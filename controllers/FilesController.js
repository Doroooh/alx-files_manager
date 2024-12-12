const { ObjectID } = require('mongodb'); // Import ObjectID for MongoDB operations
const fs = require('fs'); // File system module to handle file operations
const { v4: uuidv4 } = require('uuid'); // UUID generator for unique identifiers
const Queue = require('bull'); // Bull queue library for job processing
const { findUserByTokenId } = require('../utils/helpers'); // Helper to find user by token
const dbClient = require('../utils/db'); // Database client utility
const redisClient = require('../utils/redis'); // Redis client utility

class FilesController {
  /**
   * Create a new file or folder in the database and on disk
   */
  static async postUpload(request, response) {
    const fileQueue = new Queue('fileQueue'); // Initialize a queue for file-related jobs
    const userId = await findUserByTokenId(request); // Validate user session
    if (!userId) return response.status(401).json({ error: 'Unauthorized' });

    const { name, type, isPublic = false, parentId = 0, data } = request.body; // Extract request body fields
    if (!name) return response.status(400).json({ error: 'Missing name' }); // Ensure name is provided
    if (!type || !['folder', 'file', 'image'].includes(type)) return response.status(400).json({ error: 'Missing type' }); // Validate type
    if (!data && type !== 'folder') return response.status(400).json({ error: 'Missing data' }); // Ensure data exists for non-folder types

    if (parentId !== 0) {
      // Validate parentId and ensure parent is a folder
      const parentFile = await dbClient.files.findOne({ _id: ObjectID(parentId) });
      if (!parentFile) return response.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return response.status(400).json({ error: 'Parent is not a folder' });
    }

    let fileInserted;

    if (type === 'folder') {
      // Insert folder into the database
      fileInserted = await dbClient.files.insertOne({
        userId: ObjectID(userId),
        name,
        type,
        isPublic,
        parentId: parentId === 0 ? parentId : ObjectID(parentId),
      });
    } else {
      // Handle non-folder file creation
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager'; // Define storage path
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true }); // Create storage directory if needed

      const filenameUUID = uuidv4(); // Generate unique file identifier
      const localPath = `${folderPath}/${filenameUUID}`; // Set local file path

      const clearData = Buffer.from(data, 'base64'); // Decode file data
      await fs.promises.writeFile(localPath, clearData); // Save file to disk

      fileInserted = await dbClient.files.insertOne({
        userId: ObjectID(userId),
        name,
        type,
        isPublic,
        parentId: parentId === 0 ? parentId : ObjectID(parentId),
        localPath,
      });

      if (type === 'image') {
        // Special handling for image files
        await fileQueue.add({ userId, fileId: fileInserted.insertedId, localPath }); // Add to processing queue
      }
    }

    return response.status(201).json({ // Respond with file details
      id: fileInserted.ops[0]._id, userId, name, type, isPublic, parentId,
    });
  }

  /**
   * Fetch file details by ID
   */
  static async getShow(request, response) {
    const token = request.headers['x-token']; // Get user token from headers
    if (!token) return response.status(401).json({ error: 'Unauthorized' }); // Validate token

    const keyID = await redisClient.get(`auth_${token}`); // Get user ID from Redis
    if (!keyID) return response.status(401).json({ error: 'Unauthorized' });

    const fileDocument = await dbClient.files.findOne({ 
      _id: ObjectID(request.params.id), 
      userId: ObjectID(keyID),
    }); // Fetch file by ID

    if (!fileDocument) return response.status(404).send({ error: 'Not found' }); // Ensure file exists

    return response.send({ // Respond with file details
      id: fileDocument._id,
      userId: fileDocument.userId,
      name: fileDocument.name,
      type: fileDocument.type,
      isPublic: fileDocument.isPublic,
      parentId: fileDocument.parentId,
    });
  }

  /**
   * List files owned by the user
   */
  static async getIndex(request, response) {
    const token = request.headers['x-token']; // Get user token from headers
    if (!token) return response.status(401).json({ error: 'Unauthorized' }); // Validate token

    const keyID = await redisClient.get(`auth_${token}`); // Get user ID from Redis
    if (!keyID) return response.status(401).json({ error: 'Unauthorized' });

    const parentId = request.query.parentId || '0'; // Get parent ID from query params
    const pagination = parseInt(request.query.page, 10) || 0; // Handle pagination
    const query = parentId === '0' ? {} : { parentId: ObjectID(parentId) }; // Adjust query for parentId

    const files = await dbClient.files.find(query).skip(pagination * 20).limit(20).toArray(); // Fetch files

    return response.send(files.map(file => ({ // Respond with file list
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    })));
  }
}

module.exports = FilesController;

// Importing the UUID library to generate unique tokens
const { v4: uuidv4 } = require('uuid');
// Importing the crypto module to create secure hash functions
const { createHash } = require('crypto');
// Importing the database client utility
const dbClient = require('../utils/db');
// Importing the Redis client utility
const redisClient = require('../utils/redis');

// Defining the AuthController class to manage authentication-related actions
class AuthController {
  /**
   * Handles user authentication via Basic Auth and generates a session token.
   * @param {Object} req - The HTTP request object.
   * @param {Object} res - The HTTP response object.
   */
  static async getConnect(req, res) {
    // Check if the authorization header is missing or does not use Basic Auth
    if (!req.headers.authorization || req.headers.authorization.indexOf('Basic ') === -1) {
      return res.status(401).json({ message: 'Missing Auth Header' });
    }

    // Decode the Base64 encoded credentials from the Authorization header
    const credentials = Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString('ascii');
    // Split the decoded string to extract email and password
    const [email, password] = credentials.split(':');

    // If email or password is missing, return an Unauthorized error
    if (!email || !password) return res.status(401).json({ error: 'Unauthorized' });

    // Hash the password using SHA-1 for secure comparison
    const hash = createHash('sha1').update(password).digest('hex');
    // Query the database to find a user with the provided email and hashed password
    const user = await dbClient.db.collection('users').findOne({ email, password: hash });

    // If no user is found, return an Unauthorized error
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate a unique token for the user session
    const token = uuidv4();
    const key = `auth_${token}`;

    // Store the user's ID in Redis with a 24-hour expiration time
    await redisClient.set(key, user._id.toString(), 86400);

    // Return the generated token as the response
    return res.status(200).json({ token });
  }

  /**
   * Handles user logout by invalidating the session token.
   * @param {Object} req - The HTTP request object.
   * @param {Object} res - The HTTP response object.
   */
  static async getDisconnect(req, res) {
    // Retrieve the session token from the 'x-token' header
    const token = req.headers['x-token'];
    // Check if the token exists in Redis
    const user = await redisClient.get(`auth_${token}`);

    // If no session is found, return an Unauthorized error
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete the token from Redis to invalidate the session
    await redisClient.del(`auth_${token}`);

    // Respond with a 204 No Content status indicating successful logout
    res.status(204);
    res.end();
    return null;
  }
}

// Export the AuthController class to be used in other modules
module.exports = AuthController;

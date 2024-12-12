// Importing Redis and database utility modules
const Redis = require('../utils/redis');
const DB = require('../utils/db');

// Defining the AppController class, which provides application-specific API endpoints
class AppController {
  /**
   * Handles the '/status' endpoint to check the health status of Redis and MongoDB services.
   * @param {Object} req - The HTTP request object.
   * @param {Object} res - The HTTP response object.
   */
  static getStatus(req, res) {
    // Check if both Redis and the database are alive
    if (Redis.isAlive() && DB.isAlive()) {
      // If both services are alive, return a 200 response with JSON indicating their status
      return res.status(200).json({ redis: true, db: true });
    }
    // If either service is not alive, return a 400 response with an error message
    return res.status(400).send('Redis and MongoDB not connected');
  }

  /**
   * Handles the '/stats' endpoint to get application statistics (number of users and files).
   * @param {Object} req - The HTTP request object.
   * @param {Object} res - The HTTP response object.
   */
  static getStats(req, res) {
    (async () => {
      // Asynchronously fetch the number of users from the database
      const users = await DB.nbUsers();
      // Asynchronously fetch the number of files from the database
      const files = await DB.nbFiles();
      // Return a 200 response with the number of users and files as JSON
      return res.status(200).json({ users, files });
    })();
  }
}

// Export the AppController class to be used in other modules
module.exports = AppController;

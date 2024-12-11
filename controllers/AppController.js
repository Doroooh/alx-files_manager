import redisInstance from '../utils/redis';
import databaseInstance from '../utils/db';

/**
 * A controller to handle API status and statistics.
 */
class ApplicationController {
  /**
   * Handles the GET /status endpoint.
   * Responds with the operational status of Redis and the database.
   * @param {object} request - The incoming HTTP request (not used).
   * @param {object} response - The HTTP response object.
   */
  static checkStatus(request, response) {
    const statusData = {
      redis: redisInstance.isAlive(),
      database: databaseInstance.isAlive(),
    };
    response.status(200).json(statusData);
  }

  /**
   * Handles the GET /stats endpoint.
   * Responds with the total counts of users and files in the database.
   * @param {object} request - The incoming HTTP request (not used).
   * @param {object} response - The HTTP response object.
   */
  static async fetchStatistics(request, response) {
    try {
      const [userCount, fileCount] = await Promise.all([
        databaseInstance.nbUsers(),
        databaseInstance.nbFiles(),
      ]);
      const statsData = { users: userCount, files: fileCount };
      response.status(200).json(statsData);
    } catch (error) {
      response.status(500).json({ error: 'Failed to retrieve statistics', details: error.message });
    }
  }
}

export default ApplicationController;

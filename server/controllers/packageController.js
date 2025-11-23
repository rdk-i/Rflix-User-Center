const db = require('../config/database');
const logger = require('../utils/logger');

class PackageController {
  /**
   * Get all packages
   */
  async getAllPackages(req, res, next) {
    try {
      const packages = db.prepare(`
        SELECT * FROM packages 
        WHERE isActive = 1 
        ORDER BY displayOrder ASC, durationMonths ASC
      `).all();

      res.json({
        success: true,
        data: packages
      });
    } catch (error) {
      logger.error('Get packages error:', error);
      next(error);
    }
  }

  /**
   * Get package by ID
   */
  async getPackageById(req, res, next) {
    try {
      const { id } = req.params;
      const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(id);

      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PACKAGE_NOT_FOUND',
            message: 'Package not found'
          }
        });
      }

      res.json({
        success: true,
        data: pkg
      });
    } catch (error) {
      logger.error('Get package error:', error);
      next(error);
    }
  }

  /**
   * Create package (Admin only)
   */
  async createPackage(req, res, next) {
    try {
      const { name, durationMonths, price, description, displayOrder } = req.body;

      if (!name || !durationMonths || price === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Name, durationMonths, and price are required'
          }
        });
      }

      const result = db.prepare(`
        INSERT INTO packages (name, durationMonths, price, description, displayOrder)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, durationMonths, price, description || null, displayOrder || 0);

      logger.info(`Package created: ${name}`);

      res.status(201).json({
        success: true,
        data: { id: result.lastInsertRowid }
      });
    } catch (error) {
      logger.error('Create package error:', error);
      next(error);
    }
  }

  /**
   * Update package (Admin only)
   */
  async updatePackage(req, res, next) {
    try {
      const { id } = req.params;
      const { name, durationMonths, price, description, isActive, displayOrder } = req.body;

      const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(id);
      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PACKAGE_NOT_FOUND',
            message: 'Package not found'
          }
        });
      }

      db.prepare(`
        UPDATE packages 
        SET name = COALESCE(?, name),
            durationMonths = COALESCE(?, durationMonths),
            price = COALESCE(?, price),
            description = COALESCE(?, description),
            isActive = COALESCE(?, isActive),
            displayOrder = COALESCE(?, displayOrder),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, durationMonths, price, description, isActive, displayOrder, id);

      logger.info(`Package updated: ${id}`);

      res.json({
        success: true,
        message: 'Package updated successfully'
      });
    } catch (error) {
      logger.error('Update package error:', error);
      next(error);
    }
  }

  /**
   * Delete package (Admin only)
   */
  async deletePackage(req, res, next) {
    try {
      const { id } = req.params;

      const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(id);
      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PACKAGE_NOT_FOUND',
            message: 'Package not found'
          }
        });
      }

      // Soft delete by setting isActive = 0
      db.prepare('UPDATE packages SET isActive = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

      logger.info(`Package deleted: ${id}`);

      res.json({
        success: true,
        message: 'Package deleted successfully'
      });
    } catch (error) {
      logger.error('Delete package error:', error);
      next(error);
    }
  }
}

module.exports = new PackageController();

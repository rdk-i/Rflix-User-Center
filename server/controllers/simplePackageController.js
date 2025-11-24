const db = require('../config/database');
const logger = require('../utils/logger');

class SimplePackageController {
  /**
   * Get all active packages
   */
  async getAllPackages(req, res, next) {
    try {
      const packages = db.prepare(`
        SELECT id, name, duration_days, price, is_active 
        FROM packages 
        WHERE is_active = 1 
        ORDER BY price ASC
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
      const pkg = db.prepare('SELECT id, name, duration_days, price, is_active FROM packages WHERE id = ?').get(id);

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
      const { name, duration_days, price } = req.body;

      if (!name || !duration_days || price === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Name, duration_days, and price are required'
          }
        });
      }

      const result = db.prepare(`
        INSERT INTO packages (name, duration_days, price)
        VALUES (?, ?, ?)
      `).run(name, duration_days, price);

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
      const { name, duration_days, price, is_active } = req.body;

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
            duration_days = COALESCE(?, duration_days),
            price = COALESCE(?, price),
            is_active = COALESCE(?, is_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, duration_days, price, is_active, id);

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
   * Toggle package status (Admin only)
   */
  async togglePackageStatus(req, res, next) {
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

      const newStatus = pkg.is_active ? 0 : 1;
      
      db.prepare(`
        UPDATE packages 
        SET is_active = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, id);

      logger.info(`Package status toggled: ${id} -> ${newStatus ? 'active' : 'inactive'}`);

      res.json({
        success: true,
        data: { is_active: newStatus }
      });
    } catch (error) {
      logger.error('Toggle package status error:', error);
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

      // Check if package is in use
      const usageCount = db.prepare('SELECT COUNT(*) as count FROM user_expiration WHERE packageId = ?').get(id).count;
      
      if (usageCount > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PACKAGE_IN_USE',
            message: 'Cannot delete package that is in use by users'
          }
        });
      }

      db.prepare('DELETE FROM packages WHERE id = ?').run(id);

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

module.exports = new SimplePackageController();
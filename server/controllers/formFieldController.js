const db = require('../config/database');
const logger = require('../utils/logger');

class FormFieldController {
  /**
   * Get all registration fields (public)
   */
  getFields(req, res) {
    try {
      const fields = db.prepare('SELECT * FROM registration_fields ORDER BY sort_order ASC').all();
      
      // Parse options JSON
      const formattedFields = fields.map(field => ({
        ...field,
        options: field.options ? JSON.parse(field.options) : null,
        required: !!field.required,
        is_system: !!field.is_system
      }));

      res.json({
        success: true,
        data: formattedFields
      });
    } catch (error) {
      logger.error('Get form fields error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch form fields' }
      });
    }
  }

  /**
   * Add a new field (admin)
   */
  addField(req, res) {
    try {
      const { field_key, label, type, placeholder, required, sort_order, validation_pattern, validation_message, options } = req.body;

      if (!field_key || !label || !type) {
        return res.status(400).json({ success: false, error: { message: 'Key, Label and Type are required' } });
      }

      const stmt = db.prepare(`
        INSERT INTO registration_fields (field_key, label, type, placeholder, required, sort_order, validation_pattern, validation_message, options, is_system)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      const result = stmt.run(
        field_key, 
        label, 
        type, 
        placeholder, 
        required ? 1 : 0, 
        sort_order || 99, 
        validation_pattern, 
        validation_message, 
        options ? JSON.stringify(options) : null
      );

      res.status(201).json({
        success: true,
        data: { id: result.lastInsertRowid }
      });
    } catch (error) {
      logger.error('Add field error:', error);
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * Update a field (admin)
   */
  updateField(req, res) {
    try {
      const { id } = req.params;
      const { label, placeholder, required, sort_order, validation_pattern, validation_message, options } = req.body;

      // Check if system field
      const field = db.prepare('SELECT is_system FROM registration_fields WHERE id = ?').get(id);
      if (!field) return res.status(404).json({ success: false, error: { message: 'Field not found' } });

      const stmt = db.prepare(`
        UPDATE registration_fields 
        SET label = ?, placeholder = ?, required = ?, sort_order = ?, validation_pattern = ?, validation_message = ?, options = ?
        WHERE id = ?
      `);

      stmt.run(
        label, 
        placeholder, 
        required ? 1 : 0, 
        sort_order, 
        validation_pattern, 
        validation_message, 
        options ? JSON.stringify(options) : null,
        id
      );

      res.json({ success: true, data: { message: 'Field updated' } });
    } catch (error) {
      logger.error('Update field error:', error);
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * Delete a field (admin)
   */
  deleteField(req, res) {
    try {
      const { id } = req.params;
      
      const field = db.prepare('SELECT is_system FROM registration_fields WHERE id = ?').get(id);
      if (!field) return res.status(404).json({ success: false, error: { message: 'Field not found' } });
      
      if (field.is_system) {
        return res.status(403).json({ success: false, error: { message: 'Cannot delete system field' } });
      }

      db.prepare('DELETE FROM registration_fields WHERE id = ?').run(id);

      res.json({ success: true, data: { message: 'Field deleted' } });
    } catch (error) {
      logger.error('Delete field error:', error);
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}

module.exports = new FormFieldController();

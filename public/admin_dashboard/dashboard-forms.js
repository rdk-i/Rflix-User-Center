// Dashboard Forms Module - Registration Form Builder

async function loadForms() {
  const view = document.getElementById('forms-view');
  view.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold">Registration Form Builder</h2>
        <p class="text-muted text-sm">Manage custom fields for user registration</p>
      </div>
      <button onclick="openAddFieldModal()" class="neu-btn neu-btn-sm primary">+ Add Field</button>
    </div>
    
    <div class="neu-panel">
      <div id="formFieldsList">
        <div class="text-center py-8">
          <div class="loading-spinner mx-auto mb-4"></div>
          <p class="text-muted">Loading form fields...</p>
        </div>
      </div>
    </div>
    
    <!-- Add/Edit Field Modal -->
    <div id="fieldModal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title" id="modalTitle">Add Form Field</h3>
          <button class="modal-close" onclick="closeFieldModal()">×</button>
        </div>
        <div class="modal-body">
          <form id="fieldForm">
            <input type="hidden" id="fieldId">
            
            <div class="form-group">
              <label class="form-label">Field Name *</label>
              <input type="text" id="fieldName" class="neu-input" placeholder="e.g., phone, address" required>
              <small class="text-muted">Internal name (lowercase, no spaces)</small>
            </div>
            
            <div class="form-group">
              <label class="form-label">Label *</label>
              <input type="text" id="fieldLabel" class="neu-input" placeholder="e.g., Phone Number" required>
            </div>
            
            <div class="form-group">
              <label class="form-label">Type *</label>
              <select id="fieldType" class="neu-input" required>
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="tel">Phone</option>
                <option value="number">Number</option>
                <option value="textarea">Textarea</option>
                <option value="select">Dropdown</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Placeholder</label>
              <input type="text" id="fieldPlaceholder" class="neu-input" placeholder="Optional placeholder text">
            </div>
            
            <div class="form-group" id="optionsGroup" style="display: none;">
              <label class="form-label">Options (comma-separated)</label>
              <input type="text" id="fieldOptions" class="neu-input" placeholder="Option 1, Option 2, Option 3">
              <small class="text-muted">For dropdown fields</small>
            </div>
            
            <div class="form-group">
              <label class="flex items-center gap-2">
                <input type="checkbox" id="fieldRequired" class="neu-toggle">
                <span>Required Field</span>
              </label>
            </div>
            
            <div class="form-group">
              <label class="form-label">Display Order</label>
              <input type="number" id="fieldOrder" class="neu-input" value="0" min="0">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="neu-btn" onclick="closeFieldModal()">Cancel</button>
          <button class="neu-btn primary" onclick="saveField()">Save Field</button>
        </div>
      </div>
    </div>
  `;
  
  // Show/hide options field based on type
  document.getElementById('fieldType').addEventListener('change', (e) => {
    const optionsGroup = document.getElementById('optionsGroup');
    optionsGroup.style.display = e.target.value === 'select' ? 'block' : 'none';
  });
  
  // Load existing fields
  await loadFormFields();
}

async function loadFormFields() {
  try {
    const res = await fetch('/api/form-fields');
    const json = await res.json();
    
    if (json.success) {
      renderFormFields(json.data);
    } else {
      document.getElementById('formFieldsList').innerHTML = `
        <div class="text-center py-8 text-danger">
          Failed to load form fields
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading form fields:', error);
    document.getElementById('formFieldsList').innerHTML = `
      <div class="text-center py-8 text-danger">
        Error: ${error.message}
      </div>
    `;
  }
}

function renderFormFields(fields) {
  const container = document.getElementById('formFieldsList');
  
  if (fields.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8">
        <p class="text-muted mb-4">No custom fields yet</p>
        <button onclick="openAddFieldModal()" class="neu-btn neu-btn-sm primary">Add Your First Field</button>
      </div>
    `;
    return;
  }
  
  // Sort by order
  fields.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  
  container.innerHTML = `
    <div style="display: grid; gap: 1.5rem;">
      ${fields.map(field => `
        <div class="neu-panel" style="padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
                <h4 style="font-weight: 600; font-size: 1.1rem; margin: 0;">${field.label}</h4>
                ${field.isRequired ? '<span class="neu-badge" style="background: rgba(239, 68, 68, 0.2); color: var(--danger); font-size: 0.7rem;">Required</span>' : ''}
                <span class="neu-badge" style="font-size: 0.7rem;">${field.type}</span>
              </div>
              <div style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6;">
                <div style="margin-bottom: 0.5rem;">
                  <strong>Field name:</strong> <code style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${field.name}</code>
                </div>
                ${field.placeholder ? `
                  <div style="margin-bottom: 0.5rem;">
                    <strong>Placeholder:</strong> "${field.placeholder}"
                  </div>
                ` : ''}
                ${field.options ? `
                  <div style="margin-bottom: 0.5rem;">
                    <strong>Options:</strong> ${field.options}
                  </div>
                ` : ''}
                <div>
                  <strong>Order:</strong> ${field.displayOrder || 0}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
              <button onclick="editField(${field.id})" class="neu-btn neu-btn-sm" title="Edit" style="padding: 8px 12px;">✏️</button>
              <button onclick="deleteField(${field.id})" class="neu-btn neu-btn-sm" title="Delete" style="padding: 8px 12px; color: var(--danger);">🗑️</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openAddFieldModal() {
  document.getElementById('modalTitle').textContent = 'Add Form Field';
  document.getElementById('fieldForm').reset();
  document.getElementById('fieldId').value = '';
  document.getElementById('fieldModal').style.display = 'flex';
}

function closeFieldModal() {
  document.getElementById('fieldModal').style.display = 'none';
}

async function editField(id) {
  try {
    const res = await fetch('/api/form-fields');
    const json = await res.json();
    
    if (json.success) {
      const field = json.data.find(f => f.id === id);
      if (field) {
        document.getElementById('modalTitle').textContent = 'Edit Form Field';
        document.getElementById('fieldId').value = field.id;
        document.getElementById('fieldName').value = field.name;
        document.getElementById('fieldLabel').value = field.label;
        document.getElementById('fieldType').value = field.type;
        document.getElementById('fieldPlaceholder').value = field.placeholder || '';
        document.getElementById('fieldOptions').value = field.options || '';
        document.getElementById('fieldRequired').checked = field.isRequired;
        document.getElementById('fieldOrder').value = field.displayOrder;
        
        // Show options if select type
        document.getElementById('optionsGroup').style.display = 
          field.type === 'select' ? 'block' : 'none';
        
        document.getElementById('fieldModal').style.display = 'flex';
      }
    }
  } catch (error) {
    showAlert('Error loading field data', 'error');
  }
}

async function saveField() {
  const id = document.getElementById('fieldId').value;
  const data = {
    name: document.getElementById('fieldName').value,
    label: document.getElementById('fieldLabel').value,
    type: document.getElementById('fieldType').value,
    placeholder: document.getElementById('fieldPlaceholder').value,
    options: document.getElementById('fieldOptions').value,
    isRequired: document.getElementById('fieldRequired').checked,
    displayOrder: parseInt(document.getElementById('fieldOrder').value)
  };
  
  try {
    const token = localStorage.getItem('token');
    const url = id ? `/api/form-fields/${id}` : '/api/form-fields';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const json = await res.json();
    
    if (json.success) {
      showAlert(`Field ${id ? 'updated' : 'created'} successfully`, 'success');
      closeFieldModal();
      await loadFormFields();
    } else {
      showAlert(json.error?.message || 'Failed to save field', 'error');
    }
  } catch (error) {
    showAlert('Error saving field: ' + error.message, 'error');
  }
}

async function deleteField(id) {
  if (!confirm('Are you sure you want to delete this field?')) {
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/form-fields/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const json = await res.json();
    
    if (json.success) {
      showAlert('Field deleted successfully', 'success');
      await loadFormFields();
    } else {
      showAlert(json.error?.message || 'Failed to delete field', 'error');
    }
  } catch (error) {
    showAlert('Error deleting field: ' + error.message, 'error');
  }
}

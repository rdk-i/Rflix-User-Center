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
      <div class="modal-content neu-panel" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <h3 class="modal-title" id="modalTitle" style="font-size: 1.5rem; font-weight: 600; margin: 0;">Add Form Field</h3>
          <button class="neu-btn neu-btn-sm" onclick="closeFieldModal()" style="padding: 8px 12px;">✕</button>
        </div>
        
        <form id="fieldForm" onsubmit="saveField(event)">
          <input type="hidden" id="fieldId">
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: var(--text); font-weight: 500; margin-bottom: 0.5rem;">
              Field Name <span style="color: var(--danger);">*</span>
            </label>
            <input type="text" id="fieldName" class="neu-input" placeholder="e.g., phone, address" required>
            <small style="display: block; color: var(--text-muted); margin-top: 0.5rem; font-size: 0.85rem;">
              Internal name (lowercase, no spaces)
            </small>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: var(--text); font-weight: 500; margin-bottom: 0.5rem;">
              Label <span style="color: var(--danger);">*</span>
            </label>
            <input type="text" id="fieldLabel" class="neu-input" placeholder="e.g., Phone Number" required>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: var(--text); font-weight: 500; margin-bottom: 0.5rem;">
              Type <span style="color: var(--danger);">*</span>
            </label>
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
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: var(--text); font-weight: 500; margin-bottom: 0.5rem;">
              Placeholder
            </label>
            <input type="text" id="fieldPlaceholder" class="neu-input" placeholder="Optional placeholder text">
          </div>
          
          <div id="optionsGroup" style="margin-bottom: 1.5rem; display: none;">
            <label style="display: block; color: var(--text); font-weight: 500; margin-bottom: 0.5rem;">
              Options (comma-separated)
            </label>
            <input type="text" id="fieldOptions" class="neu-input" placeholder="Option 1, Option 2, Option 3">
            <small style="display: block; color: var(--text-muted); margin-top: 0.5rem; font-size: 0.85rem;">
              For dropdown fields
            </small>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; user-select: none;">
              <input type="checkbox" id="fieldRequired" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent);">
              <span style="color: var(--text); font-weight: 500;">Required Field</span>
            </label>
          </div>
          
          <div style="margin-bottom: 2rem;">
            <label style="display: block; color: var(--text); font-weight: 500; margin-bottom: 0.5rem;">
              Display Order
            </label>
            <input type="number" id="fieldOrder" class="neu-input" value="0" min="0">
          </div>
          
          <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button type="button" class="neu-btn" onclick="closeFieldModal()">Cancel</button>
            <button type="submit" class="neu-btn primary">Save Field</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // Add modal styles
  const style = document.createElement('style');
  style.textContent = `
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 2rem;
      backdrop-filter: blur(4px);
    }
    
    .modal-content {
      animation: modalSlideIn 0.3s ease-out;
    }
    
    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
  
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
  fields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  
  container.innerHTML = `
    <div style="display: grid; gap: 1.5rem;">
      ${fields.map(field => {
        // Use field_key from API
        const fieldName = field.field_key || field.name || 'unnamed';
        const isRequired = field.required || field.isRequired;
        
        return `
        <div class="neu-panel" style="padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
                <h4 style="font-weight: 600; font-size: 1.1rem; margin: 0;">${field.label}</h4>
                ${isRequired ? '<span class="neu-badge" style="background: rgba(239, 68, 68, 0.2); color: var(--danger); font-size: 0.7rem;">Required</span>' : ''}
                <span class="neu-badge" style="font-size: 0.7rem;">${field.type}</span>
              </div>
              <div style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6;">
                <div style="margin-bottom: 0.5rem;">
                  <strong>Field name:</strong> <code style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${fieldName}</code>
                </div>
                ${field.placeholder ? `
                  <div style="margin-bottom: 0.5rem;">
                    <strong>Placeholder:</strong> "${field.placeholder}"
                  </div>
                ` : ''}
                ${field.options ? `
                  <div style="margin-bottom: 0.5rem;">
                    <strong>Options:</strong> ${typeof field.options === 'string' ? field.options : JSON.stringify(field.options)}
                  </div>
                ` : ''}
                <div>
                  <strong>Order:</strong> ${field.sort_order || 0}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
              <button onclick="editField(${field.id})" class="neu-btn neu-btn-sm" title="Edit" style="padding: 8px 12px;">✏️</button>
              <button onclick="deleteField(${field.id})" class="neu-btn neu-btn-sm" title="Delete" style="padding: 8px 12px; color: var(--danger);">🗑️</button>
            </div>
          </div>
        </div>
      `}).join('')}
    </div>
  `;
}

function openAddFieldModal() {
  document.getElementById('modalTitle').textContent = 'Add Form Field';
  document.getElementById('fieldForm').reset();
  document.getElementById('fieldId').value = '';
  document.getElementById('optionsGroup').style.display = 'none';
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
        
        // Use field_key from API
        document.getElementById('fieldName').value = field.field_key || field.name || '';
        document.getElementById('fieldLabel').value = field.label || '';
        document.getElementById('fieldType').value = field.type || 'text';
        document.getElementById('fieldPlaceholder').value = field.placeholder || '';
        
        // Handle options (could be string or array)
        if (field.options) {
          if (typeof field.options === 'string') {
            document.getElementById('fieldOptions').value = field.options;
          } else if (Array.isArray(field.options)) {
            document.getElementById('fieldOptions').value = field.options.join(', ');
          }
        } else {
          document.getElementById('fieldOptions').value = '';
        }
        
        document.getElementById('fieldRequired').checked = field.required || field.isRequired || false;
        document.getElementById('fieldOrder').value = field.sort_order || field.displayOrder || 0;
        
        // Show options if select type
        document.getElementById('optionsGroup').style.display = 
          field.type === 'select' ? 'block' : 'none';
        
        document.getElementById('fieldModal').style.display = 'flex';
      }
    }
  } catch (error) {
    showAlert('Error loading field data: ' + error.message, 'error');
  }
}

async function saveField(event) {
  if (event) event.preventDefault();
  
  const id = document.getElementById('fieldId').value;
  const data = {
    field_key: document.getElementById('fieldName').value,
    label: document.getElementById('fieldLabel').value,
    type: document.getElementById('fieldType').value,
    placeholder: document.getElementById('fieldPlaceholder').value,
    options: document.getElementById('fieldOptions').value,
    required: document.getElementById('fieldRequired').checked ? 1 : 0,
    sort_order: parseInt(document.getElementById('fieldOrder').value)
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

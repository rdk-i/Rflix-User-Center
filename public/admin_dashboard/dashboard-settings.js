// Dashboard Settings Module

async function loadSettings() {
  const view = document.getElementById('settings-view');
  view.innerHTML = `
    <h2 class="text-2xl font-bold mb-6">System Settings</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      <!-- General Settings -->
      <div class="neu-panel">
        <h3 class="text-xl font-bold mb-4">General Settings</h3>
        <div class="form-group">
          <label class="block text-muted mb-2">Site Name</label>
          <input type="text" id="site-name" class="neu-input" placeholder="Loading...">
        </div>
        <div class="form-group mt-4">
          <label class="block text-muted mb-2">Admin Email</label>
          <input type="email" id="admin-email" class="neu-input" placeholder="Loading...">
        </div>
        <button id="save-general-btn" class="neu-btn primary mt-6" onclick="saveGeneralSettings()">Save Changes</button>
      </div>
      
      <!-- Jellyfin Configuration -->
      <div class="neu-panel">
        <h3 class="text-xl font-bold mb-4">Jellyfin Configuration</h3>
        <div class="form-group">
          <label class="block text-muted mb-2">Jellyfin URL</label>
          <input type="text" id="jellyfin-url" class="neu-input" placeholder="http://localhost:8096">
        </div>
        <div class="form-group mt-4">
          <label class="block text-muted mb-2">API Key</label>
          <div class="relative">
            <input type="password" id="jellyfin-api-key" class="neu-input pr-10" placeholder="****************">
            <div class="absolute right-3 top-3">
                <label class="neu-toggle">
                    <input type="checkbox" id="toggle-api-key" onchange="toggleVisibility('jellyfin-api-key')">
                    <span class="neu-toggle-slider"></span>
                </label>
            </div>
          </div>
        </div>
        <div class="flex gap-4 mt-6">
            <button id="test-jellyfin-btn" class="neu-btn" onclick="testJellyfinConnection()">Test Connection</button>
            <button id="save-jellyfin-btn" class="neu-btn primary" onclick="saveJellyfinConfig()">Save Configuration</button>
        </div>
        <div id="jellyfin-status" class="mt-4 text-sm hidden"></div>
      </div>

      <!-- Change Password -->
      <div class="neu-panel md:col-span-2">
        <h3 class="text-xl font-bold mb-4">Change Admin Password</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="form-group">
                <label class="block text-muted mb-2">Current Password</label>
                <input type="password" id="current-password" class="neu-input">
            </div>
            <div class="form-group">
                <label class="block text-muted mb-2">New Password</label>
                <input type="password" id="new-password" class="neu-input">
            </div>
            <div class="form-group">
                <label class="block text-muted mb-2">Confirm New Password</label>
                <input type="password" id="confirm-password" class="neu-input">
            </div>
        </div>
        <button id="change-password-btn" class="neu-btn mt-6 danger" onclick="changeAdminPassword()">Update Password</button>
      </div>

    </div>
  `;

  // Fetch current settings
  try {
    const response = await fetch('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('site-name').value = result.data.siteName || '';
      document.getElementById('admin-email').value = localStorage.getItem('userEmail') || ''; // Fallback or fetch from profile
      document.getElementById('jellyfin-url').value = result.data.jellyfinUrl || '';
      // API Key is usually hidden/masked, we might not want to populate it fully if it's sensitive, 
      // but for editing we might need it. Let's leave it empty placeholder if set.
      if (result.data.jellyfinUrl) {
          document.getElementById('jellyfin-api-key').placeholder = "Stored (Enter new to update)";
      }
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    showAlert('Failed to load settings', 'error');
  }
}

async function saveGeneralSettings() {
  const siteName = document.getElementById('site-name').value;
  const adminEmail = document.getElementById('admin-email').value;
  const btn = document.getElementById('save-general-btn');

  setLoading(btn, true);
  try {
    const response = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ siteName, adminEmail })
    });
    const result = await response.json();
    if (result.success) {
      showAlert('Settings updated successfully', 'success');
    } else {
      showAlert(result.error?.message || 'Failed to update settings', 'error');
    }
  } catch (error) {
    showAlert('Network error', 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function testJellyfinConnection() {
  const url = document.getElementById('jellyfin-url').value;
  const apiKey = document.getElementById('jellyfin-api-key').value;
  const btn = document.getElementById('test-jellyfin-btn');
  const statusEl = document.getElementById('jellyfin-status');

  if (!url || !apiKey) {
      showAlert('URL and API Key are required for testing', 'warning');
      return;
  }

  setLoading(btn, true);
  statusEl.classList.add('hidden');
  
  try {
    const response = await fetch('/api/admin/test-jellyfin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ url, apiKey })
    });
    const result = await response.json();
    
    statusEl.classList.remove('hidden');
    if (result.success) {
      statusEl.innerHTML = '<span class="text-green-500">✓ Connection successful!</span>';
      showAlert('Connection successful', 'success');
    } else {
      statusEl.innerHTML = `<span class="text-red-500">✗ Connection failed: ${result.error?.message}</span>`;
      showAlert('Connection failed', 'error');
    }
  } catch (error) {
    statusEl.innerHTML = '<span class="text-red-500">✗ Network error</span>';
  } finally {
    setLoading(btn, false);
  }
}

async function saveJellyfinConfig() {
  const url = document.getElementById('jellyfin-url').value;
  const apiKey = document.getElementById('jellyfin-api-key').value;
  const btn = document.getElementById('save-jellyfin-btn');

  if (!url || !apiKey) {
      showAlert('URL and API Key are required', 'warning');
      return;
  }

  setLoading(btn, true);
  try {
    const response = await fetch('/api/admin/update-jellyfin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ url, apiKey })
    });
    const result = await response.json();
    if (result.success) {
      showAlert('Jellyfin configuration saved', 'success');
    } else {
      showAlert(result.error?.message || 'Failed to save configuration', 'error');
    }
  } catch (error) {
    showAlert('Network error', 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function changeAdminPassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const btn = document.getElementById('change-password-btn');

    if (!currentPassword || !newPassword || !confirmPassword) {
        showAlert('All fields are required', 'warning');
        return;
    }

    if (newPassword !== confirmPassword) {
        showAlert('New passwords do not match', 'error');
        return;
    }

    setLoading(btn, true);
    try {
        const response = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert('Password updated successfully', 'success');
            // Clear fields
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
        } else {
            showAlert(result.error?.message || 'Failed to update password', 'error');
        }
    } catch (error) {
        showAlert('Network error', 'error');
    } finally {
        setLoading(btn, false);
    }
}

function toggleVisibility(id) {
    const input = document.getElementById(id);
    if (input.type === 'password') {
        input.type = 'text';
    } else {
        input.type = 'password';
    }
}

function setLoading(btn, isLoading) {
    if (isLoading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = 'Processing...';
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        btn.innerText = btn.dataset.originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

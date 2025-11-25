// Dashboard Settings Module

async function loadSettings() {
  const view = document.getElementById('settings-view');
  view.innerHTML = `
    <h2 class="text-2xl font-bold mb-6">System Settings</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="neu-panel">
        <h3 class="text-xl font-bold mb-4">General Settings</h3>
        <div class="form-group">
          <label class="block text-muted mb-2">Site Name</label>
          <input type="text" class="neu-input" value="Rflix User Center">
        </div>
        <div class="form-group mt-4">
          <label class="block text-muted mb-2">Admin Email</label>
          <input type="email" class="neu-input" value="admin@rflix.net">
        </div>
        <button class="neu-btn mt-6">Save Changes</button>
      </div>
      
      <div class="neu-panel">
        <h3 class="text-xl font-bold mb-4">Jellyfin Configuration</h3>
        <div class="form-group">
          <label class="block text-muted mb-2">Jellyfin URL</label>
          <input type="text" class="neu-input" value="http://localhost:8096">
        </div>
        <div class="form-group mt-4">
          <label class="block text-muted mb-2">API Key</label>
          <input type="password" class="neu-input" value="****************">
        </div>
        <button class="neu-btn mt-6">Test Connection</button>
      </div>
    </div>
  `;
}

// Dashboard Logs Module

async function loadLogs() {
  const view = document.getElementById('logs-view');
  view.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">System Logs</h2>
      <button class="neu-btn neu-btn-sm">Clear Logs</button>
    </div>
    <div class="neu-panel">
      <div class="font-mono text-sm text-muted" style="max-height: 400px; overflow-y: auto;">
        <div class="py-1 border-b border-gray-800">[INFO] System started at ${new Date().toLocaleString()}</div>
        <div class="py-1 border-b border-gray-800">[INFO] Database connected successfully</div>
        <div class="py-1 border-b border-gray-800">[INFO] Jellyfin service checked: Connected</div>
        <div class="py-1 border-b border-gray-800">[AUTH] Admin user logged in</div>
      </div>
    </div>
  `;
}

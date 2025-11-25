// Dashboard Pending Requests Module

async function loadPending() {
  const view = document.getElementById('pending-view');
  view.innerHTML = `
    <h2 class="text-2xl font-bold mb-6">Pending Requests</h2>
    <div class="neu-panel">
      <div class="text-center py-8 text-muted">
        <p class="text-xl mb-2">📭</p>
        <p>No pending requests found.</p>
      </div>
    </div>
  `;
  
  // In the future, fetch actual pending data here
}

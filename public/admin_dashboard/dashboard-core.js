// Dashboard Core - Main functionality
// This file handles authentication, navigation, and theme

// Theme Toggle
function toggleTheme() {
  const body = document.body;
  const btn = document.querySelector('.theme-toggle button');
  
  body.classList.toggle('light-mode');
  
  if (body.classList.contains('light-mode')) {
    btn.textContent = 'Light';
    localStorage.setItem('theme', 'light');
  } else {
    btn.textContent = 'Dark';
    localStorage.setItem('theme', 'dark');
  }
}

// Initialize Theme
if (localStorage.getItem('theme') === 'light') {
  document.body.classList.add('light-mode');
  const btn = document.querySelector('.theme-toggle button');
  if (btn) btn.textContent = 'Light';
}

// Check Authentication
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/admin';
}

// Navigation Logic
document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', (e) => {
    // Skip if it's a link to another page
    if (item.querySelector('a').getAttribute('href') !== '#') {
      return;
    }
    
    e.preventDefault();
    
    // Update active state
    document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');
    
    // Show target view
    const targetId = item.dataset.page + '-view';
    document.querySelectorAll('.view-section').forEach((view) => view.classList.add('hidden'));
    const targetView = document.getElementById(targetId);
    if (targetView) {
      targetView.classList.remove('hidden');
      
      // Load content for the view
      loadViewContent(item.dataset.page);
    }
  });
});

// Load view content dynamically
function loadViewContent(page) {
  switch(page) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'users':
      if (typeof loadUsers === 'function') loadUsers();
      break;
    case 'pending':
      if (typeof loadPending === 'function') loadPending();
      break;
    case 'logs':
      if (typeof loadLogs === 'function') loadLogs();
      break;
    case 'settings':
      if (typeof loadSettings === 'function') loadSettings();
      break;
    case 'forms':
      if (typeof loadForms === 'function') loadForms();
      break;
  }
}

// Logout
function logout() {
  localStorage.removeItem('token');
  window.location.href = '/admin';
}

// Load Dashboard Data
async function loadDashboardData() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const json = await res.json();
    
    if (json.success) {
      document.getElementById('totalUsers').textContent = json.data.totalUsers;
      document.getElementById('nowPlaying').textContent = json.data.nowPlaying;
      document.getElementById('pendingReqs').textContent = json.data.pendingRequests;
      
      // Update Jellyfin Status
      const jfStatus = document.getElementById('jellyfinStatus');
      if (json.data.jellyfinConnected) {
        jfStatus.textContent = 'Connected';
        jfStatus.classList.add('active');
      } else {
        jfStatus.textContent = 'Disconnected';
        jfStatus.classList.remove('active');
      }
      
      // Load recent activity
      loadRecentActivity(json.data.recentActivity);
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
}

// Load Recent Activity
function loadRecentActivity(activities) {
  const container = document.getElementById('recentActivity');
  if (!activities || activities.length === 0) {
    container.innerHTML = '<p class="text-muted">No recent activity</p>';
    return;
  }
  
  container.innerHTML = activities.slice(0, 5).map(activity => `
    <div class="flex justify-between items-center py-2 border-b border-gray-700">
      <span>${activity.message}</span>
      <span class="text-xs text-muted">${new Date(activity.timestamp).toLocaleString()}</span>
    </div>
  `).join('');
}

// Utility: Show Alert
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'neu-panel';
  alertDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; padding: 1rem; border-left: 4px solid;';
  
  switch (type) {
    case 'success':
      alertDiv.style.borderColor = '#10b981';
      alertDiv.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      alertDiv.style.color = '#10b981';
      break;
    case 'error':
      alertDiv.style.borderColor = '#ef4444';
      alertDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      alertDiv.style.color = '#ef4444';
      break;
    case 'warning':
      alertDiv.style.borderColor = '#fbbf24';
      alertDiv.style.backgroundColor = 'rgba(251, 191, 36, 0.1)';
      alertDiv.style.color = '#fbbf24';
      break;
    default:
      alertDiv.style.borderColor = '#6366f1';
      alertDiv.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
      alertDiv.style.color = '#6366f1';
  }
  
  alertDiv.textContent = message;
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.style.opacity = '0';
    alertDiv.style.transition = 'opacity 0.3s ease';
    setTimeout(() => alertDiv.remove(), 300);
  }, 3000);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  loadDashboardData();
});

console.log('Dashboard Core loaded');

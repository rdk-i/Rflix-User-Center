// Subscription Management JavaScript
// Handles all subscription-related functionality

const SubscriptionManager = {
  currentTab: 'packages',
  packages: [],
  subscriptions: [],
  analytics: null,
  payments: [],

  // Initialize subscription management
  init() {
    console.log('Initializing Subscription Manager...');
    this.loadPackages();
    this.setupEventListeners();
  },

  // Setup event listeners
  setupEventListeners() {
    // Tab switching is handled by onclick in HTML
    console.log('Event listeners setup complete');
  },

  // Switch between tabs
  switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Load data for the tab
    switch (tabName) {
      case 'packages':
        this.loadPackages();
        break;
      case 'subscriptions':
        this.loadSubscriptions();
        break;
      case 'analytics':
        this.loadAnalytics();
        break;
      case 'payments':
        this.loadPayments();
        break;
    }
  },

  // Load packages
  async loadPackages() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/subscriptions/packages', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      
      if (data.success) {
        this.packages = data.data;
        this.renderPackages();
      } else {
        this.showError('Failed to load packages');
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      this.showError('Error loading packages');
    }
  },

  // Render packages
  renderPackages() {
    const grid = document.getElementById('packagesGrid');
    
    if (!this.packages || this.packages.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-title">No Packages Yet</div>
          <div class="empty-state-description">Create your first subscription package to get started</div>
          <button onclick="SubscriptionManager.openCreatePackageModal()" class="neu-btn">Create Package</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.packages.map(pkg => `
      <div class="package-card ${pkg.featured ? 'featured' : ''}">
        <div class="package-header">
          <div class="package-name">${pkg.name}</div>
          <div class="package-price">
            $${pkg.price} <span>/ ${pkg.duration} days</span>
          </div>
          <div class="package-duration">${Math.floor(pkg.duration / 30)} month${Math.floor(pkg.duration / 30) > 1 ? 's' : ''}</div>
        </div>
        
        <div class="package-description">${pkg.description || 'No description'}</div>
        
        <div class="package-status ${pkg.status}">${pkg.status}</div>
        
        <div class="package-actions">
          <button onclick="SubscriptionManager.editPackage(${pkg.id})" class="neu-btn neu-btn-sm" style="flex: 1;">Edit</button>
          <button onclick="SubscriptionManager.togglePackageStatus(${pkg.id})" class="theme-btn" style="flex: 1;">${pkg.status === 'active' ? 'Deactivate' : 'Activate'}</button>
          <button onclick="SubscriptionManager.deletePackage(${pkg.id})" class="neu-btn neu-btn-sm" style="background: rgba(239, 68, 68, 0.2); color: #ef4444;">Delete</button>
        </div>
        
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.875rem; color: var(--text-muted);">
          Active Subscriptions: ${pkg.activeSubscriptions || 0}
        </div>
      </div>
    `).join('');
  },

  // Load subscriptions
  async loadSubscriptions() {
    try {
      const token = localStorage.getItem('token');
      // Note: This endpoint might need to be created in backend
      const res = await fetch('/api/subscriptions/all', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      
      if (data.success) {
        this.subscriptions = data.data;
        this.renderSubscriptions();
      } else {
        this.showSubscriptionsPlaceholder();
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      this.showSubscriptionsPlaceholder();
    }
  },

  // Render subscriptions
  renderSubscriptions() {
    const tbody = document.getElementById('subscriptionsTableBody');
    
    if (!this.subscriptions || this.subscriptions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No active subscriptions</td></tr>';
      return;
    }

    tbody.innerHTML = this.subscriptions.map(sub => `
      <tr>
        <td>${sub.userName || 'N/A'}</td>
        <td>${sub.packageName}</td>
        <td><span class="neu-badge ${sub.status}">${sub.status}</span></td>
        <td>${new Date(sub.startDate).toLocaleDateString()}</td>
        <td>${new Date(sub.endDate).toLocaleDateString()}</td>
        <td>$${sub.price}</td>
        <td>
          <button onclick="SubscriptionManager.viewSubscription(${sub.id})" class="neu-btn neu-btn-sm">View</button>
        </td>
      </tr>
    `).join('');
  },

  // Show subscriptions placeholder
  showSubscriptionsPlaceholder() {
    const tbody = document.getElementById('subscriptionsTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading subscriptions...</td></tr>';
  },

  // Load analytics
  async loadAnalytics() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/subscriptions/analytics/overview', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      
      if (data.success) {
        this.analytics = data.data;
        this.renderAnalytics();
      } else {
        this.showAnalyticsPlaceholder();
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      this.showAnalyticsPlaceholder();
    }
  },

  // Render analytics
  renderAnalytics() {
    if (!this.analytics) {
      this.showAnalyticsPlaceholder();
      return;
    }

    document.getElementById('totalRevenue').textContent = `$${this.analytics.totalRevenue || 0}`;
    document.getElementById('activeSubscriptions').textContent = this.analytics.activeSubscriptions || 0;
    document.getElementById('churnRate').textContent = `${this.analytics.churnRate || 0}%`;
    document.getElementById('growthRate').textContent = `${this.analytics.growthRate || 0}%`;
  },

  // Show analytics placeholder
  showAnalyticsPlaceholder() {
    document.getElementById('totalRevenue').textContent = '-';
    document.getElementById('activeSubscriptions').textContent = '-';
    document.getElementById('churnRate').textContent = '-';
    document.getElementById('growthRate').textContent = '-';
  },

  // Load payments
  async loadPayments() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/subscriptions/payments/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      
      if (data.success) {
        this.payments = data.data;
        this.renderPayments();
      } else {
        this.showPaymentsPlaceholder();
      }
    } catch (error) {
      console.error('Error loading payments:', error);
      this.showPaymentsPlaceholder();
    }
  },

  // Render payments
  renderPayments() {
    const tbody = document.getElementById('paymentsTableBody');
    
    if (!this.payments || this.payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No payment history</td></tr>';
      return;
    }

    tbody.innerHTML = this.payments.map(payment => `
      <tr>
        <td>${new Date(payment.createdAt).toLocaleDateString()}</td>
        <td>${payment.userName || 'N/A'}</td>
        <td>${payment.packageName}</td>
        <td>$${payment.amount}</td>
        <td>${payment.paymentMethod}</td>
        <td><span class="neu-badge ${payment.status}">${payment.status}</span></td>
        <td>
          <button onclick="SubscriptionManager.viewPayment(${payment.id})" class="neu-btn neu-btn-sm">View</button>
        </td>
      </tr>
    `).join('');
  },

  // Show payments placeholder
  showPaymentsPlaceholder() {
    const tbody = document.getElementById('paymentsTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading payments...</td></tr>';
  },

  // Open create package modal
  openCreatePackageModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Create New Package</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createPackageForm" onsubmit="SubscriptionManager.createPackage(event)">
            <div class="form-group">
              <label class="form-label">Package Name</label>
              <input type="text" name="name" class="form-input" required placeholder="e.g., Premium Monthly">
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea name="description" class="form-input form-textarea" placeholder="Package description..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Price ($)</label>
              <input type="number" name="price" class="form-input" required step="0.01" min="0" placeholder="9.99">
            </div>
            <div class="form-group">
              <label class="form-label">Duration (days)</label>
              <input type="number" name="duration" class="form-input" required min="1" placeholder="30">
            </div>
            <div class="modal-footer">
              <button type="button" class="neu-btn" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
              <button type="submit" class="neu-btn" style="background: var(--accent); color: var(--bg);">Create Package</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  // Create package
  async createPackage(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const packageData = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price')),
      duration: parseInt(formData.get('duration')),
      status: 'active'
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/subscriptions/packages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(packageData)
      });

      const data = await res.json();
      
      if (data.success) {
        this.showSuccess('Package created successfully');
        form.closest('.modal-overlay').remove();
        this.loadPackages();
      } else {
        this.showError(data.error?.message || 'Failed to create package');
      }
    } catch (error) {
      console.error('Error creating package:', error);
      this.showError('Error creating package');
    }
  },

  // Edit package
  editPackage(id) {
    const pkg = this.packages.find(p => p.id === id);
    if (!pkg) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Edit Package</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="editPackageForm" onsubmit="SubscriptionManager.updatePackage(event, ${id})">
            <div class="form-group">
              <label class="form-label">Package Name</label>
              <input type="text" name="name" class="form-input" required value="${pkg.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea name="description" class="form-input form-textarea">${pkg.description || ''}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Price ($)</label>
              <input type="number" name="price" class="form-input" required step="0.01" min="0" value="${pkg.price}">
            </div>
            <div class="form-group">
              <label class="form-label">Duration (days)</label>
              <input type="number" name="duration" class="form-input" required min="1" value="${pkg.duration}">
            </div>
            <div class="modal-footer">
              <button type="button" class="neu-btn" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
              <button type="submit" class="neu-btn" style="background: var(--accent); color: var(--bg);">Update Package</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  // Update package
  async updatePackage(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const packageData = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price')),
      duration: parseInt(formData.get('duration'))
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/subscriptions/packages/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(packageData)
      });

      const data = await res.json();
      
      if (data.success) {
        this.showSuccess('Package updated successfully');
        form.closest('.modal-overlay').remove();
        this.loadPackages();
      } else {
        this.showError(data.error?.message || 'Failed to update package');
      }
    } catch (error) {
      console.error('Error updating package:', error);
      this.showError('Error updating package');
    }
  },

  // Toggle package status
  async togglePackageStatus(id) {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/subscriptions/packages/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      
      if (data.success) {
        this.showSuccess(`Package ${data.data.status}`);
        this.loadPackages();
      } else {
        this.showError(data.error?.message || 'Failed to toggle package status');
      }
    } catch (error) {
      console.error('Error toggling package status:', error);
      this.showError('Error toggling package status');
    }
  },

  // Delete package
  async deletePackage(id) {
    if (!confirm('Are you sure you want to delete this package?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/subscriptions/packages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      
      if (data.success) {
        this.showSuccess('Package deleted successfully');
        this.loadPackages();
      } else {
        this.showError(data.error?.message || 'Failed to delete package');
      }
    } catch (error) {
      console.error('Error deleting package:', error);
      this.showError('Error deleting package');
    }
  },

  // Refresh all data
  refreshData() {
    switch (this.currentTab) {
      case 'packages':
        this.loadPackages();
        break;
      case 'subscriptions':
        this.loadSubscriptions();
        break;
      case 'analytics':
        this.loadAnalytics();
        break;
      case 'payments':
        this.loadPayments();
        break;
    }
  },

  // Export data
  exportData() {
    alert('Export functionality will be implemented soon');
  },

  // Show success message
  showSuccess(message) {
    this.showToast(message, 'success');
  },

  // Show error message
  showError(message) {
    this.showToast(message, 'error');
  },

  // Show toast notification
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type}`;
    toast.textContent = message;
    toast.style.cssText = 'position: fixed; top: 2rem; right: 2rem; z-index: 9999; min-width: 300px;';
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// Global functions for onclick handlers
function switchSubscriptionTab(tabName) {
  SubscriptionManager.switchTab(tabName);
}

function refreshSubscriptionData() {
  SubscriptionManager.refreshData();
}

function exportSubscriptionData() {
  SubscriptionManager.exportData();
}

function openCreatePackageModal() {
  SubscriptionManager.openCreatePackageModal();
}

// Initialize when subscription view is shown
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on subscription view
  const subscriptionView = document.getElementById('subscriptions-view');
  if (subscriptionView && !subscriptionView.classList.contains('hidden')) {
    SubscriptionManager.init();
  }
});

console.log('Subscription Manager loaded');

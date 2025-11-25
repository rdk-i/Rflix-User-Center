// Dashboard Users Module

async function loadUsers() {
  const view = document.getElementById('users-view');
  view.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">User Management</h2>
      <button onclick="loadUsers()" class="neu-btn neu-btn-sm">🔄 Refresh</button>
    </div>
    <div class="neu-panel overflow-hidden">
      <div class="overflow-x-auto">
        <table class="neu-table w-full" id="usersTable">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Package</th>
              <th>Expiration</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            <tr><td colspan="6" class="text-center py-4">Loading users...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();

    if (json.success) {
      renderUsersTable(json.data);
    } else {
      document.getElementById('usersTableBody').innerHTML = `
        <tr><td colspan="6" class="text-center py-4 text-danger">Failed to load users</td></tr>
      `;
    }
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('usersTableBody').innerHTML = `
      <tr><td colspan="6" class="text-center py-4 text-danger">Error loading data</td></tr>
    `;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => {
    const statusClass = user.is_active ? 'text-success' : 'text-danger';
    const statusText = user.is_active ? 'Active' : 'Inactive';
    // Handle package name safely
    const packageName = user.packageName || user.package || 'No Package';
    // Format expiration date
    let expDate = '-';
    if (user.expirationDate) {
        expDate = new Date(user.expirationDate).toLocaleDateString();
    }

    return `
      <tr>
        <td class="font-bold">${user.username}</td>
        <td class="text-muted">${user.email}</td>
        <td><span class="neu-badge">${packageName}</span></td>
        <td>${expDate}</td>
        <td class="${statusClass}">${statusText}</td>
        <td>
          <button class="neu-btn neu-btn-sm" onclick="editUser(${user.id})">✏️</button>
          <button class="neu-btn neu-btn-sm text-danger" onclick="deleteUser(${user.id})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Placeholder for edit/delete functions
function editUser(id) {
  alert('Edit user functionality coming soon for ID: ' + id);
}

function deleteUser(id) {
  if(confirm('Are you sure you want to delete this user?')) {
      alert('Delete functionality coming soon');
  }
}

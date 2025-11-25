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
    const res = await fetch('/api/admin/users/jellyfin', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();

    if (json.success) {
      renderUsersTable(json.data);
    } else {
      document.getElementById('usersTableBody').innerHTML = `
        <tr><td colspan="6" class="text-center py-4 text-danger">
          Failed to load users: ${json.error?.message || 'Unknown error'}
        </td></tr>
      `;
    }
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('usersTableBody').innerHTML = `
      <tr><td colspan="6" class="text-center py-4 text-danger">Error loading data: ${error.message}</td></tr>
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
    // Jellyfin user data structure
    const username = user.Name || 'Unknown';
    const userId = user.Id;
    const isDisabled = user.Policy?.IsDisabled || false;
    
    // Local database data
    const email = user.email || '-';
    const packageName = user.package || 'No Package';
    
    // Format expiration date
    let expDate = '-';
    if (user.expirationDate) {
      const date = new Date(user.expirationDate);
      expDate = date.toLocaleDateString('id-ID', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      
      // Check if expired
      if (date < new Date()) {
        expDate = `<span class="text-danger">${expDate} (Expired)</span>`;
      }
    }
    
    // Status
    const statusClass = !isDisabled ? 'text-success' : 'text-danger';
    const statusText = !isDisabled ? 'Active' : 'Disabled';

    return `
      <tr>
        <td class="font-bold">${username}</td>
        <td class="text-muted">${email}</td>
        <td><span class="neu-badge">${packageName}</span></td>
        <td>${expDate}</td>
        <td class="${statusClass}">${statusText}</td>
        <td>
          <button class="neu-btn neu-btn-sm" onclick="editUser('${userId}', '${username}')" title="Edit User">✏️</button>
          <button class="neu-btn neu-btn-sm text-danger" onclick="deleteUser('${userId}', '${username}')" title="Delete User">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Edit user function
function editUser(userId, username) {
  showAlert(`Edit functionality for user "${username}" is coming soon!`, 'info');
  console.log('Edit user:', userId, username);
  // TODO: Implement edit modal
}

// Delete user function
async function deleteUser(userId, username) {
  if(!confirm(`Are you sure you want to delete user "${username}"?\n\nThis will remove the user from both Jellyfin and the local database.`)) {
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const json = await res.json();
    
    if (json.success) {
      showAlert(`User "${username}" deleted successfully`, 'success');
      loadUsers(); // Reload the table
    } else {
      showAlert(`Failed to delete user: ${json.error?.message || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    showAlert(`Error deleting user: ${error.message}`, 'error');
  }
}

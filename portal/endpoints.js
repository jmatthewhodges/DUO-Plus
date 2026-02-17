/**
 * PORTAL_METHODS — method definitions for the DUO+ API testing portal.
 *
 * Each entry describes a named API operation that the portal UI renders as
 * a clickable card.  Add new operations by copying a block below.
 *
 * Shape:
 *   { id, label, category, description, endpoint: { method, path, body?, headers? } }
 */
window.PORTAL_METHODS = [

  /* ── Auth ─────────────────────────────────────────────── */

  {
    id: 'CreateUser',
    label: 'Create User',
    category: 'Auth',
    description: 'Register a new client account with all required fields.',
    endpoint: {
      method: 'POST',
      path: 'register.php',
      body: {
        firstName: 'John',
        middleInitial: 'A',
        lastName: 'Doe',
        dob: '1990-01-15',
        sex: 'M',
        phone: '5551234567'
      }
    }
  },

  {
    id: 'LoginUser',
    label: 'Login User',
    category: 'Auth',
    description: 'Authenticate a client with email and password.',
    endpoint: {
      method: 'POST',
      path: 'login.php',
      body: {
        email: 'user@example.com',
        password: 'your_password'
      }
    }
  },

  /* ── Staff ────────────────────────────────────────────── */

  {
    id: 'VerifyStaffPin',
    label: 'Verify Staff PIN',
    category: 'Staff',
    description: 'Verify a staff member\'s 6-digit PIN, name, and page.',
    endpoint: {
      method: 'POST',
      path: 'verify-pin.php',
      body: {
        pin: '123456',
        name: 'Staff Name',
        pageName: 'registration-dashboard'
      }
    }
  },

  /* ── Clients ──────────────────────────────────────────── */

  {
    id: 'CheckInClient',
    label: 'Check In Client',
    category: 'Clients',
    description: 'Check in a client with one or more selected services.',
    endpoint: {
      method: 'POST',
      path: 'check-in.php',
      body: {
        clientID: '1',
        services: ['medical', 'optical', 'dental', 'haircut'],
        needsInterpreter: false
      }
    }
  },

  {
    id: 'ListRegistrationQueue',
    label: 'List Registration Queue',
    category: 'Clients',
    description: 'Fetch the current registration queue for the dashboard.',
    endpoint: {
      method: 'GET',
      path: 'registration-dashboard.php',
      body: null
    }
  }
];

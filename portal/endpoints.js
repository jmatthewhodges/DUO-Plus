/**
 * API endpoints for the testing portal.
 * Add new endpoints here: copy a block, change id, method, path, description, and body.
 */
window.PORTAL_ENDPOINTS = [
  {
    id: 'login',
    method: 'POST',
    path: 'login.php',
    description: 'Client login with email and password.',
    body: {
      email: 'user@example.com',
      password: 'your_password'
    }
  },
  {
    id: 'register',
    method: 'POST',
    path: 'register.php',
    description: 'Register new client.',
    body: {
      firstName: 'John',
      middleInitial: 'A',
      lastName: 'Doe',
      dob: '1990-01-15',
      sex: 'M',
      phone: '5551234567'
    }
  },
  {
    id: 'verify-pin',
    method: 'POST',
    path: 'verify-pin.php',
    description: 'Verify staff PIN (6 digits), name, and page name.',
    body: {
      pin: '123456',
      name: 'Staff Name',
      pageName: 'registration-dashboard'
    }
  },
  {
    id: 'check-in',
    method: 'POST',
    path: 'check-in.php',
    description: 'Check in a client with selected services.',
    body: {
      clientID: '1',
      services: ['medical', 'optical', 'dental', 'haircut'],
      needsInterpreter: false
    }
  },
  {
    id: 'registration-dashboard',
    method: 'GET',
    path: 'registration-dashboard.php',
    description: 'List clients in registration queue.',
    body: null
  }
];

/**
 * Login Handling JavaScript
 * Handles client-side login validation and form submission
 */

// Initialize login form handler when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('volunteerLoginForm');
    const errorDiv = document.getElementById('errorMessage');
    
    if (!loginForm) {
        return; // Exit if form doesn't exist on this page
    }
    
    // Handle form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Prevent default form submission
        
        // Hide any previous error messages
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        
        // Get form values
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        // Client-side validation
        if (!validateLoginForm(email, password, errorDiv)) {
            return false;
        }
        
        // Submit login request (password will be hashed before sending)
        submitLogin(email, password, errorDiv).catch(error => {
            console.error('Login submission error:', error);
            showError('An error occurred during login. Please try again.', errorDiv);
        });
    });
});

/**
 * Validate login form fields
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {HTMLElement} errorDiv - Error message container
 * @returns {boolean} - True if validation passes
 */
function validateLoginForm(email, password, errorDiv) {
    // Check if fields are filled
    if (!email || !password) {
        showError('Please fill in all fields.', errorDiv);
        return false;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Please enter a valid email address.', errorDiv);
        return false;
    }
    
    // Validate password length (minimum 6 characters)
    if (password.length < 6) {
        showError('Password must be at least 6 characters long.', errorDiv);
        return false;
    }
    
    return true;
}

/**
 * Hash password using SHA-256 before sending to server
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password as hex string
 */
async function hashPassword(password) {
    // Convert password to ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Hash the password using SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

/**
 * Submit login request to server
 * @param {string} email - User email
 * @param {string} password - User password (will be hashed before sending)
 * @param {HTMLElement} errorDiv - Error message container
 */
async function submitLogin(email, password, errorDiv) {
    try {
        // Get form action URL
        const form = document.getElementById('volunteerLoginForm');
        const actionUrl = form.getAttribute('action');
        
        // Hash password before sending to server
        const hashedPassword = await hashPassword(password);
        
        // Log password hash for verification (not exposing actual password)
        console.log('Password hash (SHA-256):', hashedPassword);
        console.log('Hash length:', hashedPassword.length, 'characters');
        
        // Create form data with hashed password
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password_hash', hashedPassword);
        
        // Submit login request
        const response = await fetch(actionUrl, {
            method: 'POST',
            body: formData
        });
        
        // Get response text first to check if it's valid JSON
        const responseText = await response.text();
        
        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            // If response is not valid JSON, it's likely a PHP error
            console.error('Invalid JSON response:', responseText);
            throw new Error('Server returned an invalid response. Please check the server logs.');
        }
        
        // Check if response indicates an error status
        if (!response.ok) {
            throw new Error(data.message || 'Network response was not ok');
        }
        
        if (data.success) {
            // Login successful - redirect or handle success
            handleLoginSuccess(data);
        } else {
            // Login failed - show error message
            showError(data.message || 'Login failed. Please check your credentials.', errorDiv);
        }
    } catch (error) {
        console.error('Login error:', error);
        
        // Provide more specific error messages
        let errorMessage = 'An error occurred during login. Please try again.';
        if (error.message.includes('invalid response')) {
            errorMessage = 'Server error. Please contact administrator if the problem persists.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showError(errorMessage, errorDiv);
    }
}

/**
 * Handle successful login
 * @param {Object} data - Response data from server
 */
function handleLoginSuccess(data) {
    // Redirect to volunteer dashboard or specified redirect URL
    if (data.redirect) {
        window.location.href = data.redirect;
    } else {
        // Default redirect to volunteer dashboard
        window.location.href = '../pages/volunteer-dashboard.html';
    }
}

/**
 * Display error message
 * @param {string} message - Error message to display
 * @param {HTMLElement} errorDiv - Error message container
 */
function showError(message, errorDiv) {
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } else {
        console.error('Login error:', message);
        alert(message); // Fallback if error div doesn't exist
    }
}


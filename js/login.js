function submitLogin() {
    const email = document.getElementById('txtClientEmail').value;
    const password = document.getElementById('txtClientPassword').value;

    fetch('../api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Store user data in sessionStorage
            sessionStorage.setItem('userData', JSON.stringify(data.data));

            Swal.fire({
                icon: 'success',
                title: 'Welcome Back!',
                text: `Hello, ${data.data.FirstName}! Redirecting you now...`,
                timer: 3500,
                timerProgressBar: true,
                showConfirmButton: false,
                allowOutsideClick: false
            }).then(() => {
                window.location.href = '../register.html';
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: data.message || 'Invalid email or password.',
                confirmButtonColor: '#174593'
            });
        }
    })
    .catch(error => {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Connection Error',
            text: 'Unable to connect to the server.',
            confirmButtonColor: '#174593'
        });
    });
}

document.getElementById('btnClientLogin').addEventListener('click', submitLogin);

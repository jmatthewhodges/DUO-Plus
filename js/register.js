function stepOneSubmit() 
{
    const strEmailInput = document.getElementById("clientRegisterEmail")
    const strPassInput = document.getElementById("clientLoginPass")

    const emailRegex = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/

    if (!emailRegex.test(strEmailInput.value))
    {
        strEmailInput.classList.add('is-invalid');
        strEmailInput.classList.remove('is-valid');
    } 
    else 
    {
        strEmailInput.classList.add('is-valid');
        strEmailInput.classList.remove('is-invalid');
    }

    if (!passwordRegex.test(strPassInput.value))
    {
        strPassInput.classList.add('is-invalid');
        strPassInput.classList.remove('is-valid');
    }
    else
    {
        strPassInput.classList.remove('is-invalid');
        strPassInput.classList.add('is-valid');
    }
}

document.getElementById('btnRegisterNext1').addEventListener('click', stepOneSubmit);

// Toggle password visibility
document.getElementById('toggleClientRegisterPass').addEventListener('change', function() 
{
    const passwordInput = document.getElementById('clientLoginPass');
    passwordInput.type = this.checked ? 'text' : 'password';
})
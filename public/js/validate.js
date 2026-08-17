
const form = document.getElementById('registerForm')

form.addEventListener('submit', (e) => {
    const password = form.querySelector('input[name="password"]').value
    const repeat = form.querySelector('input[name="passwordRepeat"]').value

    if (password === repeat) return

    e.preventDefault()

    let error = document.getElementById('err')
    if (!error) {
        error = document.createElement('span')
        error.id = 'err'
        error.className = 'c-red'

        form.insertBefore(error, form.lastElementChild)
    }

    error.innerHTML = "passwords don't match"
})

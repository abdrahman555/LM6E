// Lightweight authentication helper (demo using localStorage)
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');

    // Defensive: only attach login handler if elements exist
    if (loginForm && loginEmail && loginPassword) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginEmail.value.trim();
            const password = loginPassword.value;

            // Demo auth: look up in localStorage
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.email === email && u.password === password);

            if (user) {
                localStorage.setItem('currentUser', JSON.stringify(user));
                // Redirect based on role
                if (user.type === 'admin') {
                    window.location.href = 'index.html?mode=admin';
                } else if (user.type === 'employer') {
                    window.location.href = 'index.html?mode=employer';
                } else {
                    window.location.href = 'index.html?mode=regular';
                }
            } else {
                // Friendly UI feedback instead of alert
                showMessage('Invalid credentials. Please check your email and password.', 'error');
            }
        });
    }

        // No preventDefault on the signup link so `signup.html` navigation works normally

    // Optional: forgot password link
    const forgot = document.getElementById('forgotPassword');
    if (forgot) {
        forgot.addEventListener('click', (e) => {
            e.preventDefault();
            showMessage('If this were a production app, password recovery would start here.', 'info');
        });
    }

        // If already logged in, redirect away from login/signup pages to app
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        try {
            const user = JSON.parse(currentUser);
            if (user && user.type === 'admin') window.location.href = 'index.html?mode=admin';
            else if (user.type === 'employer') window.location.href = 'index.html?mode=employer';
            else window.location.href = 'index.html?mode=regular';
        } catch (e) {
            // invalid data: clear it
            localStorage.removeItem('currentUser');
        }
    }

        // Signup handling (if on signup page) — kept outside login logic
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = (document.getElementById('signupName') || {}).value || '';
                const email = (document.getElementById('signupEmail') || {}).value || '';
                const password = (document.getElementById('signupPassword') || {}).value || '';
                const region = (document.getElementById('signupRegion') || {}).value || '';
                const type = (document.getElementById('userType') || {}).value || 'regular';

                if (!name || !email || !password || password.length < 6) {
                    showMessage('Please fill all fields and ensure password is at least 6 characters.', 'error');
                    return;
                }

                const users = JSON.parse(localStorage.getItem('users') || '[]');
                if (users.some(u => u.email === email)) {
                    showMessage('Email already registered. Use another email or sign in.', 'error');
                    return;
                }

                users.push({ name, email, password, region, type });
                localStorage.setItem('users', JSON.stringify(users));
                showMessage('Account created — redirecting to sign in...', 'info');
                setTimeout(() => window.location.href = 'login.html', 1200);
            });
        }
});

// Small helper to show non-blocking messages (uses alert fallback)
function showMessage(text, type = 'info') {
    // Create a temporary toast element if the page supports it
    const existing = document.getElementById('globalMessage');
    if (existing) {
        existing.textContent = text;
        existing.className = 'message ' + type;
        setTimeout(() => existing.remove(), 4000);
        return;
    }

    // Create a simple message at top-right
    const div = document.createElement('div');
    div.id = 'globalMessage';
    div.className = 'message ' + type;
    div.textContent = text;
    Object.assign(div.style, {
        position: 'fixed',
        right: '20px',
        top: '20px',
        padding: '10px 14px',
        background: type === 'error' ? '#ff6b6b' : '#64ffda',
        color: type === 'error' ? '#fff' : '#06283d',
        borderRadius: '8px',
        zIndex: 9999,
        boxShadow: '0 6px 18px rgba(0,0,0,0.15)'
    });
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

// Logout helper used by other pages
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}
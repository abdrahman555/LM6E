document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signupForm');
    const steps = Array.from(document.querySelectorAll('.form-step'));
    const progressSteps = Array.from(document.querySelectorAll('.step'));
    const nextButton = document.querySelector('.next-step');
    const prevButton = document.querySelector('.prev-step');
    const submitButton = document.querySelector('.submit-form');
    let currentStep = 1;

    // Multi-step form navigation
    function showStep(step) {
        steps.forEach((stepElement, index) => {
            if (index + 1 === step) {
                stepElement.classList.add('active');
            } else {
                stepElement.classList.remove('active');
            }
        });

        progressSteps.forEach((progressStep, index) => {
            if (index + 1 <= step) {
                progressStep.classList.add('active');
            } else {
                progressStep.classList.remove('active');
            }
        });

        prevButton.style.display = step === 1 ? 'none' : 'inline-block';
        nextButton.style.display = step === steps.length ? 'none' : 'inline-block';
        submitButton.style.display = step === steps.length ? 'inline-block' : 'none';
    }

    nextButton.addEventListener('click', () => {
        if (validateCurrentStep()) {
            currentStep++;
            showStep(currentStep);
        }
    });

    prevButton.addEventListener('click', () => {
        currentStep--;
        showStep(currentStep);
    });

    function validateCurrentStep() {
        const currentStepElement = steps[currentStep - 1];
        const requiredFields = currentStepElement.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                field.classList.add('error');
                isValid = false;
            } else {
                field.classList.remove('error');
            }
        });

        // Additional validation for step 1 (password confirmation)
        if (currentStep === 1) {
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (password !== confirmPassword) {
                document.getElementById('confirmPassword').classList.add('error');
                isValid = false;
            }
        }

        return isValid;
    }

    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const userData = {
            name: formData.get('fullName'),
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            country: formData.get('country'),
            city: formData.get('city'),
            region: formData.get('region'),
            streetAddress: formData.get('streetAddress'),
            type: formData.get('accountMode') // 'admin' or 'employer'
        };

        // Store user data
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        users.push(userData);
        localStorage.setItem('users', JSON.stringify(users));

        // Show success message and redirect
        showMessage('Account created successfully! Redirecting to login...', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    });

    // Helper function to show messages
    function showMessage(text, type = 'info') {
        const existing = document.querySelector('.message-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `message-toast ${type}`;
        toast.textContent = text;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }

const _EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const _EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

window.handleGoogleCredential = async (response) => {
  const statusEl = document.getElementById('login-status');
  if (statusEl) statusEl.textContent = 'Signing in with Google…';
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.message || 'Google sign-in failed.');

    if (body.needsProfile) {
      const params = new URLSearchParams({
        token: body.profileToken,
        email: body.email || '',
        firstName: body.firstName || '',
        lastName: body.lastName || '',
      });
      if (statusEl) statusEl.textContent = 'New account — finish your profile to continue…';
      window.location.href = `/signup.html#google=${encodeURIComponent(params.toString())}`;
      return;
    }

    if (body.token) window.localStorage.setItem('gims_employee_token', body.token);
    if (body.role) window.localStorage.setItem('gims_role', String(body.role));
    if (statusEl) statusEl.textContent = 'Logged in. Redirecting to your dashboard…';
    setTimeout(() => {
      window.location.href = body.role === 'admin' ? '/admin.html' : '/employee.html';
    }, 700);
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || 'Google sign-in failed.';
  }
};

const initGoogleSignIn = async () => {
  const container = document.getElementById('google-signin-container');
  if (!container) return;
  try {
    const res = await fetch('/api/auth/google-config');
    const { clientId } = await res.json();
    if (!clientId) {
      container.innerHTML = '<span class="muted small">Google sign-in is not configured.</span>';
      return;
    }
    const tryRender = () => {
      if (!window.google?.accounts?.id) {
        setTimeout(tryRender, 150);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: window.handleGoogleCredential,
        auto_select: false,
        ux_mode: 'popup',
      });
      window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 320,
      });
    };
    tryRender();
  } catch {
    container.innerHTML = '<span class="muted small">Google sign-in unavailable.</span>';
  }
};

const _decodeJwt = (jwtToken) => {
  try {
    const parts = String(jwtToken || '').split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(b64 + pad));
  } catch { return null; }
};
const _redirectIfLoggedIn = () => {
  const stored = window.localStorage.getItem('gims_employee_token');
  if (!stored) return false;
  const payload = _decodeJwt(stored);
  if (!payload || (payload.exp && Date.now() / 1000 > payload.exp)) {
    window.localStorage.removeItem('gims_employee_token');
    window.localStorage.removeItem('gims_role');
    return false;
  }
  const role = window.localStorage.getItem('gims_role') || payload.role;
  window.location.replace(role === 'admin' ? '/admin.html' : '/employee.html');
  return true;
};

document.addEventListener('DOMContentLoaded', () => {
  if (_redirectIfLoggedIn()) return;
  // Re-check on Back/Forward (bfcache) so a fresh login doesn't re-render here.
  window.addEventListener('pageshow', () => { _redirectIfLoggedIn(); });
  initGoogleSignIn();

  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.innerHTML = _EYE;
    btn.addEventListener('click', () => {
      const input = btn.closest('.password-field').querySelector('input');
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? _EYE : _EYE_OFF;
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });
  const topbar = document.getElementById('topbar');
  const navbar = document.getElementById('navbar');

  const navLinks = Array.from(document.querySelectorAll('.topbar-nav .nav-link[href^="#"]'));
  const spySections = navLinks
    .map(link => document.getElementById(link.getAttribute('href').slice(1)))
    .filter(Boolean);

  const updateActiveLink = () => {
    if (!navLinks.length || !spySections.length) return;
    const probe = window.innerHeight * 0.35;
    let activeId = null;
    spySections.forEach(section => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= probe && rect.bottom >= probe) {
        activeId = section.id;
      }
    });
    navLinks.forEach(link => {
      const target = link.getAttribute('href').slice(1);
      link.classList.toggle('is-active', activeId !== null && target === activeId);
    });
  };

  const handleScroll = () => {
    const scrolled = window.scrollY > 10;
    if (topbar) {
      topbar.classList.toggle('is-scrolled', scrolled);
    }
    if (navbar) {
      navbar.classList.toggle('is-scrolled', scrolled);
    }
    updateActiveLink();
  };

  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', updateActiveLink, { passive: true });

  const form = document.getElementById('login-form');
  const statusEl = document.getElementById('login-status');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
  const forgotOpenBtn = document.getElementById('forgot-password-open-btn');
  const forgotModalEl = document.getElementById('forgot-password-modal');
  const forgotCloseBtn = document.getElementById('forgot-password-close-btn');
  const forgotCancelBtn = document.getElementById('forgot-password-cancel-btn');
  const forgotRequestBtn = document.getElementById('forgot-password-request-btn');
  const forgotVerifyBtn = document.getElementById('forgot-password-verify-btn');
  const forgotConfirmBtn = document.getElementById('forgot-password-confirm-btn');
  const forgotStatusEl = document.getElementById('forgot-password-status');
  const forgotEmailEl = document.getElementById('forgot-password-email');
  const forgotPinEl = document.getElementById('forgot-password-pin');
  const forgotPasswordEl = document.getElementById('forgot-password-new-password');

  let forgotResetToken = null;

  const isValidXUEmail = (value) => {
    const email = String(value || '').trim().toLowerCase();
    return email.endsWith('@xu.edu.ph') || email.endsWith('@my.xu.edu.ph');
  };

  const resetForgotForm = () => {
    forgotResetToken = null;
    if (forgotStatusEl) forgotStatusEl.textContent = '';
    if (forgotPinEl) forgotPinEl.value = '';
    if (forgotPasswordEl) forgotPasswordEl.value = '';
  };

  const closeForgotModal = () => {
    if (forgotModalEl) forgotModalEl.style.display = 'none';
    resetForgotForm();
  };

  forgotOpenBtn?.addEventListener('click', () => {
    if (forgotModalEl) forgotModalEl.style.display = 'flex';
    if (forgotStatusEl) forgotStatusEl.textContent = '';
  });
  forgotCloseBtn?.addEventListener('click', closeForgotModal);
  forgotCancelBtn?.addEventListener('click', closeForgotModal);
  forgotModalEl?.addEventListener('click', (event) => {
    if (event.target === forgotModalEl) closeForgotModal();
  });

  forgotRequestBtn?.addEventListener('click', async () => {
    if (forgotStatusEl) forgotStatusEl.textContent = '';
    const email = String(forgotEmailEl?.value || '').trim();
    if (!isValidXUEmail(email)) {
      if (forgotStatusEl) forgotStatusEl.textContent = 'Use a valid @xu.edu.ph or @my.xu.edu.ph email.';
      return;
    }

    try {
      forgotRequestBtn.disabled = true;
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || 'Failed to send reset PIN.');
      if (forgotStatusEl) forgotStatusEl.textContent = body?.message || 'Reset PIN sent. Check your email.';
    } catch (err) {
      if (forgotStatusEl) forgotStatusEl.textContent = err.message || 'Failed to send reset PIN.';
    } finally {
      forgotRequestBtn.disabled = false;
    }
  });

  forgotVerifyBtn?.addEventListener('click', async () => {
    if (forgotStatusEl) forgotStatusEl.textContent = '';
    const email = String(forgotEmailEl?.value || '').trim();
    const code = String(forgotPinEl?.value || '').trim();
    if (!isValidXUEmail(email)) {
      if (forgotStatusEl) forgotStatusEl.textContent = 'Use a valid @xu.edu.ph or @my.xu.edu.ph email.';
      return;
    }
    if (!code || code.length !== 6) {
      if (forgotStatusEl) forgotStatusEl.textContent = 'Enter your 6-digit reset PIN.';
      return;
    }

    try {
      forgotVerifyBtn.disabled = true;
      const res = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || 'PIN verification failed.');
      forgotResetToken = body?.token || null;
      if (forgotStatusEl) forgotStatusEl.textContent = 'PIN verified. You can now set a new password.';
    } catch (err) {
      if (forgotStatusEl) forgotStatusEl.textContent = err.message || 'PIN verification failed.';
    } finally {
      forgotVerifyBtn.disabled = false;
    }
  });

  forgotConfirmBtn?.addEventListener('click', async () => {
    if (forgotStatusEl) forgotStatusEl.textContent = '';
    const newPassword = String(forgotPasswordEl?.value || '').trim();
    if (!forgotResetToken) {
      if (forgotStatusEl) forgotStatusEl.textContent = 'Verify your PIN first.';
      return;
    }
    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      if (forgotStatusEl)
        forgotStatusEl.textContent =
          'New password must be at least 8 characters and include an uppercase letter, a number, and a special character.';
      return;
    }

    try {
      forgotConfirmBtn.disabled = true;
      const res = await fetch('/api/auth/forgot-password/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${forgotResetToken}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || 'Password reset failed.');
      if (forgotStatusEl) forgotStatusEl.textContent = body?.message || 'Password reset successful. You can now login.';
      setTimeout(() => {
        closeForgotModal();
      }, 900);
    } catch (err) {
      if (forgotStatusEl) forgotStatusEl.textContent = err.message || 'Password reset failed.';
    } finally {
      forgotConfirmBtn.disabled = false;
    }
  });

  // ---- Landing-page inline forgot-password flow ----
  const lpStepLogin  = document.getElementById('lp-step-login');
  const lpStepEmail  = document.getElementById('lp-step-email');
  const lpStepPin    = document.getElementById('lp-step-pin');
  const lpStepNewpw  = document.getElementById('lp-step-newpw');

  if (lpStepLogin && lpStepEmail && lpStepPin && lpStepNewpw) {
    const lpForgotBtn   = document.getElementById('lp-forgot-btn');
    const lpEmailInput  = document.getElementById('lp-fp-email');
    const lpSendBtn     = document.getElementById('lp-fp-send-btn');
    const lpFpStatus    = document.getElementById('lp-fp-status');
    const lpPinInput    = document.getElementById('lp-fp-pin');
    const lpVerifyBtn   = document.getElementById('lp-fp-verify-btn');
    const lpPinStatus   = document.getElementById('lp-fp-pin-status');
    const lpResendBtn   = document.getElementById('lp-fp-resend-btn');
    const lpNewpwInput  = document.getElementById('lp-fp-newpw');
    const lpConfirmBtn  = document.getElementById('lp-fp-confirm-btn');
    const lpNewpwStatus = document.getElementById('lp-fp-newpw-status');
    const lpBackToLogin = document.getElementById('lp-fp-back-to-login');
    const lpBackToEmail = document.getElementById('lp-fp-back-to-email');

    let lpResetToken = null;
    let lpEmail = '';

    const showStep = (step) => {
      lpStepLogin.style.display = step === 'login' ? '' : 'none';
      lpStepEmail.style.display = step === 'email' ? '' : 'none';
      lpStepPin.style.display   = step === 'pin'   ? '' : 'none';
      lpStepNewpw.style.display = step === 'newpw' ? '' : 'none';
    };

    const clearStatus = (...els) => els.forEach(el => { if (el) el.textContent = ''; });

    lpForgotBtn?.addEventListener('click', () => {
      clearStatus(lpFpStatus, lpPinStatus, lpNewpwStatus);
      showStep('email');
    });

    lpBackToLogin?.addEventListener('click', () => {
      lpResetToken = null;
      lpEmail = '';
      if (lpEmailInput) lpEmailInput.value = '';
      if (lpPinInput) lpPinInput.value = '';
      if (lpNewpwInput) lpNewpwInput.value = '';
      clearStatus(lpFpStatus, lpPinStatus, lpNewpwStatus);
      showStep('login');
    });

    lpBackToEmail?.addEventListener('click', () => {
      clearStatus(lpPinStatus);
      if (lpPinInput) lpPinInput.value = '';
      showStep('email');
    });

    const sendPin = async () => {
      const email = String(lpEmailInput?.value || '').trim();
      if (!isValidXUEmail(email)) {
        if (lpFpStatus) lpFpStatus.textContent = 'Use a valid @xu.edu.ph or @my.xu.edu.ph email.';
        return;
      }
      clearStatus(lpFpStatus);
      if (lpSendBtn) lpSendBtn.disabled = true;
      try {
        const res = await fetch('/api/auth/forgot-password/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to send PIN.');
        lpEmail = email;
        if (lpPinInput) lpPinInput.value = '';
        clearStatus(lpPinStatus);
        showStep('pin');
      } catch (err) {
        if (lpFpStatus) lpFpStatus.textContent = err.message;
      } finally {
        if (lpSendBtn) lpSendBtn.disabled = false;
      }
    };

    lpSendBtn?.addEventListener('click', sendPin);
    lpResendBtn?.addEventListener('click', sendPin);

    lpVerifyBtn?.addEventListener('click', async () => {
      const pin = String(lpPinInput?.value || '').trim();
      if (!pin || pin.length !== 6) {
        if (lpPinStatus) lpPinStatus.textContent = 'Enter your 6-digit PIN.';
        return;
      }
      clearStatus(lpPinStatus);
      if (lpVerifyBtn) lpVerifyBtn.disabled = true;
      try {
        const res = await fetch('/api/auth/forgot-password/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: lpEmail, code: pin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'PIN verification failed.');
        lpResetToken = data.token;
        if (lpNewpwInput) lpNewpwInput.value = '';
        clearStatus(lpNewpwStatus);
        showStep('newpw');
      } catch (err) {
        if (lpPinStatus) lpPinStatus.textContent = err.message;
      } finally {
        if (lpVerifyBtn) lpVerifyBtn.disabled = false;
      }
    });

    lpConfirmBtn?.addEventListener('click', async () => {
      const newPassword = String(lpNewpwInput?.value || '').trim();
      if (!lpResetToken) {
        if (lpNewpwStatus) lpNewpwStatus.textContent = 'Session expired. Please start over.';
        return;
      }
      if (newPassword.length < 8) {
        if (lpNewpwStatus) lpNewpwStatus.textContent = 'Password must be at least 8 characters.';
        return;
      }
      clearStatus(lpNewpwStatus);
      if (lpConfirmBtn) lpConfirmBtn.disabled = true;
      try {
        const res = await fetch('/api/auth/forgot-password/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lpResetToken}`,
          },
          body: JSON.stringify({ password: newPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Password update failed.');
        if (lpNewpwStatus) lpNewpwStatus.textContent = 'Password updated. You can now log in.';
        lpResetToken = null;
        setTimeout(() => {
          lpEmail = '';
          showStep('login');
        }, 1800);
      } catch (err) {
        if (lpNewpwStatus) lpNewpwStatus.textContent = err.message;
      } finally {
        if (lpConfirmBtn) lpConfirmBtn.disabled = false;
      }
    });
  }

  const emailField = form?.querySelector('input[name="email"]');
  const passwordField = form?.querySelector('input[name="password"]');
  const submitBtnLabel = submitBtn?.textContent || 'Login';

  const clearFieldError = (input) => {
    if (!input) return;
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  };
  const markFieldError = (input) => {
    if (!input) return;
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
  };
  emailField?.addEventListener('input', () => clearFieldError(emailField));
  passwordField?.addEventListener('input', () => clearFieldError(passwordField));

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form || !statusEl) return;
    statusEl.textContent = '';
    statusEl.classList.remove('is-error');
    clearFieldError(emailField);
    clearFieldError(passwordField);

    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '').trim();

    if (!email || !password) {
      if (!email) markFieldError(emailField);
      if (!password) markFieldError(passwordField);
      statusEl.textContent = 'Please fill in the highlighted field(s).';
      statusEl.classList.add('is-error');
      (!email ? emailField : passwordField)?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.message || 'Login failed.');
      }
      if (body.token) {
        window.localStorage.setItem('gims_employee_token', body.token);
      }
      if (body.role) {
        window.localStorage.setItem('gims_role', String(body.role));
      }
      const role = body.role || 'employee';
      statusEl.textContent = 'Logged in. Redirecting to your dashboard…';
      setTimeout(() => {
        if (role === 'admin') {
          window.location.href = '/admin.html';
        } else {
          window.location.href = '/employee.html';
        }
      }, 900);
    } catch (err) {
      statusEl.textContent = err.message || 'Login failed.';
      statusEl.classList.add('is-error');
      const msg = String(err.message || '').toLowerCase();
      if (msg.includes('credential') || msg.includes('password') || msg.includes('invalid')) {
        markFieldError(emailField);
        markFieldError(passwordField);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtnLabel;
      }
    }
  });
});


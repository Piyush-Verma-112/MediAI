/* ═══════════════════════════════════
   AUTHENTICATION
   Login, Signup, Logout & Validation
═══════════════════════════════════ */

// NOTE: currentUser, currentProfile, currentRole, currentTab, sb
// are all declared in config.js — do NOT redeclare them here.

// ═══════════════════════════════════
// ROLE & TAB SWITCHING
// ════════════════════════════════════

function setRole(r) {
    currentRole = r;
    document.getElementById('rolePatient').classList.toggle('active', r === 'patient');
    document.getElementById('roleDoctor').classList.toggle('active', r === 'doctor');
    document.getElementById('doctorExtra').style.display = r === 'doctor' ? 'block' : 'none';
    document.getElementById('patientExtra').style.display = r === 'patient' ? 'block' : 'none';
}

function toggleSignupDay(btn) {
    btn.classList.toggle('selected');
    document.getElementById('errVisitDays')?.classList.remove('show');
}

function getSignupVisitDays() {
    return [...document.querySelectorAll('#signupVisitDays .signup-day-chip.selected')]
        .map(el => el.dataset.day);
}

function resetSignupVisitDays() {
    document.querySelectorAll('#signupVisitDays .signup-day-chip').forEach(chip => {
        chip.classList.toggle('selected', SIGNUP_DEFAULT_DAYS.includes(chip.dataset.day));
    });
}

function switchTab(t) {
    currentTab = t;
    document.getElementById('tabLogin').classList.toggle('active', t === 'login');
    document.getElementById('tabSignup').classList.toggle('active', t === 'signup');
    document.getElementById('loginForm').style.display = t === 'login' ? 'block' : 'none';
    document.getElementById('signupForm').style.display = t === 'signup' ? 'block' : 'none';
    clearAuthMsg();
}

// ═══════════════════════════════════
// PASSWORD TOGGLE
// ════════════════════════════════════

function togglePwd(id, btn) {
    const inp = document.getElementById(id);
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

// ═══════════════════════════════════
// PASSWORD STRENGTH
// ════════════════════════════════════

function checkPwdStrength(val) {
    const wrap = document.getElementById('pwdStrength');
    const label = document.getElementById('pwdLabel');
    const bars = [
        document.getElementById('pb1'),
        document.getElementById('pb2'),
        document.getElementById('pb3'),
        document.getElementById('pb4')
    ];

    if (!val) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';

    let score = 0;
    if (val.length >= 8) score++;
    if (val.length >= 12) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val)) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    score = Math.min(score, 4);

    const levels = ['', 'weak', 'fair', 'good', 'strong'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong 💪'];

    bars.forEach((b, i) => {
        b.className = 'pwd-bar';
        if (i < score) b.classList.add(levels[score]);
    });

    label.className = 'pwd-label ' + levels[score];
    label.textContent = labels[score];
}

function checkConfirmPwd() {
    const pwd = document.getElementById('signupPassword').value;
    const cpwd = document.getElementById('signupConfirmPassword').value;
    const errEl = document.getElementById('errConfirmPassword');
    const inp = document.getElementById('signupConfirmPassword');

    if (cpwd && pwd !== cpwd) {
        errEl.classList.add('show');
        inp.classList.add('input-invalid');
        inp.classList.remove('input-valid');
    } else if (cpwd) {
        errEl.classList.remove('show');
        inp.classList.remove('input-invalid');
        inp.classList.add('input-valid');
    }
}

// ═══════════════════════════════════
// FIELD VALIDATORS
// ════════════════════════════════════

function validateName() {
    const val = document.getElementById('signupName').value.trim();
    const errEl = document.getElementById('errName');
    const inp = document.getElementById('signupName');
    const valid = val.length >= 3 && /^[a-zA-Z\s.''-]+$/.test(val);
    errEl.classList.toggle('show', !valid && val.length > 0);
    inp.classList.toggle('input-invalid', !valid && val.length > 0);
    inp.classList.toggle('input-valid', valid);
    return valid;
}

function validateEmail() {
    const val = document.getElementById('signupEmail').value.trim();
    const errEl = document.getElementById('errEmail');
    const inp = document.getElementById('signupEmail');
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    errEl.classList.toggle('show', !valid && val.length > 0);
    inp.classList.toggle('input-invalid', !valid && val.length > 0);
    inp.classList.toggle('input-valid', valid);
    return valid;
}

function validatePhone() {
    const val = document.getElementById('signupPhone').value.trim().replace(/\s|-/g, '');
    const errEl = document.getElementById('errPhone');
    const inp = document.getElementById('signupPhone');
    const valid = /^(\+91)?[6-9]\d{9}$/.test(val);
    errEl.classList.toggle('show', !valid && val.length > 0);
    inp.classList.toggle('input-invalid', !valid && val.length > 0);
    inp.classList.toggle('input-valid', valid);
    return valid;
}

function showFieldError(id, errId, condition) {
    const errEl = document.getElementById(errId);
    const inp = document.getElementById(id);
    if (!errEl || !inp) return !condition;
    errEl.classList.toggle('show', condition);
    inp.classList.toggle('input-invalid', condition);
    inp.classList.toggle('input-valid', !condition);
    return !condition;
}

// ═══════════════════════════════════
// ERROR MESSAGES
// ════════════════════════════════════

function showError(msg) {
    const el = document.getElementById('authError');
    el.textContent = msg;
    el.classList.add('show');
    document.getElementById('authSuccess').classList.remove('show');
}

function showSuccess(msg) {
    const el = document.getElementById('authSuccess');
    el.textContent = msg;
    el.classList.add('show');
    document.getElementById('authError').classList.remove('show');
}

function clearAuthMsg() {
    document.getElementById('authError').classList.remove('show');
    document.getElementById('authSuccess').classList.remove('show');
}

// ═══════════════════════════════════
// BUTTON LOADING STATE
// ════════════════════════════════════

function setBtnLoading(id, loading) {
    const btn = document.getElementById(id);
    btn.disabled = loading;
    btn.innerHTML = loading
        ? '<div class="spinner"></div>'
        : id === 'loginBtn'
            ? '<span>Login to MediAI</span>'
            : '<span>Create Account</span>';
}

// ═══════════════════════════════════
// SIGNUP
// ════════════════════════════════════

async function handleSignup() {
    clearAuthMsg();

    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const pass = document.getElementById('signupPassword').value;
    const confirmPass = document.getElementById('signupConfirmPassword').value;

    let valid = true;

    if (!name || name.length < 3 || !/^[a-zA-Z\s.''-]+$/.test(name)) {
        showFieldError('signupName', 'errName', true);
        valid = false;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError('signupEmail', 'errEmail', true);
        valid = false;
    }

    const pwdValid = pass.length >= 8 && /[0-9]/.test(pass) && /[!@#$%^&*()\-_+=\[\]{};:'"<>,.?/\\|`~]/.test(pass);
    if (!pwdValid) {
        document.getElementById('errPassword').classList.add('show');
        document.getElementById('signupPassword').classList.add('input-invalid');
        valid = false;
    } else {
        document.getElementById('errPassword').classList.remove('show');
        document.getElementById('signupPassword').classList.remove('input-invalid');
    }

    if (pass !== confirmPass) {
        document.getElementById('errConfirmPassword').classList.add('show');
        document.getElementById('signupConfirmPassword').classList.add('input-invalid');
        valid = false;
    }

    if (!valid) return showError('Please fix the errors above before continuing.');

    setBtnLoading('signupBtn', true);

    const meta = { full_name: name, role: currentRole };

    if (currentRole === 'doctor') {
        meta.specialty = document.getElementById('signupSpecialty').value;
        meta.experience = parseInt(document.getElementById('signupExp').value) || 0;
        meta.hospital = document.getElementById('signupHospital').value.trim();
        meta.fee = parseInt(document.getElementById('signupFee').value) || 500;

        if (!meta.specialty) {
            setBtnLoading('signupBtn', false);
            return showError('Please select your specialty.');
        }
        if (!meta.hospital || meta.hospital.length < 3) {
            showFieldError('signupHospital', 'errHospital', true);
            setBtnLoading('signupBtn', false);
            return showError('Please enter your hospital name.');
        }
        if (meta.experience < 0 || meta.experience > 60) {
            showFieldError('signupExp', 'errExp', true);
            setBtnLoading('signupBtn', false);
            return showError('Please enter valid years of experience.');
        }
        if (meta.fee < 100 || meta.fee > 50000) {
            showFieldError('signupFee', 'errFee', true);
            setBtnLoading('signupBtn', false);
            return showError('Please enter a valid consultation fee (₹100–₹50,000).');
        }

        const visitDays = getSignupVisitDays();
        if (visitDays.length === 0) {
            document.getElementById('errVisitDays').classList.add('show');
            setBtnLoading('signupBtn', false);
            return showError('Please select at least one visit day.');
        }
        meta.visit_days = visitDays;
    } else {
        meta.phone = document.getElementById('signupPhone').value.trim();
        meta.age = parseInt(document.getElementById('signupAge').value) || null;
        meta.city = document.getElementById('signupCity').value.trim();

        const phoneClean = meta.phone.replace(/\s|-/g, '');
        if (!phoneClean || !/^(\+91)?[6-9]\d{9}$/.test(phoneClean)) {
            showFieldError('signupPhone', 'errPhone', true);
            setBtnLoading('signupBtn', false);
            return showError('Please enter a valid Indian mobile number.');
        }
        if (!meta.age || meta.age < 1 || meta.age > 120) {
            showFieldError('signupAge', 'errAge', true);
            setBtnLoading('signupBtn', false);
            return showError('Please enter a valid age.');
        }
        if (!meta.city || meta.city.length < 2) {
            showFieldError('signupCity', 'errCity', true);
            setBtnLoading('signupBtn', false);
            return showError('Please enter your city.');
        }
    }

    const { data, error } = await sb.auth.signUp({
        email,
        password: pass,
        options: { data: meta }
    });

    setBtnLoading('signupBtn', false);

    if (error) return showError(error.message);

    if (data.user) {
        await new Promise(r => setTimeout(r, 1000));

        const extraFields = currentRole === 'doctor'
            ? { specialty: meta.specialty, experience: meta.experience, hospital: meta.hospital, fee: meta.fee, is_available: true }
            : { phone: meta.phone, age: meta.age, city: meta.city };

        const { error: profileError } = await sb
            .from('profiles')
            .upsert({
                id: data.user.id,
                email,
                full_name: meta.full_name,
                role: currentRole,
                ...extraFields
            }, { onConflict: 'id' });

        if (profileError) console.warn('Profile upsert warning:', profileError.message);

        if (currentRole === 'doctor') {
            const visitDays = meta.visit_days || getSignupVisitDays();
            const { error: availErr } = await saveDoctorVisitDays(data.user.id, visitDays);
            if (availErr) console.warn('Visit days save:', availErr.message);
        }
    }

    if (data.user && !data.session) {
        showSuccess('✅ Account created! Check your email to verify, then login.');
    } else if (data.session) {
        await onSignedIn(data.session.user);
    }
}

// ═══════════════════════════════════
// LOGIN
// ════════════════════════════════════

async function handleLogin() {
    clearAuthMsg();

    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;

    if (!email || !pass) return showError('Please enter your email and password.');

    setBtnLoading('loginBtn', true);

    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

    setBtnLoading('loginBtn', false);

    if (error) return showError(error.message);

    await onSignedIn(data.user);
}

async function handleForgotPassword() {
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) return showError('Please enter your email first.');
    
    const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://remarkable-frangollo-b60825.netlify.app'
    });
    
    if (error) return showError(error.message);
    showSuccess('✅ Password reset link sent to your email!');
}

// ═══════════════════════════════════
// LOGOUT
// ════════════════════════════════════

async function handleLogout() {
    await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    // FIX: auth-wrap uses grid, not flex — just remove display:none from authScreen
    document.getElementById('app').classList.remove('show');
    document.getElementById('authScreen').style.display = '';
    showToast('Logged out successfully');
}

// ═══════════════════════════════════
// ON SIGNED IN
// ════════════════════════════════════

async function onSignedIn(user) {
    currentUser = user;

    const { data: profileData } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

    currentProfile = { ...(user.user_metadata || {}), ...(profileData || {}) };
    const role = currentProfile.role || 'patient';

    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('app').classList.add('show');

    const initials = (currentProfile.full_name || 'U')
        .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    document.getElementById('navAvatar').textContent = initials;
    document.getElementById('navName').textContent = currentProfile.full_name || user.email;

    buildNav(role);

    if (role === 'doctor') {
        showPage('portal');
    } else {
        showPage('find');
    }
}

// ═══════════════════════════════════
// NAV BUILDER
// ════════════════════════════════════

function buildNav(role) {
    const tabs = role === 'doctor'
        ? [
            { id: 'portal', label: '🗓 Schedule' },
            { id: 'doc-appointments', label: '📋 Appointments' },
            { id: 'dashboard', label: '📊 Dashboard' }
        ]
        : [
            { id: 'find', label: '🔍 Find Doctors' },
            { id: 'appointments', label: '📋 My Appointments' },
            { id: 'dashboard', label: '📊 Dashboard' }
        ];

    document.getElementById('navTabs').innerHTML = tabs
        .map(t => `<button class="nav-tab" id="navtab-${t.id}" onclick="showPage('${t.id}')">${t.label}</button>`)
        .join('');
}

// ═══════════════════════════════════
// PAGE SWITCHING
// ════════════════════════════════════

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const pg = document.getElementById('page-' + id);
    if (pg) pg.classList.add('active');

    const nt = document.getElementById('navtab-' + id);
    if (nt) nt.classList.add('active');

    if (id === 'appointments') loadMyAppointments();
    if (id === 'dashboard') renderDashboard();
    if (id === 'portal') renderDoctorPortal();
    if (id === 'doc-appointments') loadDocAppointments('all');
}

function openProfilePage() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('page-profile')?.classList.add('active');
    renderProfilePage();
}

// ═══════════════════════════════════
// TOAST  (uses toastContainer div)
// ════════════════════════════════════

function showToast(msg) {
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    container.appendChild(t);
    // Trigger transition
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 400);
    }, 4000);
}

// ═══════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════════

function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'flex'; el.classList.add('open'); }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.classList.remove('open'); }
}

function closeModalOnOverlay(event, id) {
    if (event.target === event.currentTarget) closeModal(id);
}

function showTermsModal() {
    openModal('termsModal');
}

// ═══════════════════════════════════
// FILTER DOCTOR APPOINTMENTS
// ════════════════════════════════════

async function filterDocAppointments(status, btn) {
    document.querySelectorAll('#page-doc-appointments .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    await loadDocAppointments(status);
}

async function loadDocAppointments(status) {
    const wrap = document.getElementById('docApptListWrap');
    wrap.innerHTML = '<div style="color:var(--text-hint);padding:1rem">Loading...</div>';

    const { data: raw, error } = await sb
        .from('appointments')
        .select('*')
        .eq('doctor_name', currentProfile?.full_name)
        .order('appointment_date', { ascending: false });

    if (error) {
        wrap.innerHTML = `<div class="empty-state"><div class="es-icon">📭</div><p>Could not load appointments.</p></div>`;
        return;
    }

    await syncAppointmentStatusesInDb(raw || []);
    let data = raw || [];
    data.forEach(a => {
        if (a.status !== 'cancelled' && a.status !== 'completed') {
            a.status = getTargetAppointmentStatus(a);
        }
    });

    if (status && status !== 'all') {
        data = data.filter(a => a.status === status);
    }

    if (!data || data.length === 0) {
        wrap.innerHTML = `<div class="empty-state"><div class="es-icon">📭</div><p>No appointments found.</p></div>`;
        return;
    }

    wrap.innerHTML = buildApptListDoctor(data);
}

function buildApptListDoctor(appts) {
    return `<div class="appt-list">${appts.map(a => {
        const status = a.status === 'completed' || a.status === 'cancelled'
            ? a.status
            : getTargetAppointmentStatus(a);
        const markBtn = canMarkAppointmentComplete(a)
            ? `<button type="button" class="btn-mark-complete" onclick="completeAppointment('${a.id}')">✓ Mark complete</button>`
            : '';
        return `
    <div class="appt-card">
      <div class="appt-card-left">
        <div class="appt-card-doc">${a.patient_name}</div>
        <div class="appt-card-meta">${a.doctor_specialty || ''} · ${a.doctor_hospital || ''}</div>
        <div class="appt-card-meta" style="margin-top:4px">📅 ${a.appointment_date} at ${a.appointment_time} · ₹${a.fee || '—'}</div>
        ${a.note ? `<div class="appt-card-meta" style="margin-top:4px">📝 ${a.note}</div>` : ''}
      </div>
      <div class="appt-row-actions">
        <span class="appt-badge ${STATUS_BADGES[status] || 'badge-pending'}">${formatAppointmentStatus(status)}</span>
        ${markBtn}
      </div>
    </div>`;
    }).join('')}</div>`;
}

// ═══════════════════════════════════
// FILTER PATIENT APPOINTMENTS (tab UI)
// ════════════════════════════════════

async function filterAppointments(status, btn) {
    document.querySelectorAll('#apptFilterRow .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const wrap = document.getElementById('apptListWrap');
    wrap.innerHTML = '<div style="color:var(--text-hint);padding:1rem">Loading...</div>';

    let query = sb
        .from('appointments')
        .select('*')
        .eq('patient_id', currentUser.id)
        .order('appointment_date', { ascending: false });

    const today = getTodayStr();

    const { data: raw, error } = await query;

    if (error) {
        wrap.innerHTML = `<div class="empty-state"><div class="es-icon">📭</div><p>Could not load appointments.</p></div>`;
        return;
    }

    await syncAppointmentStatusesInDb(raw || []);
    let data = (raw || []).map(a => {
        if (a.status !== 'cancelled' && a.status !== 'completed') {
            return { ...a, status: getTargetAppointmentStatus(a) };
        }
        return a;
    });

    if (status === 'upcoming') {
        data = data.filter(a => a.status === 'upcoming');
    } else if (status === 'completed') {
        data = data.filter(a => a.status === 'completed');
    } else if (status === 'cancelled') {
        data = data.filter(a => a.status === 'cancelled');
    }

    if (!data.length) {
        wrap.innerHTML = `<div class="empty-state"><div class="es-icon">📭</div><p>No appointments found.</p></div>`;
        return;
    }

    wrap.innerHTML = buildApptList(data);
}

// ═══════════════════════════════════
// SESSION CHECK ON LOAD
// ════════════════════════════════════

(async () => {
    if (!sb) return;
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session) await onSignedIn(session.user);
    } catch(e) {
        console.error('Init error:', e);
        document.getElementById('authScreen').style.display = '';
    }
})();
// ═══════════════════════════════════
// MISC AUTH UTILITIES
// ════════════════════════════════════

async function requestPasswordReset(email) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('Please enter a valid email address.');
        return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
    });
    if (error) { showError(error.message); return; }
    showSuccess('Password reset link sent to your email!');
}

async function updateProfile(updates) {
    if (!currentUser) return;
    if (typeof persistProfileUpdates === 'function') {
        const row = await persistProfileUpdates(updates);
        if (!row) return false;
        currentProfile = { ...currentProfile, ...row };
        showToast('✅ Profile updated!');
        return true;
    }
    const { data, error } = await sb.from('profiles').update(updates).eq('id', currentUser.id).select('*');
    if (error) { showToast('❌ Failed to update profile'); return; }
    const row = data?.[0];
    if (!row) { showToast('❌ Profile not saved in database'); return false; }
    currentProfile = row;
    showToast('✅ Profile updated!');
    return true;
}

function getCurrentUser() { return currentUser; }
function getCurrentProfile() { return currentProfile; }
function getCurrentRole() { return currentRole || currentProfile?.role || 'patient'; }
function isLoggedIn() { return !!currentUser; }

async function quickLogin(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { console.error('Login error:', error); return { error }; }
    await onSignedIn(data.user);
    return { user: data.user, session: data.session };
}

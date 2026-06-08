/* ═══════════════════════════════════
   PROFILE FUNCTIONALITY
   Profile Page & Edit
═══════════════════════════════════ */

// ═══════════════════════════════════
// RENDER PROFILE PAGE
// ════════════════════════════════════

async function renderProfilePage() {
    const wrap = document.getElementById('profileContent');
    wrap.innerHTML = '<div style="color:var(--text-hint);padding:2rem">Loading profile...</div>';

    // Fetch fresh profile from DB
    const { data: fresh } = await sb
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

    const meta = currentUser?.user_metadata || {};
    const prof = { ...meta, ...(currentProfile || {}), ...(fresh || {}) };
    const role = prof?.role || 'patient';
    const name = prof?.full_name || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const [bg, tc] = ['#E1F5EE', '#085041'];

    const { data: myAppts } = await sb
        .from('appointments')
        .select('id, status, appointment_date, appointment_time')
        .eq(role === 'doctor' ? 'doctor_name' : 'patient_id', role === 'doctor' ? prof.full_name : currentUser.id);

    await syncAppointmentStatusesInDb(myAppts || []);
    const appts = (myAppts || []).map(a => {
        if (a.status !== 'cancelled' && a.status !== 'completed') {
            return { ...a, status: getTargetAppointmentStatus(a) };
        }
        return a;
    });

    const total = appts.length;
    const upcoming = appts.filter(a => a.status === 'upcoming').length;
    const completed = appts.filter(a => a.status === 'completed').length;
    const cancelled = appts.filter(a => a.status === 'cancelled').length;

    // Render profile content
    wrap.innerHTML = `
    <div class="profile-wrap">
      <!-- Banner -->
      <div class="profile-banner">
        <div class="profile-big-avatar">${initials}</div>
        <div class="profile-banner-info">
          <h2>${prof.full_name || 'User'}</h2>
          <p>${prof.email || currentUser.email}</p>
          <div class="profile-banner-badge">${role === 'doctor' ? '👨‍⚕️ Doctor' : '🧑 Patient'}</div>
        </div>
      </div>

      <div class="profile-cards">
        <!-- Info card -->
        <div class="profile-card">
          <h3>${role === 'doctor' ? 'Professional Info' : 'Personal Info'}</h3>
          ${role === 'doctor' ? `
            <div class="profile-field">
              <span class="profile-field-lbl">Specialty</span>
              <span class="profile-field-val">${prof.specialty || '—'}</span>
            </div>
            <div class="profile-field">
              <span class="profile-field-lbl">Hospital</span>
              <span class="profile-field-val">${prof.hospital || '—'}</span>
            </div>
            <div class="profile-field">
              <span class="profile-field-lbl">Experience</span>
              <span class="profile-field-val">${prof.experience ? prof.experience + ' years' : '—'}</span>
            </div>
            <div class="profile-field">
              <span class="profile-field-lbl">Fee</span>
              <span class="profile-field-val">${prof.fee ? '₹' + prof.fee : '—'}</span>
            </div>
            <div class="profile-field">
              <span class="profile-field-lbl">Rating</span>
              <span class="profile-field-val">${prof.rating ? parseFloat(prof.rating).toFixed(1) + ' ⭐' : 'No ratings yet'}</span>
            </div>
          ` : `
            <div class="profile-field">
              <span class="profile-field-lbl">Phone</span>
              <span class="profile-field-val">${prof.phone || '—'}</span>
            </div>
            <div class="profile-field">
              <span class="profile-field-lbl">Age</span>
              <span class="profile-field-val">${prof.age || '—'}</span>
            </div>
            <div class="profile-field">
              <span class="profile-field-lbl">City</span>
              <span class="profile-field-val">${prof.city || '—'}</span>
            </div>
          `}
        </div>

        <!-- Stats card -->
        <div class="profile-card">
          <h3>Activity</h3>
          <div class="profile-field">
            <span class="profile-field-lbl">Total Appointments</span>
            <span class="profile-field-val">${total}</span>
          </div>
          <div class="profile-field">
            <span class="profile-field-lbl">Upcoming</span>
            <span class="profile-field-val" style="color:var(--amber)">${upcoming}</span>
          </div>
          <div class="profile-field">
            <span class="profile-field-lbl">Completed</span>
            <span class="profile-field-val" style="color:var(--teal-dark)">${completed}</span>
          </div>
          <div class="profile-field">
            <span class="profile-field-lbl">Cancelled</span>
            <span class="profile-field-val" style="color:var(--coral)">${cancelled}</span>
          </div>
          <div class="profile-field">
            <span class="profile-field-lbl">Member Since</span>
            <span class="profile-field-val">${prof.created_at ? new Date(prof.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}</span>
          </div>
        </div>
      </div>

      <!-- Edit Form -->
      <div class="profile-card">
        <h3>Edit Profile</h3>
        ${role === 'doctor' ? `
          <div class="form-group">
            <label>Bio / About</label>
            <textarea id="editBio" rows="2" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;resize:vertical" placeholder="Brief description about yourself...">${prof.bio || ''}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Fee (₹)</label>
              <input type="number" id="editFee" value="${prof.fee || ''}" min="100" max="50000" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:14px;outline:none"/>
            </div>
            <div class="form-group">
              <label>Experience (yrs)</label>
              <input type="number" id="editExp" value="${prof.experience || ''}" min="0" max="60" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:14px;outline:none"/>
            </div>
          </div>
          <div class="form-group">
            <label>Hospital</label>
            <input type="text" id="editHospital" value="${prof.hospital || ''}" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:14px;outline:none"/>
          </div>
        ` : `
          <div class="form-row">
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" id="editPhone" value="${prof.phone || ''}" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:14px;outline:none"/>
            </div>
            <div class="form-group">
              <label>Age</label>
              <input type="number" id="editAge" value="${prof.age || ''}" min="1" max="120" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:14px;outline:none"/>
            </div>
          </div>
          <div class="form-group">
            <label>City</label>
            <input type="text" id="editCity" value="${prof.city || ''}" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:14px;outline:none"/>
          </div>
        `}
        <button type="button" class="save-profile-btn" onclick="saveProfile('${role}')">💾 Save Changes</button>
        <span id="saveProfileMsg" style="font-size:13px;margin-left:1rem;color:var(--teal-dark);display:none">✅ Saved!</span>
      </div>
    </div>`;
}

// ═══════════════════════════════════
// SAVE PROFILE
// ════════════════════════════════════

async function saveProfile(role) {
    const updates = {};

    if (role === 'doctor') {
        const bioEl = document.getElementById('editBio');
        const feeEl = document.getElementById('editFee');
        const expEl = document.getElementById('editExp');
        const hospEl = document.getElementById('editHospital');

        updates.bio = bioEl ? bioEl.value.trim() : undefined;
        updates.fee = feeEl && feeEl.value ? Math.round(parseFloat(feeEl.value)) : undefined;
        updates.experience = expEl && expEl.value ? parseInt(expEl.value) : undefined;
        updates.hospital = hospEl ? hospEl.value.trim() : undefined;

        // Remove undefined keys
        Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

        // Validation
        if (updates.fee !== undefined && (updates.fee < 100 || updates.fee > 50000))
            return showToast('⚠️ Fee must be ₹100–₹50,000');
        if (updates.experience !== undefined && (updates.experience < 0 || updates.experience > 60))
            return showToast('⚠️ Experience must be 0–60 years');
        if (updates.hospital !== undefined && updates.hospital.length < 2)
            return showToast('⚠️ Please enter a valid hospital name');

    } else {
        const phoneEl = document.getElementById('editPhone');
        const ageEl = document.getElementById('editAge');
        const cityEl = document.getElementById('editCity');

        updates.phone = phoneEl ? phoneEl.value.trim() : undefined;
        updates.age = ageEl && ageEl.value ? parseInt(ageEl.value) : undefined;
        updates.city = cityEl ? cityEl.value.trim() : undefined;

        Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

        // Validation
        if (updates.phone) {
            const cleaned = updates.phone.replace(/[\s\-]/g, '');
            if (!/^(\+91)?[6-9]\d{9}$/.test(cleaned))
            return showToast('⚠️ Enter a valid Indian mobile number');
        }
        if (updates.age !== undefined && (updates.age < 1 || updates.age > 120))
            return showToast('⚠️ Enter a valid age (1–120)');
    }

    if (Object.keys(updates).length === 0) return showToast('⚠️ Nothing to update');

    const savedRow = await persistProfileUpdates(updates);
    if (!savedRow) return;

    currentProfile = { ...currentProfile, ...savedRow };

    const feeLabel = savedRow.fee != null ? '₹' + savedRow.fee : '';
    showToast(feeLabel ? '✅ Profile saved! Fee: ' + feeLabel : '✅ Profile saved!');

    const msg = document.getElementById('saveProfileMsg');
    if (msg) {
        msg.style.display = 'inline';
        setTimeout(() => {
            msg.style.display = 'none';
            renderProfilePage();
        }, 800);
    } else {
        renderProfilePage();
    }
}

function profileRowBase() {
    const p = currentProfile || {};
    const m = currentUser?.user_metadata || {};
    return {
        id: currentUser.id,
        email: currentUser.email || p.email || null,
        full_name: p.full_name || m.full_name || null,
        role: p.role || m.role || 'patient'
    };
}

async function writeProfileRow(mode, fields) {
    let payload = { ...fields };
    for (let attempt = 0; attempt < 2; attempt++) {
        const query = mode === 'upsert'
            ? sb.from('profiles').upsert(payload, { onConflict: 'id' })
            : sb.from('profiles').update(payload).eq('id', currentUser.id);

        const { data, error } = await query.select('*');
        if (error) {
            if (attempt === 0 && payload.bio != null && /bio/i.test(error.message || '')) {
                delete payload.bio;
                continue;
            }
            console.error('Profile DB write failed:', error);
            return { error };
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (row) return { row };
    }
    return {};
}

function profilePatchMatchesRow(patch, row) {
    if (patch.fee != null && Number(row.fee) !== Number(patch.fee)) return false;
    if (patch.experience != null && Number(row.experience) !== Number(patch.experience)) return false;
    if (patch.hospital != null && String(row.hospital || '') !== String(patch.hospital)) return false;
    return true;
}

// Save to Supabase profiles table (must persist — not auth-metadata-only)
async function persistProfileUpdates(updates) {
    const patch = { ...updates };

    let { row, error } = await writeProfileRow('update', patch);
    if (!row && !error) {
        ({ row, error } = await writeProfileRow('upsert', { ...profileRowBase(), ...patch }));
    }

    if (error) {
        showToast('❌ Save failed: ' + error.message);
        return null;
    }

    if (!row) {
        showToast('❌ Database row not updated. Run supabase/fix_profiles_rls.sql in Supabase SQL Editor.');
        return null;
    }

    if (!profilePatchMatchesRow(patch, row)) {
        console.error('Profile save mismatch — sent:', patch, 'got:', row);
        showToast('❌ Not saved in Supabase (RLS). Run supabase/fix_profiles_rls.sql');
        return null;
    }

    const { data: authData, error: authError } = await sb.auth.updateUser({ data: patch });
    if (authError) console.warn('Auth metadata sync:', authError.message);
    else if (authData?.user) currentUser = authData.user;

    return row;
}

// ═══════════════════════════════════
// UPDATE PROFILE FIELD
// ════════════════════════════════════

async function updateProfileField(field, value) {
    const { error } = await sb
        .from('profiles')
        .update({ [field]: value })
        .eq('id', currentUser.id);

    if (error) {
        showToast('❌ Failed to update ' + field);
        return false;
    }

    currentProfile[field] = value;
    return true;
}

// ═══════════════════════════════════
// CHANGE PASSWORD
// ════════════════════════════════════

async function changePassword(currentPassword, newPassword) {
    // Re-authenticate first
    const { error: reauthError } = await sb.auth.reauthenticate();

    if (reauthError) {
        showToast('❌ Please login again to change password');
        return false;
    }

    const { error } = await sb.auth.updateUser({ password: newPassword });

    if (error) {
        showToast('❌ ' + error.message);
        return false;
    }

    showToast('✅ Password updated successfully');
    return true;
}

// ═══════════════════════════════════
// GET PROFILE
// ════════════════════════════════════

function getProfile() {
    return currentProfile;
}

// ═══════════════════════════════════
// GET PROFILE FIELD
// ════════════════════════════════════

function getProfileField(field) {
    return currentProfile?.[field];
}

// ═══════════════════════════════════
// REFRESH PROFILE
// ════════════════════════════════════

async function refreshProfile() {
    const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (error) {
        console.error('Error refreshing profile:', error);
        return null;
    }

    currentProfile = data;
    return data;
}

// ═══════════════════════════════════
// IS DOCTOR
// ════════════════════════════════════

function isDoctor() {
    return currentProfile?.role === 'doctor';
}

// ═══════════════════════════════════
// IS PATIENT
// ════════════════════════════════════

function isPatient() {
    return currentProfile?.role === 'patient';
}

// ═══════════════════════════════════
// GET USER ROLE
// ════════════════════════════════════

function getUserRole() {
    return currentProfile?.role || 'patient';
}

// ═══════════════════════════════════
// GET USER NAME
// ════════════════════════════════════

function getUserName() {
    return currentProfile?.full_name || currentUser?.email;
}

// ═══════════════════════════════════
// GET USER EMAIL
// ════════════════════════════════════

function getUserEmail() {
    return currentUser?.email;
}

// ═══════════════════════════════════
// GET USER ID
// ════════════════════════════════════

function getUserId() {
    return currentUser?.id;
}

// ═══════════════════════════════════
// UPDATE PROFILE PICTURE
// ════════════════════════════════════

async function updateProfilePicture(url) {
    const { error } = await sb
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', currentUser.id);

    if (error) {
        showToast('❌ Failed to update profile picture');
        return false;
    }

    currentProfile.avatar_url = url;
    showToast('✅ Profile picture updated');
    return true;
}

// ═══════════════════════════════════
// DELETE ACCOUNT
// ════════════════════════════════════

async function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        return false;
    }

    if (!confirm('This will permanently delete all your data. Continue?')) {
        return false;
    }

    // Delete profile
    await sb.from('profiles').delete().eq('id', currentUser.id);

    // Delete auth user
    const { error } = await sb.auth.admin.deleteUser(currentUser.id);

    if (error) {
        showToast('❌ Failed to delete account');
        return false;
    }

    // Logout
    await handleLogout();
    return true;
}
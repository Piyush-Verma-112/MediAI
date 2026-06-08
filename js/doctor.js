/* ═══════════════════════════════════
   DOCTOR PORTAL FUNCTIONALITY
   Schedule Management & Availability
═══════════════════════════════════ */

// ═══════════════════════════════════
// RENDER DOCTOR PORTAL
// ════════════════════════════════════

async function renderDoctorPortal() {
    // Fetch fresh profile from DB
    const { data: freshProfile } = await sb
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (freshProfile) currentProfile = freshProfile;

    const p = currentProfile || {};

    // Update header
    document.getElementById('portalTitle').textContent = `Dr. ${p.full_name || 'Portal'}`;
    document.getElementById('portalSubtitle').textContent = `${p.specialty || 'Specialist'} · ${p.hospital || ''}`;

    syncScheduleStatusToggle(p.is_available !== false);

    // Set today's date
    const todayFormatted = new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    document.getElementById('schedDateTitle').textContent = `Today — ${todayFormatted}`;

    // Load appointments
    document.getElementById('schedList').innerHTML = '<div style="color:var(--text-hint);font-size:13px">Loading...</div>';

    const doctorName = currentProfile?.full_name || '';

    // Fetch appointments by doctor name
    const { data: apptsByName, error: apptErr } = await sb
        .from('appointments')
        .select('*')
        .eq('doctor_name', doctorName)
        .order('appointment_date', { ascending: true });

    // Also fetch by doctor_id
    const { data: apptsById } = await sb
        .from('appointments')
        .select('*')
        .eq('doctor_id', currentUser.id)
        .order('appointment_date', { ascending: true });

    // Merge and deduplicate
    const allRaw = [...(apptsByName || []), ...(apptsById || [])];
    const seen = new Set();
    const sched = allRaw.filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
    });

    await syncAppointmentStatusesInDb(sched);
    sched.forEach(a => {
        const target = getTargetAppointmentStatus(a);
        if (a.status !== 'cancelled' && a.status !== 'completed') a.status = target;
    });

    // KPI calculations
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAppts = sched.filter(s => s.appointment_date === todayStr && s.status !== 'cancelled');
    document.getElementById('kpiAppts').textContent = todayAppts.length;

    const attendanceBase = sched.filter(s => s.status === 'completed' || s.status === 'incomplete');
    const completedCount = sched.filter(s => s.status === 'completed').length;
    const attendance = attendanceBase.length > 0
        ? Math.round((completedCount / attendanceBase.length) * 100)
        : null;
    document.getElementById('kpiAttendance').textContent =
        attendance !== null ? attendance + '%' : 'N/A';

    // Rating from profile
    const docRating = currentProfile?.rating;
    document.getElementById('kpiRating').textContent = docRating ? parseFloat(docRating).toFixed(1) + ' ⭐' : 'No ratings';

    // Render schedule list
    if (sched.length === 0) {
        document.getElementById('schedList').innerHTML = `
      <div style="color:var(--text-hint);font-size:13px;padding:1rem 0">
        No appointments yet.<br>
        <span style="font-size:11px">Doctor name in DB: "${doctorName}"</span>
      </div>`;
    } else {
        document.getElementById('schedList').innerHTML = sched.map(a => renderScheduleApptRow(a)).join('');
    }

    const { data: visitDays } = await fetchDoctorVisitDays(currentUser.id);
    const activeDays = new Set((visitDays || []).map(d => d.day_name));
    const timeFor = (day) => {
        const row = (visitDays || []).find(d => d.day_name === day);
        if (!row) return 'Off';
        const fmt = t => (t || '').slice(0, 5);
        return `${fmt(row.start_time)}–${fmt(row.end_time)}`;
    };

    document.getElementById('availList').innerHTML = DAYS.map(d => `
    <div class="avail-row">
      <span class="avail-day">${d}</span>
      <span class="avail-time">${activeDays.has(d) ? timeFor(d) : 'Off'}</span>
      <div class="toggle ${activeDays.has(d) ? 'on' : ''}" title="Edit via ✏️ Edit Availability">
        <div class="toggle-k"></div>
      </div>
    </div>`).join('') || '<p style="font-size:13px;color:var(--text-hint)">No visit days set yet.</p>';
}

async function syncAppointmentStatusesInDb(appts) {
    const toUpdate = (appts || []).filter(a => {
        if (a.status === 'cancelled' || a.status === 'completed') return false;
        const target = getTargetAppointmentStatus(a);
        return a.status !== target;
    });

    for (const a of toUpdate) {
        const target = getTargetAppointmentStatus(a);
        const { error } = await sb
            .from('appointments')
            .update({ status: target })
            .eq('id', a.id);
        if (!error) a.status = target;
        else console.warn('Status sync failed:', a.id, error.message);
    }
}

function renderScheduleApptRow(a) {
    const status = a.status === 'completed' || a.status === 'cancelled'
        ? a.status
        : getTargetAppointmentStatus(a);
    const badge = STATUS_BADGES[status] || 'badge-pending';
    const label = formatAppointmentStatus(status);
    const markBtn = canMarkAppointmentComplete(a)
        ? `<button type="button" class="btn-mark-complete" onclick="completeAppointment('${a.id}')">✓ Mark complete</button>`
        : '';

    return `
      <div class="appt-row">
        <div class="ar-time" style="min-width:90px;font-size:11px">
          ${a.appointment_date}<br>${a.appointment_time}
        </div>
        <div class="ar-info">
          <div class="ar-name">${a.patient_name}</div>
          <div class="ar-sym">${a.note || a.doctor_specialty || 'No note'}</div>
        </div>
        <div class="appt-row-actions">
          <span class="ar-badge appt-badge ${badge}">${label}</span>
          ${markBtn}
        </div>
      </div>`;
}

async function openAvailabilityEditor() {
    const { data: visitDays, error } = await fetchDoctorVisitDays(currentUser.id);
    if (error) {
        showToast('❌ Could not load visit days');
        return;
    }

    const active = new Set((visitDays || []).map(d => d.day_name));
    document.getElementById('availEditorGrid').innerHTML = DAYS.map(day => `
      <label class="avail-edit-row">
        <input type="checkbox" data-day="${day}" ${active.has(day) ? 'checked' : ''} />
        <span>${day}</span>
        <span class="avail-edit-hint">9:00 AM – 5:00 PM</span>
      </label>`).join('');

    openModal('availabilityModal');
}

async function saveAvailability() {
    const days = [...document.querySelectorAll('#availEditorGrid input[type="checkbox"]:checked')]
        .map(cb => cb.dataset.day);

    if (days.length === 0) return showToast('⚠️ Select at least one visit day');

    const { error } = await saveDoctorVisitDays(currentUser.id, days);
    if (error) {
        showToast('❌ Save failed: ' + error.message);
        return;
    }

    closeModal('availabilityModal');
    showToast('✅ Visit days updated');
    renderDoctorPortal();
}

// ═══════════════════════════════════
// SCHEDULE: AVAILABLE / OFFLINE (today)
// ════════════════════════════════════

function syncScheduleStatusToggle(isAvailable) {
    const toggle = document.getElementById('statusToggle');
    const label = document.getElementById('statusTxt');
    const pill = document.getElementById('statusPill');
    if (!toggle || !label) return;

    toggle.classList.toggle('on', isAvailable);
    label.textContent = isAvailable ? 'Available' : 'Offline';
    if (pill) pill.classList.toggle('is-offline', !isAvailable);
}

async function toggleStatus() {
    const toggle = document.getElementById('statusToggle');
    if (!toggle) return;

    const nextAvailable = !toggle.classList.contains('on');
    syncScheduleStatusToggle(nextAvailable);

    const { data, error } = await sb
        .from('profiles')
        .update({ is_available: nextAvailable })
        .eq('id', currentUser.id)
        .select('is_available');

    const row = data?.[0];
    if (error || !row) {
        syncScheduleStatusToggle(!nextAvailable);
        showToast(error ? '❌ Status update failed: ' + error.message : '❌ Status not saved');
        return;
    }

    currentProfile.is_available = row.is_available;
    syncScheduleStatusToggle(row.is_available);
    showToast(
        row.is_available
            ? '🟢 Available — patients can book for today'
            : '🔴 Offline — no new bookings for today'
    );
}

// ═══════════════════════════════════
// GET TODAY SCHEDULE
// ════════════════════════════════════

async function getTodaySchedule() {
    const todayStr = new Date().toISOString().split('T')[0];

    const { data, error } = await sb
        .from('appointments')
        .select('*')
        .eq('doctor_name', currentProfile?.full_name)
        .eq('appointment_date', todayStr)
        .neq('status', 'cancelled')
        .order('appointment_time', { ascending: true });

    if (error) {
        console.error('Error fetching today schedule:', error);
        return [];
    }

    return data || [];
}

// ═══════════════════════════════════
// GET WEEKLY SCHEDULE
// ════════════════════════════════════

async function getWeeklySchedule() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const { data, error } = await sb
        .from('appointments')
        .select('*')
        .eq('doctor_name', currentProfile?.full_name)
        .gte('appointment_date', weekStart.toISOString().split('T')[0])
        .lte('appointment_date', weekEnd.toISOString().split('T')[0])
        .neq('status', 'cancelled')
        .order('appointment_date', { ascending: true });

    if (error) {
        console.error('Error fetching weekly schedule:', error);
        return [];
    }

    return data || [];
}

// ═══════════════════════════════════
// UPDATE AVAILABILITY
// ════════════════════════════════════

async function updateAvailability(day, available) {
    const { error } = await sb
        .from('profiles')
        .update({ [`avail_${day}`]: available })
        .eq('id', currentUser.id);

    if (error) {
        showToast('❌ Failed to update availability');
        return false;
    }

    showToast(`✅ ${day} availability updated`);
    return true;
}

// ═══════════════════════════════════
// GET DOCTOR STATS
// ════════════════════════════════════

async function getDoctorStats() {
    const doctorName = currentProfile?.full_name;

    // Total appointments
    const { count: totalCount } = await sb
        .from('appointments')
        .select('id', { count: 'exact' })
        .eq('doctor_name', doctorName);

    // This month's appointments
    const monthStart = new Date();
    monthStart.setDate(1);

    const { count: monthCount } = await sb
        .from('appointments')
        .select('id', { count: 'exact' })
        .eq('doctor_name', doctorName)
        .gte('appointment_date', monthStart.toISOString().split('T')[0]);

    // Confirmed vs cancelled
    const { data: allAppts } = await sb
        .from('appointments')
        .select('status')
        .eq('doctor_name', doctorName);

    const confirmed = (allAppts || []).filter(a => a.status === 'confirmed').length;
    const cancelled = (allAppts || []).filter(a => a.status === 'cancelled').length;
    const total = allAppts?.length || 0;

    return {
        totalAppointments: totalCount || 0,
        monthAppointments: monthCount || 0,
        confirmedCount: confirmed,
        cancelledCount: cancelled,
        attendanceRate: total > 0 ? Math.round((confirmed / total) * 100) : 0
    };
}

// ═══════════════════════════════════
// UPDATE APPOINTMENT STATUS
// ════════════════════════════════════

async function updateAppointmentStatus(apptId, status) {
    const { data, error } = await sb
        .from('appointments')
        .update({ status })
        .eq('id', apptId)
        .select('id, status')
        .maybeSingle();

    if (error || !data) {
        showToast(error ? '❌ Failed to update status: ' + error.message : '❌ Status not saved');
        return false;
    }

    showToast(`✅ Appointment marked as ${formatAppointmentStatus(status)}`);
    renderDoctorPortal();
    const docApptPage = document.getElementById('page-doc-appointments');
    if (docApptPage?.classList.contains('active')) {
        const activeBtn = document.querySelector('#page-doc-appointments .filter-btn.active');
        const filter = activeBtn?.textContent?.trim().toLowerCase() || 'all';
        loadDocAppointments(filter === 'all' ? 'all' : filter);
    }
    return true;
}

// ═══════════════════════════════════
// COMPLETE APPOINTMENT
// ════════════════════════════════════

async function completeAppointment(apptId) {
    return updateAppointmentStatus(apptId, 'completed');
}

// ═══════════════════════════════════
// CANCEL APPOINTMENT (DOCTOR)
// ════════════════════════════════════

async function cancelAppointmentDoctor(apptId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
        return;
    }
    return updateAppointmentStatus(apptId, 'cancelled');
}

// ═══════════════════════════════════
// NO-SHOW APPOINTMENT
// ════════════════════════════════════

async function markNoShow(apptId) {
    return updateAppointmentStatus(apptId, 'no-show');
}

// ═══════════════════════════════════
// GET UPCOMING APPOINTMENTS
// ════════════════════════════════════

async function getUpcomingAppointments() {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await sb
        .from('appointments')
        .select('*')
        .eq('doctor_name', currentProfile?.full_name)
        .gte('appointment_date', today)
        .eq('status', 'confirmed')
        .order('appointment_date', { ascending: true })
        .limit(10);

    if (error) {
        console.error('Error fetching upcoming:', error);
        return [];
    }

    return data || [];
}

// ═══════════════════════════════════
// GET PATIENT INFO
// ════════════════════════════════════

async function getPatientInfo(patientId) {
    const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching patient:', error);
        return null;
    }

    return data;
}

// ═══════════════════════════════════
// GET APPOINTMENTS BY DATE RANGE
// ════════════════════════════════════

async function getAppointmentsByRange(startDate, endDate) {
    const { data, error } = await sb
        .from('appointments')
        .select('*')
        .eq('doctor_name', currentProfile?.full_name)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date', { ascending: true });

    if (error) {
        console.error('Error fetching range:', error);
        return [];
    }

    return data || [];
}

// ═══════════════════════════════════
// GET DOCTOR SCHEDULE FOR WEEK
// ════════════════════════════════════

async function getWeeklyAvailability() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const availability = {};

    // Get from profile or default
    days.forEach(day => {
        availability[day] = {
            enabled: day !== 'Wed' && day !== 'Sat',
            startTime: '09:00 AM',
            endTime: '05:00 PM'
        };
    });

    return availability;
}

// ═══════════════════════════════════
// SET WORKING HOURS
// ════════════════════════════════════

async function setWorkingHours(day, startTime, endTime) {
    const { error } = await sb
        .from('profiles')
        .update({
            [`work_day_${day}`]: true,
            [`work_start_${day}`]: startTime,
            [`work_end_${day}`]: endTime
        })
        .eq('id', currentUser.id);

    if (error) {
        showToast('❌ Failed to set working hours');
        return false;
    }

    showToast('✅ Working hours updated');
    return true;
}
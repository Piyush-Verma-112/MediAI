/* ═══════════════════════════════════
   PATIENT FUNCTIONALITY
   Patient Appointments & History
═══════════════════════════════════ */

// ═══════════════════════════════════
// LOAD MY APPOINTMENTS
// ════════════════════════════════════

async function loadMyAppointments() {
    const wrap = document.getElementById('apptListWrap');
    if (!wrap) return;
    wrap.innerHTML = '<div style="color:var(--text-hint);padding:1rem">Loading...</div>';

    const { data, error } = await sb
        .from('appointments')
        .select('*')
        .eq('patient_id', currentUser.id)
        .order('appointment_date', { ascending: false });

    if (error || !data || data.length === 0) {
        wrap.innerHTML = `<div class="empty-state">
      <div class="es-icon">📭</div>
      <p>No appointments yet.<br>Find a doctor and book your first appointment!</p>
    </div>`;
        return;
    }

    await syncAppointmentStatusesInDb(data);
    data.forEach(a => {
        if (a.status !== 'cancelled' && a.status !== 'completed') {
            a.status = getTargetAppointmentStatus(a);
        }
    });

    wrap.innerHTML = buildApptList(data);
}

// ═══════════════════════════════════
// BUILD APPOINTMENT LIST
// ════════════════════════════════════

function buildApptList(appts) {
    return `<div class="appt-list">${appts.map(a => {
        const displayStatus = a.status === 'completed' || a.status === 'cancelled'
            ? a.status
            : getTargetAppointmentStatus(a);
        const canRate = canPatientRateAppointment(a);
        const canCancel = ['upcoming', 'confirmed', 'pending'].includes(a.status)
            && !hasAppointmentTimeArrived(a);
        const ratedLabel = hasPatientRated(a)
            ? `<span style="font-size:11px;color:var(--amber);font-weight:600">${Number(a.patient_rating).toFixed(1)} ★ Rated</span>`
            : '';

        return `<div class="appt-card">
      <div class="appt-card-left">
        <div class="appt-card-doc">${a.doctor_name}</div>
        <div class="appt-card-meta">${a.doctor_specialty || ''} · ${a.doctor_hospital || ''}</div>
        <div class="appt-card-meta" style="margin-top:4px">
          📅 ${a.appointment_date} at ${a.appointment_time} · ₹${a.fee || '—'}
        </div>
        ${a.note ? `<div class="appt-card-meta" style="margin-top:4px">📝 ${a.note}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <span class="appt-badge ${STATUS_BADGES[displayStatus] || 'badge-pending'}">${formatAppointmentStatus(displayStatus)}</span>
        ${canCancel ? `<button onclick="cancelMyAppointment('${a.id}')" style="font-size:11px;padding:4px 10px;border:1px solid var(--coral);color:var(--coral);background:transparent;border-radius:20px;cursor:pointer">Cancel</button>` : ''}
        ${canRate ? `<button onclick="openRatingModal('${a.id}','${(a.doctor_name || '').replace(/'/g, "\\'")}')" style="font-size:11px;padding:4px 10px;border:1px solid var(--amber);color:var(--amber);background:transparent;border-radius:20px;cursor:pointer">Rate visit</button>` : ''}
        ${ratedLabel}
      </div>
    </div>`;
    }).join('')}</div>`;
}

// ═══════════════════════════════════
// CANCEL APPOINTMENT
// ════════════════════════════════════

async function cancelMyAppointment(apptId) {
    openModal('cancelConfirmModal');

    document.getElementById('cancelConfirmBtn').onclick = async () => {
        closeModal('cancelConfirmModal');

        const { error } = await sb
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', apptId)
            .eq('patient_id', currentUser.id);

        if (error) { showToast('❌ Failed to cancel appointment'); return; }

        showToast('✅ Appointment cancelled');
        loadMyAppointments();
    };
}

// ═══════════════════════════════════
// PATIENT STATS
// ════════════════════════════════════

async function getPatientStats() {
    const { data: allAppts } = await sb
        .from('appointments')
        .select('id, status, appointment_date')
        .eq('patient_id', currentUser.id);

    const today = getTodayStr();
    const all = allAppts || [];
    const upcoming = all.filter(a => a.appointment_date >= today && a.status !== 'cancelled');
    const cancelled = all.filter(a => a.status === 'cancelled');
    const doctors = [...new Set(all.map(a => a.doctor_name).filter(Boolean))];

    return {
        totalAppointments: all.length,
        upcomingCount: upcoming.length,
        cancelledCount: cancelled.length,
        doctorsVisited: doctors.length
    };
}

// ═══════════════════════════════════
// REVIEW HELPERS
// ════════════════════════════════════

async function addDoctorReview(doctorId, rating, review) {
    const { error } = await sb.from('reviews').insert([{
        patient_id: currentUser.id,
        doctor_id: doctorId,
        rating,
        review,
        created_at: new Date().toISOString()
    }]);

    if (error) { showToast('❌ Failed to add review'); return false; }
    showToast('✅ Review added!');
    return true;
}

async function getDoctorReviews(doctorId) {
    const { data, error } = await sb
        .from('reviews')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

    if (error) { console.error('Error fetching reviews:', error); return []; }
    return data || [];
}

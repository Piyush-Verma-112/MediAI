/* ═══════════════════════════════════
   BOOKING FUNCTIONALITY
   Appointment Booking & Slot Management
═══════════════════════════════════ */

// currentDoctor is declared in config.js

// ═══════════════════════════════════
// OPEN BOOKING MODAL
// ════════════════════════════════════

async function openBooking(doc) {
    currentDoctor = doc;

    // Update modal header (uses IDs from index.html)
    document.getElementById('bookingDoctorName').textContent = 'Book — ' + (doc.full_name || 'Doctor');
    document.getElementById('bookingDoctorMeta').textContent =
        `${doc.specialty || ''} · ${doc.hospital || ''} · ₹${doc.fee || '—'}`;

    const today = getTodayStr();
    const bkDate = document.getElementById('bookingDate');
    bkDate.min = today;
    bkDate.value = today;
    bkDate.onchange = () => loadSlots();

    const canBookToday = await fetchDoctorIsAvailable(doc.id);
    if (!canBookToday) {
        const tomorrow = getTomorrowStr();
        bkDate.value = tomorrow;
    }

    document.getElementById('bookingReason').value = '';

    // Clear slots
    document.getElementById('slotsGrid').innerHTML =
        '<p class="slots-hint" style="color:var(--text-hint);font-size:13px">Pick a date to see available slots</p>';

    // Open the modal
    openModal('bookingModal');

    await loadSlots();
}

// ═══════════════════════════════════
// LOAD SLOTS (called by onchange & openBooking)
// ════════════════════════════════════

async function loadSlots() {
    const date = document.getElementById('bookingDate').value;
    if (!date || !currentDoctor) return;
    await loadSlotsForDate(currentDoctor, date);
}

// ═══════════════════════════════════
// LOAD SLOTS FOR DATE
// ════════════════════════════════════

async function loadSlotsForDate(doc, date) {
    const grid = document.getElementById('slotsGrid');
    grid.innerHTML = '<div style="grid-column:1/-1;font-size:13px;color:var(--text-hint)">Checking availability...</div>';

    const doctorId = doc.id;
    const today = getTodayStr();

    if (doctorId && date === today) {
        const online = await fetchDoctorIsAvailable(doctorId);
        if (!online) {
            grid.innerHTML = `<p class="slots-hint" style="grid-column:1/-1;color:var(--coral)">
        <strong>Doctor is offline today.</strong> Please choose a future date or try again later.
      </p>`;
            return;
        }
    }

    if (doctorId) {
        const { data: visitDays, error: visitErr } = await fetchDoctorVisitDays(doctorId);
        if (!visitErr && visitDays && visitDays.length > 0) {
            const dayName = getDayNameFromDate(date);
            const allowed = visitDays.map(d => d.day_name);
            if (!allowed.includes(dayName)) {
                grid.innerHTML = `<p class="slots-hint" style="grid-column:1/-1;color:var(--coral)">
          Doctor is not available on <strong>${dayName}</strong>. Please pick another date.
        </p>`;
                return;
            }
        }
    }

    const doctorName = doc.full_name || doc.name;

    const { data: bookedAppts } = await sb
        .from('appointments')
        .select('appointment_time, status')
        .eq('doctor_name', doctorName)
        .eq('appointment_date', date)
        .neq('status', 'cancelled');

    const slotCount = {};
    (bookedAppts || []).forEach(a => {
        slotCount[a.appointment_time] = (slotCount[a.appointment_time] || 0) + 1;
    });

    grid.innerHTML = ALL_SLOTS.map(s => {
        const count = slotCount[s] || 0;
        const past = isSlotInPast(date, s);
        const isFull = count >= MAX_PER_SLOT;
        const unavailable = isFull || past;
        const spotsLeft = MAX_PER_SLOT - count;
        const endTime = getEndTime(s);

        return `<div class="slot${unavailable ? ' taken' : ''}"
      data-time="${s}"
      onclick="${unavailable ? '' : 'pickSlot(this)'}"
      title="${past ? 'This time has passed' : isFull ? 'Slot full (6/6)' : spotsLeft + ' spot(s) left'}">
      <span style="font-weight:600">${s}</span>
      <span style="font-size:10px;opacity:0.7;display:block">to ${endTime}</span>
      ${past
            ? '<span style="font-size:9px;color:var(--text-hint);font-weight:600">Past</span>'
            : isFull
                ? '<span style="font-size:9px;color:var(--coral);font-weight:600">Full</span>'
                : spotsLeft <= 2
                    ? `<span style="font-size:9px;color:var(--amber);font-weight:600">${spotsLeft} left</span>`
                    : `<span style="font-size:9px;color:var(--teal-dark)">${spotsLeft} spots</span>`}
    </div>`;
    }).join('');
}

// ═══════════════════════════════════
// PICK SLOT
// ════════════════════════════════════

function pickSlot(el) {
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
}

// ═══════════════════════════════════
// CONFIRM BOOKING
// ════════════════════════════════════

async function confirmBooking() {
    const slot = document.querySelector('.slot.selected');
    const date = document.getElementById('bookingDate').value;
    const reason = document.getElementById('bookingReason').value.trim();

    let valid = true;

    if (!slot) {
        showToast('⚠️ Please select a time slot');
        valid = false;
    }

    if (!date) {
        showToast('⚠️ Please select a date');
        valid = false;
    }

    if (!valid) return;

    const today = getTodayStr();
    if (date < today) {
        showToast('⚠️ Cannot book an appointment in the past');
        return;
    }

    if (date === today && currentDoctor?.id) {
        const online = await fetchDoctorIsAvailable(currentDoctor.id);
        if (!online) {
            showToast('⚠️ Doctor is offline today — please pick another date');
            return;
        }
    }

    const slotTime = slot.getAttribute('data-time');
    if (isSlotInPast(date, slotTime)) {
        showToast('⚠️ This time slot has already passed — pick a later slot or another day');
        return;
    }

    if (!currentUser) {
        showToast('⚠️ Please log in to book an appointment');
        return;
    }

    const patientName = currentProfile?.full_name || currentUser.email;
    const patientPhone = currentProfile?.phone || '';

    // Build appointment object
    const appt = {
        patient_id: currentUser.id,
        patient_name: patientName,
        patient_phone: patientPhone,
        doctor_id: currentDoctor.id || null,
        doctor_name: currentDoctor.full_name || currentDoctor.name || 'Doctor',
        doctor_specialty: currentDoctor.specialty || '',
        doctor_hospital: currentDoctor.hospital || '',
        appointment_date: date,
        appointment_time: slot.getAttribute('data-time'),
        fee: currentDoctor.fee || 0,
        note: reason,
        status: 'upcoming'
    };

    // Disable button
    const btn = document.getElementById('confirmBookingBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    const { error } = await sb.from('appointments').insert([appt]);

    btn.disabled = false;
    btn.innerHTML = '<span>Confirm Booking</span>';

    if (error) {
        showToast('⚠️ Booking failed: ' + error.message);
        return;
    }

    closeModal('bookingModal');
    showToast(`✅ Appointment confirmed with ${appt.doctor_name} on ${date} at ${slot.getAttribute('data-time')}!`);

    // Refresh appointments list if on that page
    const apptPage = document.getElementById('page-appointments');
    if (apptPage && apptPage.classList.contains('active')) {
        loadMyAppointments();
    }
}

// ═══════════════════════════════════
// CHECK SLOT AVAILABILITY
// ════════════════════════════════════

async function checkSlotAvailability(doctorName, date, time) {
    const { data, error } = await sb
        .from('appointments')
        .select('id')
        .eq('doctor_name', doctorName)
        .eq('appointment_date', date)
        .eq('appointment_time', time)
        .neq('status', 'cancelled');

    if (error) { console.error('Error checking slot:', error); return false; }
    return (data || []).length < MAX_PER_SLOT;
}

// ═══════════════════════════════════
// RESCHEDULE APPOINTMENT
// ════════════════════════════════════

async function rescheduleAppointment(apptId, newDate, newTime) {
    const { error } = await sb
        .from('appointments')
        .update({ appointment_date: newDate, appointment_time: newTime, status: 'pending' })
        .eq('id', apptId);

    if (error) { showToast('❌ Failed to reschedule'); return; }
    showToast('✅ Appointment rescheduled!');
    loadMyAppointments();
}

// ═══════════════════════════════════
// RATING HELPERS
// ════════════════════════════════════

let _selectedRating = 0;
let _ratingApptId = null;

function setRating(val) {
    _selectedRating = val;
    document.querySelectorAll('.star').forEach((s, i) => {
        s.style.color = i < val ? '#BA7517' : '#ccc';
    });
}

async function openRatingModal(apptId, doctorName) {
    _ratingApptId = apptId;
    _selectedRating = 0;

    const { data: appt } = await sb
        .from('appointments')
        .select('id, status, patient_rating, rating_comment')
        .eq('id', apptId)
        .eq('patient_id', currentUser.id)
        .maybeSingle();

    if (!appt || appt.status !== 'completed') {
        showToast('⚠️ You can rate only after the doctor marks the visit complete');
        return;
    }
    if (hasPatientRated(appt)) {
        showToast('✅ You already rated this visit');
        return;
    }

    document.getElementById('ratingDoctorName').textContent = doctorName;
    document.querySelectorAll('.star').forEach(s => s.style.color = '#ccc');
    document.getElementById('ratingComment').value = '';
    openModal('ratingModal');
}

async function updateDoctorProfileRating(doctorId) {
    if (!doctorId) return;
    const { data: rows } = await sb
        .from('appointments')
        .select('patient_rating')
        .eq('doctor_id', doctorId)
        .not('patient_rating', 'is', null);

    const ratings = (rows || [])
        .map(r => Number(r.patient_rating))
        .filter(n => n > 0 && n <= 5);
    if (!ratings.length) return;

    const avg = Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10;
    await sb.from('profiles').update({ rating: avg }).eq('id', doctorId);
}

async function submitRating() {
    if (!_selectedRating) { showToast('⚠️ Please select a rating'); return; }
    if (!_ratingApptId) return;

    const comment = document.getElementById('ratingComment').value.trim();

    const { data: appt, error: fetchErr } = await sb
        .from('appointments')
        .select('id, status, doctor_id, patient_rating')
        .eq('id', _ratingApptId)
        .eq('patient_id', currentUser.id)
        .maybeSingle();

    if (fetchErr || !appt) {
        showToast('❌ Could not find appointment');
        return;
    }
    if (appt.status !== 'completed') {
        showToast('⚠️ Rating is available only after the doctor marks the visit complete');
        return;
    }
    if (hasPatientRated(appt)) {
        showToast('✅ You already rated this visit');
        closeModal('ratingModal');
        return;
    }

    const { error } = await sb
        .from('appointments')
        .update({
            patient_rating: _selectedRating,
            rating_comment: comment || null
        })
        .eq('id', _ratingApptId)
        .eq('patient_id', currentUser.id);

    if (error) {
        showToast('❌ Failed to save rating: ' + error.message);
        return;
    }

    await updateDoctorProfileRating(appt.doctor_id);

    closeModal('ratingModal');
    showToast('✅ Thank you for your rating!');
    _ratingApptId = null;

    const apptPage = document.getElementById('page-appointments');
    if (apptPage?.classList.contains('active')) loadMyAppointments();
}

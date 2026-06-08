/* ═══════════════════════════════════
   CONFIGURATION
   API Keys & Constants
═══════════════════════════════════ */

// ═══════════════════════════════════
// 🔧 REPLACE WITH YOUR KEYS
// ════════════════════════════════════

const SUPABASE_URL = 'https://myskwxvqgtregvjjudjn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_q0TcXZLlUvD-LMxy1FXh_A_KNys3F_f';
const GROQ_KEY = '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';

// ═══════════════════════════════════
// CONSTANTS
// ════════════════════════════════════

const ALL_SLOTS = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
];

const MAX_PER_SLOT = 6;

const SPEC_ICONS = {
    'Cardiologist': '❤️',
    'Neurologist': '🧠',
    'Dermatologist': '🩺',
    'Orthopedist': '🦴',
    'Psychiatrist': '🧘',
    'Gastroenterologist': '🫁',
    'Pulmonologist': '🫀',
    'General Physician': '👨‍⚕️',
    'ENT Specialist': '👂',
    'Ophthalmologist': '👁️',
    'Endocrinologist': '🔬',
    'Pediatrician': '👶'
};

const AVATAR_COLORS = [
    ['#E1F5EE', '#085041'],
    ['#E6F1FB', '#0C447C'],
    ['#FAECE7', '#993C1D'],
    ['#FAEEDA', '#854F0B'],
    ['#FBEAF0', '#72243E']
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SIGNUP_DEFAULT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function getDayNameFromDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

async function fetchDoctorVisitDays(doctorId) {
    if (!sb || !doctorId) return { data: [], error: null };
    return sb
        .from('doctor_availability')
        .select('day_name, start_time, end_time')
        .eq('doctor_id', doctorId);
}

async function fetchDoctorIsAvailable(doctorId) {
    if (!sb || !doctorId) return true;
    const { data } = await sb
        .from('profiles')
        .select('is_available')
        .eq('id', doctorId)
        .maybeSingle();
    return data?.is_available !== false;
}

async function saveDoctorVisitDays(doctorId, dayNames, opts = {}) {
    if (!sb || !doctorId) return { error: { message: 'Database not ready' } };

    const startTime = opts.startTime || '09:00:00';
    const endTime = opts.endTime || '17:00:00';

    const { error: delErr } = await sb
        .from('doctor_availability')
        .delete()
        .eq('doctor_id', doctorId);

    if (delErr) return { error: delErr };

    if (!dayNames || dayNames.length === 0) return { error: null };

    const rows = dayNames.map(day_name => ({
        doctor_id: doctorId,
        day_name,
        start_time: startTime,
        end_time: endTime
    }));

    return sb.from('doctor_availability').insert(rows);
}

const STATUS_BADGES = {
    'upcoming': 'badge-upcoming',
    'incomplete': 'badge-incomplete',
    'completed': 'badge-completed',
    'confirmed': 'badge-confirmed',
    'pending': 'badge-pending',
    'cancelled': 'badge-cancelled'
};

function parseAppointmentTime(timeStr) {
    if (!timeStr) return { h: 0, m: 0 };
    const parts = timeStr.trim().split(' ');
    const [time, ampm] = parts.length >= 2 ? [parts[0], parts[1]] : [parts[0], 'AM'];
    let [h, m] = time.split(':').map(Number);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return { h: h || 0, m: m || 0 };
}

function getAppointmentDateTime(dateStr, timeStr) {
    const { h, m } = parseAppointmentTime(timeStr);
    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d;
}

function hasAppointmentTimeArrived(appt) {
    if (!appt?.appointment_date || !appt?.appointment_time) return false;
    return getAppointmentDateTime(appt.appointment_date, appt.appointment_time) <= new Date();
}

function getTargetAppointmentStatus(appt) {
    const s = appt.status;
    if (s === 'cancelled' || s === 'completed') return s;
    if (!hasAppointmentTimeArrived(appt)) return 'upcoming';
    return 'incomplete';
}

function canMarkAppointmentComplete(appt) {
    if (!appt || appt.status === 'completed' || appt.status === 'cancelled') return false;
    return hasAppointmentTimeArrived(appt);
}

function isSlotInPast(dateStr, timeStr) {
    if (!dateStr || !timeStr) return false;
    return getAppointmentDateTime(dateStr, timeStr) <= new Date();
}

function hasPatientRated(appt) {
    const r = appt?.patient_rating;
    return r != null && r !== '' && Number(r) > 0;
}

function canPatientRateAppointment(appt) {
    return appt?.status === 'completed' && !hasPatientRated(appt);
}

function formatAppointmentStatus(status) {
    const labels = {
        upcoming: 'Upcoming',
        incomplete: 'Incomplete',
        completed: 'Completed',
        cancelled: 'Cancelled',
        confirmed: 'Confirmed',
        pending: 'Pending'
    };
    return labels[status] || status;
}

// ═══════════════════════════════════
// RISK HELPERS
// ════════════════════════════════════

function getRiskColor(risk) {
    if (risk >= 60) return 'var(--coral)';
    if (risk >= 35) return 'var(--amber)';
    return 'var(--teal-dark)';
}

function getRiskBg(risk) {
    if (risk >= 60) return 'var(--coral-light)';
    if (risk >= 35) return 'var(--amber-light)';
    return 'var(--teal-light)';
}

function getRiskLabel(risk) {
    if (risk >= 60) return 'Send Reminder';
    if (risk >= 35) return 'Monitor';
    return 'Low Risk';
}

// ═══════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════

function getEndTime(start) {
    const [time, ampm] = start.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    h += 1;
    const newAmpm = h >= 12 && h < 24 ? 'PM' : 'AM';
    const disp = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${disp}:${m.toString().padStart(2, '0')} ${newAmpm}`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function getTomorrowStr() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// ═══════════════════════════════════
// GLOBAL STATE
// (declared once here, used everywhere)
// ════════════════════════════════════

let sb = null;
let currentUser = null;
let currentProfile = null;
let currentRole = 'patient';
let currentTab = 'login';
let currentDoctor = null;

// ═══════════════════════════════════
// SUPABASE INIT
// ════════════════════════════════════

function isConfigValid() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
        SUPABASE_ANON_KEY !== 'YOUR_ANON_KEY' &&
        !SUPABASE_URL.includes('YOUR_');
}

// Initialize immediately so all scripts below can use `sb`
(function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.warn('Supabase library not loaded');
        return;
    }
    const { createClient } = supabase;
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();

/* ═══════════════════════════════════
   DASHBOARD FUNCTIONALITY
   Analytics & Statistics
═══════════════════════════════════ */

async function renderDashboard() {
    const { data: allAppts } = await sb
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: false });

    const { data: allDoctors } = await sb
        .from('profiles')
        .select('*')
        .eq('role', 'doctor');

    const { data: allPatients } = await sb
        .from('profiles')
        .select('*')
        .eq('role', 'patient');

    const appts = allAppts || [];
    const doctors = allDoctors || [];
    const patients = allPatients || [];
    const today = getTodayStr();

    // ─── KPI Cards ───────────────────────────────
    const todayAppts = appts.filter(a => a.appointment_date === today);
    const totalAppts = appts.length;
    const cancelledAppts = appts.filter(a => a.status === 'cancelled').length;
    const noShowRate = totalAppts > 0 ? ((cancelledAppts / totalAppts) * 100).toFixed(1) : '0.0';

    document.querySelector('.kpis').innerHTML = `
    <div class="kpi-big">
      <div class="val" style="color:var(--teal)">${todayAppts.length}</div>
      <div class="lbl">Appointments Today</div>
      <div class="delta d-up">${totalAppts} total all time</div>
    </div>
    <div class="kpi-big">
      <div class="val" style="color:var(--coral)">${noShowRate}%</div>
      <div class="lbl">Cancellation Rate</div>
      <div class="delta">${cancelledAppts} cancelled total</div>
    </div>
    <div class="kpi-big">
      <div class="val" style="color:var(--blue)">${doctors.length}</div>
      <div class="lbl">Doctors Onboarded</div>
      <div class="delta d-up">Active on platform</div>
    </div>
    <div class="kpi-big">
      <div class="val" style="color:var(--amber)">${patients.length}</div>
      <div class="lbl">Patients Registered</div>
      <div class="delta d-up">Total signups</div>
    </div>`;

    // ─── Bar Chart: Last 7 Days ───────────────────
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const count = appts.filter(a => a.appointment_date === dateStr).length;
        last7.push({ day: dayName, count, isToday: i === 0 });
    }

    const mx = Math.max(...last7.map(d => d.count), 1);
    document.getElementById('barChart').innerHTML = last7.map(d => `
    <div class="bw">
      <div class="bval">${d.count}</div>
      <div class="bar" style="height:${Math.round((d.count / mx) * 100)}%;background:${d.isToday ? 'var(--teal)' : 'var(--teal-mid)'}"></div>
      <div class="blbl">${d.day}</div>
    </div>`).join('');

    // ─── No-show Risk Scoring ─────────────────────
    const upcoming = appts.filter(a => a.appointment_date >= today && a.status === 'confirmed');

    const cancelCount = {};
    appts.filter(a => a.status === 'cancelled').forEach(a => {
        cancelCount[a.patient_name] = (cancelCount[a.patient_name] || 0) + 1;
    });

    const scored = upcoming.map(a => {
        let score = 10;
        score += (cancelCount[a.patient_name] || 0) * 25;
        const bookDate = new Date(a.created_at || today);
        const apptDate = new Date(a.appointment_date);
        const leadDays = Math.ceil((apptDate - bookDate) / (1000 * 60 * 60 * 24));
        if (leadDays <= 1) score += 20;
        if (leadDays > 7) score += 10;
        score = Math.min(score, 95);
        return { ...a, risk: score };
    }).sort((a, b) => b.risk - a.risk).slice(0, 5);

    const rclr = (r) => r >= 60 ? 'var(--coral)' : r >= 35 ? 'var(--amber)' : 'var(--teal-dark)';
    const rbg = (r) => r >= 60 ? 'var(--coral-light)' : r >= 35 ? 'var(--amber-light)' : 'var(--teal-light)';
    const rlab = (r) => r >= 60 ? 'Send Reminder' : r >= 35 ? 'Monitor' : 'Low Risk';

    const rfactor = (a) => {
        if ((cancelCount[a.patient_name] || 0) > 0) return `${cancelCount[a.patient_name]} prior cancellation(s)`;
        const lead = Math.ceil((new Date(a.appointment_date) - new Date(a.created_at || today)) / (1000 * 60 * 60 * 24));
        if (lead <= 1) return 'Last-minute booking';
        return 'First-time patient';
    };

    // Risk list widget
    const riskListEl = document.getElementById('riskList');
    if (riskListEl) {
        if (scored.length === 0) {
            riskListEl.innerHTML = '<div style="color:var(--text-hint);font-size:13px;padding:0.5rem 0">No upcoming appointments to score.</div>';
        } else {
            riskListEl.innerHTML = scored.map(r => `
      <div class="risk-row">
        <div class="rdot" style="background:${rclr(r.risk)}"></div>
        <div class="rname">${r.patient_name}</div>
        <div class="rpbar"><div class="rpfill" style="width:${r.risk}%;background:${rclr(r.risk)}"></div></div>
        <div class="rpct" style="color:${rclr(r.risk)}">${r.risk}%</div>
      </div>`).join('');
        }
    }

    // ─── Specialty & Peak charts ──────────────────
    renderSpecialtyChart(appts);
    renderPeakChart(appts);

    // ─── No-show risk table (rendered inline below kpis area) ───
    renderNoShowTable(scored, rclr, rbg, rlab, rfactor);
}

// ─── Render No-Show Table ────────────────────────
function renderNoShowTable(scored, rclr, rbg, rlab, rfactor) {
    // Find or create the noshow-wrap container
    let wrap = document.getElementById('noshowTableWrap');
    if (!wrap) {
        const dashPage = document.getElementById('page-dashboard');
        const div = document.createElement('div');
        div.id = 'noshowTableWrap';
        div.className = 'noshow-wrap';
        div.style.marginTop = '1.5rem';
        dashPage.appendChild(div);
        wrap = div;
    }

    if (scored.length === 0) {
        wrap.innerHTML = '<h3>🤖 No-show Risk Table</h3><div style="color:var(--text-hint);font-size:13px;padding:1rem 0">No upcoming appointments.</div>';
        return;
    }

    wrap.innerHTML = `
    <h3>🤖 No-show Risk Detail</h3>
    <table class="nst">
      <thead>
        <tr>
          <th>Patient</th>
          <th>Time</th>
          <th>Doctor</th>
          <th>Risk</th>
          <th>Factor</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${scored.map(r => `
        <tr>
          <td style="font-weight:500">${r.patient_name}</td>
          <td style="color:var(--text-muted)">${r.appointment_time}</td>
          <td style="color:var(--text-muted)">${r.doctor_name}</td>
          <td><span style="font-weight:700;color:${rclr(r.risk)}">${r.risk}%</span></td>
          <td style="font-size:13px;color:var(--text-muted)">${rfactor(r)}</td>
          <td><span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:${rbg(r.risk)};color:${rclr(r.risk)}">${rlab(r.risk)}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

// ─── Specialty Donut ─────────────────────────────
function renderSpecialtyChart(appts) {
    const el = document.getElementById('specialtyChart');
    if (!el) return;

    const counts = {};
    appts.forEach(a => {
        const s = a.doctor_specialty || 'Other';
        counts[s] = (counts[s] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const total = sorted.reduce((s, [, v]) => s + v, 0);

    if (sorted.length === 0) {
        el.innerHTML = '<div style="color:var(--text-hint);font-size:13px">No data yet</div>';
        return;
    }

    const colors = ['var(--teal)', 'var(--blue)', 'var(--amber)', 'var(--coral)', 'var(--teal-mid)', 'var(--blue-dark)'];
    el.innerHTML = sorted.map(([spec, cnt], i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:10px;height:10px;border-radius:50%;background:${colors[i % colors.length]};flex-shrink:0"></div>
        <span>${spec}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:80px;height:5px;background:var(--gray-light);border-radius:3px;overflow:hidden">
          <div style="width:${Math.round((cnt / total) * 100)}%;height:100%;background:${colors[i % colors.length]};border-radius:3px"></div>
        </div>
        <span style="font-weight:600;min-width:24px;text-align:right">${cnt}</span>
      </div>
    </div>`).join('');
}

// ─── Peak Hours ──────────────────────────────────
function renderPeakChart(appts) {
    const el = document.getElementById('peakChart');
    if (!el) return;

    const hours = {};
    ALL_SLOTS.forEach(s => { hours[s] = 0; });
    appts.forEach(a => {
        if (hours[a.appointment_time] !== undefined) hours[a.appointment_time]++;
    });

    const vals = Object.values(hours);
    const mx = Math.max(...vals, 1);

    el.innerHTML = Object.entries(hours).map(([time, count]) => `
    <div class="bw" style="flex:1">
      <div class="bval">${count}</div>
      <div class="bar" style="height:${Math.round((count / mx) * 100)}%;background:var(--blue)"></div>
      <div class="blbl" style="font-size:9px">${time.replace(' AM', 'a').replace(' PM', 'p')}</div>
    </div>`).join('');
}

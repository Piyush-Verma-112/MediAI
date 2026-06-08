/* ═══════════════════════════════════
   SEARCH FUNCTIONALITY
   AI Symptom Search & Doctor Matching
═══════════════════════════════════ */

// ═══════════════════════════════════
// QUICK SYMPTOM FILL
// ════════════════════════════════════

function qs(s) {
    document.getElementById('symptomInput').value = s;
    searchDoctors();
}

// ═══════════════════════════════════
// SEARCH DOCTORS
// ════════════════════════════════════

async function searchDoctors() {
    const query = document.getElementById('symptomInput').value.trim();
    if (!query) return;

    const btn = document.getElementById('searchBtn');
    btn.disabled = true;
    btn.textContent = '...';

    // Hide previous results
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('aiInsight').classList.remove('show');
    document.getElementById('doctorsGrid').innerHTML = skelCards(4);
    document.getElementById('resultsSection').style.display = 'block';

    try {
        // Step 1: Fetch ALL real doctors from Supabase
        const { data: allDoctors, error: dbErr } = await sb
            .from('profiles')
            .select('id, full_name, specialty, hospital, experience, fee, rating, bio, is_available, city')
            .eq('role', 'doctor');

        if (dbErr) throw new Error('DB error: ' + dbErr.message);

        if (!allDoctors || allDoctors.length === 0) {
            document.getElementById('doctorsGrid').innerHTML = `
        <div style="padding:2rem;color:var(--text-muted);grid-column:1/-1;text-align:center">
          <div style="font-size:3rem;margin-bottom:1rem">👨‍⚕️</div>
          <strong>No doctors onboarded yet.</strong><br>
          Ask a doctor to sign up on MediAI first!
        </div>`;
            return;
        }

        // Step 2: Check if query looks like a doctor name
        const isNameSearch = allDoctors.some(d =>
            d.full_name?.toLowerCase().includes(query.toLowerCase())
        );

        if (isNameSearch) {
            // Direct name match — no AI needed
            const matched = allDoctors.filter(d =>
                d.full_name?.toLowerCase().includes(query.toLowerCase())
            );
            document.getElementById('aiInsightText').innerHTML =
                `<strong>Name Search:</strong> Showing doctors matching "${query}"`;
            document.getElementById('aiInsight').classList.add('show');
            document.getElementById('resultsTitle').textContent = `${matched.length} doctor(s) found for "${query}"`;
            document.getElementById('doctorsGrid').innerHTML = matched.map((d, i) => doctorCard(d, i)).join('');
            return;
        }

        // Step 3: AI maps symptoms → specialties
        if (!GROQ_KEY || GROQ_KEY.startsWith('YOUR_')) {
            throw new Error('Please set your GROQ_KEY in the config section');
        }

        const specialtyList = [...new Set(allDoctors.map(d => d.specialty).filter(Boolean))].join(', ');

        const prompt = `A patient has these symptoms or query: "${query}"

Available specialties in our system: ${specialtyList}

Return ONLY a JSON object — no markdown, no explanation:
{
  "insight": "2-sentence analysis of the symptoms and what specialist is recommended",
  "matched_specialties": ["Specialty1", "Specialty2"]
}

matched_specialties must only include specialties from the available list above that are relevant to the symptoms. Return at most 3 specialties.`;

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.4,
                max_tokens: 400
            })
        });

        if (!res.ok) {
            const e = await res.json();
            throw new Error(e?.error?.message || 'Groq error');
        }

        const aiData = await res.json();
        const raw = aiData.choices[0].message.content.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(raw);

        // Step 4: Filter real doctors by matched specialties
        const matchedSpecs = parsed.matched_specialties || [];
        let matched = allDoctors.filter(d =>
            matchedSpecs.some(s => d.specialty?.toLowerCase() === s.toLowerCase())
        );

        // Fallback: show all doctors if no specialty match
        if (matched.length === 0) matched = allDoctors;

        document.getElementById('aiInsightText').innerHTML = `<strong>AI Analysis:</strong> ${parsed.insight}`;
        document.getElementById('aiInsight').classList.add('show');
        document.getElementById('resultsTitle').textContent =
            `${matched.length} real doctor(s) matched for "${query}"`;
        document.getElementById('doctorsGrid').innerHTML = matched.map((d, i) => doctorCard(d, i)).join('');

    } catch (e) {
        console.error('Search error:', e);
        document.getElementById('doctorsGrid').innerHTML = `
      <div style="padding:2rem;color:var(--coral);grid-column:1/-1;line-height:1.8">
        <strong>⚠️ Error:</strong> ${e.message}
      </div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Search';
    }
}

// ═══════════════════════════════════
// DOCTOR CARD RENDERER
// ════════════════════════════════════

function doctorCard(d, i) {
    const [bg, tc] = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const name = d.full_name || d.name || 'Doctor';
    const specialty = d.specialty || 'Specialist';
    const hospital = d.hospital || d.clinic_name || 'Private Practice';
    const experience = d.experience || d.years_experience || '—';
    const fee = d.fee
        ? parseInt(d.fee)
        : d.consultation_fee
            ? parseInt(d.consultation_fee)
            : '—';
    const rating =
        d.rating && parseFloat(d.rating) > 0
            ? parseFloat(d.rating).toFixed(1)
            : null;
    const bio = d.bio || '';
    const initials = name
        .replace('Dr. ', '')
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const icon = SPEC_ICONS[specialty] || '👨‍⚕️';
    const cardData = JSON.stringify({
        id: d.id,
        full_name: name,
        specialty,
        hospital,
        experience,
        fee,
        rating,
        bio
    }).replace(/'/g, "&#39;");

    return `<div class="doctor-card">
    <div class="dc-head">
      <div class="dc-avatar" style="background:${bg};color:${tc}">${initials}</div>
      <div>
        <div class="dc-name">${name}</div>
        <div class="dc-spec">${icon} ${specialty}</div>
        <span class="dc-hosp" style="background:${bg};color:${tc}">${hospital}</span>
      </div>
    </div>
    <div class="dc-stats">
      <div class="dc-stat">
        <div class="dc-stat-val">${experience}y</div>
        <div class="dc-stat-lbl">Experience</div>
      </div>
      <div class="dc-stat">
        <div class="dc-stat-val">${rating ? rating + '⭐' : 'No ratings'}</div>
        <div class="dc-stat-lbl">Rating</div>
      </div>
      <div class="dc-stat">
        <div class="dc-stat-val">₹${fee}</div>
        <div class="dc-stat-lbl">Fee</div>
      </div>
    </div>
    ${bio ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:1rem;line-height:1.5">${bio}</div>` : ''}
    <button class="book-btn" onclick='openBooking(${cardData})'>Book Appointment</button>
  </div>`;
}

// ═══════════════════════════════════
// SKELETON CARDS
// ════════════════════════════════════

function skelCards(n) {
    return Array(n)
        .fill(0)
        .map(
            () => `<div class="doctor-card">
      <div style="display:flex;gap:12px;margin-bottom:1rem">
        <div class="skel" style="width:50px;height:50px;border-radius:50%;flex-shrink:0"></div>
        <div style="flex:1">
          <div class="skel" style="height:13px;width:65%;margin-bottom:8px"></div>
          <div class="skel" style="height:11px;width:45%"></div>
        </div>
      </div>
      <div class="skel" style="height:56px;margin-bottom:1rem"></div>
      <div class="skel" style="height:36px"></div>
    </div>`
        )
        .join('');
}

// ═══════════════════════════════════
// FILTER DOCTORS
// ════════════════════════════════════

async function filterDoctors(filters) {
    const { data: doctors, error } = await sb
        .from('profiles')
        .select('*')
        .eq('role', 'doctor');

    if (error) {
        console.error('Filter error:', error);
        return [];
    }

    let filtered = doctors || [];

    // Filter by specialty
    if (filters.specialty) {
        filtered = filtered.filter(
            d => d.specialty?.toLowerCase() === filters.specialty.toLowerCase()
        );
    }

    // Filter by city
    if (filters.city) {
        filtered = filtered.filter(
            d => d.city?.toLowerCase().includes(filters.city.toLowerCase())
        );
    }

    // Filter by fee range
    if (filters.minFee) {
        filtered = filtered.filter(d => d.fee >= filters.minFee);
    }
    if (filters.maxFee) {
        filtered = filtered.filter(d => d.fee <= filters.maxFee);
    }

    // Filter by experience
    if (filters.minExperience) {
        filtered = filtered.filter(d => d.experience >= filters.minExperience);
    }

    // Filter by rating
    if (filters.minRating) {
        filtered = filtered.filter(d => d.rating >= filters.minRating);
    }

    return filtered;
}

// ═══════════════════════════════════
// SORT DOCTORS
// ════════════════════════════════════

function sortDoctors(doctors, sortBy) {
    const sorted = [...doctors];

    switch (sortBy) {
        case 'rating':
            sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
        case 'fee_low':
            sorted.sort((a, b) => (a.fee || 0) - (b.fee || 0));
            break;
        case 'fee_high':
            sorted.sort((a, b) => (b.fee || 0) - (a.fee || 0));
            break;
        case 'experience':
            sorted.sort((a, b) => (b.experience || 0) - (a.experience || 0));
            break;
        case 'name':
            sorted.sort((a, b) =>
                (a.full_name || '').localeCompare(b.full_name || '')
            );
            break;
        default:
            break;
    }

    return sorted;
}

// ═══════════════════════════════════
// SEARCH HISTORY
// ════════════════════════════════════

function saveSearchHistory(query) {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    if (!history.includes(query)) {
        history.unshift(query);
        localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 10)));
    }
}

function getSearchHistory() {
    return JSON.parse(localStorage.getItem('searchHistory') || '[]');
}

function clearSearchHistory() {
    localStorage.removeItem('searchHistory');
}

// ═══════════════════════════════════
// GET SPECIALTIES
// ════════════════════════════════════

async function getSpecialties() {
    const { data, error } = await sb
        .from('profiles')
        .select('specialty')
        .eq('role', 'doctor')
        .not('specialty', 'is', null);

    if (error) {
        console.error('Error fetching specialties:', error);
        return [];
    }

    const specialties = [...new Set(data.map(d => d.specialty).filter(Boolean))];
    return specialties.sort();
}

// ═══════════════════════════════════
// GET CITIES
// ════════════════════════════════════

async function getCities() {
    const { data, error } = await sb
        .from('profiles')
        .select('city')
        .eq('role', 'doctor')
        .not('city', 'is', null);

    if (error) {
        console.error('Error fetching cities:', error);
        return [];
    }

    const cities = [...new Set(data.map(d => d.city).filter(Boolean))];
    return cities.sort();
}

// ═══════════════════════════════════
// SEARCH SUGGESTIONS
// ════════════════════════════════════

async function getSearchSuggestions(query) {
    const suggestions = [
        'headache and dizziness',
        'chest pain and shortness of breath',
        'skin rash and itching',
        'joint pain and swelling',
        'anxiety and low mood',
        'stomach pain and nausea',
        'eye redness and blurry vision',
        'fever and cough',
        'back pain',
        'tooth pain'
    ];

    if (!query) return suggestions;

    return suggestions.filter(s =>
        s.toLowerCase().includes(query.toLowerCase())
    );
}
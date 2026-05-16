// ================================================================
// KONFIGURASI KATEGORI
// ================================================================
const CATEGORIES = {
    elementary: { label: 'Elementary School', color: '#ef4444', icon: 'fa-school', faColor: 'red', img: '🏫' },
    middle:     { label: 'Middle School',     color: '#1e3a5f', icon: 'fa-school-flag', faColor: 'darkblue', img: '🏫' },
    high:       { label: 'High School',       color: '#92400e', icon: 'fa-graduation-cap', faColor: 'orange', img: '🎓' },
    university: { label: 'University / College', color: '#7c3aed', icon: 'fa-university', faColor: 'purple', img: '🎓' },
    government: { label: 'Government Office',  color: '#6d28d9', icon: 'fa-landmark', faColor: 'cadetblue', img: '🏛️' },
    military:   { label: 'Military',           color: '#065f46', icon: 'fa-shield-halved', faColor: 'darkgreen', img: '🪖' },
    library:    { label: 'Library',            color: '#0891b2', icon: 'fa-book', faColor: 'cadetblue', img: '📚' },
    community:  { label: 'Community Centre',   color: '#db2777', icon: 'fa-people-roof', faColor: 'pink', img: '🏠' },
    townhall:   { label: 'Town Hall',          color: '#d97706', icon: 'fa-building-columns', faColor: 'orange', img: '🏛️' },
    other:      { label: 'Other',              color: '#64748b', icon: 'fa-map-pin', faColor: 'gray', img: '📍' }
};

// ================================================================
// CLASSIFY FEATURE
// ================================================================
function classifyFeature(props) {
    const amenity = props.amenity || '';
    const office = props.office || '';
    const landuse = props.landuse || '';
    const military = props.military || '';
    const isced = props.isced_level || '';

    if (amenity === 'school') {
        if (isced.includes('3') && !isced.includes('1')) return 'high';
        if (isced.includes('2') && !isced.includes('1') && !isced.includes('3')) return 'middle';
        if (isced === '2;3') return 'high';
        if (isced === '1;2;3' || isced === '0;1;2;3') return 'high';
        if (isced === '1;2' || isced === '0;1;2') return 'middle';
        if (isced.startsWith('1') || isced === '0;1') return 'elementary';
        return 'elementary'; // default school
    }
    if (amenity === 'university' || amenity === 'college') return 'university';
    if (amenity === 'library') return 'library';
    if (amenity === 'community_centre' || amenity === 'social_centre') return 'community';
    if (amenity === 'townhall' || amenity === 'courthouse') return 'townhall';
    if (office === 'government' || amenity === 'fire_station' || amenity === 'police') return 'government';
    if (landuse === 'military' || military) return 'military';
    return 'other';
}

// ================================================================
// GLOBAL STATE
// ================================================================
let map, allFeatures = [], allLayers = {}, categoryGroups = {}, mainBounds;

// ================================================================
// INIT MAP
// ================================================================
function initMap() {
    map = L.map('map', { center: [45.35, -75.7], zoom: 11, zoomControl: false });
    L.control.zoom({ position: 'topright' }).addTo(map);
    return map;
}

// ================================================================
// BASEMAPS
// ================================================================
const basemapDefs = {
    osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OSM' },
    dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '&copy; CARTO' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri' }
};
let basemaps = {}, activeBasemap = 'osm';

function initBasemaps() {
    for (const [k, v] of Object.entries(basemapDefs)) {
        basemaps[k] = L.tileLayer(v.url, { maxZoom: 19, attribution: v.attr });
    }
    basemaps.osm.addTo(map);
}

function switchBasemap(key) {
    if (key === activeBasemap) return;
    map.removeLayer(basemaps[activeBasemap]);
    basemaps[key].addTo(map);
    activeBasemap = key;
    document.querySelectorAll('.bm-btn').forEach(b => b.classList.toggle('active', b.dataset.bm === key));
}

// ================================================================
// CREATE MARKER
// ================================================================
function createMarker(feature, latlng) {
    const cat = classifyFeature(feature.properties);
    const cfg = CATEGORIES[cat];
    const icon = L.AwesomeMarkers.icon({
        icon: cfg.icon,
        prefix: 'fa',
        markerColor: cfg.faColor,
        iconColor: '#fff'
    });
    return L.marker(latlng, { icon });
}

function polyStyle(feature) {
    const cat = classifyFeature(feature.properties);
    const c = CATEGORIES[cat].color;
    return { color: c, weight: 2, opacity: 0.8, fillColor: c, fillOpacity: 0.18 };
}

// ================================================================
// OPERATING HOURS PER CATEGORY
// ================================================================
const OPERATING_HOURS = {
    elementary: { hours: '08:00 – 15:30', days: 'Senin – Jumat', note: 'Sesuai kalender akademik' },
    middle:     { hours: '08:00 – 15:45', days: 'Senin – Jumat', note: 'Sesuai kalender akademik' },
    high:       { hours: '08:30 – 16:00', days: 'Senin – Jumat', note: 'Sesuai kalender akademik' },
    university: { hours: '07:00 – 22:00', days: 'Senin – Sabtu', note: 'Perpustakaan buka hingga malam' },
    government: { hours: '08:30 – 16:30', days: 'Senin – Jumat', note: 'Tutup di hari libur nasional' },
    military:   { hours: '06:00 – 18:00', days: 'Senin – Jumat', note: 'Akses terbatas, perlu izin' },
    library:    { hours: '09:00 – 21:00', days: 'Senin – Sabtu', note: 'Minggu: 10:00 – 17:00' },
    community:  { hours: '08:00 – 22:00', days: 'Setiap Hari', note: 'Jadwal bervariasi per program' },
    townhall:   { hours: '08:30 – 16:30', days: 'Senin – Jumat', note: 'Layanan publik reguler' },
    other:      { hours: '09:00 – 17:00', days: 'Senin – Jumat', note: 'Jam bervariasi' }
};

function getStatusNow(cat) {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const day = now.getDay(); // 0=Sun, 6=Sat
    const oh = OPERATING_HOURS[cat];
    if (!oh) return { open: false, text: 'Tidak diketahui' };

    const [openH, openM] = oh.hours.split('–')[0].trim().split(':').map(Number);
    const [closeH, closeM] = oh.hours.split('–')[1].trim().split(':').map(Number);
    const nowMin = hour * 60 + minute;
    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;

    let isWeekday = day >= 1 && day <= 5;
    let isSaturday = day === 6;
    let isSunday = day === 0;

    let isOpen = false;
    if (oh.days === 'Setiap Hari') {
        isOpen = nowMin >= openMin && nowMin < closeMin;
    } else if (oh.days.includes('Sabtu') && isSaturday) {
        isOpen = nowMin >= openMin && nowMin < closeMin;
    } else if (isWeekday) {
        isOpen = nowMin >= openMin && nowMin < closeMin;
    }

    // Special: library Sunday
    if (cat === 'library' && isSunday) {
        isOpen = nowMin >= 600 && nowMin < 1020; // 10:00-17:00
    }

    return {
        open: isOpen,
        text: isOpen ? '🟢 Sedang Buka' : '🔴 Sedang Tutup'
    };
}

// ================================================================
// OFFICIAL WEBSITE LINKS
// ================================================================
const KNOWN_WEBSITES = {
    'city of ottawa': 'https://ottawa.ca',
    'ottawa public library': 'https://biblioottawalibrary.ca',
    'university of ottawa': 'https://www.uottawa.ca',
    'carleton university': 'https://carleton.ca',
    'algonquin college': 'https://www.algonquincollege.com',
    'la cité collégiale': 'https://www.lacitec.on.ca',
    'ottawa-carleton district school board': 'https://www.ocdsb.ca',
    'ottawa catholic school board': 'https://www.ocsb.ca',
    'senate of canada': 'https://sencanada.ca',
    'house of commons': 'https://www.ourcommons.ca',
    'parliament of canada': 'https://www.parl.ca',
    'national defence': 'https://www.canada.ca/en/department-national-defence.html',
    'canadian forces': 'https://www.canada.ca/en/department-national-defence.html',
    'drivetest': 'https://www.drivetest.ca',
    'rcmp': 'https://www.rcmp-grc.gc.ca',
};

function getOfficialLink(props) {
    const name = (props.name || '').trim();
    if (!name) return null;

    // Check known websites (case-insensitive partial match)
    const nameLower = name.toLowerCase();
    for (const [key, url] of Object.entries(KNOWN_WEBSITES)) {
        if (nameLower.includes(key) || key.includes(nameLower)) {
            return { url, type: 'official' };
        }
    }

    // Generate smart search links based on category
    const cat = classifyFeature(props);
    const searchName = encodeURIComponent(name + ' Ottawa Ontario');
    const googleSearch = `https://www.google.com/search?q=${searchName}`;
    const googleMaps = `https://www.google.com/maps/search/${searchName}`;

    // For schools, also try the school board websites
    if (cat === 'elementary' || cat === 'middle' || cat === 'high') {
        const ocdsb = `https://www.ocdsb.ca/search?q=${encodeURIComponent(name)}`;
        return { url: googleSearch, mapsUrl: googleMaps, boardUrl: ocdsb, type: 'search' };
    }

    // For government
    if (cat === 'government') {
        const govSearch = `https://www.google.com/search?q=${encodeURIComponent(name + ' Ottawa government official site')}`;
        return { url: govSearch, mapsUrl: googleMaps, type: 'search' };
    }

    return { url: googleSearch, mapsUrl: googleMaps, type: 'search' };
}

// ================================================================
// POPUP
// ================================================================
function buildPopup(props) {
    const cat = classifyFeature(props);
    const cfg = CATEGORIES[cat];
    const oh = OPERATING_HOURS[cat];
    const status = getStatusNow(cat);
    const title = props.name || props.osm_id || 'Feature';
    let rows = '';
    const skip = new Set(['osm_id', 'osm_type']);
    for (const [k, v] of Object.entries(props)) {
        if (v && !skip.has(k)) rows += `<tr><td>${k}</td><td>${v}</td></tr>`;
    }

    const statusColor = status.open ? '#34d399' : '#ef4444';

    // Build website link section
    const link = getOfficialLink(props);
    let linkHtml = '';
    if (link && props.name) {
        if (link.type === 'official') {
            linkHtml = `
            <div class="popup-links">
                <a href="${link.url}" target="_blank" class="popup-link-btn official">
                    <i class="fa-solid fa-globe"></i> Website Resmi
                </a>
                <a href="https://www.google.com/maps/search/${encodeURIComponent(props.name + ' Ottawa')}" target="_blank" class="popup-link-btn maps">
                    <i class="fa-solid fa-map-location-dot"></i> Google Maps
                </a>
            </div>`;
        } else {
            linkHtml = `
            <div class="popup-links">
                <a href="${link.url}" target="_blank" class="popup-link-btn search">
                    <i class="fa-solid fa-magnifying-glass"></i> Cari Website
                </a>
                <a href="${link.mapsUrl}" target="_blank" class="popup-link-btn maps">
                    <i class="fa-solid fa-map-location-dot"></i> Google Maps
                </a>
                ${link.boardUrl ? `<a href="${link.boardUrl}" target="_blank" class="popup-link-btn board">
                    <i class="fa-solid fa-school"></i> OCDSB
                </a>` : ''}
            </div>`;
        }
    }

    return `<div class="popup-title"><i class="fa-solid ${cfg.icon}"></i> ${title}</div>
            <span class="popup-cat-badge" style="background:${cfg.color}22;color:${cfg.color}">${cfg.label}</span>
            <div class="popup-hours">
                <div class="popup-hours-status" style="color:${statusColor};font-weight:600;font-size:12px;margin:8px 0 4px">${status.text}</div>
                <div style="font-size:11px;color:#8b8fa3">🕐 Jam: <b style="color:#e2e4eb">${oh.hours}</b></div>
                <div style="font-size:11px;color:#8b8fa3">📅 Hari: <b style="color:#e2e4eb">${oh.days}</b></div>
                <div style="font-size:10px;color:#6b7080;margin-top:2px">📌 ${oh.note}</div>
            </div>
            ${linkHtml}
            <table class="popup-table" style="margin-top:8px">${rows}</table>`;
}
// ================================================================
// LOAD GEOJSON
// ================================================================
async function loadAllData() {
    const files = ['Webgis_Femas.geojson', 'clipping_boundary.geojson'];
    const results = {};
    for (const f of files) {
        try {
            const res = await fetch(`./data/${f}`);
            if (res.ok) results[f] = await res.json();
        } catch (e) { console.warn('Skip:', f, e); }
    }
    return results;
}

// ================================================================
// PROCESS & RENDER
// ================================================================
function processData(data) {
    const mainGeo = data['Webgis_Femas.geojson'];
    if (!mainGeo || !mainGeo.features) return;

    allFeatures = mainGeo.features;

    // Init category groups
    for (const k of Object.keys(CATEGORIES)) {
        categoryGroups[k] = L.layerGroup().addTo(map);
    }

    // Count per category
    const counts = {};
    for (const k of Object.keys(CATEGORIES)) counts[k] = 0;

    allFeatures.forEach((feat, idx) => {
        const cat = classifyFeature(feat.properties);
        counts[cat] = (counts[cat] || 0) + 1;

        let layer;
        if (feat.geometry.type === 'Point') {
            const ll = L.latLng(feat.geometry.coordinates[1], feat.geometry.coordinates[0]);
            layer = createMarker(feat, ll);
        } else {
            layer = L.geoJSON(feat, { style: polyStyle });
        }

        if (feat.properties) layer.bindPopup(buildPopup(feat.properties), { maxWidth: 320 });
        layer.featureIndex = idx;
        layer.addTo(categoryGroups[cat]);
        allLayers[idx] = { layer, cat };
    });

    // Fit bounds
    const allGeoLayer = L.geoJSON(mainGeo);
    mainBounds = allGeoLayer.getBounds();
    map.fitBounds(mainBounds, { padding: [50, 50] });

    // Boundary
    const bndRaw = data['clipping_boundary.geojson'];
    if (bndRaw) {
        let bndGeo = bndRaw;
        if (bndRaw.type === 'Polygon') {
            bndGeo = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: bndRaw, properties: { name: 'Clipping Boundary' } }] };
        }
        L.geoJSON(bndGeo, {
            style: { color: '#fbbf24', weight: 2.5, opacity: 0.6, fillOpacity: 0.03, dashArray: '8 4' },
            onEachFeature: (f, l) => l.bindPopup('<div class="popup-title">Clipping Boundary</div>')
        }).addTo(map);
    }

    return counts;
}

// ================================================================
// SIDEBAR CATEGORIES
// ================================================================
function buildSidebar(counts) {
    const container = document.getElementById('cat-list');
    container.innerHTML = '';

    for (const [key, cfg] of Object.entries(CATEGORIES)) {
        if (!counts[key]) continue;
        const card = document.createElement('div');
        card.className = 'cat-card';
        card.innerHTML = `
            <div class="cat-icon" style="background:${cfg.color}22;color:${cfg.color}">
                <i class="fa-solid ${cfg.icon}"></i>
            </div>
            <div class="cat-info">
                <div class="cat-name">${cfg.label}</div>
                <div class="cat-count">${counts[key]} features</div>
            </div>
            <label class="cat-toggle" onclick="event.stopPropagation()">
                <input type="checkbox" checked data-cat="${key}">
                <span class="slider"></span>
            </label>`;

        // Click card -> zoom to category bounds
        card.addEventListener('click', () => {
            if (categoryGroups[key] && map.hasLayer(categoryGroups[key])) {
                const b = categoryGroups[key].getBounds();
                if (b.isValid()) map.fitBounds(b, { padding: [40, 40] });
            }
        });

        // Toggle visibility
        card.querySelector('input').addEventListener('change', function () {
            if (this.checked) categoryGroups[key].addTo(map);
            else map.removeLayer(categoryGroups[key]);
        });

        container.appendChild(card);
    }
}

// ================================================================
// DATA TREE
// ================================================================
function buildDataTree() {
    const container = document.getElementById('data-tree');
    container.innerHTML = '';

    allFeatures.forEach((feat, idx) => {
        const name = (feat.properties && feat.properties.name) || `Feature #${idx + 1}`;
        const cat = classifyFeature(feat.properties);
        const cfg = CATEGORIES[cat];

        const div = document.createElement('div');
        div.className = 'tree-item';
        div.innerHTML = `<i class="fa-solid ${cfg.icon}" style="color:${cfg.color}"></i> ${name}`;

        div.addEventListener('click', () => {
            const entry = allLayers[idx];
            if (!entry) return;
            const l = entry.layer;
            if (l.getLatLng) {
                map.setView(l.getLatLng(), 16);
                l.openPopup();
            } else if (l.getBounds) {
                map.fitBounds(l.getBounds(), { padding: [40, 40] });
                l.eachLayer && l.eachLayer(sub => sub.openPopup());
            }
        });

        container.appendChild(div);
    });
}

// ================================================================
// SEARCH
// ================================================================
function initSearch() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        results.innerHTML = '';
        if (q.length < 2) { results.classList.remove('show'); return; }

        const matches = allFeatures
            .map((f, i) => ({ f, i }))
            .filter(({ f }) => {
                const name = (f.properties.name || '').toLowerCase();
                const cat = CATEGORIES[classifyFeature(f.properties)].label.toLowerCase();
                return name.includes(q) || cat.includes(q);
            })
            .slice(0, 15);

        if (!matches.length) { results.classList.remove('show'); return; }

        matches.forEach(({ f, i }) => {
            const cat = classifyFeature(f.properties);
            const cfg = CATEGORIES[cat];
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<i class="fa-solid ${cfg.icon}" style="color:${cfg.color}"></i>
                             <span class="sr-name">${f.properties.name || 'Unnamed'}</span>
                             <span class="sr-cat">${cfg.label}</span>`;
            div.addEventListener('click', () => {
                const entry = allLayers[i];
                if (!entry) return;
                const l = entry.layer;
                if (l.getLatLng) { map.setView(l.getLatLng(), 16); l.openPopup(); }
                else if (l.getBounds) { map.fitBounds(l.getBounds(), { padding: [40, 40] }); }
                results.classList.remove('show');
                input.value = f.properties.name || '';
            });
            results.appendChild(div);
        });
        results.classList.add('show');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) results.classList.remove('show');
    });
}

// ================================================================
// LEGEND
// ================================================================
function buildLegend(counts) {
    const el = document.getElementById('legend-items');
    el.innerHTML = '';
    for (const [key, cfg] of Object.entries(CATEGORIES)) {
        if (!counts[key]) continue;
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `<div class="legend-dot" style="background:${cfg.color}"></div>
                         <span>${cfg.label} (${counts[key]})</span>`;
        el.appendChild(div);
    }
}

// ================================================================
// CHATBOT
// ================================================================
function initChatbot() {
    const toggle = document.getElementById('chat-toggle');
    const panel = document.getElementById('chatbot');
    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');
    const msgs = document.getElementById('chat-messages');
    const close = document.getElementById('chat-close');

    function toggleChat() {
        panel.classList.toggle('open');
        toggle.classList.toggle('active');
    }

    toggle.addEventListener('click', toggleChat);
    close.addEventListener('click', toggleChat);

    function addMsg(text, type) {
        const div = document.createElement('div');
        div.className = `chat-msg ${type}`;
        div.innerHTML = `<div class="chat-bubble">${text}</div>`;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
    }

    function processQuery(q) {
        const ql = q.toLowerCase();

        // Count queries
        if (ql.includes('jumlah') || ql.includes('berapa') || ql.includes('total') || ql.includes('how many') || ql.includes('count')) {
            for (const [key, cfg] of Object.entries(CATEGORIES)) {
                const lbl = cfg.label.toLowerCase();
                if (ql.includes(lbl) || ql.includes(key)) {
                    const cnt = allFeatures.filter(f => classifyFeature(f.properties) === key).length;
                    return `📊 Terdapat <b>${cnt}</b> ${cfg.label} dalam data.`;
                }
            }
            if (ql.includes('sekolah') || ql.includes('school')) {
                const cnt = allFeatures.filter(f => f.properties.amenity === 'school').length;
                return `📊 Total sekolah: <b>${cnt}</b> (Elementary, Middle, & High School).`;
            }
            return `📊 Total data: <b>${allFeatures.length}</b> fitur dari ${Object.keys(CATEGORIES).length} kategori.`;
        }

        // Location queries
        if (ql.includes('lokasi') || ql.includes('dimana') || ql.includes('where') || ql.includes('location') || ql.includes('cari') || ql.includes('find')) {
            const matches = allFeatures.filter(f => (f.properties.name || '').toLowerCase().includes(ql.replace(/lokasi|dimana|where|location|cari|find/g, '').trim()));
            if (matches.length > 0) {
                const names = matches.slice(0, 5).map(f => `• ${f.properties.name}`).join('<br>');
                return `📍 Ditemukan ${matches.length} lokasi:<br>${names}${matches.length > 5 ? '<br>... dan lainnya' : ''}`;
            }
        }

        // Category info
        if (ql.includes('kategori') || ql.includes('category') || ql.includes('jenis') || ql.includes('tipe')) {
            let info = '📋 Kategori data yang tersedia:<br>';
            for (const [key, cfg] of Object.entries(CATEGORIES)) {
                const cnt = allFeatures.filter(f => classifyFeature(f.properties) === key).length;
                if (cnt > 0) info += `• ${cfg.img} ${cfg.label}: ${cnt}<br>`;
            }
            return info;
        }

        // Address
        if (ql.includes('alamat') || ql.includes('address')) {
            return '📫 Data ini mencakup wilayah <b>Ottawa, Ontario, Canada</b>. Koordinat area: 44.96°N - 45.59°N, 75.08°W - 76.35°W.';
        }

        // Fasilitas
        if (ql.includes('fasilitas') || ql.includes('facility') || ql.includes('sekitar') || ql.includes('nearby')) {
            return '🏢 Fasilitas yang tersedia: Sekolah (Elementary/Middle/High), Universitas, Kantor Pemerintahan, Perpustakaan, Community Centre, Town Hall, dan area Militer.';
        }

        // Route / transport
        if (ql.includes('rute') || ql.includes('route') || ql.includes('transport') || ql.includes('perjalanan')) {
            return getRouteRecommendation();
        }

        // Help
        if (ql.includes('help') || ql.includes('bantuan') || ql.includes('bisa apa')) {
            return `🤖 Saya bisa membantu:<br>
                • Jumlah data per kategori<br>
                • Lokasi / pencarian nama<br>
                • Informasi kategori<br>
                • Rekomendasi transportasi<br>
                • Fasilitas sekitar<br>
                Coba tanya: "berapa jumlah elementary school?"`;
        }

        // Default
        return `🤖 Saya mengerti pertanyaan Anda tentang "<i>${q}</i>". Coba tanyakan tentang: jumlah data, lokasi, kategori, fasilitas, atau rekomendasi rute. Ketik <b>"help"</b> untuk info lengkap.`;
    }

    function handleSend() {
        const q = input.value.trim();
        if (!q) return;
        addMsg(q, 'user');
        input.value = '';
        setTimeout(() => addMsg(processQuery(q), 'bot'), 400);
    }

    send.addEventListener('click', handleSend);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') handleSend(); });

    // Welcome message
    addMsg('👋 Halo! Saya asisten GIS Anda. Tanyakan tentang data peta ini — lokasi, kategori, jumlah, atau rekomendasi perjalanan!', 'bot');
}

// ================================================================
// SMART ROUTE RECOMMENDATION
// ================================================================
function getRouteRecommendation() {
    const hour = new Date().getHours();
    let rec, icon, detail;

    if (hour >= 7 && hour <= 9) {
        rec = 'Public Transport / Sepeda Motor';
        icon = '🚌';
        detail = 'Rush hour pagi — hindari kemacetan dengan transportasi umum atau motor.';
    } else if (hour >= 16 && hour <= 18) {
        rec = 'Public Transport / Sepeda Motor';
        icon = '🛵';
        detail = 'Rush hour sore — gunakan jalur alternatif atau transportasi umum.';
    } else if (hour >= 22 || hour <= 5) {
        rec = 'Mobil / Taksi';
        icon = '🚗';
        detail = 'Malam hari — jalanan sepi, mobil/taksi lebih aman dan nyaman.';
    } else if (hour >= 10 && hour <= 15) {
        rec = 'Sepeda / Jalan Kaki (jarak dekat)';
        icon = '🚶';
        detail = 'Siang hari cerah — ideal untuk bersepeda atau jalan kaki ke lokasi dekat.';
    } else {
        rec = 'Kendaraan Pribadi';
        icon = '🚗';
        detail = 'Kondisi normal — pilih kendaraan sesuai jarak tujuan.';
    }

    return `${icon} <b>Rekomendasi Saat Ini (${hour}:00):</b><br>
            🚦 Moda: <b>${rec}</b><br>
            💡 ${detail}`;
}

function initRoutePanel() {
    const toggle = document.getElementById('route-toggle');
    const panel = document.getElementById('route-panel');
    const select = document.getElementById('route-dest');
    const result = document.getElementById('route-result');

    toggle.addEventListener('click', () => panel.classList.toggle('open'));

    // Populate destinations from features with names
    const named = allFeatures.filter(f => f.properties.name).slice(0, 50);
    named.forEach((f, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = f.properties.name;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => {
        const idx = parseInt(select.value);
        if (isNaN(idx)) { result.innerHTML = '<span style="color:#6b7080">Pilih tujuan untuk melihat rekomendasi.</span>'; return; }
        const feat = named[idx];
        const hour = new Date().getHours();
        let coords;
        if (feat.geometry.type === 'Point') {
            coords = feat.geometry.coordinates;
        } else {
            const b = L.geoJSON(feat).getBounds().getCenter();
            coords = [b.lng, b.lat];
        }

        // Simple distance estimate from center of Ottawa
        const dist = Math.sqrt(Math.pow(coords[0] + 75.7, 2) + Math.pow(coords[1] - 45.35, 2)) * 111;
        let mode, emoji, est;

        if (dist < 2) {
            mode = 'Jalan Kaki / Sepeda'; emoji = '🚶'; est = `${Math.round(dist * 12)} menit jalan kaki`;
        } else if (dist < 8) {
            if (hour >= 7 && hour <= 9 || hour >= 16 && hour <= 18) {
                mode = 'Sepeda Motor / Bus'; emoji = '🛵'; est = `${Math.round(dist * 4)} menit`;
            } else {
                mode = 'Mobil / Sepeda'; emoji = '🚗'; est = `${Math.round(dist * 2.5)} menit`;
            }
        } else {
            if (hour >= 22 || hour <= 5) {
                mode = 'Mobil / Taksi'; emoji = '🚗'; est = `${Math.round(dist * 2)} menit`;
            } else {
                mode = 'Mobil / Public Transport'; emoji = '🚌'; est = `${Math.round(dist * 3)} menit`;
            }
        }

        result.innerHTML = `
            <div><span class="route-icon">${emoji}</span> <span class="route-label">${feat.properties.name}</span></div>
            <div class="route-detail">📏 Jarak: ~${dist.toFixed(1)} km</div>
            <div class="route-detail">🚦 Rekomendasi: <b>${mode}</b></div>
            <div class="route-detail">⏱️ Estimasi: <span class="route-time">${est}</span></div>
            <div class="route-detail" style="margin-top:6px;font-size:11px;color:#6b7080">
                ${hour >= 7 && hour <= 9 ? '⚠️ Rush hour pagi — pertimbangkan transportasi umum' :
                  hour >= 16 && hour <= 18 ? '⚠️ Rush hour sore — hindari jalur utama' :
                  hour >= 22 || hour <= 5 ? '🌙 Malam hari — utamakan keselamatan' :
                  '☀️ Kondisi jalan normal'}
            </div>`;

        // Zoom to destination
        if (feat.geometry.type === 'Point') {
            map.setView([coords[1], coords[0]], 15);
        }
    });
}

// ================================================================
// COORDINATE DISPLAY
// ================================================================
function initCoords() {
    map.on('mousemove', e => {
        document.getElementById('lat-val').textContent = e.latlng.lat.toFixed(5);
        document.getElementById('lng-val').textContent = e.latlng.lng.toFixed(5);
    });
}

// ================================================================
// SIDEBAR TOGGLE
// ================================================================
function initSidebarToggle() {
    document.getElementById('btn-sidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
        setTimeout(() => map.invalidateSize(), 400);
    });
}

// ================================================================
// MAIN INIT
// ================================================================
async function init() {
    initMap();
    initBasemaps();
    initCoords();
    initSidebarToggle();
    initSearch();

    const data = await loadAllData();
    const counts = processData(data);

    if (counts) {
        buildSidebar(counts);
        buildDataTree();
        buildLegend(counts);
        initRoutePanel();
    }

    initChatbot();

    // Basemap switcher
    document.querySelectorAll('.bm-btn').forEach(btn => {
        btn.addEventListener('click', () => switchBasemap(btn.dataset.bm));
    });

    // Hide loader
    document.getElementById('loader').classList.add('hide');
}

// Start
init();

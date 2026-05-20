const I18N = {
    en: {
        title: 'Education Distribution Map of Ottawa',
        subtitle: 'Interactive GIS Platform',
        categories: 'Categories',
        info: 'Information',
        dataSource: 'Data Source',
        features: 'Features',
        dataTree: 'Data Tree',
        visitedLoc: 'Visited Locations',
        savedLoc: 'Saved Locations',
        legend: 'Legend',
        searchPlaceholder: 'Search schools...',
        emptyHistory: 'No visited locations yet.',
        emptyBookmarks: 'No saved locations yet.',
        saveBtn: 'Save Location',
        removeBtn: 'Remove Bookmark'
    },
    id: {
        title: 'Peta Distribusi Pendidikan Ottawa',
        subtitle: 'Platform GIS Interaktif',
        categories: 'Kategori',
        info: 'Informasi',
        dataSource: 'Sumber Data',
        features: 'Jumlah Fitur',
        dataTree: 'Pohon Data',
        visitedLoc: 'Riwayat Kunjungan',
        savedLoc: 'Lokasi Tersimpan',
        legend: 'Legenda',
        searchPlaceholder: 'Cari sekolah...',
        emptyHistory: 'Belum ada riwayat.',
        emptyBookmarks: 'Belum ada lokasi tersimpan.',
        saveBtn: 'Simpan Lokasi',
        removeBtn: 'Hapus Simpanan'
    },
    zh: {
        title: '渥太华教育分布图',
        subtitle: '交互式地理信息系统',
        categories: '分类',
        info: '信息',
        dataSource: '数据源',
        features: '特征数',
        dataTree: '数据树',
        visitedLoc: '访问记录',
        savedLoc: '已存地点',
        legend: '图例',
        searchPlaceholder: '搜索学校...',
        emptyHistory: '暂无访问记录',
        emptyBookmarks: '暂无保存记录',
        saveBtn: '保存',
        removeBtn: '移除保存'
    },
    ja: {
        title: 'オタワ教育分布マップ',
        subtitle: 'インタラクティブGIS',
        categories: 'カテゴリー',
        info: '情報',
        dataSource: 'データソース',
        features: '特徴数',
        dataTree: 'データツリー',
        visitedLoc: '訪問履歴',
        savedLoc: '保存された場所',
        legend: '凡例',
        searchPlaceholder: '学校を検索...',
        emptyHistory: '履歴がありません。',
        emptyBookmarks: '保存されていません。',
        saveBtn: '保存する',
        removeBtn: '保存を削除'
    }
};

let currentLang = 'id';
function setLanguage(lang) {
    currentLang = lang;
    const t = I18N[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerText = t[el.getAttribute('data-i18n')];
    });
    document.getElementById('search-input').placeholder = t.searchPlaceholder;
    renderPanels();
}

// Categories Definition
const CATS = {
    kindergarten: { label: 'Kindergarten', color: '#ec4899', icon: 'fa-child', fa: 'pink' },
    elementary: { label: 'Elementary School', color: '#ef4444', icon: 'fa-school', fa: 'red' },
    middle: { label: 'Middle School', color: '#f59e0b', icon: 'fa-school-flag', fa: 'orange' },
    high: { label: 'High School', color: '#10b981', icon: 'fa-graduation-cap', fa: 'green' },
    university: { label: 'University / College', color: '#8b5cf6', icon: 'fa-university', fa: 'purple' },
    other: { label: 'Other Education', color: '#64748b', icon: 'fa-book', fa: 'gray' }
};

function classify(props) {
    const a = props.amenity || '';
    const i = props.isced_level || '';
    if (a === 'kindergarten') return 'kindergarten';
    if (a === 'university' || a === 'college') return 'university';
    if (a === 'school' || a === 'prep_school') {
        if (i.includes('3')) return 'high';
        if (i.includes('2')) return 'middle';
        if (i.includes('1')) return 'elementary';
        return 'elementary';
    }
    return 'other';
}

// Operating Hours Logic
const OPERATING_HOURS = {
    kindergarten: { hours: '07:30 – 16:00', days: 'Senin – Jumat', note: 'Jam layanan day-care mungkin berbeda' },
    elementary: { hours: '08:00 – 15:30', days: 'Senin – Jumat', note: 'Sesuai kalender akademik' },
    middle: { hours: '08:00 – 15:45', days: 'Senin – Jumat', note: 'Sesuai kalender akademik' },
    high: { hours: '08:30 – 16:00', days: 'Senin – Jumat', note: 'Sesuai kalender akademik' },
    university: { hours: '07:00 – 22:00', days: 'Senin – Sabtu', note: 'Perpustakaan buka hingga malam' },
    other: { hours: '09:00 – 17:00', days: 'Senin – Jumat', note: 'Jam bervariasi' }
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

    let isOpen = false;
    if (oh.days === 'Setiap Hari') {
        isOpen = nowMin >= openMin && nowMin < closeMin;
    } else if (oh.days.includes('Sabtu') && isSaturday) {
        isOpen = nowMin >= openMin && nowMin < closeMin;
    } else if (isWeekday) {
        isOpen = nowMin >= openMin && nowMin < closeMin;
    }

    return {
        open: isOpen,
        text: isOpen ? '🟢 Sedang Buka' : '🔴 Sedang Tutup',
        hours: oh.hours,
        days: oh.days
    };
}

// Global State
let map, allFeatures = [], layers = {}, groups = {}, geoMarker = null;
let history = JSON.parse(localStorage.getItem('gis_history') || '[]');
let bookmarks = JSON.parse(localStorage.getItem('gis_bookmarks') || '[]');

// Init
function initSplash() {
    let p = 0;
    const bar = document.getElementById('splash-progress');
    const txt = document.getElementById('splash-text');
    const interval = setInterval(() => {
        p += Math.random() * 15;
        if (p > 100) p = 100;
        bar.style.width = p + '%';
        txt.innerText = Math.round(p) + '%';
        if (p === 100) {
            clearInterval(interval);
            setTimeout(() => {
                document.getElementById('splash').classList.add('hide');
                document.getElementById('app').classList.add('show');
                initApp();
            }, 500);
        }
    }, 100);
}

function initApp() {
    map = L.map('map', { center: [45.35, -75.7], zoom: 11, zoomControl: false });
    L.control.zoom({ position: 'topright' }).addTo(map);

    const bms = {
        osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
        sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };
    bms.osm.addTo(map);
    
    document.querySelectorAll('.bm-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.bm-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            Object.values(bms).forEach(l => map.removeLayer(l));
            bms[btn.dataset.bm].addTo(map);
        });
    });

    for (let k in CATS) groups[k] = L.layerGroup().addTo(map);

    fetch('./UTS_FEMAS_OTTAWA_EDUCATION.geojson')
        .then(r => r.json())
        .then(data => {
            allFeatures = data.features;
            document.getElementById('info-count').innerText = allFeatures.length;
            
            const counts = {};
            for(let k in CATS) counts[k] = 0;

            allFeatures.forEach((f, i) => {
                const cat = classify(f.properties);
                counts[cat]++;
                const ll = f.geometry.type === 'Point' 
                    ? [f.geometry.coordinates[1], f.geometry.coordinates[0]] 
                    : null;
                
                let layer;
                if(ll) {
                    layer = L.marker(ll, { icon: L.AwesomeMarkers.icon({
                        icon: CATS[cat].icon, prefix: 'fa', markerColor: CATS[cat].fa, iconColor: '#fff'
                    })});
                } else {
                    layer = L.geoJSON(f, { style: { color: CATS[cat].color, weight:2, fillOpacity:0.2 }});
                }
                
                layer.bindPopup(() => buildPopup(f.properties, i, cat));
                layer.on('click', () => addHistory(f.properties, cat, i));
                layer.addTo(groups[cat]);
                layers[i] = layer;
            });
            
            buildSidebar(counts);
            buildDataTree();
            buildLegend(counts);
            if(allFeatures.length) map.fitBounds(L.geoJSON(data).getBounds());
        });

    setupUI();
    setInterval(updateWeather, 60000);
    updateWeather();
    setLanguage('id');
}

function buildPopup(props, idx, cat) {
    const isBM = bookmarks.find(b => b.id === props.osm_id);
    const title = props.name || 'Unnamed Facility';
    const status = getStatusNow(cat);
    const statusColor = status.open ? '#34d399' : '#ef4444';
    
    return `
        <div class="popup-title"><i class="fa-solid ${CATS[cat].icon}"></i> ${title}</div>
        <span class="popup-cat-badge" style="background:${CATS[cat].color}22;color:${CATS[cat].color}">${CATS[cat].label}</span>
        
        <div class="popup-hours">
            <div class="popup-hours-status" style="color:${statusColor};font-weight:600;font-size:12px;margin:8px 0 4px">${status.text}</div>
            <div style="font-size:11px;color:#8b8fa3">🕐 Jam: <b style="color:#e2e4eb">${status.hours}</b></div>
            <div style="font-size:11px;color:#8b8fa3">📅 Hari: <b style="color:#e2e4eb">${status.days}</b></div>
        </div>

        <table class="popup-table" style="margin-top:8px">
            <tr><td>Category</td><td>${props.amenity || 'N/A'}</td></tr>
            <tr><td>ISCED</td><td>${props.isced_level || 'N/A'}</td></tr>
            <tr><td>OSM ID</td><td>${props.osm_id || 'N/A'}</td></tr>
        </table>
        <div class="popup-links">
            <a href="https://www.google.com/search?q=${encodeURIComponent(title + ' Ottawa official website')}" target="_blank" class="popup-link-btn official">
                <i class="fa-solid fa-globe"></i> Official Site
            </a>
            <a href="https://www.google.com/maps/search/${encodeURIComponent(title + ' Ottawa')}" target="_blank" class="popup-link-btn maps">
                <i class="fa-solid fa-map-location-dot"></i> Google Maps
            </a>
            <button onclick="toggleBookmark(${idx}, '${props.osm_id}')" class="popup-link-btn search">
                <i class="fa-solid fa-bookmark"></i> ${isBM ? I18N[currentLang].removeBtn : I18N[currentLang].saveBtn}
            </button>
        </div>
    `;
}

function addHistory(props, cat, idx) {
    const name = props.name || 'Unnamed';
    history = history.filter(h => h.id !== props.osm_id);
    history.unshift({ id: props.osm_id, name, cat, time: new Date().toLocaleTimeString(), idx });
    if(history.length > 20) history.pop();
    localStorage.setItem('gis_history', JSON.stringify(history));
    renderPanels();
}

window.toggleBookmark = function(idx, osm_id) {
    const f = allFeatures[idx];
    const cat = classify(f.properties);
    const existing = bookmarks.findIndex(b => b.id == osm_id);
    if(existing >= 0) bookmarks.splice(existing, 1);
    else bookmarks.unshift({ id: osm_id, name: f.properties.name || 'Unnamed', cat, idx });
    localStorage.setItem('gis_bookmarks', JSON.stringify(bookmarks));
    renderPanels();
    layers[idx].openPopup(); // refresh popup
}

function renderPanels() {
    // History
    const hl = document.getElementById('list-history');
    hl.innerHTML = history.length ? '' : `<div class="panel-empty">${I18N[currentLang].emptyHistory}</div>`;
    history.forEach(h => {
        const d = document.createElement('div');
        d.className = 'panel-item';
        d.innerHTML = `<div class="pi-name">${h.name}</div><div class="pi-meta"><i class="fa-solid ${CATS[h.cat].icon}"></i> ${CATS[h.cat].label} &bull; ${h.time}</div>`;
        d.onclick = () => focusFeature(h.idx);
        hl.appendChild(d);
    });
    const hb = document.getElementById('badge-history');
    hb.innerText = history.length;
    hb.style.display = history.length ? 'flex' : 'none';

    // Bookmarks
    const bl = document.getElementById('list-bookmarks');
    bl.innerHTML = bookmarks.length ? '' : `<div class="panel-empty">${I18N[currentLang].emptyBookmarks}</div>`;
    bookmarks.forEach(b => {
        const d = document.createElement('div');
        d.className = 'panel-item';
        d.innerHTML = `<div class="pi-name">${b.name}</div><div class="pi-meta"><i class="fa-solid ${CATS[b.cat].icon}"></i> ${CATS[b.cat].label}</div>`;
        d.onclick = () => focusFeature(b.idx);
        bl.appendChild(d);
    });
    const bb = document.getElementById('badge-bookmarks');
    bb.innerText = bookmarks.length;
    bb.style.display = bookmarks.length ? 'flex' : 'none';
}

function focusFeature(idx) {
    const l = layers[idx];
    if(l.getLatLng) map.setView(l.getLatLng(), 16);
    else if(l.getBounds) map.fitBounds(l.getBounds());
    l.openPopup();
}

function buildSidebar(counts) {
    const c = document.getElementById('cat-list');
    for(let k in CATS) {
        if(!counts[k]) continue;
        const d = document.createElement('div');
        d.className = 'cat-card';
        d.innerHTML = `
            <div class="cat-icon" style="background:${CATS[k].color}22;color:${CATS[k].color}"><i class="fa-solid ${CATS[k].icon}"></i></div>
            <div class="cat-info"><div class="cat-name">${CATS[k].label}</div><div class="cat-count">${counts[k]}</div></div>
            <label class="cat-toggle" onclick="event.stopPropagation()"><input type="checkbox" checked><span class="slider"></span></label>
        `;
        d.querySelector('input').onchange = e => e.target.checked ? groups[k].addTo(map) : map.removeLayer(groups[k]);
        d.onclick = () => map.fitBounds(groups[k].getBounds());
        c.appendChild(d);
    }
}

function buildDataTree() {
    const c = document.getElementById('data-tree');
    c.innerHTML = '';
    allFeatures.forEach((f, i) => {
        const cat = classify(f.properties);
        const d = document.createElement('div');
        d.className = 'tree-item';
        d.innerHTML = `<i class="fa-solid ${CATS[cat].icon}" style="color:${CATS[cat].color}"></i> ${f.properties.name || 'Unnamed'}`;
        d.onclick = () => focusFeature(i);
        c.appendChild(d);
    });
}

function buildLegend(counts) {
    const el = document.getElementById('legend-items');
    for(let k in CATS) {
        if(!counts[k]) continue;
        el.innerHTML += `<div class="legend-item"><div class="legend-dot" style="background:${CATS[k].color}"></div><span>${CATS[k].label}</span></div>`;
    }
}

function setupUI() {
    document.getElementById('lang-select').onchange = e => setLanguage(e.target.value);
    document.getElementById('btn-sidebar').onclick = () => document.getElementById('sidebar').classList.toggle('collapsed');
    
    // Panels
    const ph = document.getElementById('panel-history');
    const pb = document.getElementById('panel-bookmarks');
    document.getElementById('btn-history').onclick = () => { pb.classList.remove('open'); ph.classList.toggle('open'); };
    document.getElementById('btn-bookmarks').onclick = () => { ph.classList.remove('open'); pb.classList.toggle('open'); };

    // Geolocation Explore
    const geoBtn = document.getElementById('btn-geo');
    geoBtn.onclick = () => {
        if(geoMarker) { map.removeLayer(geoMarker); geoMarker = null; geoBtn.style.color = ''; return; }
        map.locate({setView: true, maxZoom: 16, watch: true});
        geoBtn.style.color = '#3b82f6';
    };
    map.on('locationfound', e => {
        if(!geoMarker) {
            geoMarker = L.marker(e.latlng, { icon: L.divIcon({ className: 'user-marker', html: '<div class="user-dot"></div>' }) }).addTo(map);
        } else geoMarker.setLatLng(e.latlng);
    });

    // Search
    const search = document.getElementById('search-input');
    const res = document.getElementById('search-results');
    search.oninput = () => {
        const q = search.value.toLowerCase();
        res.innerHTML = '';
        if(q.length < 2) { res.classList.remove('show'); return; }
        const m = allFeatures.map((f,i) => ({f,i})).filter(x => (x.f.properties.name||'').toLowerCase().includes(q)).slice(0,10);
        m.forEach(x => {
            const cat = classify(x.f.properties);
            const d = document.createElement('div');
            d.className = 'search-result-item';
            d.innerHTML = `<i class="fa-solid ${CATS[cat].icon}" style="color:${CATS[cat].color}"></i><span class="sr-name">${x.f.properties.name}</span>`;
            d.onclick = () => { focusFeature(x.i); res.classList.remove('show'); search.value = ''; };
            res.appendChild(d);
        });
        res.classList.add('show');
    };

    // Chatbot Logic
    const chatToggle = document.getElementById('chat-toggle');
    const chatbot = document.getElementById('chatbot');
    const chatClose = document.getElementById('chat-close');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatMsgs = document.getElementById('chat-messages');

    chatToggle.onclick = () => { chatbot.classList.toggle('open'); chatToggle.classList.toggle('active'); };
    chatClose.onclick = () => { chatbot.classList.remove('open'); chatToggle.classList.remove('active'); };

    function addChatMsg(text, sender) {
        const d = document.createElement('div');
        d.className = `chat-msg ${sender}`;
        d.innerHTML = `<div class="chat-bubble">${text}</div>`;
        chatMsgs.appendChild(d);
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
    }

    function processChatQuery(q) {
        const ql = q.toLowerCase();
        if(ql.includes('jumlah') || ql.includes('berapa') || ql.includes('count')) {
            return `📊 Total lokasi pendidikan: <b>${allFeatures.length}</b> fasilitas.`;
        }
        if(ql.includes('lokasi') || ql.includes('cari') || ql.includes('where')) {
            const matches = allFeatures.filter(f => (f.properties.name||'').toLowerCase().includes(ql.replace(/lokasi|cari|where/g,'').trim()));
            if(matches.length) return `📍 Ditemukan ${matches.length} lokasi. Beberapa diantaranya: <br> ${matches.slice(0,3).map(m=>'• '+m.properties.name).join('<br>')}`;
        }
        return `🤖 Halo! Saya asisten AI. Anda bisa bertanya "Berapa jumlah sekolah?" atau "Cari lokasi [nama]".`;
    }

    chatSend.onclick = () => {
        const v = chatInput.value.trim();
        if(!v) return;
        addChatMsg(v, 'user');
        chatInput.value = '';
        setTimeout(() => addChatMsg(processChatQuery(v), 'bot'), 500);
    };
    chatInput.onkeypress = (e) => { if(e.key === 'Enter') chatSend.onclick(); };
    addChatMsg('👋 Halo! Saya asisten GIS Anda. Ada yang bisa dibantu?', 'bot');

    // Route Logic
    const routeToggle = document.getElementById('route-toggle');
    const routePanel = document.getElementById('route-panel');
    const routeDest = document.getElementById('route-dest');
    const routeResult = document.getElementById('route-result');
    
    routeToggle.onclick = () => {
        routePanel.classList.toggle('open');
        if(routeDest.children.length <= 1) {
            allFeatures.filter(f => f.properties.name).forEach((f, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.innerText = f.properties.name;
                routeDest.appendChild(opt);
            });
        }
    };
    
    routeDest.onchange = () => {
        if(!routeDest.value) { routeResult.innerHTML = '<span style="color:#6b7080">Select a destination</span>'; return; }
        const f = allFeatures[routeDest.value];
        const h = new Date().getHours();
        const dist = Math.random() * 10 + 1; // Simulated distance 1-11 km
        let mode = 'Car 🚗';
        if(dist < 2) mode = 'Walking 🚶 / Bicycle 🚲';
        else if (h >= 7 && h <= 9 || h >= 16 && h <= 18) mode = 'Public Transit 🚌 (Rush Hour)';
        
        routeResult.innerHTML = `
            <div><span class="route-label">${f.properties.name}</span></div>
            <div class="route-detail">📏 Distance: ~${dist.toFixed(1)} km</div>
            <div class="route-detail">🚦 Recommended: <b>${mode}</b></div>
            <div class="route-detail">⏱️ Estimated: <span class="route-time">${Math.round(dist * 3)} mins</span></div>
        `;
    };
}

function updateWeather() {
    const d = new Date();
    document.getElementById('w-time').innerText = d.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', timeZone:'America/Toronto'});
    const h = d.getHours();
    const icon = document.getElementById('w-icon');
    let t = 15;
    if(h > 6 && h < 18) { icon.className = 'fa-solid fa-sun w-icon'; icon.style.color = '#fde047'; t=22; }
    else { icon.className = 'fa-solid fa-moon w-icon'; icon.style.color = '#93c5fd'; t=12; }
    document.getElementById('w-temp').innerText = t + '°C';
}

initSplash();

const API_URL = 'http://localhost:3000/api';
const appDiv = document.getElementById('app');

let state = {
    user: null,
    token: null,
    branches: [],
    assets: []
};

// --- API Wrapper ---
async function fetchAPI(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    
    const config = { ...options, headers: { ...headers, ...options.headers } };
    const res = await fetch(`${API_URL}${endpoint}`, config);
    const data = await res.json();
    
    if (res.status === 401 || res.status === 403) {
        logout(); throw new Error("Sesión expirada o no autorizado");
    }
    if (!res.ok) throw new Error(data.error || 'Error en la petición');
    return data;
}

function logout() {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    state.token = null; state.user = null; renderLogin();
}

function notifySuccess(msg) { alert("✅ " + msg); } 
function notifyError(msg) { alert("❌ Error: " + msg); }

// --- VIEWS ---

function renderLogin() {
    document.body.className = 'auth-layout';
    appDiv.innerHTML = `
        <div class="auth-container">
            <h2>💻 IT Asset Manager</h2>
            <p>Control exacto de computadoras y equipos por número de serie</p>
            <form id="loginForm">
                <div class="form-group"><label>Usuario</label><input type="text" id="username" required></div>
                <div class="form-group"><label>Contraseña</label><input type="password" id="password" required></div>
                <div id="loginError" class="error-msg"></div>
                <button type="submit" class="btn" style="width: 100%; margin-top: 1rem;">Acceder</button>
            </form>
        </div>
    `;

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('loginError');
        try {
            const data = await fetchAPI('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username: e.target.username.value, password: e.target.password.value })
            });
            state.token = data.token; state.user = data.user;
            localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
            renderLayout();
        } catch (err) {
            errorDiv.textContent = err.message; errorDiv.style.display = 'block';
        }
    });
}

function renderLayout() {
    document.body.className = 'app-layout';
    appDiv.innerHTML = `
        <nav class="sidebar">
            <h2 style="font-size:1.2rem;">💻 IT Asset Manager</h2>
            <div class="nav-menu">
                <a class="nav-link" id="nav-dashboard">📊 Resumen</a>
                <a class="nav-link" id="nav-assets">🖥️ Catálogo de Equipos</a>
                <a class="nav-link" id="nav-movements">🔄 Traslados (Movimientos)</a>
                <a class="nav-link" id="nav-branches">🏢 Sucursales / Oficinas</a>
            </div>
            <div style="margin-top: auto; text-align:center;">
                <p style="color:var(--text-secondary); font-size:0.875rem; margin-bottom: 0.75rem;">Usuario: <strong>${state.user.username}</strong></p>
                <button onclick="logout()" class="btn btn-danger" style="width: 100%; padding:0.6rem;">Cerrar Sesión</button>
            </div>
        </nav>
        <main class="main-content" id="main-content"></main>
        
        <div class="modal-overlay" id="global-modal">
            <div class="modal-content">
                <h2 id="modal-title" style="margin-top: 0">Título</h2>
                <div id="modal-body"></div>
                <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;">
                    <button class="btn" style="background:var(--border); color:var(--text-primary);" onclick="closeModal()">Cancelar</button>
                    <button class="btn" id="modal-save">Guardar Cambios</button>
                </div>
            </div>
        </div>
    `;

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            loadView(e.target.id.split('-')[1]);
        });
    });

    document.getElementById('nav-dashboard').classList.add('active');
    preloadData().then(() => loadView('dashboard'));
}

async function preloadData() {
    try {
        state.branches = await fetchAPI('/branches');
        state.assets = await fetchAPI('/assets');
    } catch(e) { console.error('Error preloading data', e); }
}

function loadView(view) {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div style="text-align:center; padding: 4rem; color:var(--text-secondary);">Cargando equipos...</div>`;
    switch(view) {
        case 'dashboard': renderDashboard(main); break;
        case 'assets': renderAssets(main); break;
        case 'movements': renderMovements(main); break;
        case 'branches': renderBranches(main); break;
    }
}

// -- DATA VIEWS --

async function renderDashboard(container) {
    try {
        const assets = await fetchAPI('/assets');
        
        // Contar el tipo de equipos para dar estadísticas geniales
        const typeCount = assets.reduce((acc, curr) => {
            acc[curr.asset_type] = (acc[curr.asset_type] || 0) + 1;
            return acc;
        }, {});

        container.innerHTML = `
            <div class="header-flex"><h1>Dashboard de Activos</h1></div>
            <div class="grid-3">
                <div class="stat-card"><h3>Total Equipos Físicos</h3><p>${assets.length}</p></div>
                <div class="stat-card"><h3>Total Sucursales/Oficinas</h3><p>${state.branches.length}</p></div>
            </div>
            
            <div class="card">
                <h2 style="margin-top: 0">Desglose por Tipo de Equipo</h2>
                <div style="display:flex; gap: 1rem; flex-wrap:wrap;">
                    ${Object.entries(typeCount).map(([type, count]) => `
                        <div style="padding: 1rem; background: var(--bg-color); border-radius: var(--radius); border: 1px solid var(--border); min-width: 150px; text-align:center;">
                            <h4 style="margin:0; color:var(--text-secondary)">${type}</h4>
                            <p style="margin: 0.5rem 0 0 0; font-size: 1.5rem; font-weight:700;">${count}</p>
                        </div>
                    `).join('')}
                    ${Object.keys(typeCount).length === 0 ? '<p>No hay equipos registrados aún.</p>' : ''}
                </div>
            </div>
        `;
    } catch (err) { container.innerHTML = `<p class="error-msg" style="display:block">${err.message}</p>`; }
}

async function renderAssets(container) {
    try {
        const assets = await fetchAPI('/assets');
        state.assets = assets; // Cache para traslados
        container.innerHTML = `
            <div class="header-flex">
                <h1>Catálogo de Equipos y Componentes</h1>
                <button class="btn" onclick="openAssetModal()">+ Registrar Nuevo Equipo</button>
            </div>
            <div class="card">
                <table>
                    <thead><tr><th>Número de Serie (SN)</th><th>Tipo</th><th>Marca y Modelo</th><th>Especificaciones</th><th>Ubicación Actual</th></tr></thead>
                    <tbody>
                        ${assets.length === 0 ? '<tr><td colspan="5" style="text-align:center">Inventario vacío. Empieza registrando un equipo.</td></tr>' : ''}
                        ${assets.map(a => `
                            <tr>
                                <td><span class="badge" style="background:#E0E7FF; color:#3730A3">${a.serial_number}</span></td>
                                <td><strong>${a.asset_type}</strong></td>
                                <td>${a.brand} ${a.model}</td>
                                <td><small style="color:var(--text-secondary)">${a.details || '-'}</small></td>
                                <td><span class="badge" style="background:var(--primary); color:white;">📍 ${a.branch_name}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) { container.innerHTML = `<p>${err.message}</p>`; }
}

async function renderMovements(container) {
    try {
        await preloadData(); 
        const movements = await fetchAPI('/movements');
        container.innerHTML = `
            <div class="header-flex">
                <h1>Historial de Traslados</h1>
                <button class="btn" onclick="openMovementModal()">🔄 Trasladar Equipo (Asignar a otra sucursal)</button>
            </div>
            <div class="card">
                <table>
                    <thead><tr><th>Fecha y Hora</th><th>Equipo (SN)</th><th>Origen</th><th>Destino</th><th>Responsable Traslado</th><th>Motivo / Notas</th></tr></thead>
                    <tbody>
                        ${movements.map(m => `
                            <tr>
                                <td>${new Date(m.date).toLocaleString()}</td>
                                <td><strong>${m.asset_type}</strong> <br><small style="color:var(--text-secondary)">SN: ${m.serial_number}</small></td>
                                <td style="color:var(--text-secondary)">${m.from_branch || '- (Alta Nueva)'}</td>
                                <td><strong>${m.to_branch}</strong></td>
                                <td>${m.user}</td>
                                <td><small>${m.notes || ''}</small></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) { container.innerHTML = `<p>${err.message}</p>`; }
}

async function renderBranches(container) {
    try {
        const branches = await fetchAPI('/branches');
        container.innerHTML = `
            <div class="header-flex">
                <h1>Sucursales / Oficinas</h1>
                <button class="btn" onclick="openBranchModal()">+ Nueva Ubicación</button>
            </div>
            <div class="card">
                <table>
                    <thead><tr><th>ID Ubicación</th><th>Nombre Oficina</th><th>Dirección Física</th></tr></thead>
                    <tbody>
                        ${branches.map(b => `<tr><td>${b.id}</td><td><strong>${b.name}</strong></td><td>${b.location || '-'}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) { container.innerHTML = `<p>${err.message}</p>`; }
}

// --- MODALS ---

const modal = {
    open: (title, html, onSave) => {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = html;
        const saveBtn = document.getElementById('modal-save');
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', async () => {
            newSaveBtn.disabled = true; newSaveBtn.textContent = 'Guardando...';
            try { await onSave(); closeModal(); } 
            catch (e) { notifyError(e.message); newSaveBtn.disabled = false; newSaveBtn.textContent = 'Guardar Cambios'; }
        });
        document.getElementById('global-modal').classList.add('active');
    },
    close: () => document.getElementById('global-modal').classList.remove('active')
};
window.closeModal = modal.close; 

function openBranchModal() {
    modal.open('Crear Nueva Sucursal o Área', `
        <div class="form-group"><label>Nombre (Ej: Oficina Central, RRHH, Sucursal Norte)</label><input type="text" id="b-name" required></div>
        <div class="form-group"><label>Ubicación / Piso</label><input type="text" id="b-loc"></div>
    `, async () => {
        const name = document.getElementById('b-name').value;
        if(!name) throw new Error("Nombre requerido");
        await fetchAPI('/branches', { method: 'POST', body: JSON.stringify({name, location: document.getElementById('b-loc').value}) });
        notifySuccess("Oficina/Sucursal registrada"); loadView('branches'); preloadData();
    });
}

function openAssetModal() {
    if(state.branches.length === 0) { notifyError("Debes registrar al menos una Sucursal/Oficina primero."); return; }
    
    modal.open('Dar de Alta un Equipo Físico Único', `
        <div class="form-group">
            <label>Tipo de Equipo</label>
            <select id="a-type">
                <option value="Laptop">Laptop / Portátil</option>
                <option value="PC Escritorio">Computadora de Escritorio</option>
                <option value="Monitor">Monitor</option>
                <option value="Memoria RAM">Memoria RAM</option>
                <option value="Disco / Almacenamiento">Disco de Almacenamiento</option>
                <option value="Accesorio / Otro">Otro (Teclados, Switches)</option>
            </select>
        </div>
        <div class="form-group"><label>Número de Serie (Serial Number)</label><input type="text" id="a-serial" placeholder="Ej: JXBR782" required></div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1"><label>Marca</label><input type="text" id="a-brand" placeholder="Ej: Dell"></div>
            <div class="form-group" style="flex:1"><label>Modelo</label><input type="text" id="a-model" placeholder="Ej: Latitude 7420"></div>
        </div>
        <div class="form-group"><label>Especificaciones (Procesador, RAM, tamaño, etc)</label><input type="text" id="a-details" placeholder="Ej: Intel i7, 16GB RAM, 512GB SSD"></div>
        <div class="form-group"><label>Ubicación Física Inicial</label>
            <select id="a-branch">${state.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select>
        </div>
    `, async () => {
        const payload = {
            serial_number: document.getElementById('a-serial').value,
            asset_type: document.getElementById('a-type').value,
            brand: document.getElementById('a-brand').value,
            model: document.getElementById('a-model').value,
            details: document.getElementById('a-details').value,
            branch_id: parseInt(document.getElementById('a-branch').value)
        };
        if(!payload.serial_number) throw new Error("El Serial Number es estrictamente obligatorio para el control");
        await fetchAPI('/assets', { method: 'POST', body: JSON.stringify(payload) });
        notifySuccess("Equipo registrado y asignado a sucursal."); loadView('assets'); preloadData();
    });
}

function openMovementModal() {
    if(state.assets.length === 0 || state.branches.length === 0) { notifyError("Debes registrar al menos un equipo y una sucursal."); return; }
    
    modal.open('Trasladar Equipo (Cambio de Asignación / Sucursal)', `
        <div class="form-group">
            <label>Selecciona el Equipo Exacto por Número de Serie</label>
            <select id="m-asset">${state.assets.map(a => `<option value="${a.id}">[${a.serial_number}] - ${a.asset_type} ${a.brand} (${a.branch_name})</option>`).join('')}</select>
        </div>
        <div class="form-group">
            <label>Nueva Sucursal / Oficina de Destino</label>
            <select id="m-branch">${state.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select>
        </div>
        <div class="form-group">
            <label>Motivo del Traslado (Opcional)</label>
            <input type="text" id="m-notes" placeholder="Ej: Reparación, asignado a nuevo empleado, etc.">
        </div>
    `, async () => {
        const payload = {
            asset_id: parseInt(document.getElementById('m-asset').value),
            to_branch_id: parseInt(document.getElementById('m-branch').value),
            notes: document.getElementById('m-notes').value
        };
        await fetchAPI('/movements', { method: 'POST', body: JSON.stringify(payload) });
        notifySuccess("Equipo trasladado físicamente a la nueva ubicación."); loadView('movements');
    });
}

// Init
function init() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) { state.token = token; state.user = JSON.parse(userStr); renderLayout(); } 
    else renderLogin();
}
init();

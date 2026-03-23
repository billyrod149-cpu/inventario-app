const API_URL = 'http://localhost:3000/api';
const appDiv = document.getElementById('app');

let state = {
    user: null,
    token: null,
    branches: [],
    products: []
};

// --- API Wrapper ---
async function fetchAPI(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    
    const config = { ...options, headers: { ...headers, ...options.headers } };
    const res = await fetch(`${API_URL}${endpoint}`, config);
    const data = await res.json();
    
    if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error("Sesión expirada o no autorizado");
    }
    if (!res.ok) throw new Error(data.error || 'Error en la petición');
    return data;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    state.token = null; state.user = null;
    renderLogin();
}

function notifySuccess(msg) { alert(msg); } // Basic default alert for now
function notifyError(msg) { alert("Error: " + msg); }

// --- VIEWS ---

function renderLogin() {
    document.body.className = 'auth-layout';
    appDiv.innerHTML = `
        <div class="auth-container">
            <h2>📦 InvenTrack Pro</h2>
            <p>Ingresa tus credenciales para acceder</p>
            <form id="loginForm">
                <div class="form-group">
                    <label>Usuario</label>
                    <input type="text" id="username" required autocomplete="username">
                </div>
                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" id="password" required autocomplete="current-password">
                </div>
                <div id="loginError" class="error-msg"></div>
                <button type="submit" class="btn" style="width: 100%; margin-top: 1rem;">Iniciar Sesión</button>
            </form>
        </div>
    `;

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;
        const errorDiv = document.getElementById('loginError');
        const submitBtn = e.target.querySelector('button');
        
        try {
            submitBtn.textContent = 'Verificando...'; submitBtn.disabled = true;
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            state.token = data.token; state.user = data.user;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            renderLayout();
        } catch (err) {
            errorDiv.textContent = err.message || 'Error de autenticación';
            errorDiv.style.display = 'block';
            submitBtn.textContent = 'Iniciar Sesión'; submitBtn.disabled = false;
        }
    });
}

function renderLayout() {
    document.body.className = 'app-layout';
    appDiv.innerHTML = `
        <nav class="sidebar">
            <h2>📦 InvenTrack</h2>
            <div class="nav-menu">
                <a class="nav-link" id="nav-dashboard">📊 Dashboard Global</a>
                <a class="nav-link" id="nav-inventory">📦 Stock e Inventario</a>
                <a class="nav-link" id="nav-movements">🔄 Entradas / Salidas</a>
                <a class="nav-link" id="nav-products">🛒 Catálogo Productos</a>
                <a class="nav-link" id="nav-branches">🏢 Sucursales</a>
            </div>
            <div style="margin-top: auto;">
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.75rem; text-align: center;">Usuario: <strong>${state.user.username}</strong> (${state.user.role})</p>
                <button onclick="logout()" class="btn btn-danger" style="width: 100%; padding:0.6rem;">Cerrar Sesión</button>
            </div>
        </nav>
        <main class="main-content" id="main-content">
            <!-- Dynamic Content Injected Here -->
        </main>
        
        <!-- Reusable Modal Layout -->
        <div class="modal-overlay" id="global-modal">
            <div class="modal-content">
                <h2 id="modal-title" style="margin-top: 0">Título</h2>
                <div id="modal-body"></div>
                <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;">
                    <button class="btn" style="background: var(--border); color: var(--text-primary);" onclick="closeModal()">Cancelar</button>
                    <button class="btn" id="modal-save">Guardar Cambios</button>
                </div>
            </div>
        </div>
    `;

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            const view = e.target.id.split('-')[1];
            loadView(view);
        });
    });

    document.getElementById('nav-dashboard').classList.add('active');
    preloadData().then(() => loadView('dashboard'));
}

async function preloadData() {
    try {
        state.branches = await fetchAPI('/branches');
        state.products = await fetchAPI('/products');
    } catch(e) { console.error('Error preloading data', e); }
}

function loadView(view) {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div style="text-align:center; padding: 4rem; color: var(--text-secondary);">Cargando información...</div>`;
    
    switch(view) {
        case 'dashboard': renderDashboardView(main); break;
        case 'inventory': renderInventoryView(main); break;
        case 'movements': renderMovementsView(main); break;
        case 'products': renderProductsView(main); break;
        case 'branches': renderBranchesView(main); break;
    }
}

// -- INDIVIDUAL DATA VIEWS --

async function renderDashboardView(container) {
    try {
        const inventory = await fetchAPI('/inventory');
        const movements = await fetchAPI('/movements');
        const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);
        
        container.innerHTML = `
            <div class="header-flex">
                <h1>Dashboard Global</h1>
            </div>
            <div class="grid-3">
                <div class="stat-card"><h3>Total Productos Físicos</h3><p>${totalItems}</p></div>
                <div class="stat-card"><h3>Catálogo (SKUs)</h3><p>${state.products.length}</p></div>
                <div class="stat-card"><h3>Sucursales Físicas</h3><p>${state.branches.length}</p></div>
            </div>
            
            <div class="card">
                <h2 style="margin-top: 0">Movimientos Recientes</h2>
                <table>
                    <thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Sucursal</th><th>Cant.</th><th>Usuario</th></tr></thead>
                    <tbody>
                        ${movements.length === 0 ? '<tr><td colspan="6" style="text-align:center">No hay movimientos recientes</td></tr>' : ''}
                        ${movements.slice(0, 5).map(m => `
                            <tr>
                                <td>${new Date(m.date).toLocaleString()}</td>
                                <td><span class="badge ${m.type === 'IN' ? 'badge-in' : 'badge-out'}">${m.type === 'IN' ? 'ENTRADA' : 'SALIDA'}</span></td>
                                <td>${m.product_name} (${m.sku})</td>
                                <td>${m.branch_name}</td>
                                <td><strong>${m.quantity}</strong></td>
                                <td>${m.user}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) { container.innerHTML = `<p class="error-msg" style="display:block">${err.message}</p>`; }
}

async function renderInventoryView(container) {
    try {
        const inventory = await fetchAPI('/inventory');
        container.innerHTML = `
            <div class="header-flex">
                <h1>Stock en Tiempo Real</h1>
            </div>
            <div class="card">
                <table>
                    <thead><tr><th>SKU</th><th>Producto</th><th>Sucursal</th><th>Cant. Disponible</th></tr></thead>
                    <tbody>
                        ${inventory.length === 0 ? '<tr><td colspan="4" style="text-align:center">No hay stock registrado. Registra una entrada primero.</td></tr>' : ''}
                        ${inventory.map(i => `
                            <tr>
                                <td><span class="badge" style="background:var(--border); color:var(--text-primary)">${i.sku}</span></td>
                                <td><strong>${i.product_name}</strong></td>
                                <td>${i.branch_name}</td>
                                <td><strong style="font-size: 1.1rem; color: ${i.quantity <= 5 ? 'var(--danger)' : 'var(--text-primary)'}">${i.quantity}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) { container.innerHTML = `<p>${err.message}</p>`; }
}

async function renderBranchesView(container) {
    try {
        const branches = await fetchAPI('/branches');
        container.innerHTML = `
            <div class="header-flex">
                <h1>Sucursales</h1>
                ${state.user.role === 'Admin' ? `<button class="btn" onclick="openBranchModal()">+ Nueva Sucursal</button>` : ''}
            </div>
            <div class="card">
                <table>
                    <thead><tr><th># ID</th><th>Nombre de Sucursal</th><th>Ubicación</th></tr></thead>
                    <tbody>
                        ${branches.length === 0 ? '<tr><td colspan="3" style="text-align:center">No hay sucursales. Crea una nueva.</td></tr>' : ''}
                        ${branches.map(b => `<tr><td>${b.id}</td><td><strong>${b.name}</strong></td><td>${b.location || '-'}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) { container.innerHTML = `<p>${err.message}</p>`; }
}

async function renderProductsView(container) {
    try {
        const products = await fetchAPI('/products');
        container.innerHTML = `
            <div class="header-flex">
                <h1>Catálogo de Productos</h1>
                ${state.user.role === 'Admin' ? `<button class="btn" onclick="openProductModal()">+ Nuevo Producto</button>` : ''}
            </div>
            <div class="card">
                <table>
                    <thead><tr><th>SKU</th><th>Nombre</th><th>Descripción</th><th>Precio Referencia</th></tr></thead>
                    <tbody>
                        ${products.length === 0 ? '<tr><td colspan="4" style="text-align:center">El catálogo está vacío.</td></tr>' : ''}
                        ${products.map(p => `<tr><td><span class="badge" style="background:var(--border); color:var(--text-primary)">${p.sku}</span></td><td><strong>${p.name}</strong></td><td>${p.description || '-'}</td><td>$${p.price.toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) { container.innerHTML = `<p>${err.message}</p>`; }
}

async function renderMovementsView(container) {
    try {
        await preloadData(); // Refresh dropdown info
        const movements = await fetchAPI('/movements');
        container.innerHTML = `
            <div class="header-flex">
                <h1>Registro Histórico de Movimientos</h1>
                <button class="btn" onclick="openMovementModal()">+ Registrar Entrada o Salida</button>
            </div>
            <div class="card">
                <table>
                    <thead><tr><th>Fecha y Hora</th><th>Transacción</th><th>Producto</th><th>Sucursal</th><th>Cant.</th><th>Responsable</th><th>Notas</th></tr></thead>
                    <tbody>
                        ${movements.length === 0 ? '<tr><td colspan="7" style="text-align:center">No hay movimientos.</td></tr>' : ''}
                        ${movements.map(m => `
                            <tr>
                                <td>${new Date(m.date).toLocaleString()}</td>
                                <td><span class="badge ${m.type === 'IN' ? 'badge-in' : 'badge-out'}">${m.type === 'IN' ? 'INGRESO' : 'EGRESO'}</span></td>
                                <td>${m.product_name} <br><small style="color:var(--text-secondary)">${m.sku}</small></td>
                                <td>${m.branch_name}</td>
                                <td><strong>${m.quantity}</strong></td>
                                <td>${m.user}</td>
                                <td><small style="color:var(--text-secondary)">${m.notes || '-'}</small></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) { container.innerHTML = `<p>${err.message}</p>`; }
}

// --- MODALS (POPUPS) ---

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
    modal.open('Crear Nueva Sucursal', `
        <div class="form-group"><label>Nombre de la Sucursal</label><input type="text" id="b-name" placeholder="Ej: Sucursal Centro" required></div>
        <div class="form-group"><label>Dirección / Ubicación</label><input type="text" id="b-loc" placeholder="Ej: Av. Principal 123"></div>
    `, async () => {
        const name = document.getElementById('b-name').value;
        const location = document.getElementById('b-loc').value;
        if(!name) throw new Error("El nombre es requerido");
        await fetchAPI('/branches', { method: 'POST', body: JSON.stringify({name, location}) });
        notifySuccess("Sucursal agregada"); loadView('branches'); preloadData();
    });
}

function openProductModal() {
    modal.open('Agregar Nuevo Producto', `
        <div class="form-group"><label>Código Único (SKU)</label><input type="text" id="p-sku" placeholder="Ej: LAP-HP-14" required></div>
        <div class="form-group"><label>Nombre del Producto</label><input type="text" id="p-name" required></div>
        <div class="form-group"><label>Descripción</label><textarea id="p-desc" rows="2"></textarea></div>
        <div class="form-group"><label>Precio Base o Referencia ($)</label><input type="number" step="0.01" id="p-price" value="0"></div>
    `, async () => {
        const payload = {
            sku: document.getElementById('p-sku').value,
            name: document.getElementById('p-name').value,
            description: document.getElementById('p-desc').value,
            price: parseFloat(document.getElementById('p-price').value) || 0
        };
        if(!payload.sku || !payload.name) throw new Error("Debes proporcionar SKU y Nombre al menos");
        await fetchAPI('/products', { method: 'POST', body: JSON.stringify(payload) });
        notifySuccess("Producto registrado"); loadView('products'); preloadData();
    });
}

function openMovementModal() {
    if(state.branches.length === 0 || state.products.length === 0) {
        notifyError("Debes registrar al menos una sucursal y un producto primero al sistema."); return;
    }
    
    modal.open('Registrar Entrada o Salida de Inventario', `
        <div class="form-group">
            <label>Tipo de Operación</label>
            <select id="m-type">
                <option value="IN">ENTRADA (Añadir stock a la sucursal)</option>
                <option value="OUT">SALIDA (Restar stock de la sucursal)</option>
            </select>
        </div>
        <div class="form-group">
            <label>Selecciona la Sucursal</label>
            <select id="m-branch">${state.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select>
        </div>
        <div class="form-group">
            <label>Selecciona el Producto</label>
            <select id="m-product">${state.products.map(p => `<option value="${p.id}">${p.sku} - ${p.name}</option>`).join('')}</select>
        </div>
        <div class="form-group">
            <label>Cantidad a Mover</label>
            <input type="number" id="m-qty" min="1" value="1" required>
        </div>
        <div class="form-group">
            <label>Información Adicional (Opcional)</label>
            <input type="text" id="m-notes" placeholder="Ej: Factura de proveedor #999, venta local...">
        </div>
    `, async () => {
        const payload = {
            type: document.getElementById('m-type').value,
            branch_id: parseInt(document.getElementById('m-branch').value),
            product_id: parseInt(document.getElementById('m-product').value),
            quantity: parseInt(document.getElementById('m-qty').value),
            notes: document.getElementById('m-notes').value
        };
        await fetchAPI('/movements', { method: 'POST', body: JSON.stringify(payload) });
        notifySuccess("Operación registrada correctamente"); loadView('movements');
    });
}

// Init Auth State Check
function init() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
        state.token = token;
        state.user = JSON.parse(userStr);
        renderLayout();
    } else {
        renderLogin();
    }
}

init();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'super_secret_inventario_key_123';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Semilla: Admin por defecto
const crearAdminPorDefecto = async () => {
    db.get("SELECT * FROM users WHERE username = 'admin'", async (err, row) => {
        if (!row && !err) {
            const hash = await bcrypt.hash('admin123', 10);
            db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
                ['admin', hash, 'Admin']);
        }
    });
};
crearAdminPorDefecto();

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user) return res.status(401).json({ error: "Usuario/contraseña incorrectos" });

        bcrypt.compare(password, user.password_hash, (err, result) => {
            if (result) {
                const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
                res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
            } else res.status(401).json({ error: "Usuario/contraseña incorrectos" });
        });
    });
});

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user; next();
    });
};

// --- ENDPOINTS: SUCURSALES ---
app.get('/api/branches', authenticateToken, (req, res) => {
    db.all("SELECT * FROM branches", [], (err, rows) => { res.json(rows); });
});
app.post('/api/branches', authenticateToken, (req, res) => {
    const { name, location } = req.body;
    db.run("INSERT INTO branches (name, location) VALUES (?, ?)", [name, location], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, location });
    });
});

// --- ENDPOINTS: ACTIVOS (EQUIPOS) INDIVIDUALES ---
app.get('/api/assets', authenticateToken, (req, res) => {
    const q = `
        SELECT a.*, b.name as branch_name 
        FROM assets a 
        LEFT JOIN branches b ON a.branch_id = b.id
        ORDER BY a.asset_type, a.brand
    `;
    db.all(q, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Registrar un NUEVO equipo en el inventario y asignarlo a una sucursal inicial
app.post('/api/assets', authenticateToken, (req, res) => {
    const { serial_number, asset_type, brand, model, details, branch_id } = req.body;

    db.serialize(() => {
        db.run("BEGIN EXCLUSIVE TRANSACTION");
        db.run(`INSERT INTO assets (serial_number, asset_type, brand, model, details, branch_id) VALUES (?, ?, ?, ?, ?, ?)`, 
            [serial_number, asset_type, brand, model, details, branch_id], function(err) {
            
            if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: "Error: El número de serie ya existe o datos inválidos." }); }
            
            const newAssetId = this.lastID;
            
            // Guardamos el movimiento de 'Alta' en el log
            db.run(`INSERT INTO movements (asset_id, to_branch_id, user_id, notes) VALUES (?, ?, ?, ?)`,
                [newAssetId, branch_id, req.user.id, 'Alta de equipo initial en inventario.'], function(err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                
                db.run("COMMIT");
                res.json({ success: true, id: newAssetId });
            });
        });
    });
});

// --- ENDPOINTS: TRASLADOS DE EQUIPOS ---
app.post('/api/movements', authenticateToken, (req, res) => {
    const { asset_id, to_branch_id, notes } = req.body;

    db.serialize(() => {
        db.run("BEGIN EXCLUSIVE TRANSACTION");
        
        // Buscar el equipo y saber en qué sucursal está actualmente
        db.get("SELECT branch_id FROM assets WHERE id = ?", [asset_id], (err, row) => {
            if (err || !row) { db.run("ROLLBACK"); return res.status(404).json({error: "Equipo no encontrado"}); }
            const from_branch_id = row.branch_id;
            
            if (from_branch_id === parseInt(to_branch_id)) {
                db.run("ROLLBACK"); return res.status(400).json({error: "El equipo ya se encuentra actualmente en esa sucursal."});
            }

            // Actualizar su ubicación física
            db.run("UPDATE assets SET branch_id = ? WHERE id = ?", [to_branch_id, asset_id], (err) => {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                
                // Registrar el movimiento en el historial
                db.run(`INSERT INTO movements (asset_id, from_branch_id, to_branch_id, user_id, notes) VALUES (?, ?, ?, ?, ?)`, 
                    [asset_id, from_branch_id, to_branch_id, req.user.id, notes], function(err) {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                    
                    db.run("COMMIT");
                    res.json({ success: true });
                });
            });
        });
    });
});

app.get('/api/movements', authenticateToken, (req, res) => {
    const q = `
        SELECT m.id, a.serial_number, a.asset_type, a.brand, a.model, 
               bf.name as from_branch, bt.name as to_branch, 
               u.username as user, m.date, m.notes
        FROM movements m
        JOIN assets a ON m.asset_id = a.id
        LEFT JOIN branches bf ON m.from_branch_id = bf.id
        LEFT JOIN branches bt ON m.to_branch_id = bt.id
        JOIN users u ON m.user_id = u.id
        ORDER BY m.date DESC LIMIT 100
    `;
    db.all(q, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Arrancar el Servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

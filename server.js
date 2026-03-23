const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Importamos nuestra configuración de base de datos
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'super_secret_inventario_key_123'; // Clave para las sesiones (JWT)

// Middlewares
app.use(cors());
app.use(express.json());
// Servimos el frontend estático desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Semilla: Crear usuario administrador por defecto al arrancar el servidor
const crearAdminPorDefecto = async () => {
    db.get("SELECT * FROM users WHERE username = 'admin'", async (err, row) => {
        if (!row && !err) {
            const hash = await bcrypt.hash('admin123', 10);
            db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
                ['admin', hash, 'Admin'], 
                (err) => {
                    if (!err) console.log("✅ Usuario administrador creado (Username: admin, Pass: admin123)");
                });
        }
    });
};
crearAdminPorDefecto();

// ===== RUTAS DE LA API (Más adelante añadiremos los endpoints completos) =====

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API funcionando correctamente' });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

        bcrypt.compare(password, user.password_hash, (err, result) => {
            if (result) {
                const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
                res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
            } else {
                res.status(401).json({ error: "Usuario o contraseña incorrectos" });
            }
        });
    });
});

// --- MIDDLEWARE DE AUTENTICACIÓN ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- ENDPOINTS: SUCURSALES ---
app.get('/api/branches', authenticateToken, (req, res) => {
    db.all("SELECT * FROM branches", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/branches', authenticateToken, (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: "No autorizado" });
    const { name, location } = req.body;
    db.run("INSERT INTO branches (name, location) VALUES (?, ?)", [name, location], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, location });
    });
});

// --- ENDPOINTS: PRODUCTOS ---
app.get('/api/products', authenticateToken, (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/products', authenticateToken, (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: "No autorizado" });
    const { sku, name, description, price } = req.body;
    db.run("INSERT INTO products (sku, name, description, price) VALUES (?, ?, ?, ?)", 
        [sku, name, description, price], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, sku, name, description, price });
    });
});

// --- ENDPOINTS: INVENTARIO (ENTRADAS/SALIDAS) ---
app.post('/api/movements', authenticateToken, (req, res) => {
    const { product_id, branch_id, type, quantity, notes } = req.body;

    if (quantity <= 0) return res.status(400).json({ error: "Cantidad debe ser mayor a 0" });
    if (!['IN', 'OUT'].includes(type)) return res.status(400).json({ error: "Tipo de movimiento inválido" });

    db.serialize(() => {
        db.run("BEGIN EXCLUSIVE TRANSACTION");

        const qtyChange = type === 'IN' ? quantity : -quantity;
        
        db.get("SELECT quantity FROM inventory WHERE product_id = ? AND branch_id = ?", [product_id, branch_id], (err, row) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            let finalQty = quantity;
            if (row) {
                finalQty = row.quantity + qtyChange;
                if (finalQty < 0) {
                    db.run("ROLLBACK");
                    return res.status(400).json({ error: "Stock insuficiente" });
                }
                
                db.run("UPDATE inventory SET quantity = ? WHERE product_id = ? AND branch_id = ?", [finalQty, product_id, branch_id], (err) => {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                });
            } else {
                if (type === 'OUT') {
                    db.run("ROLLBACK");
                    return res.status(400).json({ error: "Stock insuficiente" });
                }
                db.run("INSERT INTO inventory (product_id, branch_id, quantity) VALUES (?, ?, ?)", [product_id, branch_id, quantity], (err) => {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                });
            }

            // Guardar log
            db.run("INSERT INTO movements (product_id, branch_id, user_id, type, quantity, notes) VALUES (?, ?, ?, ?, ?, ?)",
                [product_id, branch_id, req.user.id, type, quantity, notes], function(err) {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                    
                    db.run("COMMIT");
                    res.json({ success: true, new_quantity: finalQty });
            });
        });
    });
});

app.get('/api/inventory', authenticateToken, (req, res) => {
    const query = `
        SELECT i.id, p.name as product_name, p.sku, b.name as branch_name, i.quantity
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN branches b ON i.branch_id = b.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/movements', authenticateToken, (req, res) => {
    const query = `
        SELECT m.id, p.name as product_name, p.sku, b.name as branch_name, u.username as user, m.type, m.quantity, m.date, m.notes
        FROM movements m
        JOIN products p ON m.product_id = p.id
        JOIN branches b ON m.branch_id = b.id
        JOIN users u ON m.user_id = u.id
        ORDER BY m.date DESC LIMIT 50
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Arrancar el Servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

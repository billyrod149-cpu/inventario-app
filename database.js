const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Usamos un nuevo archivo de BD para empezar limpios con el nuevo esquema de Activos IT
const dbPath = path.resolve(__dirname, 'assets_inventory.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error al abrir la base de datos sqlite:', err.message);
    } else {
        console.log('✅ Conectado a la base de datos de Activos IT.');
        
        db.run('PRAGMA foreign_keys = ON;', (err) => {});

        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'Empleado'
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS branches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                location TEXT
            )`);

            // Nueva tabla enfocada a control exacto de equipo de cómputo (1 fila = 1 equipo físico)
            db.run(`CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                serial_number TEXT UNIQUE NOT NULL,
                asset_type TEXT NOT NULL, 
                brand TEXT,
                model TEXT,
                details TEXT,
                status TEXT DEFAULT 'Activo',
                branch_id INTEGER NOT NULL,
                FOREIGN KEY (branch_id) REFERENCES branches (id)
            )`);

            // Historial de traslados de un equipo de un lugar a otro
            db.run(`CREATE TABLE IF NOT EXISTS movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER NOT NULL,
                from_branch_id INTEGER,
                to_branch_id INTEGER,
                user_id INTEGER NOT NULL,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (asset_id) REFERENCES assets (id),
                FOREIGN KEY (from_branch_id) REFERENCES branches (id),
                FOREIGN KEY (to_branch_id) REFERENCES branches (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            console.log('✅ Esquemas de Activos IT (Computadoras) inicializados correctamente.');
        });
    }
});

module.exports = db;

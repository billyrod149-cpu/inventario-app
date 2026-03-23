const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// La base de datos se guardara en este archivo localmente
const dbPath = path.resolve(__dirname, 'inventory.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error al abrir la base de datos sqlite:', err.message);
    } else {
        console.log('✅ Conectado a la base de datos SQLite.');
        
        // Habilitar el uso de llaves foráneas (para que las relaciones funcionen bien)
        db.run('PRAGMA foreign_keys = ON;', (err) => {
            if (err) console.error("Error habilitando llaves foráneas:", err.message);
        });

        // Crear las tablas si no existen
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

            db.run(`CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL DEFAULT 0.0
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                branch_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (product_id) REFERENCES products (id),
                FOREIGN KEY (branch_id) REFERENCES branches (id),
                UNIQUE(product_id, branch_id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                branch_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('IN', 'OUT')),
                quantity INTEGER NOT NULL,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (product_id) REFERENCES products (id),
                FOREIGN KEY (branch_id) REFERENCES branches (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            console.log('✅ Tablas inicializadas correctamente.');
        });
    }
});

module.exports = db;

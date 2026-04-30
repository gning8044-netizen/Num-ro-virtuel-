# database.py
import sqlite3
from datetime import datetime

DB_FILE = "bot.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        tg_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        verified INTEGER DEFAULT 0,
        verified_at TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tg_id INTEGER,
        phone TEXT,
        service TEXT,
        country TEXT,
        code TEXT,
        status TEXT DEFAULT 'waiting',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    conn.close()

def add_user(tg_id, username, first_name):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("INSERT OR IGNORE INTO users (tg_id, username, first_name) VALUES (?, ?, ?)",
              (tg_id, username, first_name))
    conn.commit()
    conn.close()

def verify_user(tg_id):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("UPDATE users SET verified = 1, verified_at = ? WHERE tg_id = ?",
              (datetime.now(), tg_id))
    conn.commit()
    conn.close()

def is_verified(tg_id):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT verified FROM users WHERE tg_id = ?", (tg_id,))
    result = c.fetchone()
    conn.close()
    return result and result[0] == 1

def add_order(tg_id, phone, service, country, code):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''INSERT INTO orders (tg_id, phone, service, country, code, status)
                 VALUES (?, ?, ?, ?, ?, 'waiting')''',
              (tg_id, phone, service, country, code))
    conn.commit()
    conn.close()

def get_stats(tg_id):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM orders WHERE tg_id = ? AND status = 'done'", (tg_id,))
    result = c.fetchone()[0]
    conn.close()
    return result
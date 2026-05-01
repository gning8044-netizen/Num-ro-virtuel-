// index.js - DEV SHADOW TECH (version complète et stylée)
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// ----------------------------- CONFIGURATION -----------------------------
const TOKEN = '8512140301:AAHZzbLOF53mlpXtg-jNQpznINF0WioNpZs';
const ADMIN_ID = 8424269759;
const ADMIN_CODE = '26102008';
const REQUIRED_GROUP_USERNAME = '@Shadow_OTC_Group';
const NUMBERS_FILE = 'manual_numbers.json';

const bot = new TelegramBot(TOKEN, { polling: true });
const db = new sqlite3.Database('bot.db');

// ----------------------------- BASE DE DONNÉES -----------------------------
db.run(`CREATE TABLE IF NOT EXISTS users (
    tg_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    verified INTEGER DEFAULT 0,
    verified_at TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id INTEGER,
    phone TEXT,
    service TEXT,
    country TEXT,
    code TEXT,
    status TEXT DEFAULT 'waiting',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

// ----------------------------- GESTION DES NUMÉROS (manuel + index) -----------------------------
function loadNumbers() {
    if (!fs.existsSync(NUMBERS_FILE)) {
        fs.writeFileSync(NUMBERS_FILE, JSON.stringify({ numbers: [] }, null, 2));
        return { numbers: [] };
    }
    return JSON.parse(fs.readFileSync(NUMBERS_FILE));
}

function saveNumbers(data) {
    fs.writeFileSync(NUMBERS_FILE, JSON.stringify(data, null, 2));
}

function getAvailableNumber(country, service) {
    const data = loadNumbers();
    for (const num of data.numbers) {
        if (num.country === country && num.service === service && num.status === 'available') {
            return num;
        }
    }
    return null;
}

function reserveNumber(phone, tg_id) {
    const data = loadNumbers();
    for (const num of data.numbers) {
        if (num.phone === phone && num.status === 'available') {
            num.status = 'reserved';
            num.used_by = tg_id;
            num.used_at = new Date().toISOString();
            saveNumbers(data);
            return true;
        }
    }
    return false;
}

function releaseNumber(phone) {
    const data = loadNumbers();
    for (const num of data.numbers) {
        if (num.phone === phone) {
            num.status = 'available';
            num.used_by = null;
            num.used_at = null;
            saveNumbers(data);
            return true;
        }
    }
    return false;
}

function addNumber(phone, country, service) {
    const data = loadNumbers();
    if (data.numbers.some(n => n.phone === phone)) return false;
    const newId = data.numbers.length ? Math.max(...data.numbers.map(n => n.id)) + 1 : 1;
    data.numbers.push({
        id: newId,
        phone: phone,
        country: country.toUpperCase(),
        service: service.toLowerCase(),
        status: 'available',
        used_by: null,
        used_at: null
    });
    saveNumbers(data);
    return true;
}

function removeNumber(phone) {
    const data = loadNumbers();
    const index = data.numbers.findIndex(n => n.phone === phone);
    if (index !== -1) {
        data.numbers.splice(index, 1);
        saveNumbers(data);
        return true;
    }
    return false;
}

function listNumbers() {
    const data = loadNumbers();
    if (!data.numbers.length) return '📭 Aucun numéro en base.';
    let msg = '📋 *LISTE DES NUMÉROS*\n\n';
    for (const n of data.numbers) {
        const statusIcon = n.status === 'available' ? '✅' : '🔴';
        msg += `${statusIcon} \`${n.phone}\` → ${n.service} (${n.country})\n`;
    }
    return msg;
}

// ----------------------------- MESSAGES STYLÉS -----------------------------
const welcomeMessage = `
🔥 *DEV SHADOW TECH* 🔥

Bienvenue sur *DEV SHADOW SMS*  
📲 Recevez des OTP et commencez à gagner de l'argent.

🇫🇷 Multi-pays supportés  
⚡ Rapide & anonyme  
🔐 Livraison sécurisée

✨ *Profitez de nos numéros virtuels* ✨

👉 *Rejoignez notre groupe OTP* : ${REQUIRED_GROUP_USERNAME}

✅ Utilisez /verify après avoir rejoint.

_Powered by @Dev Shadow Tech_
`;

const notJoinedMessage = `
🔐 *ACCÈS REFUSÉ* 🔐

Vous devez d’abord rejoindre notre *groupe OTP officiel* :

👥 ${REQUIRED_GROUP_USERNAME}

Après avoir rejoint, cliquez sur :
✅ /verify
`;

const waitingMessage = (phone, service, country) => `
📞 *NUMÉRO ATTRIBUÉ*

✅ \`${phone}\`  
📱 Service : *${service}*  
🌍 Pays : *${country}*

⏳ *En attente du code...*

💡 Une fois le code reçu, envoyez :
\`/code 123456\`

⚠️ *Numéro réservé 5 minutes*
`;

const codeReceivedMessage = (code) => `
🔐 *CODE REÇU AVEC SUCCÈS* 🔐

✅ \`${code}\`

🎉 *OTP validé avec succès !*

Utilisez /start pour un nouveau numéro.
`;

const alreadyVerifiedMessage = `
✅ *Vous êtes déjà vérifié* ✅

Accès au bot autorisé.
`;

const adminOnlyMessage = `
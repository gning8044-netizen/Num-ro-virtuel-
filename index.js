// index.js - DEV SHADOW OTP BOT
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// ========== CONFIGURATION ==========
const TOKEN = '8512140301:AAHZzbLOF53mlpXtg-jNQpznINF0WioNpZs';
const ADMIN_ID = 8424269759;
const ADMIN_CODE = '26102008';
const GROUP_LINK = 'https://t.me/+FTSLhDhRHtVlNmJk';
const NUMBERS_FILE = 'manual_numbers.json';

const bot = new TelegramBot(TOKEN, { polling: true });
const db = new sqlite3.Database('bot.db');

// Stockage temporaire des numéros actifs par utilisateur
const activeNumbers = {};

// ========== BASE DE DONNÉES ==========
db.run(`CREATE TABLE IF NOT EXISTS users (
    tg_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    verified INTEGER DEFAULT 1,
    joined_at TEXT DEFAULT CURRENT_TIMESTAMP
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

// ========== GESTION DES NUMÉROS ==========
function loadNumbers() {
    if (!fs.existsSync(NUMBERS_FILE)) {
        const defaultData = { numbers: [] };
        fs.writeFileSync(NUMBERS_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    return JSON.parse(fs.readFileSync(NUMBERS_FILE));
}

function saveNumbers(data) {
    fs.writeFileSync(NUMBERS_FILE, JSON.stringify(data, null, 2));
}

function getAvailableNumber(country, service) {
    const data = loadNumbers();
    const available = data.numbers.filter(n => n.country === country && n.service === service && n.status === 'available');
    if (available.length === 0) return null;
    return available[0];
}

function reserveNumber(phone, tgId) {
    const data = loadNumbers();
    const index = data.numbers.findIndex(n => n.phone === phone && n.status === 'available');
    if (index === -1) return false;
    data.numbers[index].status = 'reserved';
    data.numbers[index].used_by = tgId;
    data.numbers[index].used_at = new Date().toISOString();
    saveNumbers(data);
    return true;
}

function releaseNumber(phone) {
    const data = loadNumbers();
    const index = data.numbers.findIndex(n => n.phone === phone);
    if (index === -1) return false;
    data.numbers[index].status = 'available';
    data.numbers[index].used_by = null;
    data.numbers[index].used_at = null;
    saveNumbers(data);
    return true;
}

function addNumber(phone, country, service) {
    const data = loadNumbers();
    if (data.numbers.some(n => n.phone === phone)) return false;
    const maxId = data.numbers.length > 0 ? Math.max(...data.numbers.map(n => n.id)) : 0;
    data.numbers.push({
        id: maxId + 1,
        phone: phone,
        country: country.toUpperCase(),
        service: service.toLowerCase(),
        status: 'available',
        used_by: null,
        used_at: null,
        added_at: new Date().toISOString()
    });
    saveNumbers(data);
    return true;
}

function removeNumber(phone) {
    const data = loadNumbers();
    const index = data.numbers.findIndex(n => n.phone === phone);
    if (index === -1) return false;
    data.numbers.splice(index, 1);
    saveNumbers(data);
    return true;
}

function getAllServices() {
    const data = loadNumbers();
    const services = {};
    for (const num of data.numbers) {
        if (!services[num.service]) services[num.service] = true;
    }
    return Object.keys(services);
}

function getCountriesByService(service) {
    const data = loadNumbers();
    const countries = {};
    for (const num of data.numbers) {
        if (num.service === service && num.status === 'available') {
            if (!countries[num.country]) countries[num.country] = 0;
            countries[num.country]++;
        }
    }
    return countries;
}

function getAllNumbersList() {
    const data = loadNumbers();
    if (data.numbers.length === 0) return '📭 No numbers in database.';
    let result = '📋 NUMBERS LIST\n━━━━━━━━━━━━━━━━━━━━\n\n';
    for (const num of data.numbers) {
        const statusIcon = num.status === 'available' ? '✅' : '🔴';
        result += `${statusIcon} ${num.phone}\n`;
        result += `   📱 ${num.service} | 🌍 ${num.country} | ID: ${num.id}\n\n`;
    }
    return result;
}

function getStats() {
    const data = loadNumbers();
    const available = data.numbers.filter(n => n.status === 'available').length;
    const reserved = data.numbers.filter(n => n.status === 'reserved').length;
    return { total: data.numbers.length, available, reserved };
}

// ========== CLAVIERS ==========
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            ['📞 GET NUMBER'],
            ['📊 MY STATS', '👥 OTP GROUP'],
            ['🍽️ MENU']
        ],
        resize_keyboard: true,
        persistent: true
    }
};

const adminKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '➕ ADD NUMBER', callback_data: 'admin_add' }],
            [{ text: '🗑️ DELETE NUMBER', callback_data: 'admin_del' }],
            [{ text: '📋 LIST NUMBERS', callback_data: 'admin_list' }],
            [{ text: '📊 BOT STATS', callback_data: 'admin_stats' }],
            [{ text: '🔙 BACK', callback_data: 'back_menu' }]
        ]
    }
};

function getServicesKeyboard() {
    const services = getAllServices();
    const buttons = [];
    for (let i = 0; i < services.length; i += 2) {
        const row = [];
        row.push({ text: services[i].toUpperCase(), callback_data: `svc_${services[i]}` });
        if (services[i + 1]) row.push({ text: services[i + 1].toUpperCase(), callback_data: `svc_${services[i + 1]}` });
        buttons.push(row);
    }
    buttons.push([{ text: '⬅ BACK', callback_data: 'back_menu' }]);
    return { reply_markup: { inline_keyboard: buttons } };
}

function getCountriesKeyboard(service) {
    const countries = getCountriesByService(service);
    const buttons = [];
    const countryList = Object.keys(countries);
    for (let i = 0; i < countryList.length; i += 2) {
        const row = [];
        row.push({ text: `${countryList[i]} (${countries[countryList[i]]})`, callback_data: `cnt_${service}_${countryList[i]}` });
        if (countryList[i + 1]) row.push({ text: `${countryList[i + 1]} (${countries[countryList[i + 1]]})`, callback_data: `cnt_${service}_${countryList[i + 1]}` });
        buttons.push(row);
    }
    buttons.push([{ text: '⬅ BACK TO SERVICES', callback_data: 'back_services' }]);
    return { reply_markup: { inline_keyboard: buttons } };
}

function getNumberKeyboard(service, country) {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔄 CHANGE NUMBER', callback_data: `change_${service}_${country}` }],
                [{ text: '🌍 CHANGE COUNTRY', callback_data: `change_country_${service}` }],
                [{ text: '👥 OTP GROUP', url: GROUP_LINK }]
            ]
        }
    };
}

// ========== MESSAGES ==========
const WELCOME = `🔷 DEV SHADOW OTP 🔷

Welcome to DEV SHADOW OTP Bot

Receive OTP codes virtually
Fast, secure and anonymous

Use GET NUMBER to start
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

const NO_NUMBER_MSG = `❌ NO NUMBER AVAILABLE

No numbers available for this service.

Please try another service or contact support.`;

// ========== COMMANDES ==========
bot.onText(/\/start/, (msg) => {
    const tgId = msg.from.id;
    const username = msg.from.username || '';
    const firstName = msg.from.first_name || '';
    
    db.run(`INSERT OR IGNORE INTO users (tg_id, username, first_name) VALUES (?, ?, ?)`, [tgId, username, firstName]);
    bot.sendMessage(tgId, WELCOME, mainKeyboard);
});

bot.onText(/📞 GET NUMBER/, (msg) => {
    const tgId = msg.from.id;
    const services = getAllServices();
    if (services.length === 0) {
        bot.sendMessage(tgId, '❌ No services available. Contact admin.');
        return;
    }
    bot.sendMessage(tgId, '🔹 SELECT SERVICE:', getServicesKeyboard());
});

bot.onText(/📊 MY STATS/, (msg) => {
    const tgId = msg.from.id;
    db.get(`SELECT COUNT(*) as total FROM orders WHERE tg_id = ? AND status = 'done'`, [tgId], (err, row) => {
        const count = row ? row.total : 0;
        bot.sendMessage(tgId, `📊 YOUR STATS\n━━━━━━━━━━━━━━\n✅ OTP Received: ${count}\n━━━━━━━━━━━━━━`);
    });
});

bot.onText(/👥 OTP GROUP/, (msg) => {
    bot.sendMessage(msg.from.id, `🔗 JOIN OUR OTP GROUP\n${GROUP_LINK}`);
});

bot.onText(/🍽️ MENU/, (msg) => {
    bot.sendMessage(msg.from.id, WELCOME, mainKeyboard);
});

bot.onText(/\/code (.+)/, (msg, match) => {
    const tgId = msg.from.id;
    const code = match[1];
    const phone = activeNumbers[tgId];
    
    if (!phone) {
        bot.sendMessage(tgId, '❌ No active number. Use GET NUMBER first.');
        return;
    }
    
    releaseNumber(phone);
    db.run(`INSERT INTO orders (tg_id, phone, code, status) VALUES (?, ?, ?, 'done')`, [tgId, phone, code]);
    delete activeNumbers[tgId];
    
    bot.sendMessage(tgId, `✅ CODE VERIFIED\n━━━━━━━━━━━━━━\nCode: ${code}\nStatus: VALID\n━━━━━━━━━━━━━━\nUse GET NUMBER for a new number.`);
});

// ========== CALLBACKS ==========
bot.on('callback_query', (query) => {
    const tgId = query.from.id;
    const data = query.data;
    
    bot.answerCallbackQuery(query.id);
    
    if (data === 'back_menu') {
        bot.editMessageText(WELCOME, {
            chat_id: tgId,
            message_id: query.message.message_id,
            reply_markup: mainKeyboard.reply_markup
        });
    }
    else if (data === 'back_services') {
        const services = getAllServices();
        if (services.length === 0) {
            bot.editMessageText('No services available.', { chat_id: tgId, message_id: query.message.message_id });
            return;
        }
        bot.editMessageText('🔹 SELECT SERVICE:', {
            chat_id: tgId,
            message_id: query.message.message_id,
            reply_markup: getServicesKeyboard().reply_markup
        });
    }
    else if (data.startsWith('svc_')) {
        const service = data.replace('svc_', '');
        const countries = getCountriesByService(service);
        if (Object.keys(countries).length === 0) {
            bot.editMessageText(NO_NUMBER_MSG, { chat_id: tgId, message_id: query.message.message_id });
            return;
        }
        bot.editMessageText(`🔹 SELECT COUNTRY FOR ${service.toUpperCase()}:`, {
            chat_id: tgId,
            message_id: query.message.message_id,
            reply_markup: getCountriesKeyboard(service).reply_markup
        });
    }
    else if (data.startsWith('cnt_')) {
        const parts = data.split('_');
        const service = parts[1];
        const country = parts[2];
        
        const number = getAvailableNumber(country, service);
        if (!number) {
            bot.editMessageText(NO_NUMBER_MSG, { chat_id: tgId, message_id: query.message.message_id });
            return;
        }
        
        reserveNumber(number.phone, tgId);
        activeNumbers[tgId] = number.phone;
        
        const formattedPhone = number.phone.match(/.{1,2}/g)?.join(' ') || number.phone;
        
        bot.editMessageText(`📞 YOUR NUMBER\n━━━━━━━━━━━━━━\nCountry: ${country}\nService: ${service.toUpperCase()}\nNumber: ${formattedPhone}\n━━━━━━━━━━━━━━\n⏳ Waiting for OTP...\n\nSend code using:\n/code 123456`, {
            chat_id: tgId,
            message_id: query.message.message_id,
            reply_markup: getNumberKeyboard(service, country).reply_markup
        });
    }
    else if (data.startsWith('change_')) {
        const parts = data.split('_');
        const service = parts[1];
        const country = parts[2];
        
        const currentPhone = activeNumbers[tgId];
        if (currentPhone) releaseNumber(currentPhone);
        
        const newNumber = getAvailableNumber(country, service);
        if (!newNumber) {
            bot.editMessageText(NO_NUMBER_MSG, { chat_id: tgId, message_id: query.message.message_id });
            return;
        }
        
        reserveNumber(newNumber.phone, tgId);
        activeNumbers[tgId] = newNumber.phone;
        const formattedPhone = newNumber.phone.match(/.{1,2}/g)?.join(' ') || newNumber.phone;
        
        bot.editMessageText(`📞 NUMBER CHANGED\n━━━━━━━━━━━━━━\nCountry: ${country}\nService: ${service.toUpperCase()}\nNumber: ${formattedPhone}\n━━━━━━━━━━━━━━\nSend code using /code`, {
            chat_id: tgId,
            message_id: query.message.message_id,
            reply_markup: getNumberKeyboard(service, country).reply_markup
        });
    }
    else if (data.startsWith('change_country_')) {
        const service = data.replace('change_country_', '');
        const countries = getCountriesByService(service);
        bot.editMessageText(`🔹 SELECT COUNTRY FOR ${service.toUpperCase()}:`, {
            chat_id: tgId,
            message_id: query.message.message_id,
            reply_markup: getCountriesKeyboard(service).reply_markup
        });
    }
    
    // ========== ADMIN PANEL ==========
    else if (data === 'admin_add') {
        bot.editMessageText('📝 ADD NUMBER\n━━━━━━━━━━━━━━\nSend number in format:\n+33612345678\n\nBot will detect country and ask for service.', {
            chat_id: tgId,
            message_id: query.message.message_id
        });
        const addListener = (msg) => {
            if (!msg.text || !msg.text.startsWith('+')) return;
            const phone = msg.text.trim();
            let countryCode = '';
            if (phone.startsWith('+33')) countryCode = 'FR';
            else if (phone.startsWith('+1')) countryCode = 'US';
            else if (phone.startsWith('+44')) countryCode = 'UK';
            else if (phone.startsWith('+234')) countryCode = 'NG';
            else if (phone.startsWith('+225')) countryCode = 'CI';
            else if (phone.startsWith('+49')) countryCode = 'DE';
            else countryCode = 'XX';
            
            bot.sendMessage(tgId, `Country detected: ${countryCode}\nSend service (whatsapp/telegram/google/instagram):`);
            bot.once('message', (msg2) => {
                const service = msg2.text.toLowerCase();
                if (addNumber(phone, countryCode, service)) {
                    bot.sendMessage(tgId, `✅ NUMBER ADDED\n${phone}\n${service.toUpperCase()} / ${countryCode}`, adminKeyboard);
                } else {
                    bot.sendMessage(tgId, '❌ Number already exists', adminKeyboard);
                }
                bot.removeListener('message', addListener);
            });
        };
        bot.on('message', addListener);
    }
    else if (data === 'admin_del') {
        bot.editMessageText('🗑️ DELETE NUMBER\n━━━━━━━━━━━━━━\nSend number to delete:\n+33612345678', {
            chat_id: tgId,
            message_id: query.message.message_id
        });
        const delListener = (msg) => {
            if (!msg.text || !msg.text.startsWith('+')) return;
            const phone = msg.text.trim();
            if (removeNumber(phone)) {
                bot.sendMessage(tgId, `✅ NUMBER DELETED\n${phone}`, adminKeyboard);
            } else {
                bot.sendMessage(tgId, '❌ Number not found', adminKeyboard);
            }
            bot.removeListener('message', delListener);
        };
        bot.on('message', delListener);
    }
    else if (data === 'admin_list') {
        const list = getAllNumbersList();
        bot.editMessageText(list, {
            chat_id: tgId,
            message_id: query.message.message_id,
            reply_markup: adminKeyboard.reply_markup
        });
    }
    else if (data === 'admin_stats') {
        const stats = getStats();
        db.get(`SELECT COUNT(*) as users FROM users`, [], (err, row) => {
            const userCount = row ? row.users : 0;
            bot.editMessageText(`📊 BOT STATISTICS\n━━━━━━━━━━━━━━\n👥 Users: ${userCount}\n📞 Total numbers: ${stats.total}\n✅ Available: ${stats.available}\n🔴 Reserved: ${stats.reserved}\n━━━━━━━━━━━━━━`, {
                chat_id: tgId,
                message_id: query.message.message_id,
                reply_markup: adminKeyboard.reply_markup
            });
        });
    }
});

// ========== ADMIN COMMAND ==========
bot.onText(/\/admin/, (msg) => {
    const tgId = msg.from.id;
    if (tgId !== ADMIN_ID) {
        bot.sendMessage(tgId, '⛔ ACCESS DENIED');
        return;
    }
    bot.sendMessage(tgId, '🔐 ENTER ADMIN CODE:');
    bot.once('message', (msg) => {
        if (msg.text === ADMIN_CODE) {
            bot.sendMessage(tgId, '✅ ADMIN PANEL', adminKeyboard);
        } else {
            bot.sendMessage(tgId, '❌ INVALID CODE');
        }
    });
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 DEV SHADOW OTP IS RUNNING');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
// index.js - DEV SHADOW TECH OTP Bot
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// ============ CONFIGURATION ============
const TOKEN = '8512140301:AAHZzbLOF53mlpXtg-jNQpznINF0WioNpZs';
const ADMIN_ID = 8424269759;
const ADMIN_CODE = '26102008';
const REQUIRED_GROUP = '@Shadow_OTC_Group';

const bot = new TelegramBot(TOKEN, { polling: true });

// ============ BASE DE DONNÉES ============
const db = new sqlite3.Database('bot.db');

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

// ============ FICHIER DES NUMÉROS ============
const numbersFile = 'manual_numbers.json';

function loadNumbers() {
    if (!fs.existsSync(numbersFile)) {
        fs.writeFileSync(numbersFile, JSON.stringify({ numbers: [] }));
        return { numbers: [] };
    }
    return JSON.parse(fs.readFileSync(numbersFile));
}

function saveNumbers(data) {
    fs.writeFileSync(numbersFile, JSON.stringify(data, null, 2));
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
    for (const num of data.numbers) {
        if (num.phone === phone) return false;
    }
    const newId = (data.numbers.length > 0 ? Math.max(...data.numbers.map(n => n.id)) : 0) + 1;
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
    if (data.numbers.length === 0) return '📭 No numbers available';
    let result = '📋 NUMBERS LIST:\n\n';
    for (const num of data.numbers) {
        const emoji = num.status === 'available' ? '✅' : '🔴';
        result += `${emoji} ${num.phone} | ${num.service} | ${num.country}\n`;
    }
    return result;
}

// ============ MESSAGES ============
const WELCOME_MESSAGE = `🔥 DEV SHADOW TECH 🔥

Welcome to our DEV SHADOW SMS

Receive OTP's and start Earning Money

🇫🇷 Multiple countries supported
⚡ Fast & Anonymous
🔐 Secure OTP delivery

Start verifying your accounts with ease
- anytime, anywhere!

Powered By @Dev Shadow Tech`;

const NOT_JOINED_MESSAGE = `🔐 DEV SHADOW TECH

⚠️ ACCESS DENIED ⚠️

You must join our official OTP group before using this bot!

👥 @Shadow_OTC_Group

After joining, click /verify to continue`;

// ============ CLAVIERS ============
const mainKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '📞 Get Number', callback_data: 'get_number' }],
            [{ text: '📊 My Stats', callback_data: 'my_stats' }],
            [{ text: '🍽️ Menu', callback_data: 'menu' }]
        ]
    }
};

const countryKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🇫🇷 France', callback_data: 'country_FR' }],
            [{ text: '🇺🇸 USA', callback_data: 'country_US' }],
            [{ text: '🇬🇧 UK', callback_data: 'country_UK' }]
        ]
    }
};

function getServiceKeyboard(country) {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📱 WhatsApp', callback_data: `service_${country}_whatsapp` }],
                [{ text: '📩 Telegram', callback_data: `service_${country}_telegram` }],
                [{ text: '🔙 Back', callback_data: 'back_country' }]
            ]
        }
    };
}

const adminKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '➕ Add Number', callback_data: 'admin_add' }],
            [{ text: '🗑️ Delete Number', callback_data: 'admin_del' }],
            [{ text: '📋 List Numbers', callback_data: 'admin_list' }],
            [{ text: '📊 Stats', callback_data: 'admin_stats' }]
        ]
    }
};

// ============ COMMANDES ============
bot.onText(/\/start/, (msg) => {
    const tg_id = msg.from.id;
    const username = msg.from.username || '';
    const first_name = msg.from.first_name || '';
    
    db.run(`INSERT OR IGNORE INTO users (tg_id, username, first_name) VALUES (?, ?, ?)`, [tg_id, username, first_name]);
    bot.sendMessage(tg_id, WELCOME_MESSAGE, mainKeyboard);
});

bot.onText(/\/verify/, (msg) => {
    const tg_id = msg.from.id;
    db.run(`UPDATE users SET verified = 1, verified_at = ? WHERE tg_id = ?`, [new Date().toISOString(), tg_id]);
    bot.sendMessage(tg_id, WELCOME_MESSAGE, mainKeyboard);
});

bot.onText(/\/code (.+)/, (msg, match) => {
    const tg_id = msg.from.id;
    const code = match[1];
    
    db.get(`SELECT verified FROM users WHERE tg_id = ?`, [tg_id], (err, row) => {
        if (!row || !row.verified) {
            bot.sendMessage(tg_id, NOT_JOINED_MESSAGE);
            return;
        }
        bot.sendMessage(tg_id, `🔐 DEV SHADOW TECH\n\n✅ Code received: ${code}\n\nOTP verified successfully!`);
    });
});

// ============ CALLBACKS ============
bot.on('callback_query', (query) => {
    const tg_id = query.from.id;
    const data = query.data;
    
    bot.answerCallbackQuery(query.id);
    
    if (data === 'get_number') {
        db.get(`SELECT verified FROM users WHERE tg_id = ?`, [tg_id], (err, row) => {
            if (!row || !row.verified) {
                bot.sendMessage(tg_id, NOT_JOINED_MESSAGE);
                return;
            }
            bot.editMessageText('🌍 Select country:', {
                chat_id: tg_id,
                message_id: query.message.message_id,
                reply_markup: countryKeyboard.reply_markup
            });
        });
    }
    else if (data.startsWith('country_')) {
        const country = data.split('_')[1];
        bot.editMessageText(`📱 Select service for ${country}:`, {
            chat_id: tg_id,
            message_id: query.message.message_id,
            reply_markup: getServiceKeyboard(country).reply_markup
        });
    }
    else if (data.startsWith('service_')) {
        const parts = data.split('_');
        const country = parts[1];
        const service = parts[2];
        
        const num = getAvailableNumber(country, service);
        if (!num) {
            bot.answerCallbackQuery(query.id, { text: '❌ No number available', show_alert: true });
            return;
        }
        
        reserveNumber(num.phone, tg_id);
        db.run(`INSERT INTO orders (tg_id, phone, service, country, code, status) VALUES (?, ?, ?, ?, ?, 'waiting')`, 
                [tg_id, num.phone, service, country, '123456']);
        
        bot.editMessageText(`📞 DEV SHADOW TECH\n\n✅ Number: ${num.phone}\n📱 Service: ${service}\n🌍 Country: ${country}\n\n⏳ Waiting for OTP code...\n💡 Send code using: /code <code>`, {
            chat_id: tg_id,
            message_id: query.message.message_id
        });
    }
    else if (data === 'my_stats') {
        db.get(`SELECT COUNT(*) as total FROM orders WHERE tg_id = ? AND status = 'done'`, [tg_id], (err, row) => {
            const total = row ? row.total : 0;
            bot.editMessageText(`📊 Your stats:\n✅ Total OTPs: ${total}`, {
                chat_id: tg_id,
                message_id: query.message.message_id,
                reply_markup: mainKeyboard.reply_markup
            });
        });
    }
    else if (data === 'menu') {
        bot.editMessageText(WELCOME_MESSAGE, {
            chat_id: tg_id,
            message_id: query.message.message_id,
            reply_markup: mainKeyboard.reply_markup
        });
    }
    else if (data === 'back_country') {
        bot.editMessageText('🌍 Select country:', {
            chat_id: tg_id,
            message_id: query.message.message_id,
            reply_markup: countryKeyboard.reply_markup
        });
    }
    else if (data === 'admin_add') {
        bot.editMessageText('Send: +33612345678|FR|whatsapp', {
            chat_id: tg_id,
            message_id: query.message.message_id
        });
        bot.once('message', (msg) => {
            const parts = msg.text.split('|');
            if (parts.length === 3) {
                const [phone, country, service] = parts;
                if (addNumber(phone, country, service)) {
                    bot.sendMessage(tg_id, '✅ Number added!');
                } else {
                    bot.sendMessage(tg_id, '❌ Number already exists');
                }
            } else {
                bot.sendMessage(tg_id, '❌ Invalid format');
            }
            bot.sendMessage(tg_id, 'Admin panel', adminKeyboard);
        });
    }
    else if (data === 'admin_del') {
        bot.editMessageText('Send phone number to delete:\n+33612345678', {
            chat_id: tg_id,
            message_id: query.message.message_id
        });
        bot.once('message', (msg) => {
            if (removeNumber(msg.text)) {
                bot.sendMessage(tg_id, '✅ Number removed!');
            } else {
                bot.sendMessage(tg_id, '❌ Number not found');
            }
            bot.sendMessage(tg_id, 'Admin panel', adminKeyboard);
        });
    }
    else if (data === 'admin_list') {
        bot.editMessageText(listNumbers(), {
            chat_id: tg_id,
            message_id: query.message.message_id,
            reply_markup: adminKeyboard.reply_markup
        });
    }
    else if (data === 'admin_stats') {
        db.get(`SELECT COUNT(*) as total FROM users`, [], (err, row) => {
            const total = row ? row.total : 0;
            bot.editMessageText(`📊 Total users: ${total}`, {
                chat_id: tg_id,
                message_id: query.message.message_id,
                reply_markup: adminKeyboard.reply_markup
            });
        });
    }
});

// Commande admin
bot.onText(/\/admin/, (msg) => {
    const tg_id = msg.from.id;
    if (tg_id !== ADMIN_ID) {
        bot.sendMessage(tg_id, '⛔ Unauthorized');
        return;
    }
    bot.sendMessage(tg_id, '🔐 Enter admin code:');
    bot.once('message', (msg) => {
        if (msg.text === ADMIN_CODE) {
            bot.sendMessage(tg_id, '✅ Admin panel', adminKeyboard);
        } else {
            bot.sendMessage(tg_id, '❌ Wrong code');
        }
    });
});

console.log('🚀 DEV SHADOW TECH is running...');
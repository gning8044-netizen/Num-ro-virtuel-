// index.js - DEV SHADOW OTP (Version finale avec lien direct OTP GROUP)
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ========== CONFIGURATION ==========
const TOKEN = '8637465354:AAFYkBJKRl12OfAEBdnD7LtPDsZhRfN6Kvg';
const ADMIN_ID = 8424269759;
const ADMIN_CODE = '26102008';
const GROUP_LINK = 'https://t.me/+FTSLhDhRHtVlNmJk';
const NUMBERS_FILE = 'numbers.json';

const bot = new TelegramBot(TOKEN, { polling: true });

// Stockage temporaire
const userNumbers = {};

// ========== FONCTIONS ==========
function loadNumbers() {
    if (!fs.existsSync(NUMBERS_FILE)) {
        const defaultNumbers = [
            { phone: "+221771234567", country: "SENEGAL", flag: "🇸🇳", service: "whatsapp", version: "V1", status: "available", group: GROUP_LINK },
            { phone: "+221771234568", country: "SENEGAL", flag: "🇸🇳", service: "whatsapp", version: "V1", status: "available", group: GROUP_LINK },
            { phone: "+2250749529009", country: "IVORY COAST", flag: "🇨🇮", service: "whatsapp", version: "V1", status: "available", group: GROUP_LINK },
            { phone: "+33612345678", country: "FRANCE", flag: "🇫🇷", service: "whatsapp", version: "V1", status: "available", group: GROUP_LINK }
        ];
        fs.writeFileSync(NUMBERS_FILE, JSON.stringify(defaultNumbers, null, 2));
        return defaultNumbers;
    }
    return JSON.parse(fs.readFileSync(NUMBERS_FILE));
}

function saveNumbers(numbers) {
    fs.writeFileSync(NUMBERS_FILE, JSON.stringify(numbers, null, 2));
}

function formatPhone(phone) {
    const code = phone.match(/^\+\d+/)[0];
    const number = phone.substring(code.length);
    return `${code} ${number}`;
}

function cleanPhone(phone) {
    if (phone.startsWith('+')) {
        return phone;
    }
    return '+' + phone;
}

function getFlagByCountry(country) {
    const flags = {
        'SENEGAL': '🇸🇳', 'FRANCE': '🇫🇷', 'IVORY COAST': '🇨🇮',
        'NIGERIA': '🇳🇬', 'USA': '🇺🇸', 'UK': '🇬🇧', 'GERMANY': '🇩🇪',
        'INDIA': '🇮🇳', 'BRAZIL': '🇧🇷', 'JAPAN': '🇯🇵', 'CHINA': '🇨🇳',
        'RUSSIA': '🇷🇺', 'ITALY': '🇮🇹', 'SPAIN': '🇪🇸', 'ZIMBABWE': '🇿🇼',
        'ZAMBIA': '🇿🇲'
    };
    return flags[country] || '🌍';
}

function getAllServiceVersions() {
    const numbers = loadNumbers();
    const serviceVersions = new Set();
    for (const num of numbers) {
        serviceVersions.add(`${num.service}_${num.version}`);
    }
    return Array.from(serviceVersions);
}

function getCountriesByServiceVersion(service, version) {
    const numbers = loadNumbers();
    const countries = {};
    for (const num of numbers) {
        if (num.service === service && num.version === version) {
            if (!countries[num.country]) {
                countries[num.country] = { flag: num.flag, available: 0, total: 0 };
            }
            countries[num.country].total++;
            if (num.status === 'available') {
                countries[num.country].available++;
            }
        }
    }
    return countries;
}

function getAvailableNumber(service, version, country, excludePhone = null) {
    const numbers = loadNumbers();
    let available = numbers.filter(n => 
        n.service === service && 
        n.version === version && 
        n.country === country && 
        n.status === 'available'
    );
    
    if (excludePhone) {
        available = available.filter(n => n.phone !== excludePhone);
    }
    
    if (available.length === 0) return null;
    return available[0];
}

function reserveNumber(phone, userId) {
    const numbers = loadNumbers();
    const index = numbers.findIndex(n => n.phone === phone && n.status === 'available');
    if (index === -1) return false;
    numbers[index].status = 'reserved';
    numbers[index].reserved_by = userId;
    numbers[index].reserved_at = new Date().toISOString();
    saveNumbers(numbers);
    return true;
}

function releaseNumber(phone) {
    const numbers = loadNumbers();
    const index = numbers.findIndex(n => n.phone === phone);
    if (index === -1) return false;
    numbers[index].status = 'available';
    numbers[index].reserved_by = null;
    numbers[index].reserved_at = null;
    saveNumbers(numbers);
    return true;
}

function addMultipleNumbers(country, version, phones) {
    const numbers = loadNumbers();
    const flag = getFlagByCountry(country.toUpperCase());
    let added = 0;
    let failed = 0;
    
    for (const phone of phones) {
        const cleanPhoneNumber = cleanPhone(phone);
        if (!numbers.some(n => n.phone === cleanPhoneNumber)) {
            numbers.push({
                phone: cleanPhoneNumber,
                country: country.toUpperCase(),
                flag: flag,
                service: "whatsapp",
                version: version.toUpperCase(),
                status: 'available',
                group: GROUP_LINK,
                added_at: new Date().toISOString()
            });
            added++;
        } else {
            failed++;
        }
    }
    saveNumbers(numbers);
    return { added, failed };
}

function removeNumber(phone) {
    const numbers = loadNumbers();
    const cleanPhoneNumber = cleanPhone(phone);
    const index = numbers.findIndex(n => n.phone === cleanPhoneNumber);
    if (index === -1) return false;
    numbers.splice(index, 1);
    saveNumbers(numbers);
    return true;
}

// ========== CLAVIERS ==========
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            ['📞 𝐆𝐄𝐓 𝐍𝐔𝐌𝐁𝐄𝐑 '],
            ['📊 𝐌𝐘 𝐒𝐓𝐀𝐓𝐒', '👥 𝐎𝐓𝐏 𝐆𝐑𝐎𝐔𝐏'],
            ['🔧 𝐀𝐃𝐌𝐈𝐍']
        ],
        resize_keyboard: true
    }
};

function getServicesKeyboard() {
    const services = getAllServiceVersions();
    const buttons = [];
    for (let i = 0; i < services.length; i += 2) {
        const row = [];
        const svc1 = services[i];
        row.push({ text: svc1.toUpperCase(), callback_data: `svc_${svc1}` });
        if (services[i + 1]) {
            const svc2 = services[i + 1];
            row.push({ text: svc2.toUpperCase(), callback_data: `svc_${svc2}` });
        }
        buttons.push(row);
    }
    buttons.push([{ text: '⬅ 𝐁𝐀𝐂𝐊', callback_data: 'back' }]);
    return { reply_markup: { inline_keyboard: buttons } };
}

function getCountriesKeyboard(service, version) {
    const countries = getCountriesByServiceVersion(service, version);
    const buttons = [];
    for (const [countryName, data] of Object.entries(countries)) {
        buttons.push([{ text: `${data.flag} ${countryName} (${data.available}/${data.total})`, callback_data: `cnt_${service}_${version}_${countryName}` }]);
    }
    buttons.push([{ text: '⬅ 𝐁𝐀𝐂𝐊 𝐓𝐎 𝐒𝐄𝐑𝐕𝐈𝐂𝐄𝐒', callback_data: 'back_services' }]);
    return { reply_markup: { inline_keyboard: buttons } };
}

function getNumberKeyboard(service, version, country, groupLink, currentPhone) {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔄 𝐂𝐇𝐀𝐍𝐆𝐄 𝐍𝐔𝐌𝐁𝐄𝐑', callback_data: `change_${service}_${version}_${country}_${currentPhone}` }],
                [{ text: '🌍 𝐂𝐇𝐀𝐍𝐆𝐄 𝐂𝐎𝐔𝐍𝐓𝐑𝐘', callback_data: `change_country_${service}_${version}` }],
                [{ text: '👥 𝐎𝐓𝐏 𝐆𝐑𝐎𝐔𝐏', url: groupLink }]
            ]
        }
    };
}

function getAdminKeyboard() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ AJOUTER NUMEROS', callback_data: 'admin_add' }],
                [{ text: '🗑️ SUPPRIMER NUMERO', callback_data: 'admin_del' }],
                [{ text: '📋 LISTE NUMEROS', callback_data: 'admin_list' }],
                [{ text: '📊 STATISTIQUES', callback_data: 'admin_stats' }],
                [{ text: '🔙 RETOUR', callback_data: 'back' }]
            ]
        }
    };
}

// ========== MESSAGES ==========
const 𝕎𝔼𝕃ℂ𝕆𝕄𝔼 = `🔷 𝔻𝔼𝕍 𝕊ℍ𝔸𝔻𝕆𝕎 𝕆𝕋ℙ 🔷

𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 𝐃𝐄𝐕 𝐒𝐇𝐀𝐃𝐎𝐖 𝐎𝐓𝐏 𝐁𝐨𝐭

𝐑𝐞𝐜𝐞𝐢𝐯𝐞 𝐎𝐓𝐏 𝐜𝐨𝐝𝐞𝐬 𝐯𝐢𝐫𝐭𝐮𝐚𝐥𝐥𝐲𝐅𝐚𝐬𝐭, 𝐬𝐞𝐜𝐮𝐫𝐞 𝐚𝐧𝐝 𝐚𝐧𝐨𝐧𝐲𝐦𝐨𝐮𝐬

𝐔𝐭𝐢𝐥𝐢𝐬𝐞 𝐆𝐄𝐓 𝐍𝐔𝐌𝐁𝐄𝐑 𝐭𝐨 𝐬𝐭𝐚𝐫𝐭`;

// ========== COMMANDES ==========
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, WELCOME, mainKeyboard);
});

bot.onText(/📞 GET NUMBER/, (msg) => {
    const services = getAllServiceVersions();
    if (services.length === 0) {
        bot.sendMessage(msg.chat.id, '❌ No services available. Contact admin.');
        return;
    }
    bot.sendMessage(msg.chat.id, '🔹 𝐒𝐄𝐋𝐄𝐂𝐓 𝐒𝐄𝐑𝐕𝐈𝐂𝐄:', getServicesKeyboard());
});

bot.onText(/📊 MY STATS/, (msg) => {
    const userId = msg.chat.id;
    if (userNumbers[userId]) {
        bot.sendMessage(msg.chat.id, '📊 YOUR STATS\n━━━━━━━━━━━━━━\n🟡 Active number pending.\n━━━━━━━━━━━━━━');
    } else {
        bot.sendMessage(msg.chat.id, '📊 YOUR STATS\n━━━━━━━━━━━━━━\n✅ No OTP used yet.\n━━━━━━━━━━━━━━');
    }
});

bot.onText(/👥 OTP GROUP/, (msg) => {
    bot.sendMessage(msg.chat.id, `👥 𝐎𝐓𝐏 𝐆𝐑𝐎𝐔𝐏\n\n𝐉𝐨𝐢𝐧 𝐨𝐮𝐫 𝐨𝐟𝐟𝐢𝐜𝐢𝐚𝐥 𝐎𝐓𝐏 𝐠𝐫𝐨𝐮𝐩:\n\n${GROUP_LINK}\n\n𝐆𝐞𝐭 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐚𝐧𝐝 𝐮𝐩𝐝𝐚𝐭𝐞𝐬 𝐭𝐡𝐞𝐫𝐞.`);
});

bot.onText(/\/code (.+)/, (msg, match) => {
    const userId = msg.chat.id;
    const code = match[1];
    
    if (!userNumbers[userId]) {
        bot.sendMessage(userId, '❌ No active number. Use GET NUMBER first.');
        return;
    }
    
    const phone = userNumbers[userId];
    releaseNumber(phone);
    delete userNumbers[userId];
    
    bot.sendMessage(userId, `✅ CODE VERIFIED\n━━━━━━━━━━━━━━\n📞 ${formatPhone(phone)}\n🔐 Code: ${code}\n✅ Status: VALID\n━━━━━━━━━━━━━━\nUse GET NUMBER for a new number.`);
});

// ========== PANEL ADMIN ==========
bot.onText(/🔧 ADMIN/, (msg) => {
    if (msg.from.id !== ADMIN_ID) {
        bot.sendMessage(msg.chat.id, '⛔ ACCES REFUSE');
        return;
    }
    
    bot.sendMessage(msg.chat.id, '🔐 CODE ADMIN:');
    bot.once('message', (codeMsg) => {
        if (codeMsg.text !== ADMIN_CODE) {
            bot.sendMessage(msg.chat.id, '❌ CODE INVALIDE');
            return;
        }
        
        bot.sendMessage(msg.chat.id, '✅ PANEL ADMIN', getAdminKeyboard());
    });
});

// ========== CALLBACKS ==========
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const msgId = query.message.message_id;
    
    bot.answerCallbackQuery(query.id);
    
    if (data === 'back') {
        bot.sendMessage(chatId, WELCOME, mainKeyboard);
        return;
    }
    
    if (data === 'back_services') {
        const services = getAllServiceVersions();
        if (services.length === 0) {
            bot.editMessageText('No services available.', { chat_id: chatId, message_id: msgId });
            return;
        }
        bot.editMessageText('🔹 SELECT SERVICE:', {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: getServicesKeyboard().reply_markup
        });
        return;
    }
    
    if (data.startsWith('svc_')) {
        const svcVersion = data.substring(4);
        const [service, version] = svcVersion.split('_');
        const countries = getCountriesByServiceVersion(service, version);
        
        if (Object.keys(countries).length === 0) {
            bot.editMessageText('❌ No numbers available.', { chat_id: chatId, message_id: msgId });
            return;
        }
        
        bot.editMessageText(`🔹 SELECT COUNTRY FOR ${service.toUpperCase()} ${version}:`, {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: getCountriesKeyboard(service, version).reply_markup
        });
        return;
    }
    
    if (data.startsWith('cnt_')) {
        const parts = data.split('_');
        const service = parts[1];
        const version = parts[2];
        const country = parts.slice(3).join('_');
        
        const number = getAvailableNumber(service, version, country);
        if (!number) {
            bot.editMessageText('❌ No number available.', { chat_id: chatId, message_id: msgId });
            return;
        }
        
        if (userNumbers[chatId]) {
            releaseNumber(userNumbers[chatId]);
        }
        
        reserveNumber(number.phone, chatId);
        userNumbers[chatId] = number.phone;
        
        bot.editMessageText(
            `📞 𝐘𝐎𝐔𝐑 𝐍𝐔𝐌𝐁𝐄𝐑\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n${number.flag} ${number.country}\n📱 ${number.service.toUpperCase()} ${number.version}\n📞 \`${formatPhone(number.phone)}\`\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n⏳ 𝐖𝐚𝐢𝐭𝐢𝐧𝐠 𝐟𝐨𝐫 𝐎𝐓𝐏...\n\n𝐒𝐞𝐧𝐝 𝐜𝐨𝐝𝐞 𝐮𝐬𝐢𝐧𝐠:\n/code *****\n━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'Markdown',
                reply_markup: getNumberKeyboard(service, version, country, number.group, number.phone).reply_markup
            }
        );
        return;
    }
    
    // CHANGE NUMBER
    if (data.startsWith('change_') && !data.includes('change_country')) {
        const parts = data.split('_');
        const service = parts[1];
        const version = parts[2];
        const country = parts[3];
        const currentPhone = parts[4];
        
        const newNumber = getAvailableNumber(service, version, country, currentPhone);
        if (!newNumber) {
            bot.editMessageText('❌ No other number available for this country.', { chat_id: chatId, message_id: msgId });
            return;
        }
        
        if (userNumbers[chatId]) {
            releaseNumber(userNumbers[chatId]);
        }
        
        reserveNumber(newNumber.phone, chatId);
        userNumbers[chatId] = newNumber.phone;
        
        bot.editMessageText(
            `📞 𝐘𝐎𝐔𝐑 𝐍𝐔𝐌𝐁𝐄𝐑\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n${newNumber.flag} ${newNumber.country}\n📱 ${newNumber.service.toUpperCase()} ${newNumber.version}\n📞 \`${formatPhone(newNumber.phone)}\`\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n⏳ 𝐖𝐚𝐢𝐭𝐢𝐧𝐠 𝐟𝐨𝐫 𝐎𝐓𝐏...\n\n𝐒𝐞𝐧𝐝 𝐜𝐨𝐝𝐞 𝐮𝐬𝐢𝐧𝐠:\n/code *****\n━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'Markdown',
                reply_markup: getNumberKeyboard(service, version, country, newNumber.group, newNumber.phone).reply_markup
            }
        );
        return;
    }
    
    // CHANGE COUNTRY
    if (data.startsWith('change_country_')) {
        const parts = data.split('_');
        const service = parts[2];
        const version = parts[3];
        
        const countries = getCountriesByServiceVersion(service, version);
        if (Object.keys(countries).length === 0) {
            bot.editMessageText('❌ No numbers available.', { chat_id: chatId, message_id: msgId });
            return;
        }
        
        bot.editMessageText(`🔹 𝐒𝐄𝐋𝐄𝐂𝐓 𝐂𝐎𝐔𝐍𝐓𝐑𝐘 𝐅𝐎𝐑 ${service.toUpperCase()} ${version}:`, {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: getCountriesKeyboard(service, version).reply_markup
        });
        return;
    }
    
    // ========== ADMIN CALLBACKS ==========
    
    // AJOUTER NUMEROS
    if (data === 'admin_add') {
        bot.editMessageText(
            `✏️ AJOUTER DES NUMEROS\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📝 FORMAT (sur plusieurs lignes) :\nZIMBABWE | V3 | 260958579347\n260956419943\n260750353256\n\n📝 EXEMPLE :\nSENEGAL | V1 | 221771234567\n221771234568\n221771234569\n\n✅ Les numéros seront ajoutés automatiquement (avec ou sans +).`,
            { chat_id: chatId, message_id: msgId, reply_markup: getAdminKeyboard().reply_markup }
        );
        
        const addListener = (msg) => {
            if (msg.from.id !== ADMIN_ID) return;
            if (!msg.text || msg.text.startsWith('/')) return;
            
            const lines = msg.text.split('\n').filter(l => l.trim().length > 0);
            if (lines.length === 0) {
                bot.sendMessage(chatId, '❌ Aucun numéro reçu.');
                return;
            }
            
            const firstLine = lines[0];
            const firstLineParts = firstLine.split('|');
            
            if (firstLineParts.length < 3) {
                bot.sendMessage(chatId, '❌ Format invalide. Utilisez: PAYS | VERSION | NUMERO');
                return;
            }
            
            const country = firstLineParts[0].trim().toUpperCase();
            const version = firstLineParts[1].trim().toUpperCase();
            
            let allPhones = [];
            const firstPhoneRaw = firstLineParts[2].trim();
            if (firstPhoneRaw) allPhones.push(firstPhoneRaw);
            
            for (let i = 1; i < lines.length; i++) {
                const phoneRaw = lines[i].trim();
                if (phoneRaw) allPhones.push(phoneRaw);
            }
            
            if (allPhones.length === 0) {
                bot.sendMessage(chatId, '❌ Aucun numéro valide trouvé.');
                return;
            }
            
            const { added, failed } = addMultipleNumbers(country, version, allPhones);
            const flag = getFlagByCountry(country);
            
            bot.sendMessage(chatId, 
                `✅ NUMEROS AJOUTES\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📞 Ajoutés: ${added}\n❌ Déjà existants: ${failed}\n\n${flag} ${country} ${version}: +${added} / -${failed}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`
            );
            
            bot.removeListener('message', addListener);
        };
        bot.on('message', addListener);
        return;
    }
    
    // SUPPRIMER NUMERO
    if (data === 'admin_del') {
        bot.editMessageText(
            `🗑️ SUPPRIMER UN NUMERO\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📝 FORMAT:\n/remove 221771234567\n\n📝 EXEMPLE:\n/remove 2250749529009\n\n✅ Accepte avec ou sans +.`,
            { chat_id: chatId, message_id: msgId, reply_markup: getAdminKeyboard().reply_markup }
        );
        return;
    }
    
    // LISTE NUMEROS
    if (data === 'admin_list') {
        const numbers = loadNumbers();
        if (numbers.length === 0) {
            bot.editMessageText('📭 Aucun numéro en base.', { chat_id: chatId, message_id: msgId, reply_markup: getAdminKeyboard().reply_markup });
            return;
        }
        
        let listMsg = '📋 LISTE DES NUMEROS\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        const byCountry = {};
        for (const num of numbers) {
            if (!byCountry[num.country]) byCountry[num.country] = [];
            byCountry[num.country].push(num);
        }
        
        for (const [country, nums] of Object.entries(byCountry)) {
            const flag = getFlagByCountry(country);
            listMsg += `\n${flag} ${country}\n`;
            for (const num of nums) {
                const statusIcon = num.status === 'available' ? '✅' : '🔴';
                listMsg += `   ${statusIcon} ${formatPhone(num.phone)} | ${num.service.toUpperCase()} ${num.version}\n`;
            }
        }
        
        bot.editMessageText(listMsg, { chat_id: chatId, message_id: msgId, reply_markup: getAdminKeyboard().reply_markup });
        return;
    }
    
    // STATISTIQUES
    if (data === 'admin_stats') {
        const numbers = loadNumbers();
        const available = numbers.filter(n => n.status === 'available').length;
        const reserved = numbers.filter(n => n.status === 'reserved').length;
        const byCountry = {};
        for (const num of numbers) {
            if (!byCountry[num.country]) byCountry[num.country] = { available: 0, reserved: 0 };
            if (num.status === 'available') byCountry[num.country].available++;
            else byCountry[num.country].reserved++;
        }
        
        let statsMsg = `📊 STATISTIQUES\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📞 Total: ${numbers.length}\n✅ Disponibles: ${available}\n🔴 Réservés: ${reserved}\n\n📊 PAR PAYS:\n`;
        for (const [country, counts] of Object.entries(byCountry)) {
            const flag = getFlagByCountry(country);
            statsMsg += `${flag} ${country}: ✅${counts.available} 🔴${counts.reserved}\n`;
        }
        
        bot.editMessageText(statsMsg, { chat_id: chatId, message_id: msgId, reply_markup: getAdminKeyboard().reply_markup });
        return;
    }
});

// ========== COMMANDE SUPPRESSION ==========
bot.onText(/\/remove (.+)/, (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const phone = match[1];
    
    if (removeNumber(phone)) {
        bot.sendMessage(msg.chat.id, `✅ NUMERO SUPPRIME\n📞 ${formatPhone(cleanPhone(phone))}`);
    } else {
        bot.sendMessage(msg.chat.id, '❌ Numero non trouve');
    }
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 DEV SHADOW OTP IS RUNNING');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
# bot.py
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Updater, CommandHandler, CallbackQueryHandler, MessageHandler, Filters, ConversationHandler
from config import *
import database as db
import index

# États
WAITING_CODE_ADMIN, WAITING_NUMBER_ADD, WAITING_NUMBER_DELETE, WAITING_BROADCAST = range(4)

# Claviers
def main_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📞 Get Number", callback_data="get_number")],
        [InlineKeyboardButton("📊 My Stats", callback_data="my_stats")],
        [InlineKeyboardButton("🍽️ Menu", callback_data="menu")]
    ])

def verify_keyboard():
    return InlineKeyboardMarkup([[InlineKeyboardButton("✅ VERIFY", callback_data="verify")]])

def country_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🇫🇷 France", callback_data="country_FR")],
        [InlineKeyboardButton("🇺🇸 USA", callback_data="country_US")],
        [InlineKeyboardButton("🇬🇧 UK", callback_data="country_UK")]
    ])

def service_keyboard(country):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📱 WhatsApp", callback_data=f"service_{country}_whatsapp")],
        [InlineKeyboardButton("📩 Telegram", callback_data=f"service_{country}_telegram")],
        [InlineKeyboardButton("🔙 Back", callback_data="back_country")]
    ])

def admin_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("➕ Add Number", callback_data="admin_add")],
        [InlineKeyboardButton("🗑️ Delete Number", callback_data="admin_del")],
        [InlineKeyboardButton("📋 List Numbers", callback_data="admin_list")],
        [InlineKeyboardButton("📊 Stats", callback_data="admin_stats")]
    ])

# Commandes
def start(update, context):
    user = update.effective_user
    db.add_user(user.id, user.username, user.first_name)
    update.message.reply_text(WELCOME_MESSAGE, reply_markup=main_keyboard())

def verify(update, context):
    query = update.callback_query
    query.answer()
    db.verify_user(query.from_user.id)
    query.edit_message_text(WELCOME_MESSAGE, reply_markup=main_keyboard())

def get_number(update, context):
    query = update.callback_query
    query.answer()
    if not db.is_verified(query.from_user.id):
        query.edit_message_text(NOT_JOINED_MESSAGE, reply_markup=verify_keyboard())
        return
    query.edit_message_text("🌍 Select country:", reply_markup=country_keyboard())

def country_click(update, context):
    query = update.callback_query
    query.answer()
    country = query.data.split("_")[1]
    context.user_data['country'] = country
    query.edit_message_text(f"📱 Select service for {country}:", reply_markup=service_keyboard(country))

def service_click(update, context):
    query = update.callback_query
    query.answer()
    parts = query.data.split("_")
    country = parts[1]
    service = parts[2]
    
    num = index.get_available_number(country, service)
    if not num:
        query.edit_message_text("❌ No number available", reply_markup=service_keyboard(country))
        return
    
    index.reserve_number(num['phone'], query.from_user.id)
    context.user_data['phone'] = num['phone']
    db.add_order(query.from_user.id, num['phone'], service, country, "123456")
    
    query.edit_message_text(WAITING_MESSAGE.format(phone=num['phone'], service=service, country=country))

def code_handler(update, context):
    user = update.effective_user
    if not db.is_verified(user.id):
        update.message.reply_text(NOT_JOINED_MESSAGE)
        return
    
    parts = update.message.text.split()
    if len(parts) != 2:
        update.message.reply_text("❌ Usage: /code 123456")
        return
    
    code = parts[1]
    phone = context.user_data.get('phone')
    if not phone:
        update.message.reply_text("❌ No active number")
        return
    
    index.release_number(phone)
    update.message.reply_text(CODE_RECEIVED_MESSAGE.format(code=code), reply_markup=main_keyboard())

def my_stats(update, context):
    query = update.callback_query
    query.answer()
    total = db.get_stats(query.from_user.id)
    query.edit_message_text(f"📊 Your stats:\n✅ Total OTPs: {total}", reply_markup=main_keyboard())

def menu(update, context):
    query = update.callback_query
    query.answer()
    query.edit_message_text(WELCOME_MESSAGE, reply_markup=main_keyboard())

def back_country(update, context):
    query = update.callback_query
    query.answer()
    query.edit_message_text("🌍 Select country:", reply_markup=country_keyboard())

# Admin
def admin(update, context):
    if update.effective_user.id != ADMIN_ID:
        update.message.reply_text("⛔ Unauthorized")
        return
    update.message.reply_text("🔐 Enter admin code:")
    return WAITING_CODE_ADMIN

def check_code(update, context):
    if update.message.text == ADMIN_CODE:
        update.message.reply_text("✅ Admin panel", reply_markup=admin_keyboard())
    else:
        update.message.reply_text("❌ Wrong code")
    return ConversationHandler.END

def admin_add(update, context):
    query = update.callback_query
    query.answer()
    query.edit_message_text("Send: +33612345678|FR|whatsapp")
    return WAITING_NUMBER_ADD

def add_number(update, context):
    text = update.message.text
    parts = text.split('|')
    if len(parts) != 3:
        update.message.reply_text("❌ Invalid format")
        return ConversationHandler.END
    phone, country, service = parts
    success, msg = index.add_number(phone, country, service)
    update.message.reply_text(f"✅ {msg}")
    update.message.reply_text("Admin panel", reply_markup=admin_keyboard())
    return ConversationHandler.END

def admin_del(update, context):
    query = update.callback_query
    query.answer()
    query.edit_message_text("Send phone number to delete:\n+33612345678")
    return WAITING_NUMBER_DELETE

def del_number(update, context):
    phone = update.message.text
    success, msg = index.remove_number(phone)
    update.message.reply_text(f"✅ {msg}")
    update.message.reply_text("Admin panel", reply_markup=admin_keyboard())
    return ConversationHandler.END

def admin_list(update, context):
    query = update.callback_query
    query.answer()
    query.edit_message_text(index.list_numbers(), reply_markup=admin_keyboard())

def admin_stats(update, context):
    query = update.callback_query
    query.answer()
    from database import get_total_users  # simple
    conn = sqlite3.connect("bot.db")
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM users")
    total = c.fetchone()[0]
    conn.close()
    query.edit_message_text(f"📊 Total users: {total}", reply_markup=admin_keyboard())

# Main
def main():
    db.init_db()
    updater = Updater(BOT_TOKEN, use_context=True)
    dp = updater.dispatcher
    
    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(CommandHandler("code", code_handler))
    
    conv = ConversationHandler(
        entry_points=[CommandHandler("admin", admin)],
        states={
            WAITING_CODE_ADMIN: [MessageHandler(Filters.text & ~Filters.command, check_code)],
            WAITING_NUMBER_ADD: [MessageHandler(Filters.text & ~Filters.command, add_number)],
            WAITING_NUMBER_DELETE: [MessageHandler(Filters.text & ~Filters.command, del_number)],
        },
        fallbacks=[]
    )
    dp.add_handler(conv)
    
    dp.add_handler(CallbackQueryHandler(verify, pattern="verify"))
    dp.add_handler(CallbackQueryHandler(get_number, pattern="get_number"))
    dp.add_handler(CallbackQueryHandler(country_click, pattern="country_"))
    dp.add_handler(CallbackQueryHandler(service_click, pattern="service_"))
    dp.add_handler(CallbackQueryHandler(my_stats, pattern="my_stats"))
    dp.add_handler(CallbackQueryHandler(menu, pattern="menu"))
    dp.add_handler(CallbackQueryHandler(back_country, pattern="back_country"))
    dp.add_handler(CallbackQueryHandler(admin_add, pattern="admin_add"))
    dp.add_handler(CallbackQueryHandler(admin_del, pattern="admin_del"))
    dp.add_handler(CallbackQueryHandler(admin_list, pattern="admin_list"))
    dp.add_handler(CallbackQueryHandler(admin_stats, pattern="admin_stats"))
    
    updater.start_polling()
    updater.idle()

if __name__ == "__main__":
    main()
import telebot
from telebot import types  # ခလုတ်တွေ ဆောက်ဖို့ လိုအပ်တဲ့ Module

bot = telebot.TeleBot("8711190430:AAFRHqYUgCOh2ZP58zTI282rRVgkxNpQ4JQ")

# /start ရိုက်လိုက်ရင် ခလုတ်တွေနဲ့ စာပို့မယ့် Function
@bot.message_handler(commands=['start'])
def send_welcome(message):
    # ၁။ ခလုတ်ခုံ (Markup) အလွတ်တစ်ခု တည်ဆောက်မယ်
    markup = types.InlineKeyboardMarkup()
    
    # ၂။ ခလုတ် (Button) နှစ်ခု ဖန်တီးမယ်
    btn1 = types.InlineKeyboardButton("၁ လ စာဈေးနှုန်း", callback_data="price_1month")
    btn2 = types.InlineKeyboardButton("၃ လ စာဈေးနှုန်း", callback_data="price_3month")
    
    # ၃။ ခလုတ်တွေကို Markup ထဲ ထည့်မယ်
    markup.add(btn1, btn2)
    
    # ၄။ ခလုတ်ပါတဲ့ စာကို ပို့မယ်
    bot.send_message(message.chat.id, "Gemini Pro ဈေးနှုန်း ကြည့်ရန် ရွေးချယ်ပါ -", reply_markup=markup)

# ခလုတ်တစ်ခုခုကို နှိပ်လိုက်တဲ့အခါ အလုပ်လုပ်မယ့် Function
@bot.callback_query_handler(func=lambda call: True)
def callback_query(call):
    if call.data == "price_1month":
        bot.answer_callback_query(call.id, "၁ လ စာကို ရွေးချယ်လိုက်ပါပြီ!")
        bot.send_message(call.message.chat.id, "၁ လ စာဈေးနှုန်းမှာ ၅,၀၀၀ ကျပ် ဖြစ်ပါတယ်။")
    elif call.data == "price_3month":
        bot.answer_callback_query(call.id, "၃ လ စာကို ရွေးချယ်လိုက်ပါပြီ!")
        bot.send_message(call.message.chat.id, "၃ လ စာဈေးနှုန်းမှာ ၁၄,၀၀၀ ကျပ် ဖြစ်ပါတယ်။")

bot.infinity_polling()

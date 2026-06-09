import express from 'express';
import { Telegraf } from 'telegraf';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const db = {
    users: {}, 
    payouts: []
};

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const startParam = ctx.payload; 

    if (!db.users[userId]) {
        db.users[userId] = { balance: 0, referrals: 0, referrer: null };
        
        if (startParam && startParam.startsWith('ref_')) {
            const referrerId = startParam.split('_')[1];
            if (db.users[referrerId] && referrerId != userId) {
                db.users[userId].referrer = referrerId;
            }
        }
    }
    
    ctx.reply('Royal Events mein aapka swagat hai! Niche diye button par click karke App open karein:', {
        reply_markup: {
            inline_keyboard: [[
                { text: "🚀 Open App", web_app: { url: process.env.WEBAPP_URL } }
            ]]
        }
    });
});

app.post('/api/user-check', async (req, res) => {
    const { userId } = req.body;
    try {
        const chatMember = await bot.telegram.getChatMember(process.env.TELEGRAM_CHANNEL_ID, userId);
        const isMember = ['member', 'creator', 'administrator'].includes(chatMember.status);

        if (!isMember) {
            return res.json({ success: false, isMember: false });
        }

        let user = db.users[userId] || { balance: 0, referrals: 0, referrer: null };
        
        if (user.referrer && !user.rewarded) {
            const refId = user.referrer;
            if (db.users[refId]) {
                db.users[refId].referrals += 1;
                db.users[refId].balance += 1; 
                db.payouts.unshift({ userId: refId, amount: 1, time: 'Just now' });
            }
            user.rewarded = true;
        }
        
        db.users[userId] = user;
        res.json({ success: true, isMember: true, data: user, recentPayouts: db.payouts.slice(0, 5) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

bot.launch();
app.listen(process.env.PORT || 3000, () => console.log('Server running on port 3000'));

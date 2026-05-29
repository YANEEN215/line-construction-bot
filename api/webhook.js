const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

// ตั้งค่าตัวแปรระบบ (รองรับทั้งชื่อเก่าและชื่อใหม่)
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const supabaseUrl = process.env.SUPABASE_URL;
// แก้ไขให้ดึงคีย์จาก SUPABASE_KEY ที่เราตั้งไว้ล่าสุดใน Vercel
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

// สร้างฟังก์ชันส่งข้อความที่ปลอดภัย ไม่ว่าจะใช้ SDK เวอร์ชันไหนก็ตาม
async function sendReply(replyToken, messages) {
    try {
        if (line.messagingApi && line.messagingApi.MessagingApiClient) {
            // สำหรับ LINE SDK v8 (เวอร์ชันใหม่)
            const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken });
            await client.replyMessage({ replyToken, messages: Array.isArray(messages) ? messages : [messages] });
        } else {
            // สำหรับ LINE SDK v7 (เวอร์ชันเก่า)
            const client = new line.Client(config);
            await client.replyMessage(replyToken, messages);
        }
    } catch (err) {
        console.error("LINE Reply Error:", err);
    }
}

module.exports = async (req, res) => {
    if (req.method === 'POST') {
        try {
            const events = req.body.events || [];
            await Promise.all(events.map(handleEvent));
            res.status(200).send('OK');
        } catch (err) {
            console.error(err);
            res.status(500).end();
        }
    } else {
        res.status(200).send('Bot is running online!');
    }
};

async function handleEvent(event) {
    if (event.type !== 'message') return null;

    const replyToken = event.replyToken;
    const userId = event.source.userId;

    // 1. กรณีผู้ใช้งานพิมพ์ข้อความเข้ามา
    if (event.message.type === 'text') {
        const text = event.message.text.trim();

        // คำสั่งจำลองการสร้างโครงการใหม่
        if (text.startsWith('สร้างโครงการ')) {
            const projectName = text.replace('สร้างโครงการ', '').trim();
            const { data, error } = await supabase.from('projects').insert([{ project_name: projectName }]).select();
            
            if (error) {
                console.error("Supabase Error:", error);
                return await sendReply(replyToken, { type: 'text', text: 'เกิดข้อผิดพลาดในการสร้างโครงการ' });
            }
            const pId = data && data[0] ? data[0].id : 'N/A';
            return await sendReply(replyToken, { type: 'text', text: `🏗️ สร้างโครงการ "${projectName}" สำเร็จแล้ว! (ID: ${pId})` });
        }

        // คำสั่งเริ่มต้นใช้งานทั่วไป
        return await sendReply(replyToken, { 
            type: 'text', 
            text: `สวัสดีครับบอทพร้อมใช้งานแล้วครับ!\n\n🔹 พิมพ์ "สร้างโครงการ [ชื่อโครงการ]" เพื่อเริ่มตารางงาน\n🔹 ส่งรูปภาพใบเสร็จ/บิล เพื่อบันทึกค่าใช้จ่ายเข้าฐานข้อมูล`
        });
    }

    // 2. กรณีผู้ใช้งานส่งรูปภาพบิลเข้ามา
    if (event.message.type === 'image') {
        await sendReply(replyToken, { type: 'text', text: '📸 ได้รับรูปภาพบิลแล้ว กำลังเตรียมประมวลผลระบบงบประมาณ...' });
        
        try {
            await supabase.from('transactions').insert([
                {
                    line_user_id: userId,
                    item_name: 'บิลส่งจาก LINE',
                    status: 'Pending'
                }
            ]);
        } catch (sbErr) {
            console.error("Supabase Transaction Error:", sbErr);
        }
    }
}

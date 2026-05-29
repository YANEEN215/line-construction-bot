const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

// ตั้งค่าตัวแปรระบบ
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const client = new line.Client(config);

module.exports = async (req, res) => {
    if (req.method === 'POST') {
        try {
            const events = req.body.events;
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
            
            if (error) return client.replyMessage(replyToken, { type: 'text', text: 'เกิดข้อผิดพลาดในการสร้างโครงการ' });
            return client.replyMessage(replyToken, { type: 'text', text: `🏗️ สร้างโครงการ "${projectName}" สำเร็จแล้ว! (ID: ${data[0].id})` });
        }

        // คำสั่งเริ่มต้นใช้งานทั่วไป
        return client.replyMessage(replyToken, { 
            type: 'text', 
            text: `สวัสดีครับบอทพร้อมใช้งานแล้วครับ!\n\n🔹 พิมพ์ "สร้างโครงการ [ชื่อโครงการ]" เพื่อเริ่มตารางงาน\n🔹 ส่งรูปภาพใบเสร็จ/บิล เพื่อบันทึกค่าใช้จ่ายเข้าฐานข้อมูล`
        });
    }

    // 2. กรณีผู้ใช้งานส่งรูปภาพบิลเข้ามา
    if (event.message.type === 'image') {
        await client.replyMessage(replyToken, { type: 'text', text: '📸 ได้รับรูปภาพบิลแล้ว กำลังเตรียมประมวลผลระบบงบประมาณ...' });
        
        // (ในอนาคต: พาร์ทนี้เราสามารถนำมาเชื่อมต่อ AI เพื่ออ่านค่าจากรูปภาพบิลได้ครับ)
        // ตอนนี้ทำระบบเซฟข้อมูลดิบลงฐานข้อมูล Supabase ไว้เป็นประวัติก่อน
        await supabase.from('transactions').insert([
            {
                line_user_id: userId,
                item_name: 'บิลส่งจาก LINE',
                status: 'Pending'
            }
        ]);
    }
}

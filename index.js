import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db.js';
import { createServer } from 'http'; 
import { Server } from 'socket.io'; 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000; // الأفضل استخدام process.env للرفع

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"], credentials: true }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST", "PUT"] } });

io.on('connection', (socket) => {
    console.log(`🔌 متصل جديد: ${socket.id}`);
});

// ==========================================
// 🍽️ مسارات إدارة المنيو
// ==========================================

app.get('/api/admin/menu', async (req, res) => {
    try {
        const [menu] = await db.execute('SELECT * FROM menu_items ORDER BY id DESC');
        return res.json(menu);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/menu', async (req, res) => {
    const { name, price, category, image_url } = req.body;
    try {
        const [result] = await db.execute(
            'INSERT INTO menu_items (name, price, category, image_url, is_available) VALUES (?, ?, ?, ?, 1)', 
            [name, price, category, image_url]
        );
        return res.status(201).json({ success: true, itemId: result.insertId });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/menu/:id/toggle', async (req, res) => {
    const { id } = req.params;
    const { is_available } = req.body;
    try {
        await db.execute('UPDATE menu_items SET is_available = ? WHERE id = ?', [is_available, id]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/menu/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM menu_items WHERE id = ?', [id]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 📦 مسارات الطلبات (مع حماية الحقل)
// ==========================================

app.get('/api/admin/orders', async (req, res) => {
    try {
        // نصيحة: تأكد من إضافة حقل is_archived لجدول الـ orders في قاعدة بياناتك (قيمة افتراضية 0)
        // إذا لسه ما ضفته، غير الاستعلام لـ 'SELECT * FROM orders WHERE status != "completed" ORDER BY id DESC'
        const [orders] = await db.execute('SELECT * FROM orders WHERE is_archived = 0 ORDER BY id DESC');
        return res.json(orders);
    } catch (error) {
        // لو الحقل مش موجود، بيجيب كل الطلبات عشان ما يوقف السيرفر
        const [orders] = await db.execute('SELECT * FROM orders ORDER BY id DESC');
        return res.json(orders);
    }
});

app.put('/api/admin/orders/:id/archive', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('UPDATE orders SET is_archived = 1 WHERE id = ?', [id]);
        io.emit('order_archived', { id: Number(id) });
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// باقي المسارات (update status, feedback) كما هي بدون تغيير
app.put('/api/admin/orders/:id/status', async (req, res) => {
    const { id } = req.body.status === "completed" ? req.params : { id: req.params.id };
    const { status } = req.body;
    try {
        await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        io.emit('order_status_updated', { id: Number(id), status });
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false });
    }
});

app.get('/api/admin/analytics/rating', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT AVG(rating) as averageRating FROM feedbacks');
        const average = rows[0].averageRating ? parseFloat(rows[0].averageRating).toFixed(1) : "0";
        return res.json({ success: true, averageRating: average });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

httpServer.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل على المنفذ ${PORT} ومدمج به مسارات المنيو، الأرشفة، والتقارير بنجاح!`);
});
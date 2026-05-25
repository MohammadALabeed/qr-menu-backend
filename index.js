import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db.js';
import { createServer } from 'http'; 
import { Server } from 'socket.io'; 
import jwt from 'jsonwebtoken';
import verifyAdminToken from './authMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000; 

// إعدادات CORS الشاملة لمنع أي حظر من المتصفحات
app.use(cors({ 
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE"], 
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST", "PUT", "DELETE"] 
    } 
});

io.on('connection', (socket) => {
    console.log(`🔌 متصل جديد: ${socket.id}`);
});

// مسار فحص للتأكد أن السيرفر مستيقظ
app.get('/', (req, res) => {
    res.json({ success: true, message: "API is running successfully!" });
});

// ==========================================
// 🔐 مسار تسجيل الدخول للأدمن (Authentication)
// ==========================================
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token });
    }

    return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة!' });
});

// ==========================================
// ⚙️ مسارات إعدادات المتجر العامة (General Settings)
// ==========================================
app.get('/api/settings', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM RestaurantSettings LIMIT 1');
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'لم يتم العثور على إعدادات!' });
        }
        return res.json(rows[0]);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/settings', verifyAdminToken, async (req, res) => {
    const { restaurant_name, about_text, logo_url, facebook_url, instagram_url, working_hours } = req.body;
    try {
        await db.execute(
            `UPDATE RestaurantSettings 
             SET restaurant_name = ?, about_text = ?, logo_url = ?, facebook_url = ?, instagram_url = ?, working_hours = ? 
             WHERE id = 1`,
            [restaurant_name, about_text, logo_url, facebook_url, instagram_url, working_hours]
        );
        return res.json({ success: true, message: 'تم تحديث إعدادات المطعم بنجاح واقتدار!' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 📱 مسارات تطبيق الزبائن (Client App Routes)
// ==========================================
app.get('/api/menu', async (req, res) => {
    try {
        const [menu] = await db.execute('SELECT * FROM menu_items WHERE is_available = 1 ORDER BY id ASC');
        return res.json(menu);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// 🔥 [تم التعديل هنا ليدعم السلة القادمة من الفرونتد] 🔥
app.post('/api/orders', async (req, res) => {
    const { table_number, total_price, items } = req.body; // استقبال السلة (items) هنا
    try {
        // تحويل مصفوفة السلة إلى نص JSON ليتم تخزينها في عمود قاعدة البيانات (تأكد أن العمود يقبل نص طويل أو نوعه JSON)
        const itemsString = JSON.stringify(items || []);

        const [result] = await db.execute(
            'INSERT INTO orders (table_number, total_price, items, status, is_archived) VALUES (?, ?, ?, "pending", 0)',
            [table_number, total_price, itemsString]
        );
        
        const orderId = result.insertId;
        
        // إرسال تفاصيل الطلب كاملة مع السلة للأدمن عبر السوكيت لتعرض فوراً في لوحة التحكم
        io.emit('new_order', { id: orderId, table_number, total_price, items, status: 'pending' });

        return res.status(201).json({ success: true, orderId });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/feedback', async (req, res) => {
    const { table_number, rating, comment } = req.body;
    try {
        await db.execute(
            'INSERT INTO feedbacks (table_number, rating, comment) VALUES (?, ?, ?)',
            [table_number, rating, comment]
        );
        return res.status(201).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 🍽️ مسارات الإدارة المحمية بالـ JWT (Admin Routes)
// ==========================================
app.get('/api/admin/menu', verifyAdminToken, async (req, res) => {
    try {
        const [menu] = await db.execute('SELECT * FROM menu_items ORDER BY id DESC');
        return res.json(menu);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/menu', verifyAdminToken, async (req, res) => {
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

app.put('/api/admin/menu/:id/toggle', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    const { is_available } = req.body;
    try {
        await db.execute('UPDATE menu_items SET is_available = ? WHERE id = ?', [is_available, id]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/menu/:id', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM menu_items WHERE id = ?', [id]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 📦 مسارات الطلبات المحمية للأدمن
// ==========================================
app.get('/api/admin/orders', verifyAdminToken, async (req, res) => {
    try {
        const [orders] = await db.execute('SELECT * FROM orders WHERE is_archived = 0 ORDER BY id DESC');
        
        // تحويل المنتجات من نصوص JSON إلى مصفوفات برمجية مجدداً لتسهيل قراءتها في الفرونتد للأدمن
        const formattedOrders = orders.map(order => ({
            ...order,
            items: order.items ? JSON.parse(order.items) : []
        }));
        
        return res.json(formattedOrders);
    } catch (error) {
        try {
            const [orders] = await db.execute('SELECT * FROM orders ORDER BY id DESC');
            const formattedOrders = orders.map(order => ({
                ...order,
                items: order.items ? JSON.parse(order.items) : []
            }));
            return res.json(formattedOrders);
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
});

app.put('/api/admin/orders/:id/archive', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('UPDATE orders SET is_archived = 1 WHERE id = ?', [id]);
        io.emit('order_archived', { id: Number(id) });
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/orders/:id/status', verifyAdminToken, async (req, res) => {
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

app.get('/api/admin/analytics/rating', verifyAdminToken, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT AVG(rating) as averageRating FROM feedbacks');
        const average = rows[0].averageRating ? parseFloat(rows[0].averageRating).toFixed(1) : "0";
        return res.json({ success: true, averageRating: average });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// تشغيل محلي احتياطي
if (process.env.NODE_ENV !== 'production') {
    httpServer.listen(PORT, () => {
        console.log(`✅ Server running locally on port ${PORT}`);
    });
}

// هام جداً لبيئة Vercel
export default app;
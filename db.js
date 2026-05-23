import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// تفعيل قراءة ملف الإعدادات الخفي .env
dotenv.config();

// إنشاء حوض اتصالات (Connection Pool) لضمان السرعة والكفاءة العالية
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// اختبار الاتصال فوراً للتأكد أن السيرفر يتحدث مع قاعدة البيانات بنجاح
(async () => {
    try {
        const connection = await db.getConnection();
        console.log('🟢 تم الاتصال بقاعدة بيانات MySQL الملكية بنجاح واقتدار!');
        connection.release(); // إعادة الاتصال للحوض بعد الفحص
    } catch (error) {
        console.error('🔴 خطأ كارثي: فشل الاتصال بقاعدة البيانات! تأكد من تشغيل XAMPP:', error.message);
    }
})();

export default db;
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// إنشاء حوض اتصالات مرن ومتوافق مع السيرفرات السحابية
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000 // مهلة 10 ثوانٍ كحد أقصى لمنع تعليق السيرفر
});

export default db;
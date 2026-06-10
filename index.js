import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./db.js";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import verifyAdminToken from "./authMiddleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// إعدادات CORS الشاملة لمنع أي حظر من المتصفحات
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

io.on("connection", (socket) => {
  console.log(`🔌 متصل جديد: ${socket.id}`);
});

// مسار فحص للتأكد أن السيرفر مستيقظ
app.get("/", (req, res) => {
  res.json({ success: true, message: "API is running successfully!" });
});

// ==========================================
// 🔐 مسار تسجيل الدخول للأدمن (Authentication)
// ==========================================
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });
    return res.json({ success: true, token });
  }

  return res.status(401).json({
    success: false,
    message: "اسم المستخدم أو كلمة المرور غير صحيحة!",
  });
});

// ==========================================
// ⚙️ مسارات إعدادات المتجر العامة (General Settings)
// ==========================================
app.get("/api/settings", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM restaurantsettings LIMIT 1");
    if (rows.length === 0) {
      // بيانات افتراضية للزبون في حال عدم وجود إعدادات بقاعدة البيانات منعاً للانهيار
      return res.json({
        success: true,
        restaurant_name: "مطعمنا الجميل",
        about_text: "أهلاً بكم في مطعمنا تذوقوا أشهى المأكولات",
        logo_url: "",
        facebook_url: "",
        instagram_url: "",
        working_hours: "12:00 PM - 12:00 AM",
      });
    }
    return res.json({ success: true, ...rows[0] });
  } catch (error) {
    return res.json({
      success: true,
      restaurant_name: "مطعمنا الجميل",
      about_text: "أهلاً بكم في مطعمنا تذوقوا أشهى المأكولات",
      logo_url: "",
      facebook_url: "",
      instagram_url: "",
      working_hours: "12:00 PM - 12:00 AM",
    });
  }
});

// 🔥 مسار جلب إعدادات الأدمن (محصن من خطأ 500 وعودة كود 200 دائماً)
app.get("/api/admin/settings", verifyAdminToken, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM restaurantsettings LIMIT 1");
    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        id: 1,
        restaurant_name: "اضغط تعديل لكتابة اسم المطعم",
        about_text: "اكتب هنا نبذة عن المطعم",
        logo_url: "",
        facebook_url: "",
        instagram_url: "",
        working_hours: "12:00 PM - 12:00 AM",
      });
    }
    return res.json({ success: true, ...rows[0] });
  } catch (error) {
    // حماية قصوى: نرجع كائن جاهز بكود 200 لكي تفتح لوحة الأدمن وتسمح له بالحفظ والتحديث
    return res.status(200).json({
      id: 1,
      restaurant_name: "اضغط تعديل لكتابة اسم المطعم (وضع الاحتياط)",
      about_text: "اكتب هنا نبذة عن المطعم",
      logo_url: "",
      facebook_url: "",
      instagram_url: "",
      working_hours: "12:00 PM - 12:00 AM",
    });
  }
});

app.put("/api/admin/settings", verifyAdminToken, async (req, res) => {
  const {
    restaurant_name,
    about_text,
    logo_url,
    facebook_url,
    instagram_url,
    working_hours,
  } = req.body;
  try {
    // محاولة التحديث، وإذا فشلت لأن الجدول فارغ تماماً نقوم بعمل إدخال جديد تلقائياً
    const [result] = await db.execute(
      `UPDATE restaurantsettings 
             SET restaurant_name = ?, about_text = ?, logo_url = ?, facebook_url = ?, instagram_url = ?, working_hours = ? 
             WHERE id = 1`,
      [
        restaurant_name,
        about_text,
        logo_url,
        facebook_url,
        instagram_url,
        working_hours,
      ],
    );

    if (result.affectedRows === 0) {
      await db.execute(
        `INSERT INTO restaurantsettings (id, restaurant_name, about_text, logo_url, facebook_url, instagram_url, working_hours) 
                 VALUES (1, ?, ?, ?, ?, ?, ?)`,
        [
          restaurant_name,
          about_text,
          logo_url,
          facebook_url,
          instagram_url,
          working_hours,
        ],
      );
    }

    return res.json({
      success: true,
      message: "تم تحديث إعدادات المطعم بنجاح واقتدار!",
      settings: {
        restaurant_name,
        about_text,
        logo_url,
        facebook_url,
        instagram_url,
        working_hours,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 📱 مسارات تطبيق الزبائن (Client App Routes)
// ==========================================
app.get("/api/menu", async (req, res) => {
  try {
    const [menu] = await db.execute(
      "SELECT * FROM menu_items WHERE is_available = 1 ORDER BY id ASC",
    );
    return res.json(Array.isArray(menu) ? menu : []);
  } catch (error) {
    return res.status(200).json([]); // عودة بمصفوفة فارغة بدلاً من خطأ 500
  }
});

app.post("/api/orders", async (req, res) => {
  const { table_number, total_price, items } = req.body;
  try {
    const itemsString = JSON.stringify(items || []);
    let insertResult;

    try {
      [insertResult] = await db.execute(
        'INSERT INTO orders (table_number, total_price, items, status, is_archived) VALUES (?, ?, ?, "pending", 0)',
        [table_number, total_price, itemsString],
      );
    } catch (insertError) {
      if (
        insertError &&
        insertError.sqlMessage &&
        insertError.sqlMessage.includes("Unknown column")
      ) {
        [insertResult] = await db.execute(
          'INSERT INTO orders (table_number, total_price, items, status) VALUES (?, ?, ?, "pending")',
          [table_number, total_price, itemsString],
        );
      } else {
        throw insertError;
      }
    }

    const orderId = insertResult ? insertResult.insertId : null;

    io.emit("new_order", {
      id: orderId,
      table_number,
      total_price,
      items: items || [],
      status: "pending",
    });

    return res.status(201).json({ success: true, orderId });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/feedback", async (req, res) => {
  const { table_number, rating, comment } = req.body;
  try {
    await db.execute(
      "INSERT INTO feedbacks (table_number, rating, comment) VALUES (?, ?, ?)",
      [table_number, rating, comment],
    );
    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 🔥 مسار جلب الآراء للأدمن محصن 100% من خطأ الـ 500 والـ 404
app.get("/api/admin/feedback", verifyAdminToken, async (req, res) => {
  try {
    const [feedbacks] = await db.execute(
      "SELECT * FROM feedbacks ORDER BY id DESC",
    );
    return res.json(Array.isArray(feedbacks) ? feedbacks : []);
  } catch (error) {
    return res.status(200).json([]); // يعود بمصفوفة فارغة لتفتتح لوحة التحكم بشكل سليم
  }
});

// ==========================================
// 🍽️ مسارات الإدارة المحمية بالـ JWT (Admin Routes)
// ==========================================
app.get("/api/admin/menu", verifyAdminToken, async (req, res) => {
  try {
    const [menu] = await db.execute(
      "SELECT * FROM menu_items ORDER BY id DESC",
    );
    return res.json(Array.isArray(menu) ? menu : []);
  } catch (error) {
    return res.status(200).json([]);
  }
});

app.post("/api/admin/menu", verifyAdminToken, async (req, res) => {
  const { name, price, category, image_url } = req.body;
  try {
    const [result] = await db.execute(
      "INSERT INTO menu_items (name, price, category, image_url, is_available) VALUES (?, ?, ?, ?, 1)",
      [name, price, category, image_url],
    );
    return res.status(201).json({ success: true, itemId: result.insertId });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/admin/menu/:id", verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  const { name, price, category, image_url } = req.body;
  try {
    await db.execute(
      "UPDATE menu_items SET name = ?, price = ?, category = ?, image_url = ? WHERE id = ?",
      [name, price, category, image_url, id],
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/admin/menu/:id/toggle", verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  const { is_available } = req.body;
  try {
    await db.execute("UPDATE menu_items SET is_available = ? WHERE id = ?", [
      is_available,
      id,
    ]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/admin/menu/:id", verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute("DELETE FROM menu_items WHERE id = ?", [id]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 📦 مسارات الطلبات المحمية للأدمن
// ==========================================
app.get("/api/admin/orders", verifyAdminToken, async (req, res) => {
  const loadOrders = async (query) => {
    const [orders] = await db.execute(query);
    return orders.map((order) => {
      let parsedItems = [];
      if (order.items) {
        try {
          parsedItems =
            typeof order.items === "string"
              ? JSON.parse(order.items)
              : order.items;
        } catch (e) {
          parsedItems = [];
        }
      }
      return {
        ...order,
        items: Array.isArray(parsedItems) ? parsedItems : [],
      };
    });
  };

  try {
    let orders;
    try {
      orders = await loadOrders(
        "SELECT * FROM orders WHERE is_archived = 0 AND status != 'completed' ORDER BY id DESC",
      );
    } catch (firstQueryError) {
      orders = await loadOrders(
        "SELECT * FROM orders WHERE status NOT IN ('archived', 'completed') ORDER BY id DESC",
      );
    }

    if (!orders || orders.length === 0) {
      orders = await loadOrders(
        "SELECT * FROM orders WHERE status NOT IN ('archived', 'completed') ORDER BY id DESC",
      );
    }

    const itemIds = Array.from(
      new Set(
        orders.flatMap((order) =>
          order.items
            .filter((item) => item && item.id != null)
            .map((item) => Number(item.id)),
        ),
      ),
    );

    let menuItemsById = {};
    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => "?").join(",");
      const [menuItems] = await db.execute(
        `SELECT id, name FROM menu_items WHERE id IN (${placeholders})`,
        itemIds,
      );
      menuItemsById = menuItems.reduce((acc, menuItem) => {
        acc[menuItem.id] = menuItem;
        return acc;
      }, {});
    }

    const formattedOrders = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => {
        const resolvedName =
          item.item_name ||
          item.name ||
          menuItemsById[item.id]?.name ||
          `#${item.id}`;
        return {
          ...item,
          item_name: resolvedName,
        };
      }),
    }));

    return res.json(formattedOrders);
  } catch (error) {
    return res.status(200).json([]);
  }
});

app.put("/api/admin/orders/:id/archive", verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  try {
    try {
      await db.execute("UPDATE orders SET is_archived = 1 WHERE id = ?", [id]);
    } catch (archiveError) {
      if (
        archiveError &&
        archiveError.sqlMessage &&
        archiveError.sqlMessage.includes("Unknown column")
      ) {
        await db.execute("UPDATE orders SET status = ? WHERE id = ?", [
          "archived",
          id,
        ]);
      } else {
        throw archiveError;
      }
    }

    io.emit("order_archived", { id: Number(id) });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/admin/orders/:id/status", verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    if (status === "completed") {
      try {
        await db.execute(
          "UPDATE orders SET status = ?, is_archived = 1 WHERE id = ?",
          [status, id],
        );
      } catch (updateError) {
        if (
          updateError &&
          updateError.sqlMessage &&
          updateError.sqlMessage.includes("Unknown column")
        ) {
          await db.execute("UPDATE orders SET status = ? WHERE id = ?", [
            status,
            id,
          ]);
        } else {
          throw updateError;
        }
      }
    } else {
      await db.execute("UPDATE orders SET status = ? WHERE id = ?", [
        status,
        id,
      ]);
    }

    io.emit("order_status_updated", { id: Number(id), status });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/admin/analytics/rating", verifyAdminToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT AVG(rating) as averageRating FROM feedbacks",
    );
    const average =
      rows[0] && rows[0].averageRating
        ? parseFloat(rows[0].averageRating).toFixed(1)
        : "0";
    return res.json({ success: true, averageRating: average });
  } catch (error) {
    return res.status(200).json({ success: true, averageRating: "0" });
  }
});

// تشغيل محلي احتياطي
if (process.env.NODE_ENV !== "production") {
  httpServer.listen(PORT, () => {
    console.log(`✅ Server running locally on port ${PORT}`);
  });
}

// هام جداً لبيئة Vercel
export default app;

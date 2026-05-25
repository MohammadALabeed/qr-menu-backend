import jwt from "jsonwebtoken";

const verifyAdminToken = (req, res, next) => {
  try {
    // جلب التوكن من الهيدر (Authorization: Bearer <TOKEN>)
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "برجاء تسجيل الدخول أولاً، التوكن مفقود.",
      });
    }

    // التحقق من التوكن مع وضع قيمة احتياطية للـ Secret لمنع الانهيار التام
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      console.error("🚨 خطأ حرِج: JWT_SECRET غير معرّف في متغيرات البيئة على Vercel!");
    }

    const decoded = jwt.verify(token, secretKey || "fallback_secret_key");
    
    // حفظ البيانات في الحالتين لتجنب أي تضارب مع الملف الرئيسي
    req.admin = decoded; 
    req.user = decoded; 

    next(); // السماح بالانتقال للمسار التالي
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "انتهت صلاحية الجلسة أو التوكن غير صالح.",
    });
  }
};

export default verifyAdminToken;
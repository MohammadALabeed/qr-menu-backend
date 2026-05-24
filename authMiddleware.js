import jwt from "jsonwebtoken";

const verifyAdminToken = (req, res, next) => {
  // جلب التوكن من الهيدر (Authorization: Bearer <TOKEN>)
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "برجاء تسجيل الدخول أولاً، التوكن مفقود.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // حفظ بيانات الأدمن في الطلب
    next(); // السماح بالانتقال للمسار التالي
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "انتهت صلاحية الجلسة أو التوكن غير صالح.",
    });
  }
};

export default verifyAdminToken;

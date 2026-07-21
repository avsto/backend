import jwt from "jsonwebtoken";
import User from "../models/User.js";

const adminAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies?.adminToken ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.redirect("/admin/login");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const admin = await User.findById(decoded.id);

    if (!admin) {
      return res.redirect("/admin/login");
    }

    if (admin.role !== "admin") {
      return res.redirect("/admin/login");
    }

    req.admin = admin;

    next();
  } catch (err) {
    return res.redirect("/admin/login");
  }
};

export default adminAuth;
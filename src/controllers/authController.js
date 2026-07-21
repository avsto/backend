import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Wallet from "../models/Wallet.js";

import Setting from "../models/Setting.js";

// Generate JWT Token

const generateToken = (id) => {
  return jwt.sign(
    {
      id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d",
    },
  );
};

// ==========================
// Register
// POST /api/auth/register
// ==========================

export const register = async (req, res) => {
  try {
    const { name, mobile, email, password } = req.body;

    if (!name || !mobile || !password) {
      return res.status(400).json({
        message: "Name, mobile and password are required",
      });
    }

    const existingUser = await User.findOne({ mobile });

    if (existingUser) {
      return res.status(400).json({
        message: "Mobile number already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Get settings
    const setting = await Setting.findOne();

    const signupBonus = setting?.signupBonus || 0;

    // Create user
    const user = await User.create({
      name,
      mobile,
      email,
      password: hashedPassword,
      wallet: signupBonus,
    });

    // Create wallet
    await Wallet.create({
      user: user._id,
      balance: signupBonus,
      transactions: signupBonus
        ? [
            {
              type: "deposit",
              amount: signupBonus,
              status: "success",
              description: "Signup Bonus",
              referenceId: "SIGNUP-" + Date.now(),
            },
          ]
        : [],
    });

    const token = generateToken(user._id);

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        wallet: signupBonus,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// ==========================
// Login
// POST /api/auth/login
// ==========================

export const login = async (req, res) => {
  try {
    const { mobile, password } = req.body;

    const user = await User.findOne({
      mobile,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.status === "blocked") {
      return res.status(403).json({
        message: "Account blocked",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    user.lastLogin = new Date();

    await user.save();

    const token = generateToken(user._id);

    res.json({
      message: "Login successful",
      status: "success",
      token,

      user: {
        id: user._id,

        name: user.name,

        mobile: user.mobile,

        wallet: user.wallet,

        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// ==========================
// Profile
// GET /api/auth/profile
// ==========================

export const profile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const wallet = await Wallet.findOne({
      user: req.user.id,
    }).lean();

    // User object me wallet balance add kar do
    user.wallet = wallet ? wallet.balance : 0;

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

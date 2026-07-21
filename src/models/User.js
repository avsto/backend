import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    wallet: {
      type: Number,
      default: 0,
    },

    bonusWallet: {
      type: Number,
      default: 0,
    },

    totalDeposit: {
      type: Number,
      default: 0,
    },

    totalWithdraw: {
      type: Number,
      default: 0,
    },

    totalWin: {
      type: Number,
      default: 0,
    },

    totalLoss: {
      type: Number,
      default: 0,
    },

    role: {
      type: String,
      enum: [
        "user",
        "admin",
      ],
      default: "user",
    },

    status: {
      type: String,
      enum: [
        "active",
        "blocked",
      ],
      default: "active",
    },

    avatar: {
      type: String,
      default: "",
    },

    lastLogin: {
      type: Date,
    },

  },
  {
    timestamps: true,
  }
);


const User = mongoose.model(
  "User",
  userSchema
);


export default User;
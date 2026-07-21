import express from "express";

import adminAuth from "../middleware/adminAuth.js";

import {
  loginPage,
  login,
  dashboard,
  users,
  games,
  bets,
  wallet,
  transactions,
  userDetails,
  blockUser,
  unblockUser,
  deleteUser,
  settings,
  updateSettings,
  logout,
  payoutRequests,
  approvePayout,
  rejectPayout,
  deposits,
  approveDeposit,
  rejectDeposit,
  upiPage,
  addUpi,
  toggleUpi,
  deleteUpi,
} from "../controllers/adminController.js";

const router = express.Router();

// ===========================
// Public Routes
// ===========================

router.get("/login", loginPage);

router.post("/login", login);

// ===========================
// Protected Routes
// ===========================

router.get("/dashboard", adminAuth, dashboard);

// Users

router.get("/users", adminAuth, users);

router.get("/users/:id", adminAuth, userDetails);

router.get("/users/block/:id", adminAuth, blockUser);

router.get("/users/unblock/:id", adminAuth, unblockUser);

router.get("/users/delete/:id", adminAuth, deleteUser);

// Wallet

router.get("/wallet", adminAuth, wallet);

router.get("/transactions", adminAuth, transactions);

// Games

router.get("/games", adminAuth, games);

router.get("/bets", adminAuth, bets);

// Settings

router.get("/settings", adminAuth, settings);

router.post("/settings", adminAuth, updateSettings);

// ===========================
// UPI Management
// ===========================

// UPI Page

router.get("/upi", adminAuth, upiPage);

// Add UPI

router.post("/upi/add", adminAuth, addUpi);

// Active / Inactive

router.post("/upi/toggle/:id", adminAuth, toggleUpi);

// Delete

router.post("/upi/delete/:id", adminAuth, deleteUpi);

// ===========================
// Deposits
// ===========================

router.get("/deposits", adminAuth, deposits);

router.get(
  "/deposits/approve/:walletId/:transactionId",
  adminAuth,
  approveDeposit,
);

router.get(
  "/deposits/reject/:walletId/:transactionId",
  adminAuth,
  rejectDeposit,
);

// ===========================
// Payout
// ===========================

router.get("/payouts", adminAuth, payoutRequests);

router.get(
  "/payouts/approve/:walletId/:transactionId",
  adminAuth,
  approvePayout,
);

router.get("/payouts/reject/:walletId/:transactionId", adminAuth, rejectPayout);

// Logout

router.get("/logout", adminAuth, logout);

export default router;

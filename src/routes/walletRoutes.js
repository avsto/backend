import express from "express";

import {
  getWallet,
  deposit,
  withdraw,
  history,
  approveDeposit,
} from "../controllers/walletController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Get wallet balance + transactions

router.get("/", authMiddleware, getWallet);

// Deposit request

router.post("/deposit", authMiddleware, deposit);

// Withdraw request

router.post("/withdraw", authMiddleware, withdraw);

// Transaction history

router.get("/history", authMiddleware, history);

// Admin deposit approve
// (Isko baad me admin middleware se protect karenge)

router.post("/approve-deposit", authMiddleware, approveDeposit);

export default router;

import express from "express";

import { placeBet, betHistory } from "../controllers/betController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/place", authMiddleware, placeBet);

router.get("/history", authMiddleware, betHistory);

export default router;

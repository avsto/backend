import express from "express";

import {
  currentGame,
  gameHistory,
  createResult,
} from "../controllers/gameController.js";

const router = express.Router();

router.get("/current", currentGame);

router.get("/history", gameHistory);

router.post("/result", createResult);

export default router;

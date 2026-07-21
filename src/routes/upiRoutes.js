import express from "express";

import { getUpi } from "../controllers/upiController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/get", authMiddleware, getUpi);

export default router;

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import cookieParser from "cookie-parser";
import expressLayouts from "express-ejs-layouts";

import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import upiRoutes from "./routes/upiRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import betRoutes from "./routes/betRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

import { setSocket, startGameEngine } from "./services/gameEngine.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// ES Module __dirname

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB

connectDB();


// ===============================
// View Engine
// ===============================

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(expressLayouts);
app.set("layout", "layout");


// ===============================
// Static Folder
// ===============================

app.use(express.static(path.join(__dirname, "public")));


// ===============================
// Middleware
// ===============================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());


// ===============================
// Home
// ===============================

app.get("/", (req, res) => {

  res.render("index", {
    layout: false,
    title: "Color Prediction",
    message: "Welcome",
  });

});


// ===============================
// Admin Routes
// ===============================

app.use("/admin", adminRoutes);


// ===============================
// API Routes
// ===============================

app.use("/api/auth", authRoutes);
app.use("/api/upi", upiRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/bet", betRoutes);


// ===============================
// Socket
// ===============================

io.on("connection", (socket) => {

  console.log("User Connected:", socket.id);

  socket.on("disconnect", () => {

    console.log("User Disconnected:", socket.id);

  });

});


// ===============================
// Game Engine
// ===============================

setSocket(io);

startGameEngine();


// ===============================
// Server
// ===============================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {

  console.log(`Server running on ${PORT}`);

});
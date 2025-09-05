import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";

import User from "./models/User.js";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import tokenRoutes from "./routes/tokenRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";

dotenv.config();

const app = express();

connectDB();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/token", tokenRoutes);
app.use("/api/voice", voiceRoutes);

app.get("/", (req, res) => {
  res.send("Server is live and beating");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Map of socketId → userId
const onlineUsers = new Map();

// Helper to broadcast unique online users
const sendOnlineUsers = async () => {
  try {
    const userIds = Array.from(new Set(onlineUsers.values())); // unique IDs
    const users = await User.find({ _id: { $in: userIds } }).select("-password");
    io.emit("onlineUsers", users);
  } catch (err) {
    console.error("Error sending online users:", err);
  }
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("userOnline", async (userId) => {
    if (!userId) return;
    onlineUsers.set(socket.id, userId);

    await User.findByIdAndUpdate(userId, { isOnline: true });

    console.log(`${userId} is online`);
    sendOnlineUsers();
  });

  socket.on("disconnect", async () => {
    const userId = onlineUsers.get(socket.id);

    if (userId) {
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: Date.now(),
      });

      onlineUsers.delete(socket.id);

      console.log(`${userId} went offline`);
      sendOnlineUsers();
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

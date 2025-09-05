import express from "express";
import { registerUser, loginUser, verify, getAllUsers } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js"

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.get("/verify", protect, verify);

router.get("/users", protect, getAllUsers);

export default router;

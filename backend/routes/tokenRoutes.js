import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { generateVoiceToken } from "../controllers/tokenController.js";

const router = express.Router();

router.get("/voice", protect, generateVoiceToken);

export default router;

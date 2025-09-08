import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { generateVoiceToken, generateVideoToken, createVideoRoom } from "../controllers/tokenController.js";

const router = express.Router();

router.get("/voice", protect, generateVoiceToken);

router.get("/video", protect, generateVideoToken);

router.post("/video/room", protect, createVideoRoom);


export default router;
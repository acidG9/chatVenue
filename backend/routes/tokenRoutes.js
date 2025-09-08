import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { generateVoiceToken, generateVideoToken, createVideoRoom } from "../controllers/tokenController.js";

const router = express.Router();

router.get("/voice", protect, generateVoiceToken);

router.get("/video", protect, generateVideoToken);

router.post("/video/room", protect, createVideoRoom);

router.get("/speech", async (req, res) => {
  try { 
    res.json({
      key: process.env.AZURE_SPEECH_KEY,
      region: process.env.AZURE_SPEECH_REGION,
    });
  } catch (err) {
    console.error("Speech token error:", err);
    res.status(500).json({ error: "Failed to get speech credentials" });
  }
});


export default router;
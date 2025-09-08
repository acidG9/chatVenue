import express from "express";
import OpenAI from "openai";
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

router.post("/summary", async(req, res) => {
  const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
  defaultQuery: { "api-version": "2024-08-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
});
try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: "Transcript is required" });
    }

    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant that summarizes meeting transcripts." },
        { role: "user", content: `Summarize this transcript:\n\n${transcript}` },
      ],
      max_tokens: 300,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    res.json({ summary });
  } catch (error) {
    console.error("summary server problem:", error);
    res.status(500).json({ error: "failed to get summary" });
  }
});


export default router;
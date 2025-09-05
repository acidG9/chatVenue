import express from "express";
import { voiceResponse } from "../controllers/voiceController.js";

const router = express.Router();

router.post("/voice", voiceResponse);

export default router;

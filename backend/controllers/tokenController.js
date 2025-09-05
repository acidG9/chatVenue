import twilio from "twilio";

export const generateVoiceToken = async (req, res) => {
  try {
    const { name, email, _id } = req.user;
  
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const outgoingApplicationSid = process.env.TWILIO_TWIML_APP_SID;

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: _id.toString(),
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid,
      incomingAllow: true,
    });
    token.addGrant(voiceGrant);

    res.json({
      identity: _id.toString(),
      name,
      email,
      token: token.toJwt(),
    });
  } catch (error) {
    console.error("Error generating Twilio token:", error);
    res.status(500).json({ message: "Failed to generate voice token" });
  }
};

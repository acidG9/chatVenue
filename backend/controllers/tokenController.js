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

export const generateVideoToken = async (req, res) => {
try {
const { _id, name, email } = req.user;


const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;


const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;


const { room } = req.query;


const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
identity: _id.toString(),
});


const videoGrantOptions = {};
if (room) videoGrantOptions.room = room;


const videoGrant = new VideoGrant(videoGrantOptions);
token.addGrant(videoGrant);


res.json({
identity: _id.toString(),
name,
email,
token: token.toJwt(),
});
} catch (error) {
console.error("Error generating video token:", error);
res.status(500).json({ message: "Failed to generate video token" });
}
};

export const createVideoRoom = async (req, res) => {
try {
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { roomName, type = "group", uniqueName } = req.body;


if (!roomName) return res.status(400).json({ message: "roomName is required" });


const room = await client.video.rooms.create({
uniqueName: uniqueName || roomName,
type, // group | group-small | peer-to-peer
});


res.status(201).json({ room });
} catch (error) {
console.error("Create room error:", error);
res.status(500).json({ message: "Failed to create video room" });
}
};
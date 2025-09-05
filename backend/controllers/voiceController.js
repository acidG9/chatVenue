import twilio from "twilio";

export const voiceResponse = (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const { To } = req.body;

  if (!To) {
    return res.status(400).send("Missing To in request body");
  }

  const dial = twiml.dial();
  dial.client(To);

  res.type("text/xml");
  res.send(twiml.toString());
};

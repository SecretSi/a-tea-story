const MAX_TEXT_LENGTH = 1200;

function parseBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body);
  return req.body || {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body;
  try {
    body = parseBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid JSON request." });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `Text must be between 1 and ${MAX_TEXT_LENGTH} characters.` });
  }
  if (teacherId !== "ade" && teacherId !== "xiaochen") {
    return res.status(400).json({ error: "Unknown NPC voice." });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const fallbackVoiceId = process.env.ELEVENLABS_VOICE_ID;
  const maleVoiceId =
    process.env.ELEVENLABS_MALE_VOICE_ID ||
    process.env.ELEVENLABS_VOICE_ID_MALE ||
    process.env.ELEVENLABS_VOICE_ID_ADE;
  const femaleVoiceId =
    process.env.ELEVENLABS_FEMALE_VOICE_ID ||
    process.env.ELEVENLABS_VOICE_ID_FEMALE ||
    process.env.ELEVENLABS_VOICE_ID_XIAOCHEN;
  const voiceId = teacherId === "ade"
    ? (maleVoiceId || fallbackVoiceId)
    : (femaleVoiceId || fallbackVoiceId);

  if (!apiKey || !voiceId || !supabaseUrl || !anonKey) {
    return res.status(503).json({ error: "Voice service is not configured for this NPC." });
  }

  const authorization = req.headers.authorization || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return res.status(401).json({ error: "Sign in to use NPC voice." });
  }

  try {
    const userUrl = new URL("/auth/v1/user", supabaseUrl);
    const userResponse = await fetch(userUrl, {
      headers: {
        apikey: anonKey,
        Authorization: authorization,
      },
    });
    if (!userResponse.ok) {
      return res.status(401).json({ error: "Your sign-in has expired. Sign in again." });
    }

    const speechResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
        }),
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!speechResponse.ok) {
      return res.status(502).json({ error: "ElevenLabs could not generate speech." });
    }

    const audio = Buffer.from(await speechResponse.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(audio);
  } catch (error) {
    console.error("NPC speech request failed.", error);
    return res.status(502).json({ error: "NPC voice is temporarily unavailable." });
  }
};

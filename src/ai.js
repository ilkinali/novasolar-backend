// NovaSolar backend — generic AI proxy.
//
// The iOS app used to call Google Gemini directly with an API key embedded
// in the shipped binary (extractable by anyone who inspects the app). This
// module moves that call server-side: the app sends us a prompt (and an
// optional photo), we call OpenAI with our own server-held key, and return
// the raw text. All the domain-specific prompt-building (roof analysis,
// savings estimates, subsidy explanations, etc.) stays in the app — this is
// intentionally a thin, vendor-specific proxy, not a rewrite of that logic.

import express from "express";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const TEXT_MODEL = "gpt-4o-mini";
const VISION_MODEL = "gpt-4o";

// Very small in-memory sliding-window limiter so a stray script (or an
// extracted app-secret) can't run up the OpenAI bill unattended. Not a
// substitute for real auth, just a cheap backstop.
const rateLimitWindowMs = 60_000;
const rateLimitMax = 20;
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < rateLimitWindowMs);
  timestamps.push(now);
  hits.set(ip, timestamps);
  return timestamps.length > rateLimitMax;
}

export const aiRouter = express.Router();

aiRouter.post("/generate", async (req, res) => {
  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: "Too many requests. Please try again shortly." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "AI is not configured on the server yet." });
  }

  const { prompt, imageBase64, imageMimeType } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required." });
  }

  const hasImage = !!imageBase64;
  const content = hasImage
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${imageMimeType || "image/jpeg"};base64,${imageBase64}` } },
      ]
    : prompt;

  const body = {
    model: hasImage ? VISION_MODEL : TEXT_MODEL,
    messages: [{ role: "user", content }],
    temperature: 0.4,
    max_tokens: 2048,
  };

  try {
    const openaiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      const message = data?.error?.message || `OpenAI request failed (${openaiRes.status}).`;
      return res.status(502).json({ error: message });
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      return res.status(502).json({ error: "AI returned an empty response." });
    }

    res.json({ text });
  } catch (error) {
    res.status(502).json({ error: "Could not reach the AI provider." });
  }
});

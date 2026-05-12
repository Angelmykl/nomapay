export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;

  // Debug — check if key is being read
  if (!CIRCLE_API_KEY) {
    return res.status(500).json({ error: "CIRCLE_API_KEY is not set in environment" });
  }

  try {
    const response = await fetch("https://api-sandbox.circle.com/ping", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${CIRCLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
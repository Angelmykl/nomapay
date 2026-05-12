export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;

  try {
    const response = await fetch("https://api.circle.com/v1/configuration", {
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
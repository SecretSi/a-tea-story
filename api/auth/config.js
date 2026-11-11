module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  const anonKeyConfigured = Boolean(supabaseUrl && anonKey);

  return res.status(200).json({
    supabaseUrl,
    anonKey: anonKeyConfigured ? anonKey : "",
    anonKeyConfigured,
  });
};

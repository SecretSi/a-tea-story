const vocabulary = require("../../data/tocfl-vocabulary.json");

const PACK_SIZE = 15;
const TOTAL_PACKS = Math.ceil(vocabulary.length / PACK_SIZE);

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requested = Number.parseInt(req.query?.pack || "1", 10);
  if (!Number.isInteger(requested) || requested < 1 || requested > TOTAL_PACKS) {
    return res.status(400).json({
      error: "Pack number is out of range",
      totalPacks: TOTAL_PACKS,
    });
  }

  const start = (requested - 1) * PACK_SIZE;
  const entries = vocabulary.slice(start, start + PACK_SIZE);
  const levels = [...new Set(entries.map((entry) => entry.levelName))];
  const cefrLevels = [...new Set(entries.map((entry) => entry.cefr))];
  const title = cefrLevels.length === 1
    ? `TOCFL ${cefrLevels[0]} Pack ${String(requested).padStart(3, "0")}`
    : `TOCFL A1–B1 Pack ${String(requested).padStart(3, "0")}`;

  const words = entries.map((entry, index) => {
    const position = index + 1;
    return {
      ...entry,
      vocabulary: entry.hanzi,
      english: "",
      key: `${entry.hanzi}|${entry.pinyin}|`,
      packNumber: requested,
      position,
    };
  });

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({
    currentPack: {
      packNumber: requested,
      title,
      count: words.length,
      totalPacks: TOTAL_PACKS,
      totalWords: vocabulary.length,
      levels,
      cefrLevels,
    },
    words,
  });
};

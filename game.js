// ---------------------------------------------------------------------------
// A Tea Story — top-down Taipei map prototype
// Plain canvas, no build step: open index.html directly in a browser.
// ---------------------------------------------------------------------------

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
const W = canvas.width;
const H = canvas.height;

const RIVER_WIDTH = 260;

// the world is much bigger than the visible viewport (the canvas) — the
// camera follows the player around so the whole town is never on screen
// at once
const WORLD_W = 3600;
const WORLD_H = 2400;

const camera = { x: 0, y: 0 };
const interiorCamera = { x: 0 };

// ---- assets ---------------------------------------------------------------

const ASSET_PATH = "assets/locations/";
const CHARACTER_PATH = "assets/characters/";
const ITEM_PATH = "assets/items/";
const AGENT_CHAT_API_URL = "/api/agents/chat";
const AUTH_CONFIG_API_URL = "/api/auth/config";
const VOCAB_PACKS_API_URL = "/api/vocab/packs";
const VOCAB_PROGRESS_API_URL = "/api/vocab/progress";
const VOCAB_LOOKUP_API_URL = "/api/vocab/lookup";
// bust the browser cache on every load so edited source art always shows
const ASSET_VERSION = Date.now();

function loadImage(src, basePath = ASSET_PATH) {
  const img = new Image();
  img.missing = false;
  img.onerror = () => {
    img.missing = true;
  };
  img.src = basePath + src + "?v=" + ASSET_VERSION;
  return img;
}

const images = {
  teaHouse: loadImage("tea_house.png"),
  home: loadImage("home.png"),
  convenienceStore: loadImage("convenience_store.png"),
  izakaya: loadImage("izakaya.png"),
  junkBoat: loadImage("junk_boat.png"),
  airport: loadImage("airport.png"),
  temple: loadImage("temple.png"),
  soymilkShop: loadImage("soymilk_shop.png"),
  mrt: loadImage("mrt.png"),
  nightMarket: loadImage("night_market.png"),
  supermarket: loadImage("supermarket.png"),
};

const characterImages = {
  delinquent: loadImage("delinquent.png", CHARACTER_PATH),
  grandmother: loadImage("grandmother.png", CHARACTER_PATH),
  hotchick: loadImage("hotchick.png", CHARACTER_PATH),
};

const itemImages = {
  teaTable: loadImage("tea table.png", ITEM_PATH),
  scrollShelf: loadImage("scroll shelf.png", ITEM_PATH),
  bedPad: loadImage("bed pad.png", ITEM_PATH),
  vase: loadImage("vase.png", ITEM_PATH),
  metro: loadImage("metro.png", ITEM_PATH),
  metroTopdown: loadImage("metro_topdown.png", ITEM_PATH),
  mrtStation: loadImage("mrt station sprite.png", ITEM_PATH),
  mrtMap: loadImage("mrt_map.svg", ITEM_PATH),
  bartop: loadImage("bartop.png", ITEM_PATH),
  aisles: loadImage("aisles.png", ITEM_PATH),
  redLantern: loadImage("red_lantern.png", ITEM_PATH),
  teaHouseCountertop: loadImage("tea house countertop.png", ITEM_PATH),
  checkoutCounter: loadImage("convenience counter.png", ITEM_PATH),
  nightMarketStand1: loadImage("night market stand 1.png", ITEM_PATH),
  nightMarketStand2: loadImage("night market stand 2.png", ITEM_PATH),
  nightMarketStandNew: loadImage("night market stand 4.png", ITEM_PATH),
  izakayaTable: loadImage("izakaya table.png", ITEM_PATH),
  redCar: loadImage("red_car.png", ITEM_PATH),
  tree: loadImage("tree.png", ITEM_PATH),
  staircase: loadImage("staircase.png", ITEM_PATH),
  bonsai1: loadImage("bonsai.png", ITEM_PATH),
  bonsai2: loadImage("bonsai.png", ITEM_PATH),
  grandpaGarden: loadImage("grandpa_garden.png", ITEM_PATH),
  guanyin: loadImage("guanyin sprite.png", ITEM_PATH),
  guanyu: loadImage("guanyu.png", ITEM_PATH),
  mazu: loadImage("mazu sprite.png", ITEM_PATH),
  tudigong: loadImage("tudigong sprite.png", ITEM_PATH),
};

// width/height below are the target *drawn* footprint; actual source images
// are large AI-generated sprites with transparent backgrounds, so we scale
// them down and keep their native aspect ratio.
function footprint(img, targetW) {
  const ratio = img.width > 0 ? img.height / img.width : 0.72;
  return { w: targetW, h: targetW * ratio };
}

function drawSpriteRegion(img, region, x, y, w) {
  const h = (w * region.h) / region.w;
  ctx.drawImage(img, region.x, region.y, region.w, region.h, x, y, w, h);
  return { w, h };
}

// locations spread far apart across the much bigger world, so getting
// between them actually takes a walk
const locations = [
  { img: images.teaHouse, x: 750, y: 380, w: 656, name: "Tea House" },
  { img: images.home, x: 950, y: 1650, w: 560, name: "Home" },
  { img: images.airport, x: 1900, y: 320, w: 560, name: "Airport" },
  { img: images.convenienceStore, x: 3050, y: 560, w: 578, name: "Convenience Store" },
  { img: images.temple, x: 1325, y: 650, w: 620, name: "Temple" },
  { img: images.izakaya, x: 2200, y: 1850, w: 656, name: "Izakaya" },
  { img: images.soymilkShop, x: 3150, y: 1400, w: 578, name: "Soy Milk Shop" },
  { img: images.mrt, x: 1900, y: 1100, w: 520, name: "MRT Station" },
  { img: images.nightMarket, x: 3200, y: 2050, w: 750, name: "Night Market" },
  { img: images.supermarket, x: 700, y: 1100, w: 600, name: "Supermarket" },
];

const entranceSpecs = {
  "Tea House": { dx: 0, dy: 178, radius: 150 },
  Home: { dx: 0, dy: 165, radius: 175 },
  Airport: { dx: 0, dy: 175, radius: 190 },
  "Convenience Store": { dx: 0, dy: 165, radius: 175 },
  Temple: { dx: 0, dy: 155, radius: 175 },
  Izakaya: { dx: 0, dy: 165, radius: 180 },
  "Soy Milk Shop": { dx: 0, dy: 160, radius: 175 },
  "MRT Station": { dx: 0, dy: 150, radius: 180 },
  "Night Market": { dx: 0, dy: 140, radius: 210 },
  Supermarket: { dx: 0, dy: 165, radius: 180 },
};

// wharf jutting out from the riverbank, with the junk boat moored alongside it
const wharf = { y: 950, length: 150, width: 26 };

const boat = { img: images.junkBoat, x: 165, y: wharf.y - 50, w: 394, bob: 0, bobSpeed: 1 };

// ---- roads ------------------------------------------------------------
// a simple street network linking the locations together

const roads = [
  [[700, 950], [700, 1100]], // wharf spur up to the supermarket
  [[700, 1100], [750, 380]],
  [[750, 380], [1325, 650]],
  [[1325, 650], [950, 1650]],
  [[1325, 650], [1900, 1100]],
  [[750, 380], [1900, 320]],
  [[1900, 320], [1900, 1100]],
  [[1900, 1100], [3050, 560]],
  [[1900, 1100], [2200, 1850]],
  [[700, 1100], [950, 1650]],
  [[950, 1650], [2200, 1850]],
  [[2200, 1850], [3150, 1400]],
  [[3150, 1400], [3200, 2050]],
  [[3150, 1400], [3050, 560]],
];

// ---- MRT track ----------------------------------------------------------
// a single elevated line that winds across the whole city, passing the
// station near the middle of the map
const mrtTrack = [
  [600, 200],
  [1500, 180],
  [1900, 500],
  [1900, 1100],
  [2150, 1550],
  [2500, 1900],
  [2950, 2050],
  [3350, 2150],
];

// ---- green space ----------------------------------------------------------
// a couple of park patches so the city isn't wall-to-wall concrete

const parks = [
  { x: 1500, y: 2050, rx: 390, ry: 260 },
  { x: 2500, y: 250, rx: 340, ry: 220 },
  { x: 2770, y: 880, rx: 280, ry: 170 },
];

const banyanTrees = [
  { x: 1500, y: 2240, w: 620 },
];

// ---- traffic ----------------------------------------------------------
// cars/scooters/youbikes ping-pong along individual road segments, the
// MRT train loops the whole track, and a couple of small boats drift up
// and down the river — all procedural, since there's no vehicle art yet

function pathLength(points) {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  }
  return len;
}

function pointOnPath(points, dist) {
  let remaining = dist;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const segLen = Math.hypot(x2 - x1, y2 - y1);
    if (remaining <= segLen || i === points.length - 2) {
      const t = segLen === 0 ? 0 : Math.min(remaining / segLen, 1);
      return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, angle: Math.atan2(y2 - y1, x2 - x1) };
    }
    remaining -= segLen;
  }
  const [x, y] = points[points.length - 1];
  return { x, y, angle: 0 };
}

function moverTransform(mover, t) {
  if (mover.loop) {
    const d = ((t * mover.speed + mover.phase) % mover.totalLen + mover.totalLen) % mover.totalLen;
    const p = pointOnPath(mover.path, d);
    return { x: p.x, y: p.y, angle: p.angle };
  }
  const cycle = mover.totalLen * 2;
  const d0 = ((t * mover.speed + mover.phase) % cycle + cycle) % cycle;
  const reverse = d0 > mover.totalLen;
  const d = reverse ? cycle - d0 : d0;
  const p = pointOnPath(mover.path, d);
  return { x: p.x, y: p.y, angle: p.angle + (reverse ? Math.PI : 0) };
}

const CAR_FILTERS = [
  "none",
  "hue-rotate(205deg) saturate(1.35) brightness(1.06)",
  "hue-rotate(95deg) saturate(1.25) brightness(0.95)",
  "hue-rotate(48deg) saturate(1.45) brightness(1.22)",
  "hue-rotate(278deg) saturate(1.2) brightness(1.02)",
  "grayscale(0.85) brightness(1.1)",
];

const movers = [];
roads.forEach((segment, i) => {
  const len = pathLength(segment);
  movers.push({
    type: "car",
    path: segment,
    totalLen: len,
    speed: 80 + Math.random() * 40,
    phase: Math.random() * len,
    filter: CAR_FILTERS[i % CAR_FILTERS.length],
  });
  if (i % 2 === 0) {
    movers.push({
      type: "scooter",
      path: segment,
      totalLen: len,
      speed: 130 + Math.random() * 40,
      phase: Math.random() * len,
    });
  }
});
[roads[1], roads[5], roads[7]].forEach((segment) => {
  const len = pathLength(segment);
  movers.push({ type: "youbike", path: segment, totalLen: len, speed: 55 + Math.random() * 15, phase: Math.random() * len });
});

const trainPath = mrtTrack;
movers.push({ type: "train", path: trainPath, totalLen: pathLength(trainPath), speed: 240, phase: 0, loop: true });

const riverBoatPaths = [
  [[150, 150], [150, WORLD_H - 150]],
  [[195, 250], [195, WORLD_H - 350]],
];
riverBoatPaths.forEach((path, i) => {
  movers.push({ type: "boat", path, totalLen: pathLength(path), speed: 35 + i * 15, phase: i * 400 });
});

// ---- tea house interior ----------------------------------------------------
// walking up to the Tea House and pressing E swaps the whole scene for a
// small two-room interior (no camera scrolling needed, it fits the viewport)

const teaHouseLocation = locations.find((l) => l.name === "Tea House");
const teaHouseEntrance = { x: teaHouseLocation.x, y: teaHouseLocation.y + 178, radius: 150 };

const INTERIOR_W = W;
const INTERIOR_H = H;
const NIGHT_MARKET_W = 2600;
const NIGHT_MARKET_ROAD_TOP = 575;
const NIGHT_MARKET_ROAD_BOTTOM = 740;
const MRT_LOBBY_W = 1800;
const MRT_LOBBY_WALK_Y = 705;
const MRT_PLATFORM_WALK_TOP = 640;
const MRT_PLATFORM_SPAWN = { x: 350, y: 700 };
const interiorWall = { x: 640, width: 30, gapTop: 260, gapBottom: 560 };
const interiorExit = { x: 350, y: 740, radius: 90 };
const interiorPlayerStart = { x: 350, y: 700 };

let scene = "world";
const savedWorldPos = { x: 0, y: 0 };
let activeInterior = null;
let activeDialogueNpc = null;
let bonsaiStaircaseUnlocked = false;
let bonsaiStaircaseSlideStart = null;

const interactPromptEl = document.getElementById("interact-prompt");
const dialogueBoxEl = document.getElementById("dialogue-box");
const dialogueSpeakerEl = document.getElementById("dialogue-speaker");
const dialogueLineEl = document.getElementById("dialogue-line");
const teacherChatEl = document.getElementById("teacher-chat");
const teacherMessagesEl = document.getElementById("teacher-messages");
const teacherFormEl = document.getElementById("teacher-form");
const teacherInputEl = document.getElementById("teacher-input");
const teacherSendEl = document.getElementById("teacher-send");
const teacherCloseEl = document.getElementById("teacher-close");
const teacherTitleEl = teacherChatEl.querySelector("header span");
const travelPanelEl = document.getElementById("travel-panel");
const travelContentEl = document.getElementById("travel-content");
const travelStatusEl = document.getElementById("travel-status");
const travelCloseEl = document.getElementById("travel-close");
const scrollHudEl = document.getElementById("scroll-hud");
const questHudEl = document.getElementById("quest-hud");
const vocabPanelEl = document.getElementById("vocab-panel");
const vocabContentEl = document.getElementById("vocab-content");
const vocabCloseEl = document.getElementById("vocab-close");
const scrollRackPanelEl = document.getElementById("scroll-rack-panel");
const scrollRackContentEl = document.getElementById("scroll-rack-content");
const scrollRackCloseEl = document.getElementById("scroll-rack-close");
const mrtMapPanelEl = document.getElementById("mrt-map-panel");
const mrtMapCloseEl = document.getElementById("mrt-map-close");
const flashcardPopEl = document.getElementById("flashcard-pop");
const flashcardCardEl = document.getElementById("flashcard-card");
const flashcardHanziEl = document.getElementById("flashcard-hanzi");
const flashcardPinyinEl = document.getElementById("flashcard-pinyin");
const flashcardEnglishEl = document.getElementById("flashcard-english");
const flashcardNoteEl = document.getElementById("flashcard-note");
const flashcardExampleEl = document.getElementById("flashcard-example");
const flashcardMetaEl = document.getElementById("flashcard-meta");
const flashcardSpeakEl = document.getElementById("flashcard-speak");
const flashcardDictionaryEl = document.getElementById("flashcard-dictionary");
const flashcardCloseEl = document.getElementById("flashcard-close");
const wordLookupEl = document.getElementById("word-lookup");
const wordLookupHanziEl = document.getElementById("word-lookup-hanzi");
const wordLookupPinyinEl = document.getElementById("word-lookup-pinyin");
const wordLookupEnglishEl = document.getElementById("word-lookup-english");
const wordLookupExampleEl = document.getElementById("word-lookup-example");
const wordLookupSpeakEl = document.getElementById("word-lookup-speak");
const wordLookupCloseEl = document.getElementById("word-lookup-close");
const loginEl = document.getElementById("login");
const loginStatusEl = document.getElementById("login-status");
const loginGoogleEl = document.getElementById("login-google");
const loginContinueEl = document.getElementById("login-continue");
const loginOfflineEl = document.getElementById("login-offline");

const TRAVEL_DESTINATIONS = [
  {
    category: "Popular & Global",
    destinations: [
      { language: "Spanish", city: "Madrid", alternate: "Mexico City" },
      { language: "French", city: "Paris" },
      { language: "German", city: "Berlin" },
      { language: "Japanese", city: "Tokyo" },
      { language: "Korean", city: "Seoul" },
      { language: "Italian", city: "Rome" },
      { language: "Mandarin Chinese", city: "Beijing" },
      { language: "Hindi", city: "New Delhi" },
    ],
  },
  {
    category: "European",
    destinations: [
      { language: "Portuguese", city: "Lisbon", alternate: "Rio de Janeiro" },
      { language: "Russian", city: "Moscow" },
      { language: "Dutch", city: "Amsterdam" },
      { language: "Turkish", city: "Istanbul" },
      { language: "Swedish", city: "Stockholm" },
      { language: "Polish", city: "Krakow" },
      { language: "Irish", city: "Dublin" },
      { language: "Greek", city: "Athens" },
      { language: "Norwegian", city: "Oslo" },
      { language: "Latin", city: "Ancient Rome" },
    ],
  },
  {
    category: "Indigenous & Regional",
    destinations: [
      { language: "Hawaiian", city: "Honolulu" },
      { language: "Navajo", city: "Window Rock" },
      { language: "Maori", city: "Auckland", alternate: "Rotorua" },
      { language: "Welsh", city: "Cardiff" },
      { language: "Scottish Gaelic", city: "Inverness" },
    ],
  },
  {
    category: "Fictional & Classical",
    destinations: [
      { language: "Esperanto", city: "Amikeco", note: "Utopian concept city" },
      { language: "High Valyrian", city: "Valyria" },
      { language: "Klingon", city: "First City", note: "Qo'noS" },
    ],
  },
];

const TRAVEL_RETURN_GATE = { x: 650, y: 700, radius: 125 };
const TRAVEL_MAP_THEMES = [
  { ground: "#30434a", road: "#454545", roadDash: "#f1d06a", water: "#2c76a8", park: "#527f47", accent: "#d94f4f" },
  { ground: "#3f3a35", road: "#4a4740", roadDash: "#e6d69a", water: "#3b83a2", park: "#618849", accent: "#d7a33f" },
  { ground: "#2f3f38", road: "#3d443f", roadDash: "#dad28a", water: "#287b92", park: "#4f8f57", accent: "#cb5c7a" },
  { ground: "#3a3d4b", road: "#424452", roadDash: "#e8e4c1", water: "#426db0", park: "#5d7c4b", accent: "#7fc0d6" },
  { ground: "#403943", road: "#4b424c", roadDash: "#edd77e", water: "#315f85", park: "#697f42", accent: "#b990e2" },
];

let activeTravelDestination = null;

const XIAOCHEN_VOCAB = [
  { hanzi: "捷運", pinyin: "jie yun", english: "MRT", hint: "Taipei's metro system.", keywords: ["mrt", "metro", "train", "subway"] },
  { hanzi: "票", pinyin: "piao", english: "ticket", hint: "Ask for this at the booth.", keywords: ["ticket", "fare"] },
  { hanzi: "悠遊卡", pinyin: "you you ka", english: "EasyCard", hint: "Tap this card at the gates.", keywords: ["easycard", "card", "tap"] },
  { hanzi: "月台", pinyin: "yue tai", english: "platform", hint: "Where you wait for the train.", keywords: ["platform", "wait"] },
  { hanzi: "出口", pinyin: "chu kou", english: "exit", hint: "Follow this when you leave the station.", keywords: ["exit", "leave", "out"] },
  { hanzi: "多少錢", pinyin: "duo shao qian", english: "how much money", hint: "Useful before buying a ticket.", keywords: ["price", "cost", "buy", "pay", "money"] },
  { hanzi: "你好", pinyin: "ni hao", english: "hello", hint: "A friendly way to start at the counter.", keywords: ["hi", "hello", "hey"] },
  { hanzi: "謝謝", pinyin: "xie xie", english: "thank you", hint: "Say it after someone helps you.", keywords: ["thanks", "thank you"] },
];

const ADE_VOCAB = [
  { hanzi: "便利商店", pinyin: "bian li shang dian", english: "convenience store", hint: "Where 阿德 works.", keywords: ["store", "convenience", "shop"] },
  { hanzi: "結帳", pinyin: "jie zhang", english: "checkout", hint: "Use this when you are ready to pay.", keywords: ["checkout", "pay", "cashier"] },
  { hanzi: "發票", pinyin: "fa piao", english: "receipt", hint: "Taiwan receipts can be lottery tickets too.", keywords: ["receipt", "invoice"] },
  { hanzi: "袋子", pinyin: "dai zi", english: "bag", hint: "Ask for this if you need a bag.", keywords: ["bag"] },
  { hanzi: "飲料", pinyin: "yin liao", english: "drink", hint: "A convenience store classic.", keywords: ["drink", "tea", "coffee", "water"] },
  { hanzi: "便當", pinyin: "bian dang", english: "lunch box", hint: "A quick meal from the shelves.", keywords: ["lunch", "box", "food", "meal", "bento"] },
  { hanzi: "多少錢", pinyin: "duo shao qian", english: "how much money", hint: "Good for asking the price.", keywords: ["price", "cost", "money"] },
  { hanzi: "謝謝", pinyin: "xie xie", english: "thank you", hint: "Always useful at the counter.", keywords: ["thanks", "thank you"] },
];

const TEACHERS = {
  xiaochen: {
    id: "xiaochen",
    name: "小陳",
    inputPlaceholder: "Ask 小陳 in English...",
    agentName: "小陳",
    aliases: ["小陳", "小陈", "xiaochen", "xiao chen"],
    vocab: XIAOCHEN_VOCAB,
    intro: [
      "Hi, I am 小陳 at the MRT ticket booth. Ask in English, and I will teach you station Mandarin.",
      "First word: 捷運 (jie yun) means MRT.",
    ],
    defaultReply: (entry) => `At the booth, listen for "${entry.hanzi}" (${entry.pinyin}). It means "${entry.english}". ${entry.hint}`,
    exampleReply: (entry) => `Station phrase: "${entry.hanzi}" means "${entry.english}". You can point, smile, and use the word by itself first.`,
    quizReply: (entry) => `Ticket-booth quiz: what does "${entry.hanzi}" mean? Hint: ${entry.hint}`,
    turn: 0,
  },
  ade: {
    id: "ade",
    name: "阿德",
    inputPlaceholder: "Ask 阿德 in English...",
    agentName: "阿德",
    aliases: ["阿德", "ade"],
    vocab: ADE_VOCAB,
    intro: [
      "Hey, I am 阿德 at the convenience store checkout. Ask in English, and I will teach you useful counter Mandarin.",
      "First phrase: 結帳 (jie zhang) means checkout or to settle the bill.",
    ],
    defaultReply: (entry) => `At the counter, "${entry.hanzi}" (${entry.pinyin}) means "${entry.english}". ${entry.hint}`,
    exampleReply: (entry) => `Try it like this: "${entry.hanzi}" means "${entry.english}". You can say the word and point if you are still practicing.`,
    quizReply: (entry) => `Convenience-store quiz: what does "${entry.hanzi}" mean? Hint: ${entry.hint}`,
    turn: 0,
  },
};

let teacherChatOpen = false;
let activeTeacherId = null;
let teacherChatBusy = false;
const teacherChatHistory = {};
let supabaseClient = null;
let authSession = null;
let authReady = false;
let authUnavailableMessage = "Auth not configured";
let vocabPanelOpen = false;
let scrollRackOpen = false;
let mrtMapOpen = false;
const acquiredVocab = loadAcquiredVocab();
const vocabProgress = loadVocabProgress();
let currentVocabPack = null;
let currentVocabPackWords = [];
let activeFlashcardEntry = null;
let vocabProgressSyncTimer = null;
let vocabProgressRemoteLoaded = false;
let speechVoices = [];
let speechVoicesReady = false;
let flashcardSpeaking = false;
let activeFlashcardRequest = 0;
let activeLookupEntry = null;
let activeLookupRequest = 0;
const vocabLookupCache = new Map();

function randomVocabInterval() {
  return 3 + Math.floor(Math.random() * 8);
}

function loadVocabProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem("vocabProgress") || "{}");
    return {
      packNumber: Math.max(1, Number(saved.packNumber || 1)),
      responseCount: Math.max(0, Number(saved.responseCount || 0)),
      nextTeachAt: Math.max(3, Number(saved.nextTeachAt || randomVocabInterval())),
    };
  } catch (error) {
    console.warn("Could not load vocabulary progress.", error);
    return { packNumber: 1, responseCount: 0, nextTeachAt: randomVocabInterval() };
  }
}

function saveVocabProgress() {
  localStorage.setItem("vocabProgress", JSON.stringify(vocabProgress));
  scheduleRemoteVocabProgressSave();
}

function applyVocabProgress(progress) {
  if (!progress) return;
  vocabProgress.packNumber = Math.max(1, Number(progress.packNumber || vocabProgress.packNumber || 1));
  vocabProgress.responseCount = Math.max(0, Number(progress.responseCount || 0));
  vocabProgress.nextTeachAt = Math.max(3, Number(progress.nextTeachAt || randomVocabInterval()));
  currentVocabPack = null;
  currentVocabPackWords = [];
  localStorage.setItem("vocabProgress", JSON.stringify(vocabProgress));
  if (vocabPanelOpen) {
    loadCurrentVocabPack()
      .catch((error) => console.warn("Vocabulary pack reload failed.", error))
      .finally(renderVocabularyScroll);
  }
}

function serializeVocabProgress() {
  return {
    packNumber: Math.max(1, Number(vocabProgress.packNumber || 1)),
    responseCount: Math.max(0, Number(vocabProgress.responseCount || 0)),
    nextTeachAt: Math.max(3, Number(vocabProgress.nextTeachAt || 3)),
  };
}

function chooseNewestVocabProgress(localProgress, remoteProgress) {
  if (!remoteProgress) return localProgress;
  const localPack = Math.max(1, Number(localProgress?.packNumber || 1));
  const remotePack = Math.max(1, Number(remoteProgress?.packNumber || 1));
  if (remotePack > localPack) return remoteProgress;
  if (localPack > remotePack) return localProgress;

  const localResponses = Math.max(0, Number(localProgress?.responseCount || 0));
  const remoteResponses = Math.max(0, Number(remoteProgress?.responseCount || 0));
  return remoteResponses > localResponses ? remoteProgress : localProgress;
}

function scheduleRemoteVocabProgressSave() {
  if (!authSession?.access_token) return;
  clearTimeout(vocabProgressSyncTimer);
  vocabProgressSyncTimer = setTimeout(() => {
    saveRemoteVocabProgress().catch((error) => {
      console.warn("Vocabulary progress sync failed.", error);
    });
  }, 250);
}

async function saveRemoteVocabProgress() {
  if (!authSession?.access_token) return null;
  const response = await fetch(VOCAB_PROGRESS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ progress: serializeVocabProgress() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Vocabulary progress save failed");
  return data.progress || null;
}

async function syncRemoteVocabProgress() {
  if (!authSession?.access_token || vocabProgressRemoteLoaded) return;
  vocabProgressRemoteLoaded = true;
  const localProgress = serializeVocabProgress();
  const response = await fetch(VOCAB_PROGRESS_API_URL, { headers: getAuthHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn("Vocabulary progress load failed.", data.error || response.status);
    return;
  }

  const chosenProgress = chooseNewestVocabProgress(localProgress, data.progress);
  applyVocabProgress(chosenProgress);
  await saveRemoteVocabProgress();
}

function currentPackCollected(packNumber = vocabProgress.packNumber) {
  return acquiredVocab.filter((entry) => Number(entry.packNumber || 1) === Number(packNumber || 1));
}

function currentPackCollectedKeys() {
  return currentPackCollected().map((entry) => entry.key);
}

function getVocabTeachRequest() {
  vocabProgress.responseCount += 1;
  const shouldTeach = vocabProgress.responseCount >= vocabProgress.nextTeachAt;
  saveVocabProgress();
  return {
    packNumber: vocabProgress.packNumber,
    shouldTeach,
    responseCount: vocabProgress.responseCount,
    nextTeachAt: vocabProgress.nextTeachAt,
    collectedKeys: currentPackCollectedKeys(),
  };
}

function finishVocabTeachAttempt(taughtWord) {
  if (!taughtWord) return;
  vocabProgress.responseCount = 0;
  vocabProgress.nextTeachAt = randomVocabInterval();
  saveVocabProgress();
}

async function loadCurrentVocabPack(packNumber = vocabProgress.packNumber) {
  const response = await fetch(`${VOCAB_PACKS_API_URL}?pack=${encodeURIComponent(packNumber)}`);
  if (!response.ok) throw new Error("Vocabulary pack request failed");
  const data = await response.json();
  currentVocabPack = data.currentPack;
  currentVocabPackWords = Array.isArray(data.words) ? data.words : [];
  return data;
}

function allTeacherVocab() {
  return Object.values(TEACHERS).flatMap((teacher) => {
    return teacher.vocab.map((entry) => ({ ...entry, teacherId: teacher.id, teacherName: teacher.name }));
  });
}

function vocabKey(entry) {
  const hanzi = entry.hanzi || entry.char_trad || entry.traditional || entry.vocabulary || entry.term || entry.phrase || entry.word || "";
  const pinyin = entry.pinyin || entry.pronunciation || entry.romanization || "";
  const english = vocabEnglish(entry);
  return `${hanzi}|${pinyin}|${english}`;
}

function stringifyVocabValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(stringifyVocabValue).filter(Boolean).join("; ");
  if (typeof value === "object") {
    const preferred = vocabFirstPresent(value, [
      "english",
      "English",
      "definition_en",
      "definitionEnglish",
      "definition_english",
      "english_translation",
      "meaning_en",
      "meaning",
      "translation_en",
      "translation_english",
      "translation",
      "Translation",
      "text",
      "value",
    ]);
    if (preferred) return preferred;
    return Object.values(value).map(stringifyVocabValue).filter(Boolean).join("; ");
  }
  return String(value).trim();
}

function vocabFirstPresent(entry, keys) {
  for (const key of keys) {
    const text = stringifyVocabValue(entry?.[key]);
    if (text) return text;
  }
  return "";
}

function vocabHanzi(entry) {
  return entry?.hanzi || entry?.char_trad || entry?.traditional || entry?.vocabulary || entry?.term || entry?.phrase || entry?.word || "";
}

function vocabPinyin(entry) {
  return entry?.pinyin || entry?.pronunciation || entry?.romanization || "";
}

function vocabEnglish(entry) {
  return vocabFirstPresent(entry, [
    "english",
    "English",
    "en",
    "eng",
    "english_translation",
    "translation",
    "Translation",
    "translations",
    "definition_en",
    "definitionEnglish",
    "definition_english",
    "english_definition",
    "meaning_en",
    "meaning_english",
    "english_meaning",
    "meaning",
    "translation_en",
    "translation_english",
    "gloss_en",
    "definition",
    "definitions",
    "meanings",
    "gloss",
  ]);
}

function vocabExampleSentence(entry) {
  return vocabFirstPresent(entry, [
    "contextSentence",
    "context_sentence",
    "context_zh",
    "example_zh",
    "example_sentence",
    "exampleSentence",
    "sentence",
    "example",
    "examples",
  ]);
}

function vocabExampleTranslation(entry) {
  return vocabFirstPresent(entry, [
    "contextTranslation",
    "context_translation",
    "context_en",
    "example_en",
    "example_translation",
    "exampleTranslation",
    "sentence_translation",
    "sentenceTranslation",
    "translation_en",
    "translation_english",
  ]);
}

function vocabExamplePinyin(entry) {
  return vocabFirstPresent(entry, [
    "contextPinyin",
    "context_pinyin",
    "example_pinyin",
    "examplePinyin",
    "sentence_pinyin",
    "sentencePinyin",
  ]);
}

function vocabNote(entry) {
  return vocabFirstPresent(entry, ["hint", "note", "notes", "usage"]);
}

function vocabExampleText(entry) {
  const sentence = vocabExampleSentence(entry);
  const pinyin = vocabExamplePinyin(entry);
  const translation = vocabExampleTranslation(entry);
  if (sentence && pinyin && translation) return `Example: ${sentence} (${pinyin}) = ${translation}`;
  if (sentence && pinyin) return `Example: ${sentence} (${pinyin})`;
  if (sentence && translation) return `Example: ${sentence} = ${translation}`;
  if (sentence) return `Example: ${sentence}`;
  if (translation) return `Example: ${translation}`;
  return "";
}

function mergeVocabEntries(baseEntry, enrichedEntry) {
  return {
    ...(baseEntry || {}),
    ...(enrichedEntry || {}),
    english: vocabEnglish(enrichedEntry) || vocabEnglish(baseEntry),
    meaning: vocabEnglish(enrichedEntry) || vocabEnglish(baseEntry),
    hint: vocabNote(enrichedEntry) || vocabNote(baseEntry),
    contextSentence: vocabExampleSentence(enrichedEntry) || vocabExampleSentence(baseEntry),
    contextPinyin: vocabExamplePinyin(enrichedEntry) || vocabExamplePinyin(baseEntry),
    contextTranslation: vocabExampleTranslation(enrichedEntry) || vocabExampleTranslation(baseEntry),
  };
}

async function lookupVocabEntry(entry, options = {}) {
  const hanzi = vocabHanzi(entry);
  if (!hanzi) return entry;
  const pinyin = vocabPinyin(entry);
  const lookupPackNumber = entry?.packNumber || vocabProgress.packNumber;
  const allowGeneratedTranslation = Boolean(options.allowGeneratedTranslation || entry?.allowGeneratedTranslation);
  const cacheKey = `${hanzi}|${pinyin}|${lookupPackNumber}|generated:${allowGeneratedTranslation ? "yes" : "no"}`;
  if (vocabLookupCache.has(cacheKey)) return mergeVocabEntries(entry, vocabLookupCache.get(cacheKey));

  const response = await fetch(VOCAB_LOOKUP_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hanzi,
      pinyin,
      packNumber: lookupPackNumber,
      allowGeneratedTranslation,
    }),
  });
  if (!response.ok) throw new Error("Vocabulary lookup failed");
  const data = await response.json();
  if (data.word) vocabLookupCache.set(cacheKey, data.word);
  return mergeVocabEntries(entry, data.word);
}

function loadAcquiredVocab() {
  try {
    const saved = JSON.parse(localStorage.getItem("acquiredVocab") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.warn("Could not load vocabulary scroll.", error);
    return [];
  }
}

function saveAcquiredVocab() {
  localStorage.setItem("acquiredVocab", JSON.stringify(acquiredVocab));
}

function addAcquiredVocab(entry, teacher) {
  if (!entry) return null;
  const key = vocabKey(entry);
  const hanzi = vocabHanzi(entry);
  const pinyin = vocabPinyin(entry);
  const existingEntry = acquiredVocab.find((saved) => {
    return saved.key === key || (vocabHanzi(saved) === hanzi && (!pinyin || vocabPinyin(saved) === pinyin));
  });
  if (existingEntry) {
    existingEntry.key = key;
    existingEntry.hanzi = vocabHanzi(entry) || existingEntry.hanzi;
    existingEntry.vocabulary = entry.vocabulary || vocabHanzi(entry) || existingEntry.vocabulary;
    existingEntry.pinyin = vocabPinyin(entry) || existingEntry.pinyin;
    existingEntry.english = vocabEnglish(entry) || existingEntry.english;
    existingEntry.hint = vocabNote(entry) || existingEntry.hint;
    existingEntry.contextSentence = vocabExampleSentence(entry) || existingEntry.contextSentence;
    existingEntry.contextPinyin = vocabExamplePinyin(entry) || existingEntry.contextPinyin;
    existingEntry.contextTranslation = vocabExampleTranslation(entry) || existingEntry.contextTranslation;
    existingEntry.context = vocabNote(entry) || existingEntry.context;
    existingEntry.topic = entry.topic || existingEntry.topic || entry.context || "";
    existingEntry.level = entry.level || existingEntry.level;
    existingEntry.position = entry.position || existingEntry.position;
    saveAcquiredVocab();
    return existingEntry;
  }

  const savedEntry = {
    key,
    hanzi: vocabHanzi(entry),
    vocabulary: entry.vocabulary || vocabHanzi(entry),
    pinyin: vocabPinyin(entry),
    english: vocabEnglish(entry),
    hint: vocabNote(entry),
    contextSentence: vocabExampleSentence(entry),
    contextPinyin: vocabExamplePinyin(entry),
    contextTranslation: vocabExampleTranslation(entry),
    teacherId: teacher?.id || entry.teacherId || null,
    teacherName: teacher?.name || entry.teacherName || "A Tea Story",
    packId: entry.packId || `zh-pack-${String(entry.packNumber || vocabProgress.packNumber).padStart(3, "0")}`,
    packNumber: Number(entry.packNumber || vocabProgress.packNumber),
    position: entry.position || null,
    context: vocabNote(entry),
    topic: entry.topic || entry.context || "",
    level: entry.level || "",
    acquiredAt: Date.now(),
  };
  acquiredVocab.push(savedEntry);
  saveAcquiredVocab();
  if (currentVocabPackWords.length && currentPackCollected().length >= currentVocabPackWords.length) {
    vocabProgress.packNumber += 1;
    vocabProgress.responseCount = 0;
    vocabProgress.nextTeachAt = randomVocabInterval();
    saveVocabProgress();
    currentVocabPack = null;
    currentVocabPackWords = [];
  }
  scheduleRemoteVocabProgressSave();
  return savedEntry;
}

function textContainsVocabEntry(text, entry) {
  const sourceText = String(text || "");
  const normalized = sourceText.toLowerCase();
  const hanzi = entry?.hanzi || entry?.char_trad || entry?.traditional || entry?.vocabulary || "";
  const pinyin = String(entry?.pinyin || entry?.pronunciation || entry?.romanization || "").toLowerCase();
  const english = String(entry?.english || entry?.definition_en || entry?.meaning || entry?.translation || entry?.definition || "").toLowerCase();

  return Boolean(
    (hanzi && sourceText.includes(hanzi)) ||
    (pinyin && normalized.includes(pinyin)) ||
    (english && normalized.includes(english))
  );
}

function collectVocabularyFromText(text, teacherId, options = {}) {
  const teacher = TEACHERS[teacherId] || null;
  const candidates = teacher ? teacher.vocab : allTeacherVocab();
  const learnedEntries = [];

  for (const entry of candidates) {
    if (textContainsVocabEntry(text, entry)) {
      const learnedEntry = addAcquiredVocab(entry, teacher || TEACHERS[entry.teacherId]);
      if (learnedEntry) learnedEntries.push(learnedEntry);
      if (options.firstOnly && learnedEntries.length) break;
    }
  }

  if (vocabPanelOpen) renderVocabularyScroll();
  return learnedEntries;
}

function renderVocabularyScroll() {
  vocabContentEl.replaceChildren();
  const packTitle = currentVocabPack?.title || `Chinese Pack ${String(vocabProgress.packNumber).padStart(3, "0")}`;
  const visiblePackNumber = Number(currentVocabPack?.packNumber || vocabProgress.packNumber || 1);
  const collected = currentPackCollected(visiblePackNumber);
  const packCount = Math.min(100, currentVocabPack?.count || currentVocabPackWords.length || 100);
  const collectedByPosition = new Map();
  const collectedByKey = new Map();
  collected.forEach((entry) => {
    if (entry.position) collectedByPosition.set(Number(entry.position), entry);
    collectedByKey.set(entry.key, entry);
  });

  const statusEl = document.createElement("p");
  statusEl.className = "vocab-empty";
  const isCurrentPack = visiblePackNumber === Number(vocabProgress.packNumber || 1);
  const remainingResponses = Math.max(1, vocabProgress.nextTeachAt - vocabProgress.responseCount);
  const quizNote = collected.length >= packCount ?
    " Pack complete. Yeye's bonsai garden quiz unlocks next." :
    (isCurrentPack ? ` Next word in ${remainingResponses} teacher response${remainingResponses === 1 ? "" : "s"}.` : " Select this scroll later as you progress.");
  statusEl.textContent = `${packTitle}: ${collected.length}/${packCount} words unlocked.${quizNote}`;
  vocabContentEl.appendChild(statusEl);

  if (!currentVocabPackWords.length && collected.length === 0) {
    const emptyEl = document.createElement("p");
    emptyEl.className = "vocab-empty";
    emptyEl.textContent = "Talk with teachers around Taipei to begin filling this scroll.";
    vocabContentEl.appendChild(emptyEl);
  }

  const gridEl = document.createElement("div");
  gridEl.className = "vocab-grid";

  for (let slot = 1; slot <= packCount; slot += 1) {
    const packWord = currentVocabPackWords.find((word) => Number(word.position) === slot);
    const entry = collectedByPosition.get(slot) || (packWord ? collectedByKey.get(packWord.key) : null);
    const cardEl = document.createElement("article");
    cardEl.className = `vocab-card${entry ? "" : " locked"}`;
    cardEl.dataset.slot = String(slot).padStart(2, "0");

    if (!entry) {
      const lockedEl = document.createElement("span");
      lockedEl.className = "vocab-locked-mark";
      lockedEl.textContent = "------";
      cardEl.appendChild(lockedEl);
      gridEl.appendChild(cardEl);
      continue;
    }

    const hanziEl = document.createElement("span");
    hanziEl.className = "vocab-hanzi";
    hanziEl.textContent = entry.hanzi || entry.vocabulary;

    const pinyinEl = document.createElement("span");
    pinyinEl.className = "vocab-pinyin";
    pinyinEl.textContent = entry.pinyin;

    const englishEl = document.createElement("span");
    englishEl.className = "vocab-english";
    englishEl.textContent = entry.english;

    const sourceEl = document.createElement("span");
    sourceEl.className = "vocab-source";
    sourceEl.textContent = entry.position ?
      `Pack ${entry.packNumber}, word ${entry.position}${entry.level ? ` · ${entry.level}` : ""}` :
      `Learned from ${entry.teacherName}`;

    cardEl.append(hanziEl, pinyinEl, englishEl, sourceEl);
    cardEl.role = "button";
    cardEl.tabIndex = 0;
    cardEl.title = "Open flashcard";
    cardEl.addEventListener("click", () => showVocabularyFlashcard(entry));
    cardEl.addEventListener("keydown", (event) => {
      if (event.code !== "Enter" && event.code !== "Space") return;
      event.preventDefault();
      showVocabularyFlashcard(entry);
    });
    gridEl.appendChild(cardEl);
  }

  vocabContentEl.appendChild(gridEl);
}

function renderScrollRack() {
  scrollRackContentEl.replaceChildren();

  const statusEl = document.createElement("p");
  statusEl.className = "scroll-rack-status";
  statusEl.textContent = "Each scroll holds one 100-word Chinese pack. Scroll through all 76 packs to see the full 7,500+ word path.";
  scrollRackContentEl.appendChild(statusEl);

  const gridEl = document.createElement("div");
  gridEl.className = "scroll-rack-grid";

  for (let packNumber = 1; packNumber <= 76; packNumber += 1) {
    const collectedCount = acquiredVocab.filter((entry) => Number(entry.packNumber || 1) === packNumber).length;
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.className = "scroll-pack";
    if (packNumber === Number(vocabProgress.packNumber || 1)) buttonEl.classList.add("current");
    if (collectedCount >= 100) buttonEl.classList.add("complete");
    if (packNumber > Number(vocabProgress.packNumber || 1) && collectedCount === 0) buttonEl.classList.add("locked");
    buttonEl.dataset.pack = String(packNumber);

    const iconEl = document.createElement("span");
    iconEl.className = "scroll-pack-icon";

    const textEl = document.createElement("span");
    const numberEl = document.createElement("span");
    numberEl.className = "scroll-pack-number";
    numberEl.textContent = `Pack ${String(packNumber).padStart(3, "0")}`;

    const titleEl = document.createElement("span");
    titleEl.className = "scroll-pack-title";
    titleEl.textContent = packNumber === Number(vocabProgress.packNumber || 1) ? "Current word pack" : "Chinese vocabulary";

    const progressEl = document.createElement("span");
    progressEl.className = "scroll-pack-progress";
    progressEl.textContent = `${Math.min(collectedCount, 100)}/100 words unlocked`;

    textEl.append(numberEl, titleEl, progressEl);
    buttonEl.append(iconEl, textEl);
    buttonEl.addEventListener("click", () => openVocabularyScroll(packNumber));
    gridEl.appendChild(buttonEl);
  }

  scrollRackContentEl.appendChild(gridEl);
}

function openScrollRack() {
  scrollRackOpen = true;
  hidePrompt();
  hideDialogue();
  closeWordLookup();
  closeTravelPanel();
  closeTeacherChat();
  closeVocabularyScroll();
  renderScrollRack();
  scrollRackPanelEl.classList.remove("hidden");
}

function closeScrollRack() {
  scrollRackOpen = false;
  scrollRackPanelEl.classList.add("hidden");
}

function openMrtMapPanel() {
  mrtMapOpen = true;
  hidePrompt();
  hideDialogue();
  closeWordLookup();
  closeTravelPanel();
  closeTeacherChat();
  closeVocabularyScroll();
  closeScrollRack();
  mrtMapPanelEl.classList.remove("hidden");
}

function closeMrtMapPanel() {
  mrtMapOpen = false;
  mrtMapPanelEl.classList.add("hidden");
}

async function openVocabularyScroll(packNumber = vocabProgress.packNumber) {
  vocabPanelOpen = true;
  hidePrompt();
  hideDialogue();
  closeWordLookup();
  closeTravelPanel();
  closeTeacherChat();
  closeScrollRack();
  closeMrtMapPanel();
  const requestedPack = Math.max(1, Number(packNumber || vocabProgress.packNumber || 1));
  if (!currentVocabPack || Number(currentVocabPack.packNumber || 0) !== requestedPack) {
    try {
      await loadCurrentVocabPack(requestedPack);
    } catch (error) {
      console.warn("Vocabulary pack load failed.", error);
    }
  }
  renderVocabularyScroll();
  vocabPanelEl.classList.remove("hidden");
}

function closeVocabularyScroll() {
  vocabPanelOpen = false;
  vocabPanelEl.classList.add("hidden");
}

function initFlashcardSpeech() {
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const loadVoices = () => {
    speechVoices = synth.getVoices().slice().sort((a, b) => a.name.localeCompare(b.name));
    speechVoicesReady = speechVoices.length > 0;
    updateFlashcardSpeechButton();
  };
  synth.onvoiceschanged = loadVoices;
  loadVoices();
}

function updateFlashcardSpeechButton() {
  if (!flashcardSpeakEl) return;
  const supported = "speechSynthesis" in window;
  flashcardSpeakEl.disabled = !activeFlashcardEntry || !supported || flashcardSpeaking;
  flashcardSpeakEl.textContent = flashcardSpeaking ? "Speaking..." : "Voice";
}

function getPreferredSpeechVoice(lang = "zh-TW") {
  const voices = speechVoices.length && speechVoicesReady ?
    speechVoices :
    ("speechSynthesis" in window ? window.speechSynthesis.getVoices() : []);
  if (!voices.length) return null;

  const byLang = (language, keywords = []) => voices.find((voice) => {
    const voiceLang = String(voice.lang || "");
    const languageMatches = voiceLang === language || voiceLang.startsWith(`${language}-`);
    const keywordMatches = !keywords.length || keywords.some((keyword) => {
      return voice.name.toLowerCase().includes(keyword.toLowerCase());
    });
    return languageMatches && keywordMatches;
  });

  if (lang.startsWith("zh")) {
    return byLang("zh-TW", ["Google"]) ||
      byLang("zh-TW", ["Microsoft"]) ||
      byLang("zh-TW") ||
      voices.find((voice) => /^zh[-_](TW|Hant)/i.test(voice.lang)) ||
      voices.find((voice) => /^zh/i.test(voice.lang)) ||
      null;
  }

  return byLang(lang) || voices.find((voice) => voice.lang?.startsWith(lang.split("-")[0])) || null;
}

function speakChineseText(text, onDone) {
  if (!text || !("speechSynthesis" in window)) {
    if (onDone) onDone();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (onDone) onDone();
    };
    const preferredVoice = getPreferredSpeechVoice("zh-TW");
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = "zh-TW";
    }
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = finish;
    utterance.onerror = finish;
    synth.speak(utterance);
    setTimeout(finish, 3500);
  }, 80);
}

function getFlashcardMainText(entry) {
  return vocabHanzi(entry);
}

function getFlashcardMeta(entry) {
  const pack = Number(entry?.packNumber || vocabProgress.packNumber || 1);
  const position = entry?.position ? `Word ${entry.position}` : "New word";
  const level = entry?.level ? ` · ${entry.level}` : "";
  return `Pack ${String(pack).padStart(3, "0")} · ${position}${level}`;
}

function segmentChineseText(text) {
  const source = String(text || "");
  if (!source) return [];
  try {
    if ("Segmenter" in Intl) {
      return [...new Intl.Segmenter("zh-Hant", { granularity: "word" }).segment(source)]
        .map((part) => part.segment)
        .filter(Boolean);
    }
  } catch (error) {
    console.warn("Chinese segmenter unavailable.", error);
  }
  return [...source];
}

function isChineseText(text) {
  return /[\u3400-\u9fff]/.test(String(text || ""));
}

function renderFlashcardExample(entry, loading = false) {
  flashcardExampleEl.replaceChildren();
  if (loading) {
    flashcardExampleEl.textContent = "Finding a context example...";
    return;
  }

  const sentence = vocabExampleSentence(entry);
  const pinyin = vocabExamplePinyin(entry);
  const translation = vocabExampleTranslation(entry);
  if (!sentence && !pinyin && !translation) {
    flashcardExampleEl.textContent = "Context example coming soon.";
    return;
  }

  const labelEl = document.createElement("span");
  labelEl.className = "flashcard-example-label";
  labelEl.textContent = "Example: ";
  flashcardExampleEl.appendChild(labelEl);

  if (sentence) {
    const sentenceEl = document.createElement("span");
    sentenceEl.className = "flashcard-example-sentence";
    for (const segment of segmentChineseText(sentence)) {
      if (isChineseText(segment)) {
        const tokenEl = document.createElement("span");
        tokenEl.className = "vocab-token";
        tokenEl.role = "button";
        tokenEl.tabIndex = 0;
        tokenEl.textContent = segment;
        tokenEl.title = "Look up this word";
        tokenEl.addEventListener("click", (event) => {
          event.stopPropagation();
          showWordLookup({
            hanzi: segment,
            vocabulary: segment,
            packNumber: entry?.packNumber || vocabProgress.packNumber,
            allowGeneratedTranslation: true,
          });
        });
        tokenEl.addEventListener("keydown", (event) => {
          if (event.code !== "Enter" && event.code !== "Space") return;
          event.preventDefault();
          event.stopPropagation();
          tokenEl.click();
        });
        sentenceEl.appendChild(tokenEl);
      } else {
        sentenceEl.appendChild(document.createTextNode(segment));
      }
    }
    flashcardExampleEl.appendChild(sentenceEl);
  }

  if (pinyin) {
    const pinyinEl = document.createElement("span");
    pinyinEl.className = "flashcard-example-pinyin";
    pinyinEl.textContent = pinyin;
    flashcardExampleEl.appendChild(pinyinEl);
  }

  if (translation) {
    const translationEl = document.createElement("span");
    translationEl.className = "flashcard-example-translation";
    translationEl.textContent = translation;
    flashcardExampleEl.appendChild(translationEl);
  }
}

async function showVocabularyFlashcard(entry) {
  if (!entry) return;
  const requestId = ++activeFlashcardRequest;
  activeFlashcardEntry = entry;
  flashcardPopEl.classList.remove("hidden", "flipped");
  flashcardHanziEl.textContent = getFlashcardMainText(entry);
  flashcardPinyinEl.textContent = vocabPinyin(entry) || "pinyin coming soon";
  flashcardEnglishEl.textContent = vocabEnglish(entry) || "No backend translation yet";
  flashcardNoteEl.textContent = vocabNote(entry) || "Tap Voice to hear it, then flip the card to review.";
  renderFlashcardExample(entry, !vocabExampleText(entry));
  flashcardMetaEl.textContent = getFlashcardMeta(entry);
  updateFlashcardSpeechButton();

  if (vocabEnglish(entry) && vocabExampleSentence(entry) && vocabExamplePinyin(entry) && vocabExampleTranslation(entry)) return;
  try {
    const enrichedEntry = await lookupVocabEntry(entry);
    if (requestId !== activeFlashcardRequest) return;
    activeFlashcardEntry = enrichedEntry;
    flashcardHanziEl.textContent = getFlashcardMainText(enrichedEntry);
    flashcardPinyinEl.textContent = vocabPinyin(enrichedEntry) || "pinyin coming soon";
    flashcardEnglishEl.textContent = vocabEnglish(enrichedEntry) || "No backend translation yet";
    flashcardNoteEl.textContent = vocabNote(enrichedEntry) || "Tap Voice to hear it, then flip the card to review.";
    renderFlashcardExample(enrichedEntry);
    flashcardMetaEl.textContent = getFlashcardMeta(enrichedEntry);
    if (acquiredVocab.some((saved) => vocabHanzi(saved) === vocabHanzi(enrichedEntry))) {
      addAcquiredVocab(enrichedEntry, null);
      if (vocabPanelOpen) renderVocabularyScroll();
    }
    updateFlashcardSpeechButton();
  } catch (error) {
    if (requestId !== activeFlashcardRequest) return;
    console.warn(error);
    renderFlashcardExample(entry);
  }
}

function closeVocabularyFlashcard() {
  activeFlashcardEntry = null;
  activeFlashcardRequest += 1;
  flashcardSpeaking = false;
  flashcardPopEl.classList.add("hidden");
  flashcardPopEl.classList.remove("flipped");
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  updateFlashcardSpeechButton();
}

function speakVocabularyFlashcard() {
  if (!activeFlashcardEntry || !("speechSynthesis" in window)) return;
  const text = getFlashcardMainText(activeFlashcardEntry) || activeFlashcardEntry.pinyin || "";
  if (!text) return;
  flashcardSpeaking = true;
  updateFlashcardSpeechButton();
  speakChineseText(text, () => {
    flashcardSpeaking = false;
    updateFlashcardSpeechButton();
  });
}

function openFlashcardDictionary() {
  const text = getFlashcardMainText(activeFlashcardEntry);
  if (!text) return;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
  const url = isMobile ?
    `plecoapi://x-callback-url/s?q=${encodeURIComponent(text)}` :
    `https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=${encodeURIComponent(text)}`;
  window.open(url, isMobile ? "_self" : "_blank");
}

async function showWordLookup(entry) {
  const requestId = ++activeLookupRequest;
  activeLookupEntry = entry;
  wordLookupHanziEl.textContent = vocabHanzi(entry);
  wordLookupPinyinEl.textContent = vocabPinyin(entry) || "pinyin unavailable";
  wordLookupEnglishEl.textContent = vocabEnglish(entry) || "Looking up translation...";
  wordLookupExampleEl.textContent = vocabExampleText(entry) || "Finding a context example...";
  wordLookupEl.classList.remove("hidden");

  if (vocabEnglish(entry) && vocabExampleText(entry)) return;
  try {
    const enrichedEntry = await lookupVocabEntry(entry);
    if (requestId !== activeLookupRequest) return;
    activeLookupEntry = enrichedEntry;
    wordLookupHanziEl.textContent = vocabHanzi(enrichedEntry);
    wordLookupPinyinEl.textContent = vocabPinyin(enrichedEntry) || "pinyin unavailable";
    wordLookupEnglishEl.textContent = vocabEnglish(enrichedEntry) || "Translation unavailable";
    wordLookupExampleEl.textContent = vocabExampleText(enrichedEntry) || "No context example yet.";
    if (acquiredVocab.some((saved) => vocabHanzi(saved) === vocabHanzi(enrichedEntry))) {
      addAcquiredVocab(enrichedEntry, null);
    }
  } catch (error) {
    if (requestId !== activeLookupRequest) return;
    console.warn(error);
    wordLookupEnglishEl.textContent = vocabEnglish(entry) || "Translation unavailable";
    wordLookupExampleEl.textContent = vocabExampleText(entry) || "No context example yet.";
  }
}

function closeWordLookup() {
  activeLookupEntry = null;
  activeLookupRequest += 1;
  wordLookupEl.classList.add("hidden");
  wordLookupSpeakEl.disabled = false;
  wordLookupSpeakEl.textContent = "Voice";
}

function speakLookupWord() {
  const text = vocabHanzi(activeLookupEntry);
  if (!text) return;
  wordLookupSpeakEl.disabled = true;
  wordLookupSpeakEl.textContent = "Speaking...";
  speakChineseText(text, () => {
    wordLookupSpeakEl.disabled = false;
    wordLookupSpeakEl.textContent = "Voice";
  });
}

function setAuthButtonsDisabled(disabled) {
  loginGoogleEl.disabled = disabled;
  loginContinueEl.disabled = disabled;
  loginOfflineEl.disabled = disabled;
}

function getPlayerLabel(user) {
  return user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    user?.id ||
    "Signed in";
}

function updateAuthUi() {
  const user = authSession?.user;
  if (!authReady) {
    loginStatusEl.textContent = `${authUnavailableMessage}. Offline play is available.`;
    loginGoogleEl.classList.remove("hidden");
    loginContinueEl.classList.add("hidden");
    loginGoogleEl.disabled = true;
    loginContinueEl.disabled = true;
    loginOfflineEl.disabled = false;
    return;
  }

  if (user) {
    loginStatusEl.textContent = `Signed in as ${getPlayerLabel(user)}`;
    loginGoogleEl.classList.add("hidden");
    loginContinueEl.classList.remove("hidden");
    setAuthButtonsDisabled(false);
    return;
  }

  loginStatusEl.textContent = "Sign in to continue";
  loginGoogleEl.classList.remove("hidden");
  loginContinueEl.classList.add("hidden");
  setAuthButtonsDisabled(false);
}

async function initAuth() {
  try {
    setAuthButtonsDisabled(true);
    const response = await fetch(AUTH_CONFIG_API_URL);
    const config = await response.json();
    if (!response.ok || !config.anonKeyConfigured || !config.anonKey) {
      authUnavailableMessage = "Add SUPABASE_ANON_KEY";
      authReady = false;
      updateAuthUi();
      return;
    }
    if (!window.supabase?.createClient) {
      authUnavailableMessage = "Auth library unavailable";
      authReady = false;
      updateAuthUi();
      return;
    }

    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    const { data } = await supabaseClient.auth.getSession();
    authSession = data.session;
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      authSession = session;
      if (session?.access_token) {
        syncRemoteVocabProgress().catch((error) => console.warn("Vocabulary progress sync failed.", error));
      } else {
        vocabProgressRemoteLoaded = false;
      }
      updateAuthUi();
    });
    authReady = true;
    updateAuthUi();
    if (authSession?.access_token) {
      syncRemoteVocabProgress().catch((error) => console.warn("Vocabulary progress sync failed.", error));
    }
    if (hasOAuthReturnParams() && !introDone) {
      showLogin();
    }
  } catch (error) {
    console.warn("Auth init failed.", error);
    authReady = false;
    authUnavailableMessage = "Auth unavailable";
    updateAuthUi();
  }
}

async function signInWithProvider(provider) {
  if (!supabaseClient) return;
  setAuthButtonsDisabled(true);
  loginStatusEl.textContent = "Opening Google sign-in...";
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) {
    console.warn("OAuth sign-in failed.", error);
    loginStatusEl.textContent = "Sign-in failed";
    setAuthButtonsDisabled(false);
  }
}

function getAuthHeaders() {
  const token = authSession?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getPlayerId() {
  return authSession?.user?.id || null;
}

function hasOAuthReturnParams() {
  return /(?:access_token|refresh_token|code|error)=/.test(window.location.hash + window.location.search);
}

function showPrompt(text) {
  interactPromptEl.textContent = text;
  interactPromptEl.classList.remove("hidden");
}

function hidePrompt() {
  interactPromptEl.classList.add("hidden");
}

function showDialogue(npc) {
  activeDialogueNpc = npc;
  dialogueSpeakerEl.textContent = npc.name;
  dialogueLineEl.textContent = npc.line;
  dialogueBoxEl.classList.remove("hidden");
}

function hideDialogue() {
  activeDialogueNpc = null;
  dialogueBoxEl.classList.add("hidden");
}

let travelPanelOpen = false;

function destinationLabel(destination) {
  let city = destination.city;
  if (destination.alternate) city += ` or ${destination.alternate}`;
  if (destination.note) city += ` (${destination.note})`;
  return city;
}

function renderTravelDestinations() {
  travelContentEl.innerHTML = "";
  TRAVEL_DESTINATIONS.forEach((group) => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "travel-category";

    const titleEl = document.createElement("h3");
    titleEl.textContent = group.category;
    sectionEl.appendChild(titleEl);

    const gridEl = document.createElement("div");
    gridEl.className = "travel-grid";

    group.destinations.forEach((destination) => {
      const buttonEl = document.createElement("button");
      buttonEl.type = "button";
      buttonEl.className = "travel-destination";
      buttonEl.dataset.language = destination.language;
      buttonEl.dataset.city = destination.city;

      const languageEl = document.createElement("span");
      languageEl.className = "travel-language";
      languageEl.textContent = destination.language;

      const cityEl = document.createElement("span");
      cityEl.className = "travel-city";
      cityEl.textContent = destinationLabel(destination);

      buttonEl.append(languageEl, cityEl);
      buttonEl.addEventListener("click", () => selectTravelDestination(destination));
      gridEl.appendChild(buttonEl);
    });

    sectionEl.appendChild(gridEl);
    travelContentEl.appendChild(sectionEl);
  });
}

function openTravelPanel() {
  travelPanelOpen = true;
  travelStatusEl.textContent = "Choose a city to begin a language journey.";
  hidePrompt();
  hideDialogue();
  closeWordLookup();
  closeTeacherChat();
  closeVocabularyScroll();
  closeScrollRack();
  travelPanelEl.classList.remove("hidden");
}

function closeTravelPanel() {
  travelPanelOpen = false;
  travelPanelEl.classList.add("hidden");
}

function selectTravelDestination(destination) {
  const city = destinationLabel(destination);
  travelStatusEl.textContent = `Boarding ${destination.language} travel to ${city}.`;
  closeTravelPanel();
  activeTravelDestination = destination;
  scene = "world";
  activeInterior = null;
  savedWorldPos.x = 1900;
  savedWorldPos.y = 500;
  player.x = TRAVEL_RETURN_GATE.x + 120;
  player.y = TRAVEL_RETURN_GATE.y;
  camera.x = 0;
  camera.y = 0;
  hideDialogue();
  hidePrompt();
}

function isTypingInTeacherChat() {
  return teacherChatOpen && document.activeElement === teacherInputEl;
}

function findVocabEntryForText(text, extraEntries = []) {
  const exactText = String(text || "");
  const pools = [
    ...extraEntries,
    ...currentVocabPackWords,
    ...acquiredVocab,
    ...allTeacherVocab(),
  ].filter(Boolean);
  return pools.find((entry) => vocabHanzi(entry) === exactText) ||
    pools.find((entry) => exactText.includes(vocabHanzi(entry)) || vocabHanzi(entry).includes(exactText)) ||
    { hanzi: exactText, vocabulary: exactText, pinyin: "", english: "", hint: "No saved translation yet." };
}

function appendMessageTextWithVocab(parentEl, text, extraEntries = []) {
  const source = String(text || "");
  const pattern = /[\u3400-\u9fff\uf900-\ufaff]+/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parentEl.append(document.createTextNode(source.slice(lastIndex, match.index)));
    }
    const token = match[0];
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.className = "vocab-token";
    buttonEl.textContent = token;
    buttonEl.addEventListener("click", (event) => {
      event.stopPropagation();
      showWordLookup(findVocabEntryForText(token, extraEntries));
    });
    parentEl.appendChild(buttonEl);
    lastIndex = match.index + token.length;
  }
  if (lastIndex < source.length) {
    parentEl.append(document.createTextNode(source.slice(lastIndex)));
  }
}

function addTeacherMessage(speaker, text, vocabEntries = []) {
  const messageEl = document.createElement("p");
  messageEl.className = `teacher-message ${speaker === "You" ? "user" : "teacher"}`;

  const nameEl = document.createElement("span");
  nameEl.className = "name";
  nameEl.textContent = speaker;
  messageEl.appendChild(nameEl);
  if (speaker === "You") {
    messageEl.append(document.createTextNode(text));
  } else {
    appendMessageTextWithVocab(messageEl, text, vocabEntries);
  }

  teacherMessagesEl.appendChild(messageEl);
  teacherMessagesEl.scrollTop = teacherMessagesEl.scrollHeight;
}

function closeTeacherChat() {
  teacherChatOpen = false;
  activeTeacherId = null;
  teacherChatEl.classList.add("hidden");
  teacherInputEl.blur();
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
}
function pickTeacherVocab(teacher, text) {
  const lower = text.toLowerCase();
  const directMatch = teacher.vocab.find((entry) => {
    return lower.includes(entry.english) ||
      lower.includes(entry.pinyin) ||
      text.includes(entry.hanzi) ||
      entry.keywords?.some((keyword) => lower.includes(keyword));
  });
  if (directMatch) return directMatch;

  const entry = teacher.vocab[teacher.turn % teacher.vocab.length];
  teacher.turn += 1;
  return entry;
}

function buildTeacherReply(text) {
  const teacher = TEACHERS[activeTeacherId];
  if (!teacher) throw new Error("No teacher selected");
  const entry = pickTeacherVocab(teacher, text);
  const lower = text.toLowerCase();

  if (/\b(pronounce|say|sound)\b/.test(lower)) {
    return `Say "${entry.hanzi}" like "${entry.pinyin}". It means "${entry.english}". ${entry.hint}`;
  }
  if (/\b(sentence|example|use)\b/.test(lower)) {
    return teacher.exampleReply(entry);
  }
  if (/\b(test|quiz|practice)\b/.test(lower)) {
    return teacher.quizReply(entry);
  }

  return teacher.defaultReply(entry);
}

async function buildBackendTeacherReply(teacherId, text) {
  const teacher = TEACHERS[teacherId];
  if (!teacher) throw new Error("Unknown teacher");
  const history = teacherChatHistory[teacherId] || [];
  const vocabTeachRequest = getVocabTeachRequest();
  const response = await fetch(AGENT_CHAT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      agent: teacher.agentName || teacher.name,
      agentId: teacher.id || teacherId,
      aliases: teacher.aliases || [],
      playerId: getPlayerId(),
      message: text,
      history: history.slice(-8),
      location: activeInterior?.locationName || activeInterior?.theme || scene,
      vocabProgress: vocabTeachRequest,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Backend agent chat request failed");
  }
  const reply = (data.reply || data.message || data.response || data.text || "").trim();
  if (!reply) throw new Error("Backend agent chat returned an empty reply");

  teacherChatHistory[teacherId] = [
    ...history,
    { role: "user", content: text },
    { role: "assistant", content: reply },
  ].slice(-10);
  return { reply, taughtVocab: data.taughtVocab || null };
}

function openTeacherChat(teacherId) {
  const teacher = TEACHERS[teacherId];
  if (!teacher) return;
  activeDialogueNpc = null;
  dialogueBoxEl.classList.add("hidden");
  closeWordLookup();
  closeVocabularyScroll();
  closeScrollRack();
  teacherChatOpen = true;
  activeTeacherId = teacherId;
  teacherTitleEl.textContent = teacher.name;
  teacherInputEl.placeholder = teacher.inputPlaceholder;
  teacherInputEl.setAttribute("aria-label", `Message ${teacher.name}`);
  teacherChatEl.classList.remove("hidden");

  teacherMessagesEl.replaceChildren();
  teacherChatHistory[teacherId] = [];
  teacher.intro.forEach((line) => {
    addTeacherMessage(teacher.name, line);
    collectVocabularyFromText(line, teacherId);
  });

  teacherInputEl.focus();
}

function getInteriorNPCs() {
  return (activeInterior?.npcs || []).filter((npc) => {
    if (npc.requiresUnlock === "bonsaiStaircase") return bonsaiStaircaseUnlocked;
    return true;
  });
}

function getInteriorWallRects() {
  return activeInterior?.wallRects || [];
}

function getInteriorWorldW() {
  return activeInterior?.worldW || INTERIOR_W;
}

function getActiveInteriorExit() {
  if (activeInterior?.theme === "mrtLobby") {
    return { x: 250, y: MRT_LOBBY_WALK_Y, radius: 115 };
  }
  return interiorExit;
}

function findNearbyEntrance() {
  if (activeTravelDestination) return null;
  return locationEntrances.find((entry) => Math.hypot(player.x - entry.x, player.y - entry.y) < entry.radius);
}

function isNearTravelReturnGate() {
  return activeTravelDestination &&
    Math.hypot(player.x - TRAVEL_RETURN_GATE.x, player.y - TRAVEL_RETURN_GATE.y) < TRAVEL_RETURN_GATE.radius;
}

function returnFromTravelMap() {
  activeTravelDestination = null;
  scene = "world";
  activeInterior = null;
  player.x = savedWorldPos.x;
  player.y = savedWorldPos.y;
  camera.x = 0;
  camera.y = 0;
  hidePrompt();
  hideDialogue();
}

function enterLocation(entry) {
  scene = "interior";
  activeInterior = { ...entry.interior, locationName: entry.location.name };
  if (entry.location.name === "Tea House") {
    bonsaiStaircaseUnlocked = false;
    bonsaiStaircaseSlideStart = null;
  }
  savedWorldPos.x = player.x;
  savedWorldPos.y = player.y;
  player.x = activeInterior.theme === "mrtLobby" ? 260 : interiorPlayerStart.x;
  player.y = activeInterior.theme === "mrtLobby" ? MRT_LOBBY_WALK_Y : interiorPlayerStart.y;
  interiorCamera.x = 0;
  hidePrompt();
}

function exitLocation() {
  if (activeInterior?.theme === "bonsaiGarden") {
    returnToTeaHouseFromGarden();
    return;
  }

  scene = "world";
  activeInterior = null;
  player.x = savedWorldPos.x;
  player.y = savedWorldPos.y;
  hidePrompt();
  hideDialogue();
  closeTeacherChat();
}

function enterMRTPlatform() {
  activeInterior = {
    theme: "mrtPlatform",
    locationName: "MRT Platform",
    npcs: [],
  };
  player.x = MRT_PLATFORM_SPAWN.x;
  player.y = MRT_PLATFORM_SPAWN.y;
  interiorCamera.x = 0;
  hidePrompt();
  hideDialogue();
}

function enterBonsaiGarden() {
  activeInterior = { ...locationInteriors["Bonsai Garden"], locationName: "Bonsai Garden" };
  player.x = interiorPlayerStart.x;
  player.y = interiorPlayerStart.y;
  interiorCamera.x = 0;
  hidePrompt();
  hideDialogue();
  closeTeacherChat();
}

function returnToTeaHouseFromGarden() {
  activeInterior = { ...locationInteriors["Tea House"], locationName: "Tea House" };
  bonsaiStaircaseUnlocked = false;
  bonsaiStaircaseSlideStart = null;
  player.x = 1060;
  player.y = 300;
  interiorCamera.x = 0;
  hidePrompt();
  hideDialogue();
}

function unlockBonsaiStaircase(vaseNpc) {
  if (!bonsaiStaircaseUnlocked) {
    bonsaiStaircaseUnlocked = true;
    bonsaiStaircaseSlideStart = performance.now();
  }
  showDialogue(vaseNpc || {
    name: "Painted Vase",
    line: "The vase clicks softly. A hidden staircase slides into place, opening the way to the Bonsai Garden.",
  });
}

function rectOverlapsCircle(rx, ry, rw, rh, cx, cy, radius) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

const interiorWallRects = [
  { x: interiorWall.x, y: 0, w: interiorWall.width, h: interiorWall.gapTop },
  { x: interiorWall.x, y: interiorWall.gapBottom, w: interiorWall.width, h: INTERIOR_H - interiorWall.gapBottom },
];

const locationInteriors = {
  "Tea House": {
    theme: "teaHouse",
    wallRects: interiorWallRects,
    npcs: [
      {
        name: "Painted Vase",
        x: 510,
        y: 145,
        radius: 95,
        hideLabel: true,
        prompt: "Press E to inspect the vase",
        action: "unlockBonsaiStaircase",
        line: "The vase clicks softly. A hidden staircase slides into place, opening the way to the Bonsai Garden.",
      },
      {
        name: "Bonsai Garden Stairs",
        x: 1170,
        y: 220,
        radius: 105,
        hideLabel: true,
        requiresUnlock: "bonsaiStaircase",
        prompt: "Press E to visit the Bonsai Garden",
        action: "bonsaiGarden",
        line: "A narrow staircase leads to a quiet garden upstairs.",
      },
    ],
  },
  Home: {
    theme: "home",
    npcs: [
      {
        name: "Language Scrolls",
        x: 365,
        y: 535,
        radius: 105,
        hideLabel: true,
        prompt: "Press E to review your language scrolls",
        action: "openScrollRack",
        line: "Your language scrolls will live here. Soon this shelf can track learned words, practice streaks, and phrases collected from each character.",
      },
    ],
  },
  "MRT Station": {
    theme: "mrtLobby",
    worldW: MRT_LOBBY_W,
    npcs: [
      {
        name: "小陳",
        x: 1120,
        y: MRT_LOBBY_WALK_Y,
        radius: 110,
        hideLabel: true,
        prompt: "Press E to ask 小陳 about Mandarin",
        chat: "xiaochen",
        line: "Need a ticket, an EasyCard, or a new word for the station?",
      },
      {
        name: "MRT Turnstile",
        x: 1345,
        y: MRT_LOBBY_WALK_Y,
        radius: 155,
        hideLabel: true,
        prompt: "Press E to tap through the turnstile",
        action: "mrtPlatform",
        line: "Tap your EasyCard and head down to the platform.",
      },
      {
        name: "Taipei MRT Map",
        x: 465,
        y: MRT_LOBBY_WALK_Y,
        radius: 125,
        hideLabel: true,
        prompt: "Press E to inspect the Taipei MRT map",
        action: "openMrtMap",
        line: "A full Taipei MRT map is mounted on the station stand.",
      },
      {
        name: "MRT Rules Sign",
        x: 700,
        y: MRT_LOBBY_WALK_Y,
        radius: 85,
        hideLabel: true,
        style: "mrtRulesSign",
        prompt: "Press E to read the MRT rules",
        line: [
          "MRT Rules",
          "",
          "No eating or drinking after crossing the yellow fare-gate line. This includes water, gum, and breath mints. Fines can reach NT$7,500. Seal drinks or keep them in a bag.",
          "",
          "No smoking or e-cigarettes anywhere in MRT stations or trains.",
          "",
          "Keep doorways clear. Do not lean on train doors; they may open on either side.",
          "",
          "No flammable goods, hazardous materials, or oversized items without approval.",
        ].join("\n"),
      },
    ],
  },
  "Convenience Store": {
    theme: "convenienceStore",
    npcs: [
      {
        name: "阿德",
        x: 935,
        y: 590,
        radius: 150,
        hideLabel: true,
        prompt: "Press E to chat with 阿德",
        chat: "ade",
        line: "Need a receipt, a bag, or a quick word at the counter?",
      },
    ],
  },
  "Izakaya": {
    theme: "izakaya",
    wallRects: [],
    npcs: [],
  },
  Airport: {
    theme: "airport",
    npcs: [],
  },
  "Temple": {
    theme: "temple",
    npcs: [
      {
        name: "觀音 (Guanyin)",
        x: 325,
        y: 360,
        radius: 75,
        hideLabel: true,
        autoDialogue: true,
        line: "觀音 (Guānyīn) is the bodhisattva of compassion. People pray to Guanyin for mercy, protection, healing, and help in difficult moments.\nVocabulary: 神 (shén) = deity/spirit; 慈悲 (cíbēi) = compassion; 保佑 (bǎoyòu) = to bless or protect.",
      },
      {
        name: "關羽 (Guanyu)",
        x: 535,
        y: 360,
        radius: 75,
        hideLabel: true,
        autoDialogue: true,
        line: "關羽 (Guānyǔ) is honored as a deity of loyalty, righteousness, courage, and protection. You may see him in temples, shops, and police stations.\nVocabulary: 義氣 (yìqì) = loyalty/righteousness; 勇氣 (yǒngqì) = courage; 武神 (wǔshén) = martial deity.",
      },
      {
        name: "媽祖 (Mazu)",
        x: 745,
        y: 360,
        radius: 75,
        hideLabel: true,
        autoDialogue: true,
        line: "媽祖 (Māzǔ) is the sea goddess and one of Taiwan's most beloved deities. People ask her to protect travelers, fishermen, families, and whole communities.\nVocabulary: 海 (hǎi) = sea; 平安 (píng'ān) = peace/safety; 廟 (miào) = temple.",
      },
      {
        name: "土地公 (Tudigong)",
        x: 955,
        y: 360,
        radius: 75,
        hideLabel: true,
        autoDialogue: true,
        line: "土地公 (Tǔdìgōng) is the local earth god, a neighborhood guardian connected with land, prosperity, harvests, and everyday household blessings.\nVocabulary: 土地 (tǔdì) = land; 福 (fú) = good fortune; 拜拜 (bàibài) = to worship/pray.",
      },
    ],
  },
  "Soy Milk Shop": {
    theme: "soymilkShop",
    npcs: [],
  },
  "Night Market": {

    theme: "nightMarket",

    worldW: NIGHT_MARKET_W,

    npcs: [],

  },
  "Supermarket": {
    theme: "supermarket",
    npcs: [],
  },
  "River Boat": {
    theme: "riverBoat",
    npcs: [],
  },
  "Bonsai Garden": {
    theme: "bonsaiGarden",
    locationName: "Bonsai Garden",
    npcs: [],
  },
};

const locationEntrances = locations.map((location) => ({
  location,
  x: location.x + (entranceSpecs[location.name]?.dx || 0),
  y: location.y + (entranceSpecs[location.name]?.dy || 0),
  radius: entranceSpecs[location.name]?.radius || Math.max(150, location.w * 0.28),
  interior: locationInteriors[location.name],
})).concat([
  {
    location: { name: "River Boat" },
    x: RIVER_WIDTH + 20,
    y: wharf.y,
    radius: 135,
    interior: locationInteriors["River Boat"],
  },
]);

// ---- player ---------------------------------------------------------------

const player = {
  x: 700,
  y: WORLD_H - 250,
  radius: 50,
  speed: 660,
  dirX: 0,
  dirY: 1,
  sprite: null,
  walkCycle: 0,
  moving: false,
};

const keys = {};
window.addEventListener("keydown", (e) => {
  if (mrtMapOpen) {
    if (e.code === "Escape" || e.code === "KeyE") closeMrtMapPanel();
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  if (scrollRackOpen) {
    if (e.code === "Escape" || e.code === "KeyE") closeScrollRack();
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  if (vocabPanelOpen) {
    if (e.code === "Escape" || e.code === "KeyE") closeVocabularyScroll();
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  if (travelPanelOpen) {
    if (e.code === "Escape" || e.code === "KeyE") closeTravelPanel();
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  if (isTypingInTeacherChat()) return;
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => {
  if (isTypingInTeacherChat()) return;
  keys[e.key.toLowerCase()] = false;
});

function updatePlayer(dt) {
  if (travelPanelOpen || vocabPanelOpen || scrollRackOpen || mrtMapOpen) {
    player.moving = false;
    return;
  }

  let dx = 0;
  let dy = 0;
  if (keys["arrowleft"] || keys["a"]) dx -= 1;
  if (keys["arrowright"] || keys["d"]) dx += 1;
  if (keys["arrowup"] || keys["w"]) dy -= 1;
  if (keys["arrowdown"] || keys["s"]) dy += 1;
  if (activeInterior?.theme === "mrtLobby") {
    dy = 0;
  }

  player.moving = dx !== 0 || dy !== 0;

  if (player.moving) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.dirX = dx;
    player.dirY = dy;

    let nx = player.x + dx * player.speed * dt;
    let ny = player.y + dy * player.speed * dt;

    // keep player out of the river and inside the world
    nx = Math.max(RIVER_WIDTH + player.radius, Math.min(WORLD_W - player.radius, nx));
    ny = Math.max(player.radius, Math.min(WORLD_H - player.radius, ny));

    player.x = nx;
    player.y = ny;

    player.walkCycle += dt * 9;
  }
}

function updateCamera() {
  camera.x = Math.max(0, Math.min(WORLD_W - W, player.x - W / 2));
  camera.y = Math.max(0, Math.min(WORLD_H - H, player.y - H / 2));
}

function updateInteriorPlayer(dt) {
  if (vocabPanelOpen || scrollRackOpen || mrtMapOpen) {
    player.moving = false;
    return;
  }

  let dx = 0;
  let dy = 0;
  if (keys["arrowleft"] || keys["a"]) dx -= 1;
  if (keys["arrowright"] || keys["d"]) dx += 1;
  if (keys["arrowup"] || keys["w"]) dy -= 1;
  if (keys["arrowdown"] || keys["s"]) dy += 1;

  player.moving = dx !== 0 || dy !== 0;
  if (!player.moving) return;

  const len = Math.hypot(dx, dy);
  dx /= len;
  dy /= len;
  player.dirX = dx;
  player.dirY = dy;

    let nx = player.x + dx * player.speed * dt;
    let ny = player.y + dy * player.speed * dt;
    nx = Math.max(player.radius, Math.min(getInteriorWorldW() - player.radius, nx));
    ny = Math.max(player.radius, Math.min(INTERIOR_H - player.radius, ny));
    if (activeInterior?.theme === "nightMarket") {
      ny = Math.max(NIGHT_MARKET_ROAD_TOP, Math.min(NIGHT_MARKET_ROAD_BOTTOM, ny));
    } else if (activeInterior?.theme === "mrtLobby") {
      ny = MRT_LOBBY_WALK_Y;
    } else if (activeInterior?.theme === "mrtPlatform") {
      ny = Math.max(MRT_PLATFORM_WALK_TOP, ny);
    }

    const wallRects = getInteriorWallRects();
  const blockedX = wallRects.some((r) => rectOverlapsCircle(r.x, r.y, r.w, r.h, nx, player.y, player.radius));
  const blockedY = wallRects.some((r) => rectOverlapsCircle(r.x, r.y, r.w, r.h, player.x, ny, player.radius));
  if (!blockedX) player.x = nx;
  if (!blockedY) player.y = ny;

  player.walkCycle += dt * 9;
}

function updateInteriorCamera() {
  const maxX = Math.max(0, getInteriorWorldW() - W);
  interiorCamera.x = Math.max(0, Math.min(maxX, player.x - W / 2));
}

// checks proximity to location doors / interior NPCs and exits, and
// keeps the on-screen prompt + dialogue box in sync
function updateInteraction() {
  if (travelPanelOpen) {
    hidePrompt();
    return;
  }

  if (activeTravelDestination) {
    if (isNearTravelReturnGate()) showPrompt("Press E to return to Taipei Airport");
    else hidePrompt();
    return;
  }

  if (scene === "world") {
    const entrance = findNearbyEntrance();
    if (entrance?.location.name === "Airport") showPrompt("Press E to choose a flight");
    else if (entrance) showPrompt(`Press E to enter the ${entrance.location.name}`);
    else hidePrompt();
    return;
  }

  // interior
  const nearNpc = getInteriorNPCs().find((npc) => Math.hypot(player.x - npc.x, player.y - npc.y) < npc.radius + 60);
  const activeExit = getActiveInteriorExit();
  const nearExit = Math.hypot(player.x - activeExit.x, player.y - activeExit.y) < activeExit.radius;

  if (nearNpc) showPrompt(nearNpc.prompt || `Press E to talk to ${nearNpc.name}`);
  else if (nearExit) showPrompt(`Press E to leave the ${activeInterior?.locationName || "location"}`);
  else hidePrompt();

  if (nearNpc?.autoDialogue && activeDialogueNpc !== nearNpc) {
    hidePrompt();
    showDialogue(nearNpc);
  }

  if (activeDialogueNpc && activeDialogueNpc !== nearNpc) hideDialogue();
  if (teacherChatOpen && nearNpc?.chat !== activeTeacherId) closeTeacherChat();
}

// ---- drawing ----------------------------------------------------------

const asphaltPattern = (() => {
  const tile = document.createElement("canvas");
  tile.width = 160;
  tile.height = 160;
  const pctx = tile.getContext("2d");

  pctx.fillStyle = "#2c3032";
  pctx.fillRect(0, 0, tile.width, tile.height);

  for (let i = 0; i < 1250; i++) {
    const x = (i * 47) % tile.width;
    const y = (i * 83 + Math.floor(i / 7) * 19) % tile.height;
    const shade = 35 + ((i * 29) % 95);
    const alpha = 0.22 + ((i * 13) % 40) / 160;
    const w = 1 + (i % 4);
    const h = 1 + ((i * 3) % 3);

    pctx.save();
    pctx.translate(x, y);
    pctx.rotate(((i * 31) % 180) * Math.PI / 180);
    pctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 6},${alpha})`;
    pctx.fillRect(-w / 2, -h / 2, w, h);
    pctx.restore();
  }

  for (let i = 0; i < 170; i++) {
    const x = (i * 71) % tile.width;
    const y = (i * 41 + 23) % tile.height;
    const length = 5 + (i % 7);

    pctx.save();
    pctx.translate(x, y);
    pctx.rotate(((i * 67) % 180) * Math.PI / 180);
    pctx.strokeStyle = i % 3 === 0 ? "rgba(190,194,204,0.22)" : "rgba(12,15,17,0.28)";
    pctx.lineWidth = 1;
    pctx.beginPath();
    pctx.moveTo(-length / 2, 0);
    pctx.lineTo(length / 2, 0);
    pctx.stroke();
    pctx.restore();
  }

  return ctx.createPattern(tile, "repeat");
})();

function drawBackground(t) {
  // asphalt ground on the city side
  ctx.fillStyle = asphaltPattern || "#2c3032";
  ctx.fillRect(RIVER_WIDTH, 0, WORLD_W - RIVER_WIDTH, WORLD_H);

  const asphaltShade = ctx.createLinearGradient(RIVER_WIDTH, 0, WORLD_W, WORLD_H);
  asphaltShade.addColorStop(0, "rgba(255,255,255,0.05)");
  asphaltShade.addColorStop(0.45, "rgba(0,0,0,0)");
  asphaltShade.addColorStop(1, "rgba(0,0,0,0.14)");
  ctx.fillStyle = asphaltShade;
  ctx.fillRect(RIVER_WIDTH, 0, WORLD_W - RIVER_WIDTH, WORLD_H);

  // river
  const riverGrad = ctx.createLinearGradient(0, 0, RIVER_WIDTH, 0);
  riverGrad.addColorStop(0, "#1f5d8c");
  riverGrad.addColorStop(1, "#3a86c8");
  ctx.fillStyle = riverGrad;
  ctx.fillRect(0, 0, RIVER_WIDTH, WORLD_H);

  // river current ripples — two layers scrolling downstream at different
  // speeds/opacities to sell a flowing current
  const flowLayers = [
    { speed: 60, spacing: 50, alpha: 0.15, lineWidth: 2 },
    { speed: 95, spacing: 70, alpha: 0.1, lineWidth: 3 },
  ];
  flowLayers.forEach((layer) => {
    const offset = (t * layer.speed) % layer.spacing;
    ctx.strokeStyle = `rgba(255,255,255,${layer.alpha})`;
    ctx.lineWidth = layer.lineWidth;
    for (let y = -layer.spacing + offset; y < WORLD_H; y += layer.spacing) {
      ctx.beginPath();
      ctx.moveTo(10, y + 20);
      ctx.quadraticCurveTo(RIVER_WIDTH / 2, y, RIVER_WIDTH - 10, y + 20);
      ctx.stroke();
    }
  });

  // riverbank edge
  ctx.fillStyle = "#3f3a2e";
  ctx.fillRect(RIVER_WIDTH - 6, 0, 6, WORLD_H);
}

function drawParks(t) {
  parks.forEach((park) => {
    const grassGrad = ctx.createRadialGradient(
      park.x - park.rx * 0.25,
      park.y - park.ry * 0.35,
      park.rx * 0.15,
      park.x,
      park.y,
      Math.max(park.rx, park.ry)
    );
    grassGrad.addColorStop(0, "#7fba55");
    grassGrad.addColorStop(0.55, "#5f9f45");
    grassGrad.addColorStop(1, "#3f7c38");

    ctx.beginPath();
    ctx.ellipse(park.x, park.y, park.rx, park.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = grassGrad;
    ctx.fill();

    ctx.save();
    ctx.clip();

    ctx.strokeStyle = "rgba(235,255,185,0.28)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 110; i++) {
      const angle = (i * 137.5 * Math.PI) / 180;
      const r = Math.sqrt(((i * 29) % 110) / 110);
      const x = park.x + Math.cos(angle) * r * park.rx;
      const y = park.y + Math.sin(angle) * r * park.ry;
      const blade = 10 + (i % 5) * 3;
      const wind = Math.sin(t * 2.2 + i * 0.42 + park.x * 0.01) * 5;
      const lean = wind + Math.sin(y * 0.025 + t * 1.4) * 2;
      ctx.beginPath();
      ctx.moveTo(x, y + blade * 0.35);
      ctx.quadraticCurveTo(
        x + ((i % 2) ? 5 : -5) + lean * 0.45,
        y - blade * 0.2,
        x + ((i % 3) - 1) * 4 + lean,
        y - blade
      );
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(32,88,35,0.22)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      const angle = (i * 113 * Math.PI) / 180;
      const r = Math.sqrt(((i * 37) % 70) / 70);
      const x = park.x + Math.cos(angle) * r * park.rx;
      const y = park.y + Math.sin(angle) * r * park.ry;
      const blade = 14 + (i % 4) * 4;
      const wind = Math.sin(t * 2.6 + i * 0.55 + park.y * 0.008) * 7;
      ctx.beginPath();
      ctx.moveTo(x, y + blade * 0.25);
      ctx.quadraticCurveTo(x + wind * 0.35, y - blade * 0.35, x + wind, y - blade);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(33,82,34,0.18)";
    for (let i = 0; i < 180; i++) {
      const angle = (i * 137.5 * Math.PI) / 180;
      const r = Math.sqrt(i / 180);
      const x = park.x + Math.cos(angle) * r * park.rx;
      const y = park.y + Math.sin(angle) * r * park.ry;
      ctx.fillRect(x, y, 4 + (i % 3), 3 + (i % 2));
    }

    ctx.fillStyle = "rgba(184,225,94,0.38)";
    for (let i = 0; i < 42; i++) {
      const angle = (i * 91 * Math.PI) / 180;
      const r = Math.sqrt(((i * 17) % 42) / 42) * 0.92;
      const x = park.x + Math.cos(angle) * r * park.rx;
      const y = park.y + Math.sin(angle) * r * park.ry;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.arc(x + 4, y + 1, 2, 0, Math.PI * 2);
      ctx.arc(x + 1, y + 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    ctx.strokeStyle = "rgba(39,92,38,0.45)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(park.x, park.y, park.rx, park.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawBanyanTrees() {
  if (!itemImages.tree.complete || itemImages.tree.naturalWidth === 0) return;

  banyanTrees.forEach((tree) => {
    const { w, h } = footprint(itemImages.tree, tree.w);
    ctx.drawImage(itemImages.tree, tree.x - w / 2, tree.y - h, w, h);
  });
}

// traces a smoothed line through a list of [x, y] points (used for both
// the street network and the winding MRT line)
function tracePath(points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last[0], last[1]);
}

function drawRoads() {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  roads.forEach((points) => {
    tracePath(points);
    ctx.strokeStyle = "#3c3c3a";
    ctx.lineWidth = 56;
    ctx.stroke();
  });

  roads.forEach((points) => {
    tracePath(points);
    ctx.setLineDash([18, 18]);
    ctx.strokeStyle = "#d8c24a";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function drawMRTTrack() {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // shadow, suggesting the line is elevated above the street
  tracePath(mrtTrack);
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 42;
  ctx.lineDashOffset = 0;
  ctx.save();
  ctx.translate(0, 8);
  tracePath(mrtTrack);
  ctx.stroke();
  ctx.restore();

  // track bed
  tracePath(mrtTrack);
  ctx.strokeStyle = "#8c8a86";
  ctx.lineWidth = 34;
  ctx.stroke();

  // sleepers, as a dashed line down the middle of the bed
  tracePath(mrtTrack);
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 30;
  ctx.stroke();
  ctx.setLineDash([]);

  // rails
  tracePath(mrtTrack);
  ctx.strokeStyle = "#b3322a";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawNPC(npc) {
  ctx.save();
  if (npc.clipRect) {
    ctx.beginPath();
    ctx.rect(npc.clipRect.x, npc.clipRect.y, npc.clipRect.w, npc.clipRect.h);
    ctx.clip();
  }
  ctx.translate(npc.x, npc.y);
  if (npc.img && npc.img.complete && npc.img.naturalWidth > 0) {
    const w = npc.drawW || npc.radius * 2.4;
    const h = (w * npc.img.naturalHeight) / npc.img.naturalWidth;
    ctx.drawImage(npc.img, -w / 2, -h, w, h);
  } else if (npc.style === "stationAttendant") {
    ctx.fillStyle = "#24384d";
    ctx.fillRect(-23, -86, 46, 62);
    ctx.fillStyle = "#5c7897";
    ctx.fillRect(-27, -88, 54, 13);
    ctx.fillStyle = "#f0c7a8";
    ctx.beginPath();
    ctx.arc(0, -106, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2524";
    ctx.beginPath();
    ctx.arc(0, -113, 20, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f3dba0";
    ctx.fillRect(-15, -68, 30, 8);
    ctx.fillStyle = "#1b2838";
    ctx.fillRect(-20, -24, 16, 42);
    ctx.fillRect(4, -24, 16, 42);
  } else if (npc.style === "mrtRulesSign") {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(-105, -242, 210, 234);
    ctx.fillStyle = "#34434b";
    ctx.fillRect(-100, -248, 200, 226);
    ctx.fillStyle = "#f4ead8";
    ctx.fillRect(-92, -240, 184, 210);
    ctx.fillStyle = "#2f6fb2";
    ctx.fillRect(-92, -240, 184, 36);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 19px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MRT RULES", 0, -216);
    ctx.fillStyle = "#293640";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("No food or drinks", -76, -184);
    ctx.fillText("No smoking or vaping", -76, -150);
    ctx.fillText("Keep doorways clear", -76, -116);
    ctx.fillText("Follow staff instructions", -76, -82);
    ctx.strokeStyle = "#b8aa91";
    ctx.lineWidth = 1;
    [-171, -137, -103].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(-76, y);
      ctx.lineTo(76, y);
      ctx.stroke();
    });
    ctx.fillStyle = "#8c2030";
    ctx.fillRect(-10, -18, 20, 18);
  }
  ctx.restore();

  if (npc.hideLabel) return;

  ctx.fillStyle = "rgba(20,14,10,0.75)";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  const labelW = ctx.measureText(npc.name).width + 14;
  const spriteH = npc.img && npc.img.naturalWidth > 0 ? (npc.drawW ? (npc.drawW * npc.img.naturalHeight) / npc.img.naturalWidth : npc.radius * 4) : npc.radius * 4;
  const labelY = npc.y - spriteH - 24;
  ctx.fillRect(npc.x - labelW / 2, labelY, labelW, 18);
  ctx.fillStyle = "#f3dba0";
  ctx.fillText(npc.name, npc.x, labelY + 13);
}

function drawExitMat() {
  const activeExit = getActiveInteriorExit();
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(activeExit.x - 60, activeExit.y - 35, 120, 70);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(activeExit.x - 60, activeExit.y - 35, 120, 70);
}

function drawInteriorLabel(text, bg = "#263544", fg = "#f3dba0") {
  const xOffset = scene === "interior" ? interiorCamera.x : 0;
  ctx.fillStyle = bg;
  ctx.fillRect(xOffset + 455, 28, 370, 48);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(xOffset + 455, 28, 370, 48);
  ctx.fillStyle = fg;
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, xOffset + 640, 60);
}

function drawStoreShelves(color, accent) {
  ctx.fillStyle = color;
  [170, 360, 550].forEach((x) => {
    ctx.fillRect(x, 150, 80, 420);
    ctx.fillStyle = accent;
    for (let y = 190; y < 540; y += 70) ctx.fillRect(x + 10, y, 60, 12);
    ctx.fillStyle = color;
  });
}

function drawConvenienceStoreAisles() {
  if (itemImages.aisles.complete && itemImages.aisles.naturalWidth > 0) {
    drawSpriteRegion(itemImages.aisles, { x: 226, y: 110, w: 2460, h: 1037 }, 26, 64, 565);
  } else {
    drawStoreShelves("#34495e", "#f1c40f");
    if (itemImages.aisles.missing) {
      ctx.fillStyle = "#263544";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("missing assets/items/aisles.png", 130, 620);
    }
  }
}

function drawTempleAltar() {
  const altarY = 255;
  const altarX = 170;
  const altarW = 980;
  const altarH = 110;

  ctx.fillStyle = "#4f2518";
  ctx.fillRect(altarX + 24, altarY + 42, altarW - 48, altarH - 20);
  ctx.fillStyle = "#8c2030";
  ctx.fillRect(altarX, altarY, altarW, 58);
  ctx.fillStyle = "#e8b23a";
  ctx.fillRect(altarX + 18, altarY + 10, altarW - 36, 10);
  ctx.fillRect(altarX + 18, altarY + 40, altarW - 36, 8);
  ctx.fillStyle = "#2d1712";
  ctx.fillRect(altarX + 30, altarY + 58, altarW - 60, 20);

  [altarX + 115, altarX + 345, altarX + 635, altarX + 865].forEach((x) => {
    ctx.fillStyle = "#e8b23a";
    ctx.fillRect(x - 48, altarY + 82, 96, 14);
    ctx.fillStyle = "#2d1712";
    ctx.fillRect(x - 42, altarY + 96, 84, 12);
    ctx.fillStyle = "#6b2a1e";
    ctx.fillRect(x - 34, altarY + 108, 68, 40);
  });

  const statues = [
    { img: itemImages.guanyin, x: 325, baseY: altarY + 40, h: 165 },
    { img: itemImages.guanyu, x: 535, baseY: altarY + 40, h: 172 },
    { img: itemImages.mazu, x: 745, baseY: altarY + 40, h: 165 },
    { img: itemImages.tudigong, x: 955, baseY: altarY + 40, h: 162 },
  ];

  statues.forEach(({ img, x, baseY, h }) => {
    if (img.complete && img.naturalWidth > 0) {
      const w = (h * img.naturalWidth) / img.naturalHeight;
      ctx.drawImage(img, x - w / 2, baseY - h, w, h);
    } else {
      ctx.fillStyle = "#d6d0c4";
      ctx.fillRect(x - 35, baseY - h, 70, h);
    }
  });

  ctx.fillStyle = "#b33a24";
  [430, 640, 850].forEach((x) => {
    ctx.fillRect(x - 5, altarY + 8, 10, 45);
    ctx.fillStyle = "#f4d36b";
    ctx.beginPath();
    ctx.arc(x, altarY + 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b33a24";
  });
}

function drawSteamPlumes(t, source) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < 7; i++) {
    const rise = (t * (0.22 + i * 0.025) + i * 0.17 + source.x * 0.001) % 1;
    const baseX = source.x + (i - 3) * source.spacing;
    const y = source.y - rise * source.height;
    const drift = Math.sin(t * 0.95 + i * 1.7) * 8;
    const alpha = Math.sin(rise * Math.PI) * 0.18;

    ctx.strokeStyle = `rgba(245,246,235,${alpha})`;
    ctx.lineWidth = 3.2 - (i % 3) * 0.35;
    ctx.beginPath();
    ctx.moveTo(baseX, y);
    ctx.bezierCurveTo(
      baseX + drift,
      y - source.height * 0.12,
      baseX - drift * 0.7,
      y - source.height * 0.25,
      baseX + drift * 0.45,
      y - source.height * 0.38
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawSizzleFlecks(t, source) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < 18; i++) {
    const phase = (t * (0.9 + (i % 5) * 0.12) + i * 0.19) % 1;
    const x = source.x - source.w / 2 + ((i * 31) % source.w);
    const y = source.y - phase * 22 + Math.sin(t * 3 + i) * 2;
    const alpha = Math.sin(phase * Math.PI) * 0.28;
    ctx.fillStyle = i % 3 === 0 ? `rgba(255,190,75,${alpha})` : `rgba(255,239,171,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.4 + (i % 3) * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawHeatShimmer(t, source) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(255,218,139,0.14)";
  ctx.lineWidth = 2;

  for (let i = 0; i < 5; i++) {
    const x = source.x - source.w / 2 + i * (source.w / 4);
    const wobble = Math.sin(t * 2.2 + i * 1.4) * 5;
    ctx.beginPath();
    ctx.moveTo(x, source.y);
    ctx.quadraticCurveTo(x + wobble, source.y - 18, x - wobble * 0.6, source.y - 36);
    ctx.stroke();
  }

  ctx.restore();
}

function drawNightMarketStandEffects(t, entry, i) {
  const steamSources = [
    { x: entry.x - 108, y: entry.y + 47, height: 74, spacing: 14 },
    { x: entry.x + 64, y: entry.y + 42, height: 66, spacing: 13 },
  ];
  const hotPlates = [
    { x: entry.x - 62, y: entry.y + 66, w: 150 },
    { x: entry.x + 65, y: entry.y + 62, w: 118 },
  ];

  steamSources.forEach((source) => drawSteamPlumes(t + i * 0.28, source));
  hotPlates.forEach((source) => {
    drawSizzleFlecks(t + i * 0.22, source);
    drawHeatShimmer(t + i * 0.31, source);
  });
}

function drawThemedInterior(t = 0) {
  const theme = activeInterior?.theme || "teaHouse";
  const title = activeInterior?.locationName || "Location";

  if (theme === "mrtLobby") {
    const lobbyW = getInteriorWorldW();
    ctx.fillStyle = "#9ba1a6";
    ctx.fillRect(0, 0, lobbyW, INTERIOR_H);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let x = 0; x < lobbyW; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, INTERIOR_H);
      ctx.stroke();
    }
    for (let y = 0; y < INTERIOR_H; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(INTERIOR_W, y);
      ctx.stroke();
    }

    if (itemImages.mrtStation.complete && itemImages.mrtStation.naturalWidth > 0) {
      const stationW = 1040;
      const stationH = (stationW * itemImages.mrtStation.naturalHeight) / itemImages.mrtStation.naturalWidth;
      ctx.drawImage(itemImages.mrtStation, 830, 755 - stationH, stationW, stationH);
    } else {
      ctx.fillStyle = "#2f6fb2";
      ctx.fillRect(830, 120, 320, 90);
      ctx.fillStyle = "#eef5ff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MRT", 990, 175);
      ctx.fillStyle = "#6c7a86";
      [1360, 1440, 1520].forEach((x) => ctx.fillRect(x, 180, 42, 140));
      ctx.fillStyle = "#2e8b57";
      ctx.fillRect(1358, 168, 206, 18);
    }

    const mapX = 350;
    const mapY = 180;
    const mapW = 220;
    const mapH = 295;
    const standFloorY = MRT_LOBBY_WALK_Y + 22;
    ctx.fillStyle = "rgba(30,34,36,0.5)";
    ctx.fillRect(mapX + 18, standFloorY + 8, mapW - 36, 16);
    ctx.fillStyle = "#667981";
    ctx.fillRect(mapX + 34, mapY + mapH + 8, 10, standFloorY - (mapY + mapH + 8));
    ctx.fillRect(mapX + mapW - 44, mapY + mapH + 8, 10, standFloorY - (mapY + mapH + 8));
    ctx.fillStyle = "#455861";
    ctx.fillRect(mapX + 20, standFloorY, mapW - 40, 14);
    ctx.fillStyle = "rgba(20,24,28,0.35)";
    ctx.fillRect(mapX + 10, mapY + 12, mapW, mapH);
    ctx.fillStyle = "#f4ead8";
    ctx.fillRect(mapX - 10, mapY - 10, mapW + 20, mapH + 20);
    ctx.strokeStyle = "#2f6fb2";
    ctx.lineWidth = 6;
    ctx.strokeRect(mapX - 10, mapY - 10, mapW + 20, mapH + 20);
    if (itemImages.mrtMap.complete && itemImages.mrtMap.naturalWidth > 0) {
      ctx.drawImage(itemImages.mrtMap, mapX, mapY, mapW, mapH);
    } else {
      ctx.fillStyle = "#eadfc9";
      ctx.fillRect(mapX, mapY, mapW, mapH);
      ctx.fillStyle = "#2f6fb2";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MRT MAP", mapX + mapW / 2, mapY + mapH / 2);
    }

  } else if (theme === "bonsaiGarden") {
    ctx.fillStyle = "#b9c9b1";
    ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);
    ctx.strokeStyle = "rgba(75,92,63,0.18)";
    ctx.lineWidth = 2;
    for (let x = 0; x < INTERIOR_W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, INTERIOR_H);
      ctx.stroke();
    }
    for (let y = 0; y < INTERIOR_H; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(INTERIOR_W, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#6c8b57";
    ctx.fillRect(0, 0, INTERIOR_W, 190);
    ctx.fillStyle = "#2f5f45";
    ctx.fillRect(0, 190, INTERIOR_W, 18);

    ctx.fillStyle = "rgba(47,95,69,0.18)";
    ctx.fillRect(0, 580, INTERIOR_W, 150);
    ctx.fillStyle = "#9f7c58";
    ctx.fillRect(130, 665, 1000, 18);
    ctx.fillStyle = "#5d3d2a";
    ctx.fillRect(150, 683, 960, 16);

    const bonsaiSprites = [
      { img: itemImages.bonsai1, x: 260, baseY: 660, h: 270 },
      { img: itemImages.bonsai2, x: 640, baseY: 690, h: 440 },
      { img: itemImages.bonsai1, x: 1035, baseY: 650, h: 240 },
    ];
    bonsaiSprites.forEach((tree) => {
      if (!tree.img.complete || tree.img.naturalWidth === 0) return;
      const w = (tree.h * tree.img.naturalWidth) / tree.img.naturalHeight;
      ctx.drawImage(tree.img, tree.x - w / 2, tree.baseY - tree.h, w, tree.h);
    });

    if (itemImages.grandpaGarden.complete && itemImages.grandpaGarden.naturalWidth > 0) {
      const grandpaH = 285;
      const grandpaW = (grandpaH * itemImages.grandpaGarden.naturalWidth) / itemImages.grandpaGarden.naturalHeight;
      ctx.drawImage(itemImages.grandpaGarden, 940 - grandpaW / 2, 700 - grandpaH, grandpaW, grandpaH);
    }

    drawInteriorLabel("Bonsai Garden", "#2f5f45", "#f3dba0");
  } else if (theme === "mrtPlatform") {
    ctx.fillStyle = "#a3aaad";
    ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let x = 0; x < INTERIOR_W; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, INTERIOR_H);
      ctx.stroke();
    }
    for (let y = 0; y < INTERIOR_H; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(INTERIOR_W, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#3d454b";
    ctx.fillRect(0, 130, INTERIOR_W, 390);
    ctx.fillStyle = "#242a2f";
    ctx.fillRect(0, 310, INTERIOR_W, 70);
    ctx.strokeStyle = "#d9d9d9";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 335);
    ctx.lineTo(INTERIOR_W, 335);
    ctx.moveTo(0, 365);
    ctx.lineTo(INTERIOR_W, 365);
    ctx.stroke();

    if (itemImages.metroTopdown.complete && itemImages.metroTopdown.naturalWidth > 0) {
      const metroW = 1180;
      const metroH = (metroW * itemImages.metroTopdown.naturalHeight) / itemImages.metroTopdown.naturalWidth;
      ctx.drawImage(itemImages.metroTopdown, 50, 245 - metroH / 2, metroW, metroH);
    } else if (itemImages.metro.complete && itemImages.metro.naturalWidth > 0) {
      const metroW = 1080;
      const metroH = (metroW * itemImages.metro.naturalHeight) / itemImages.metro.naturalWidth;
      ctx.drawImage(itemImages.metro, 470, 380 - metroH / 2, metroW, metroH);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.24)";
      ctx.beginPath();
      ctx.roundRect(112, 242, 1080, 150, 30);
      ctx.fill();
      ctx.fillStyle = "#f1f1e9";
      ctx.strokeStyle = "#263d50";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(100, 220, 1080, 150, 30);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2f6fb2";
      ctx.fillRect(110, 252, 1060, 83);
      ctx.fillStyle = "#bfe8f0";
      for (let x = 165; x < 1090; x += 145) ctx.fillRect(x, 236, 102, 56);
      ctx.fillStyle = "#f4ead8";
      for (let x = 280; x < 1000; x += 290) {
        ctx.fillRect(x, 232, 12, 105);
        ctx.fillRect(x + 82, 232, 12, 105);
      }
      ctx.fillStyle = "#f3d35c";
      ctx.fillRect(115, 324, 1050, 8);
      ctx.fillStyle = "#273d50";
      ctx.fillRect(125, 336, 1028, 18);
      ctx.fillStyle = "#f6f4eb";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("捷運  METRO", 640, 316);
      ctx.fillStyle = "#fff4b0";
      ctx.fillRect(104, 284, 8, 18);
      ctx.fillRect(1168, 284, 8, 18);
    }

    ctx.fillStyle = "#6d7478";
    ctx.fillRect(0, 560, INTERIOR_W, 240);
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 6;
    ctx.setLineDash([26, 16]);
    ctx.beginPath();
    ctx.moveTo(0, MRT_PLATFORM_WALK_TOP - 55);
    ctx.lineTo(INTERIOR_W, MRT_PLATFORM_WALK_TOP - 55);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (theme === "convenienceStore") {
    ctx.fillStyle = "#dfe7ea";
    ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);
    drawConvenienceStoreAisles();
    if (itemImages.checkoutCounter.complete && itemImages.checkoutCounter.naturalWidth > 0) {
      drawSpriteRegion(itemImages.checkoutCounter, { x: 0, y: 103, w: 2760, h: 1401 }, 540, 250, 720);
    } else {
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(760, 520, 360, 120);
    }
  } else if (theme === "home") {
    const floor = ctx.createLinearGradient(0, 0, INTERIOR_W, INTERIOR_H);
    floor.addColorStop(0, "#8f6844");
    floor.addColorStop(0.55, "#b18458");
    floor.addColorStop(1, "#6a4931");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);

    ctx.strokeStyle = "rgba(53,33,20,0.35)";
    ctx.lineWidth = 3;
    for (let y = 90; y < INTERIOR_H; y += 54) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(INTERIOR_W, y + Math.sin(y * 0.02) * 6);
      ctx.stroke();
    }

    ctx.fillStyle = "#4c3026";
    ctx.fillRect(0, 0, INTERIOR_W, 145);
    if (itemImages.scrollShelf.complete && itemImages.scrollShelf.naturalWidth > 0) {
      const shelfW = 390;
      const shelfH = (shelfW * itemImages.scrollShelf.naturalHeight) / itemImages.scrollShelf.naturalWidth;
      ctx.drawImage(itemImages.scrollShelf, 150, 285, shelfW, shelfH);
    } else {
      ctx.fillStyle = "#5b3726";
      ctx.fillRect(180, 300, 330, 255);
    }

    if (itemImages.bedPad.complete && itemImages.bedPad.naturalWidth > 0) {
      const bedW = 360;
      const bedH = (bedW * itemImages.bedPad.naturalHeight) / itemImages.bedPad.naturalWidth;
      ctx.drawImage(itemImages.bedPad, 710, 178, bedW, bedH);
    } else {
      ctx.fillStyle = "#4f6f73";
      ctx.fillRect(705, 180, 360, 115);
    }
  } else if (theme === "supermarket") {
    ctx.fillStyle = "#ececec";
    ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);
    drawStoreShelves("#2f6f55", "#f6d365");
    ctx.fillStyle = "#7b8a8b";
    ctx.fillRect(780, 150, 80, 430);
    ctx.fillRect(920, 150, 80, 430);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(1040, 510, 140, 80);
  } else if (theme === "nightMarket") {
    const marketW = activeInterior?.worldW || INTERIOR_W;
    ctx.fillStyle = "#31363b";
    ctx.fillRect(0, 0, marketW, INTERIOR_H);
    ctx.fillStyle = "#262a2e";
    ctx.fillRect(0, 575, marketW, 165);
    ctx.strokeStyle = "rgba(243,219,160,0.16)";
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 26]);
    ctx.beginPath();
    ctx.moveTo(80, 650);
    ctx.lineTo(marketW - 80, 650);
    ctx.stroke();
    ctx.setLineDash([]);

    const nightMarketStands = [
      { img: itemImages.nightMarketStand1, x: 430, y: 318, w: 545 },
      { img: itemImages.nightMarketStandNew, x: 1300, y: 318, w: 545 },
      { img: itemImages.nightMarketStand2, x: 2170, y: 318, w: 545 },
    ];
    nightMarketStands.forEach((entry, i) => {
      const stand = entry.img;
      if (stand.complete && stand.naturalWidth > 0) {
        const standW = entry.w;
        const standH = (standW * stand.naturalHeight) / stand.naturalWidth;
        ctx.drawImage(stand, entry.x - standW / 2, entry.y - standH / 2, standW, standH);
        drawNightMarketStandEffects(t, entry, i);
      } else {
        const colors = ["#c0392b", "#f1c40f", "#2980b9", "#27ae60"];
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(entry.x - 95, 130, 190, 130);
        ctx.fillStyle = "#f7f0d8";
        ctx.fillRect(entry.x - 83, 250, 166, 45);
        drawNightMarketStandEffects(t, entry, i);
      }
    });
    getInteriorNPCs().forEach(drawNPC);
    const lanternXs = Array.from({ length: 27 }, (_, i) => 95 + i * 95);
    const lanternFilters = [
      "none",
      "hue-rotate(45deg) saturate(1.6) brightness(1.18)",
      "hue-rotate(155deg) saturate(1.45) brightness(1.08)",
      "hue-rotate(235deg) saturate(1.35) brightness(1.12)",
      "hue-rotate(305deg) saturate(1.4) brightness(1.12)",
    ];

    ctx.strokeStyle = "#f3dba0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, 92);
    lanternXs.forEach((x, i) => {
      const y = 92 + Math.sin(i * 0.85) * 22 + Math.sin(t * 1.05 + i * 0.42) * 3;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(marketW - 70, 92);
    ctx.stroke();

    lanternXs.forEach((x, i) => {
      const y = 100 + Math.sin(i * 0.85) * 22 + Math.sin(t * 1.05 + i * 0.42) * 3;
      const sway = Math.sin(t * 1.25 + i * 0.55) * 0.045;
      ctx.strokeStyle = "rgba(243,219,160,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x + Math.sin(sway) * 12, y + 7);
      ctx.stroke();

      if (itemImages.redLantern.complete && itemImages.redLantern.naturalWidth > 0) {
        const lanternW = 120;
        const lanternH = (lanternW * itemImages.redLantern.naturalHeight) / itemImages.redLantern.naturalWidth;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(sway);
        ctx.filter = lanternFilters[i % lanternFilters.length];
        ctx.drawImage(itemImages.redLantern, -lanternW / 2, 0, lanternW, lanternH);
        ctx.restore();
      } else {
        const colors = ["#e74c3c", "#f1c40f", "#2980b9", "#27ae60", "#d252a5"];
        ctx.fillStyle = colors[i % colors.length];
        ctx.save();
        ctx.translate(x, y + 22);
        ctx.rotate(sway);
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  } else if (theme === "temple") {
    ctx.fillStyle = "#6d4b3b";
    ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    for (let y = 70; y < INTERIOR_H; y += 62) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(INTERIOR_W, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#44251d";
    ctx.fillRect(0, 0, INTERIOR_W, 210);
    ctx.fillStyle = "#e8b23a";
    ctx.fillRect(120, 78, 1040, 16);
    ctx.fillRect(120, 146, 1040, 10);
    ctx.fillStyle = "#8c2030";
    [170, 330, 950, 1110].forEach((x) => {
      ctx.fillRect(x - 34, 24, 68, 120);
      ctx.fillStyle = "#f3dba0";
      ctx.fillRect(x - 22, 42, 44, 12);
      ctx.fillRect(x - 22, 116, 44, 10);
      ctx.fillStyle = "#8c2030";
    });

    drawTempleAltar();
  } else if (theme === "airport") {
    ctx.fillStyle = "#c8d2d8";
    ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    for (let x = 0; x < INTERIOR_W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, INTERIOR_H);
      ctx.stroke();
    }
    for (let y = 0; y < INTERIOR_H; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(INTERIOR_W, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#2f6f9f";
    ctx.fillRect(500, 90, 280, 125);
    ctx.fillStyle = "#dcefff";
    [525, 585, 645, 705].forEach((x) => ctx.fillRect(x, 125, 38, 20));
    ctx.fillStyle = "#f2f5f4";
    [210, 390, 570, 750].forEach((x) => {
      ctx.fillRect(x, 390, 135, 90);
      ctx.fillStyle = "#2f6f9f";
      ctx.fillRect(x + 12, 410, 111, 18);
      ctx.fillStyle = "#f2f5f4";
    });
    ctx.fillStyle = "#4a5158";
    ctx.fillRect(875, 450, 260, 74);
    ctx.fillStyle = "#20252a";
    ctx.fillRect(900, 468, 210, 38);
    ctx.fillStyle = "#79838d";
    [930, 990, 1050].forEach((x) => ctx.fillRect(x, 350, 46, 90));
  } else if (theme === "soymilkShop") {
    ctx.fillStyle = "#cdb79e";
    ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);
    ctx.fillStyle = "#f0eadc";
    ctx.fillRect(80, 120, 470, 115);
    ctx.fillStyle = "#7a5a3a";
    ctx.fillRect(100, 240, 430, 55);
    ctx.fillStyle = "#9aa0a6";
    [190, 270, 350, 430].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, 150, 28, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#5c3b22";
    [760, 970].forEach((x) => ctx.fillRect(x, 430, 120, 80));
  } else if (theme === "izakaya") {
    ctx.fillStyle = "#4a2f22";
    ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);
    if (itemImages.bartop.complete && itemImages.bartop.naturalWidth > 0) {
      const barW = 540;
      const barH = (barW * itemImages.bartop.naturalHeight) / itemImages.bartop.naturalWidth;
      ctx.drawImage(itemImages.bartop, 70, 125 - barH / 2, barW, barH);
    } else {
      ctx.fillStyle = "#2f1f18";
      ctx.fillRect(80, 110, 470, 95);
    }
    ctx.fillStyle = "#8c2030";
    [120, 230, 340, 450, 850, 980, 1110].forEach((x) => {
      ctx.beginPath();
      ctx.ellipse(x, 70, 18, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    [
      { x: 690, y: 490, w: 340 },
      { x: 1015, y: 440, w: 350 },
      { x: 900, y: 675, w: 370 },
    ].forEach((table) => {
      if (itemImages.izakayaTable.complete && itemImages.izakayaTable.naturalWidth > 0) {
        const tableH = (table.w * itemImages.izakayaTable.naturalHeight) / itemImages.izakayaTable.naturalWidth;
        ctx.drawImage(itemImages.izakayaTable, table.x - table.w / 2, table.y - tableH / 2, table.w, tableH);
      } else {
        ctx.fillStyle = "#7a5a3a";
        ctx.beginPath();
        ctx.arc(table.x, table.y, table.w * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  } else if (theme === "riverBoat") {
    const hullGrad = ctx.createLinearGradient(0, 0, 0, INTERIOR_H);
    hullGrad.addColorStop(0, "#6d4326");
    hullGrad.addColorStop(0.5, "#8b5a32");
    hullGrad.addColorStop(1, "#4f2f1f");
    ctx.fillStyle = hullGrad;
    ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);

    ctx.strokeStyle = "rgba(43,24,14,0.55)";
    ctx.lineWidth = 4;
    for (let y = 92; y < INTERIOR_H; y += 68) {
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(INTERIOR_W - 80, y + Math.sin(y * 0.04) * 8);
      ctx.stroke();
    }

    ctx.fillStyle = "#3a2418";
    ctx.beginPath();
    ctx.roundRect(90, 90, INTERIOR_W - 180, INTERIOR_H - 170, 34);
    ctx.fill();
    ctx.fillStyle = "#7b4d2c";
    ctx.beginPath();
    ctx.roundRect(125, 125, INTERIOR_W - 250, INTERIOR_H - 240, 26);
    ctx.fill();

    ctx.fillStyle = "#1e536d";
    ctx.strokeStyle = "#d4b06f";
    ctx.lineWidth = 8;
    [230, 455, 680, 905, 1130].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, 170, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(184,224,239,0.55)";
      ctx.beginPath();
      ctx.arc(x - 12, 156, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1e536d";
    });

    ctx.fillStyle = "#5a321d";
    ctx.fillRect(185, 455, 270, 82);
    ctx.fillRect(825, 455, 270, 82);
    ctx.fillStyle = "#2f1c12";
    ctx.fillRect(185, 535, 270, 38);
    ctx.fillRect(825, 535, 270, 38);

    ctx.fillStyle = "#c78949";
    ctx.beginPath();
    ctx.ellipse(640, 500, 160, 72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4b2b18";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#f0d28b";
    ctx.beginPath();
    ctx.arc(600, 475, 16, 0, Math.PI * 2);
    ctx.arc(680, 510, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2d2520";
    ctx.fillRect(1010, 300, 120, 95);
    ctx.strokeStyle = "#c7a56a";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(1070, 300, 42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,226,139,0.75)";
    [340, 640, 940].forEach((x) => {
      ctx.beginPath();
      ctx.ellipse(x, 80, 24, 31, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawInteriorLabel(title, theme.startsWith("mrt") ? "#2f6fb2" : "#263544");
  drawExitMat();
  getInteriorWallRects().forEach((r) => {
    ctx.fillStyle = "rgba(45,32,25,0.88)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
  });
  if (theme !== "nightMarket") getInteriorNPCs().forEach(drawNPC);
}

function drawTeaHouseWoodFloor() {
  const floorGrad = ctx.createLinearGradient(0, 0, INTERIOR_W, INTERIOR_H);
  floorGrad.addColorStop(0, "#6b452b");
  floorGrad.addColorStop(0.45, "#8a5a35");
  floorGrad.addColorStop(1, "#4c2f1f");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 0, INTERIOR_W, INTERIOR_H);

  ctx.save();
  ctx.translate(INTERIOR_W / 2, INTERIOR_H / 2);
  ctx.rotate(-0.38);
  ctx.translate(-INTERIOR_W / 2, -INTERIOR_H / 2);

  ctx.lineWidth = 4;
  for (let y = -360; y < INTERIOR_H + 520; y += 42) {
    ctx.strokeStyle = "rgba(38,20,12,0.62)";
    ctx.beginPath();
    ctx.moveTo(-240, y);
    ctx.lineTo(INTERIOR_W + 240, y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(178,112,65,0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-240, y + 5);
    ctx.lineTo(INTERIOR_W + 240, y + 5);
    ctx.stroke();
    ctx.lineWidth = 4;
  }

  for (let y = -340; y < INTERIOR_H + 520; y += 42) {
    for (let x = -220; x < INTERIOR_W + 260; x += 170) {
      const wiggle = ((x * 17 + y * 31) % 23) - 11;
      ctx.strokeStyle = "rgba(42,22,13,0.28)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + 15 + wiggle * 0.15);
      ctx.bezierCurveTo(x + 42, y + 7, x + 80, y + 27, x + 132, y + 13);
      ctx.stroke();

      ctx.strokeStyle = "rgba(196,128,73,0.16)";
      ctx.beginPath();
      ctx.moveTo(x + 18, y + 28);
      ctx.bezierCurveTo(x + 52, y + 20, x + 88, y + 36, x + 146, y + 24);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.fillStyle = "rgba(24,12,8,0.08)";
  for (let i = 0; i < 520; i++) {
    const x = (i * 73) % INTERIOR_W;
    const y = (i * 131) % INTERIOR_H;
    ctx.fillRect(x, y, 3, 2);
  }
}

function drawInterior(t = 0) {
  if (activeInterior?.theme && activeInterior.theme !== "teaHouse") {
    drawThemedInterior(t);
    return;
  }

  drawTeaHouseWoodFloor();

  // red/gold outer wall, in the spirit of the night-market gate art
  ctx.strokeStyle = "#8c2030";
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, INTERIOR_W - 18, INTERIOR_H - 18);
  ctx.strokeStyle = "#e8b23a";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, INTERIOR_W - 36, INTERIOR_H - 36);

  // dividing wall between the two rooms, with a doorway gap
  ctx.fillStyle = "#4a2f22";
  interiorWallRects.forEach((r) => ctx.fillRect(r.x, r.y, r.w, r.h));
  ctx.strokeStyle = "#e8b23a";
  ctx.lineWidth = 3;
  interiorWallRects.forEach((r) => ctx.strokeRect(r.x, r.y, r.w, r.h));

  // hanging lanterns along the top of both rooms
  [120, 280, 440, 840, 1000, 1160].forEach((x) => {
    if (itemImages.redLantern.complete && itemImages.redLantern.naturalWidth > 0) {
      const lanternW = 248;
      const lanternH = (lanternW * itemImages.redLantern.naturalHeight) / itemImages.redLantern.naturalWidth;
      ctx.drawImage(itemImages.redLantern, x - lanternW / 2, -28, lanternW, lanternH);
    } else {
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.ellipse(x, 50, 16, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8b23a";
      ctx.fillRect(x - 2, 28, 4, 14);
    }
  });

  // front-room counter
  if (itemImages.teaHouseCountertop.complete && itemImages.teaHouseCountertop.naturalWidth > 0) {
    const counterW = 520;
    const counterH = (counterW * itemImages.teaHouseCountertop.naturalHeight) / itemImages.teaHouseCountertop.naturalWidth;
    ctx.drawImage(itemImages.teaHouseCountertop, 65, 145 - counterH / 2, counterW, counterH);
  } else {
    ctx.fillStyle = "#5c3b22";
    ctx.fillRect(80, 110, 420, 70);
    ctx.fillStyle = "#3f2a18";
    ctx.fillRect(80, 110, 420, 10);
  }

  // exit mat by the front door
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(interiorExit.x - 60, interiorExit.y - 35, 120, 70);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(interiorExit.x - 60, interiorExit.y - 35, 120, 70);

  if (itemImages.vase.complete && itemImages.vase.naturalWidth > 0) {
    const vaseW = 48;
    const vaseH = (vaseW * itemImages.vase.naturalHeight) / itemImages.vase.naturalWidth;
    ctx.drawImage(itemImages.vase, 510 - vaseW / 2, 126 - vaseH, vaseW, vaseH);
  } else {
    ctx.fillStyle = "#8c2030";
    ctx.beginPath();
    ctx.ellipse(510, 100, 12, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (bonsaiStaircaseUnlocked && itemImages.staircase.complete && itemImages.staircase.naturalWidth > 0) {
    const stairW = 185;
    const stairH = (stairW * itemImages.staircase.naturalHeight) / itemImages.staircase.naturalWidth;
    let stairX = INTERIOR_W - stairW - 8;
    if (bonsaiStaircaseSlideStart && bonsaiStaircaseSlideStart > 0) {
      const elapsed = Math.min((performance.now() - bonsaiStaircaseSlideStart) / 850, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      stairX = INTERIOR_W + 24 + (INTERIOR_W - stairW - 8 - (INTERIOR_W + 24)) * eased;
      if (elapsed >= 1) bonsaiStaircaseSlideStart = -1;
    }
    ctx.drawImage(itemImages.staircase, stairX, 28, stairW, stairH);
  } else if (bonsaiStaircaseUnlocked) {
    ctx.fillStyle = "#6b4732";
    ctx.fillRect(1060, 90, 145, 210);
    ctx.fillStyle = "#d6a65f";
    for (let y = 105; y < 280; y += 28) ctx.fillRect(1072, y, 120, 10);
  }

  // back-room tea tables
  [
    { x: 865, y: 330, w: 285 },
    { x: 1090, y: 350, w: 275 },
    { x: 905, y: 600, w: 360 },
    { x: 1140, y: 610, w: 315 },
  ].forEach((table) => {
    if (itemImages.teaTable.complete && itemImages.teaTable.naturalWidth > 0) {
      const tableH = (table.w * itemImages.teaTable.naturalHeight) / itemImages.teaTable.naturalWidth;
      ctx.drawImage(itemImages.teaTable, table.x - table.w / 2, table.y - tableH / 2, table.w, tableH);
    } else {
      ctx.fillStyle = "#5c3b22";
      ctx.beginPath();
      ctx.arc(table.x, table.y, table.w * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  getInteriorNPCs().forEach(drawNPC);
}

function drawVehicle(mover, transform) {
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.rotate(transform.angle);

  if (mover.type === "car") {
    if (itemImages.redCar.complete && itemImages.redCar.naturalWidth > 0) {
      const { w, h } = footprint(itemImages.redCar, 108);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(0, h * 0.23, w * 0.24, h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.filter = mover.filter || "none";
      ctx.rotate(Math.PI);
      ctx.drawImage(itemImages.redCar, -w / 2, -h / 2, w, h);
      ctx.filter = "none";
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(-16, -8, 32, 18);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(-16, -9, 32, 18);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(-7, -7, 16, 14);
    }
  } else if (mover.type === "scooter") {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(-11, -4, 22, 10);
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(-11, -5, 22, 10);
    ctx.fillStyle = "#e8e8e8";
    ctx.beginPath();
    ctx.arc(2, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (mover.type === "youbike") {
    ctx.strokeStyle = "#e8a020";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();
    ctx.fillStyle = "#e8a020";
    ctx.beginPath();
    ctx.arc(-8, 0, 3.5, 0, Math.PI * 2);
    ctx.arc(8, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (mover.type === "train") {
    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ctx.beginPath();
    ctx.roundRect(-76, -16, 152, 38, 10);
    ctx.fill();
    ctx.fillStyle = "#f2f1e9";
    ctx.strokeStyle = "#20384b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-78, -23, 156, 42, 11);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2f6fb2";
    ctx.fillRect(-73, -17, 146, 27);
    ctx.fillStyle = "#b9e8f2";
    [-56, -29, -2, 25].forEach((x) => ctx.fillRect(x, -14, 20, 14));
    ctx.fillStyle = "#f4ead8";
    ctx.fillRect(-7, -15, 3, 25);
    ctx.fillRect(20, -15, 3, 25);
    ctx.fillStyle = "#f6d36b";
    ctx.fillRect(-72, 6, 144, 4);
    ctx.fillStyle = "#fff5bd";
    ctx.fillRect(-75, -7, 4, 7);
    ctx.fillRect(71, -7, 4, 7);
  } else if (mover.type === "boat") {
    const img = images.junkBoat;
    if (img.complete && img.naturalWidth > 0) {
      const { w, h } = footprint(img, 110);
      ctx.rotate(-transform.angle); // keep the boat sprite upright, just bob along the river
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
  }

  ctx.restore();
}

function drawMovers(t) {
  movers.forEach((mover) => drawVehicle(mover, moverTransform(mover, t)));
}

function drawSprite(entry) {
  const { w, h } = footprint(entry.img, entry.w);
  if (entry.img.complete && entry.img.naturalWidth > 0) {
    ctx.drawImage(entry.img, entry.x - w / 2, entry.y - h / 2, w, h);
  } else if (entry.img.missing) {
    ctx.fillStyle = "#6a4931";
    ctx.fillRect(entry.x - w / 2, entry.y - 95, w, 190);
    ctx.fillStyle = "#8c2030";
    ctx.beginPath();
    ctx.moveTo(entry.x - w / 2 - 18, entry.y - 95);
    ctx.lineTo(entry.x, entry.y - 205);
    ctx.lineTo(entry.x + w / 2 + 18, entry.y - 95);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2f221d";
    ctx.fillRect(entry.x - 40, entry.y + 10, 80, 85);
    ctx.fillStyle = "#f3dba0";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(entry.name, entry.x, entry.y - 25);
  }
}

function drawLocations() {
  locations.forEach(drawSprite);
}

function stringHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function destinationSeed(destination) {
  return stringHash(`${destination.language}:${destination.city}`);
}

function seededRange(seed, index, min, max) {
  const x = Math.sin(seed * 0.0001 + index * 12.9898) * 43758.5453;
  return min + (x - Math.floor(x)) * (max - min);
}

function drawTravelBuilding(x, y, w, h, color, label) {
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(x - w / 2 + 10, y - h / 2 + 12, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x - w / 2 + 8, y - h / 2 + 8, w - 16, h - 16);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  const cols = Math.max(2, Math.floor(w / 40));
  const rows = Math.max(2, Math.floor(h / 32));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillRect(x - w / 2 + 18 + col * 34, y - h / 2 + 18 + row * 26, 12, 10);
    }
  }

  ctx.fillStyle = "#fff3d2";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - h / 2 - 12);
}

function drawTravelMap(t) {
  const destination = activeTravelDestination;
  const seed = destinationSeed(destination);
  const theme = TRAVEL_MAP_THEMES[seed % TRAVEL_MAP_THEMES.length];
  const city = destinationLabel(destination);

  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const waterX = 220 + (seed % 4) * 85;
  const waterW = 160 + (seed % 3) * 45;
  const waterGrad = ctx.createLinearGradient(waterX - waterW / 2, 0, waterX + waterW / 2, 0);
  waterGrad.addColorStop(0, theme.water);
  waterGrad.addColorStop(1, "#6fb4d1");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(waterX - waterW / 2, 0, waterW, WORLD_H);

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 3;
  for (let y = -80 + ((t * 48) % 80); y < WORLD_H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(waterX - waterW / 2 + 18, y);
    ctx.quadraticCurveTo(waterX, y + 32, waterX + waterW / 2 - 18, y);
    ctx.stroke();
  }

  const travelRoads = [
    [[TRAVEL_RETURN_GATE.x, TRAVEL_RETURN_GATE.y], [1180, 710], [1730, 520], [2290, 760], [3020, 610]],
    [[980, 380], [1320, 920], [1680, 1320], [2350, 1500], [3180, 1280]],
    [[720, 1320], [1300, 1160], [1910, 930], [2520, 950], [3320, 1060]],
    [[1450, 260], [1560, 820], [1460, 1450], [1660, 2070]],
  ];

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  travelRoads.forEach((points) => {
    tracePath(points);
    ctx.strokeStyle = theme.road;
    ctx.lineWidth = 64;
    ctx.stroke();
  });
  travelRoads.forEach((points) => {
    tracePath(points);
    ctx.setLineDash([22, 18]);
    ctx.strokeStyle = theme.roadDash;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);
  });

  for (let i = 0; i < 4; i++) {
    const x = seededRange(seed, i, 1120, 3200);
    const y = seededRange(seed, i + 5, 260, 2040);
    const rx = seededRange(seed, i + 10, 150, 330);
    const ry = seededRange(seed, i + 15, 95, 210);
    ctx.fillStyle = theme.park;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  const landmarkLabels = [
    `${destination.language} School`,
    "Central Market",
    "Old Quarter",
    "Transit Hub",
    "Cultural Museum",
  ];
  landmarkLabels.forEach((label, i) => {
    const x = seededRange(seed, i + 20, 980, 3220);
    const y = seededRange(seed, i + 25, 300, 1980);
    const w = seededRange(seed, i + 30, 150, 250);
    const h = seededRange(seed, i + 35, 95, 180);
    const hue = (seed + i * 48) % 360;
    drawTravelBuilding(x, y, w, h, `hsl(${hue} 42% 44%)`, label);
  });

  ctx.fillStyle = "rgba(18,16,15,0.92)";
  ctx.fillRect(TRAVEL_RETURN_GATE.x - 210, TRAVEL_RETURN_GATE.y - 92, 420, 184);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(TRAVEL_RETURN_GATE.x - 210, TRAVEL_RETURN_GATE.y - 92, 420, 184);
  ctx.fillStyle = "#f3dba0";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Airport Gate", TRAVEL_RETURN_GATE.x, TRAVEL_RETURN_GATE.y - 18);
  ctx.font = "18px sans-serif";
  ctx.fillText("Return to Taipei", TRAVEL_RETURN_GATE.x, TRAVEL_RETURN_GATE.y + 24);

  ctx.fillStyle = "rgba(18,16,15,0.84)";
  ctx.fillRect(camera.x + 22, camera.y + 22, 520, 92);
  ctx.strokeStyle = "rgba(243,219,160,0.65)";
  ctx.strokeRect(camera.x + 22, camera.y + 22, 520, 92);
  ctx.fillStyle = "#f3dba0";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(city, camera.x + 44, camera.y + 58);
  ctx.fillStyle = "#f3e3c3";
  ctx.font = "17px sans-serif";
  ctx.fillText(`${destination.language} language map`, camera.x + 44, camera.y + 88);
}

function drawWharf() {
  // wooden deck jutting out from the riverbank into the river
  ctx.fillStyle = "#7a5a3a";
  ctx.fillRect(RIVER_WIDTH - wharf.length, wharf.y - wharf.width / 2, wharf.length, wharf.width);

  // plank lines
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1.5;
  for (let x = RIVER_WIDTH - wharf.length + 8; x < RIVER_WIDTH; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, wharf.y - wharf.width / 2);
    ctx.lineTo(x, wharf.y + wharf.width / 2);
    ctx.stroke();
  }

  // support piles in the water
  ctx.fillStyle = "#5c4128";
  const pileXs = [RIVER_WIDTH - wharf.length + 10, RIVER_WIDTH - wharf.length / 2, RIVER_WIDTH - 14];
  pileXs.forEach((x) => {
    ctx.fillRect(x - 3, wharf.y - wharf.width / 2, 6, wharf.width + 10);
  });
}

function drawBoat(t) {
  const bobY = Math.sin(t * boat.bobSpeed) * 2;
  const { w, h } = footprint(boat.img, boat.w);
  if (boat.img.complete && boat.img.naturalWidth > 0) {
    ctx.drawImage(boat.img, boat.x - w / 2, boat.y - h / 2 + bobY, w, h);
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  if (player.sprite && player.sprite.complete && player.sprite.naturalWidth > 0) {
    const img = player.sprite;
    const h = player.radius * 4;
    const w = (h * img.naturalWidth) / img.naturalHeight;

    // procedural walk cycle (no walk-cycle spritesheet exists, so we
    // fake footsteps with a bob + lean + squash on the single sprite)
    const bob = player.moving ? Math.abs(Math.sin(player.walkCycle)) * h * 0.05 : 0;
    const tilt = player.moving ? Math.sin(player.walkCycle) * 0.04 : 0;
    const squash = player.moving ? 1 - Math.abs(Math.sin(player.walkCycle)) * 0.04 : 1;

    ctx.rotate(tilt);
    ctx.scale(1 / squash, squash);
    ctx.drawImage(img, -w / 2, -h - bob, w, h);

    ctx.restore();
    return;
  }

  // body (fallback marker before a character is chosen)
  ctx.fillStyle = "#e0455a";
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7a1c28";
  ctx.lineWidth = 2;
  ctx.stroke();

  // facing indicator
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(player.dirX * player.radius * 0.6, player.dirY * player.radius * 0.6, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---- main loop ----------------------------------------------------------

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  ctx.clearRect(0, 0, W, H);

  if (scene === "interior") {
    updateInteriorPlayer(dt);
    updateInteriorCamera();
    updateInteraction();

    ctx.save();
    ctx.translate(-interiorCamera.x, 0);
    drawInterior(now / 1000);
    drawPlayer();
    ctx.restore();
  } else {
    updatePlayer(dt);
    updateCamera();
    updateInteraction();

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    if (activeTravelDestination) {
      drawTravelMap(now / 1000);
    } else {
      drawBackground(now / 1000);
      drawParks(now / 1000);
      drawBanyanTrees();
      drawRoads();
      drawMRTTrack();
      drawWharf();
      drawBoat(now / 1000);
      drawMovers(now / 1000);
      drawLocations();
    }
    drawPlayer();

    ctx.restore();
  }

  requestAnimationFrame(loop);
}

// ---- intro -> character select -> game ------------------------------------
// Space starts the game from the intro; the skip button keeps the sign-in and
// character-selection flow available for players who want it.

const introEl = document.getElementById("intro");
const introVideo = document.getElementById("intro-video");
const introSkipEl = document.getElementById("intro-skip");
const selectEl = document.getElementById("select");
const selectCardsEl = document.getElementById("select-cards");
const wrapEl = document.getElementById("wrap");
const bgm = document.getElementById("bgm");
bgm.volume = 0.5;
let introDone = false;
let loginDone = false;
let started = false;

function renderCharacterCards() {
  const characters = [
    { id: "delinquent", label: "P1: Delinquent", portrait: "assets/characters/delinquent_portrait.png" },
    { id: "grandmother", label: "P2: Grandmother", portrait: "assets/characters/grandmother_portrait.png" },
    { id: "hotchick", label: "P3: Traveler", portrait: "assets/characters/hotchick_portrait.png" },
  ];

  selectCardsEl.innerHTML = "";
  characters.forEach((character) => {
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.className = "card";
    buttonEl.dataset.character = character.id;

    const frameEl = document.createElement("div");
    frameEl.className = "card-frame";

    const imgEl = document.createElement("img");
    imgEl.src = character.portrait;
    imgEl.alt = character.label.replace(/^P\d: /, "");

    const labelEl = document.createElement("div");
    labelEl.className = "card-label";
    labelEl.textContent = character.label;

    frameEl.appendChild(imgEl);
    buttonEl.append(frameEl, labelEl);
    buttonEl.addEventListener("click", () => startGame(character.id));
    selectCardsEl.appendChild(buttonEl);
  });
}

function showLogin() {
  if (introDone) return;
  introDone = true;
  introVideo.pause();
  introEl.classList.add("hidden");
  loginEl.classList.remove("hidden");
  updateAuthUi();
}

function skipIntroToOfflineSelect() {
  if (started || loginDone) return;
  introDone = true;
  loginDone = true;
  introVideo.pause();
  introEl.classList.add("hidden");
  loginEl.classList.add("hidden");
  selectEl.classList.remove("hidden");
}

function showSelect() {
  if (loginDone) return;
  if (!authSession?.user) {
    loginStatusEl.textContent = "Sign in with Google to continue";
    return;
  }
  loginDone = true;
  loginEl.classList.add("hidden");
  selectEl.classList.remove("hidden");
}

function playOffline() {
  if (loginDone) return;
  authSession = null;
  loginDone = true;
  loginEl.classList.add("hidden");
  selectEl.classList.remove("hidden");
}

function startGame(character) {
  if (started) return;
  started = true;
  player.sprite = characterImages[character];
  selectEl.classList.add("hidden");
  wrapEl.classList.remove("hidden");
  bgm.play();
  requestAnimationFrame(loop);
}

teacherFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (teacherChatBusy) return;
  const text = teacherInputEl.value.trim();
  if (!text) return;

  const teacherId = activeTeacherId;
  const teacher = TEACHERS[teacherId];
  if (!teacher) return;
  addTeacherMessage("You", text);
  teacherInputEl.value = "";
  teacherInputEl.placeholder = "Asking agent...";
  teacherChatBusy = true;
  teacherInputEl.disabled = true;
  teacherSendEl.disabled = true;

  try {
    const result = await buildBackendTeacherReply(teacherId, text);
    addTeacherMessage(teacher.name, result.reply, result.taughtVocab ? [result.taughtVocab] : []);
    const shouldTeachFromReply = vocabProgress.responseCount >= vocabProgress.nextTeachAt;
    if (result.taughtVocab) {
      const learnedEntry = addAcquiredVocab(result.taughtVocab, teacher);
      finishVocabTeachAttempt(result.taughtVocab);
      if (learnedEntry) showVocabularyFlashcard(learnedEntry);
      if (vocabPanelOpen) renderVocabularyScroll();
    } else if (shouldTeachFromReply) {
      const learnedEntries = collectVocabularyFromText(result.reply, teacherId, { firstOnly: true });
      if (learnedEntries[0]) {
        finishVocabTeachAttempt(learnedEntries[0]);
        showVocabularyFlashcard(learnedEntries[0]);
      }
    }
  } catch (error) {
    console.warn("Backend NPC chat unavailable.", error);
    addTeacherMessage(
      teacher.name,
      "I am having trouble reaching my language brain right now. Please try again in a moment."
    );
  } finally {
    teacherChatBusy = false;
    teacherInputEl.disabled = false;
    teacherSendEl.disabled = false;
    teacherInputEl.placeholder = teacher.inputPlaceholder;
    teacherInputEl.focus();
  }
});

teacherCloseEl.addEventListener("click", closeTeacherChat);
travelCloseEl.addEventListener("click", closeTravelPanel);
scrollHudEl.addEventListener("click", openVocabularyScroll);
questHudEl.addEventListener("click", () => {
  hidePrompt();
  closeTravelPanel();
  closeVocabularyScroll();
  closeScrollRack();
  closeMrtMapPanel();
  closeTeacherChat();
  showDialogue({
    name: "Quest Book",
    line: "Your quests will live here. For now, keep exploring Taipei, talk with NPC teachers, and collect vocabulary scrolls.",
  });
});
vocabCloseEl.addEventListener("click", closeVocabularyScroll);
scrollRackCloseEl.addEventListener("click", closeScrollRack);
mrtMapCloseEl.addEventListener("click", closeMrtMapPanel);
wordLookupCloseEl.addEventListener("click", closeWordLookup);
wordLookupSpeakEl.addEventListener("click", speakLookupWord);
flashcardCardEl.addEventListener("click", () => {
  flashcardPopEl.classList.toggle("flipped");
});
flashcardSpeakEl.addEventListener("click", (e) => {
  e.stopPropagation();
  speakVocabularyFlashcard();
});
flashcardDictionaryEl.addEventListener("click", (e) => {
  e.stopPropagation();
  openFlashcardDictionary();
});
flashcardCloseEl.addEventListener("click", (e) => {
  e.stopPropagation();
  closeVocabularyFlashcard();
});
renderTravelDestinations();
initFlashcardSpeech();
introSkipEl.addEventListener("click", skipIntroToOfflineSelect);
introVideo.addEventListener("ended", showLogin);
loginGoogleEl.addEventListener("click", () => signInWithProvider("google"));
loginContinueEl.addEventListener("click", showSelect);
loginOfflineEl.addEventListener("click", playOffline);
renderCharacterCards();
initAuth();

window.addEventListener("keydown", (e) => {
  if (!started && !introDone && e.code === "Space") {
    e.preventDefault();
    loginDone = true;
    introVideo.pause();
    introEl.classList.add("hidden");
    loginEl.classList.add("hidden");
    selectEl.classList.add("hidden");
    startGame("delinquent");
    return;
  }

  if (!started && e.code === "Enter") {
    e.preventDefault();
    introDone = true;
    loginDone = true;
    introVideo.pause();
    introEl.classList.add("hidden");
    loginEl.classList.add("hidden");
    selectEl.classList.add("hidden");
    startGame("delinquent");
    return;
  }

  if (!flashcardPopEl.classList.contains("hidden") && e.code === "Escape") {
    closeVocabularyFlashcard();
    return;
  }

  if (!wordLookupEl.classList.contains("hidden") && e.code === "Escape") {
    closeWordLookup();
    return;
  }

  if (vocabPanelOpen && e.code === "Escape") {
    closeVocabularyScroll();
    return;
  }

  if (scrollRackOpen && e.code === "Escape") {
    closeScrollRack();
    return;
  }

  if (mrtMapOpen && e.code === "Escape") {
    closeMrtMapPanel();
    return;
  }

  if (teacherChatOpen && e.code === "Escape") {
    closeTeacherChat();
    return;
  }

  if (isTypingInTeacherChat()) return;

  if (started && e.code === "KeyM") {
    bgm.muted = !bgm.muted;
    return;
  }

  if (started && e.code === "KeyE") {
    if (activeTravelDestination) {
      if (isNearTravelReturnGate()) returnFromTravelMap();
    } else if (scene === "world") {
      const entrance = findNearbyEntrance();
      if (entrance?.location.name === "Airport") openTravelPanel();
      else if (entrance) enterLocation(entrance);
    } else {
      const nearNpc = getInteriorNPCs().find((npc) => Math.hypot(player.x - npc.x, player.y - npc.y) < npc.radius + 60);
      const activeExit = getActiveInteriorExit();
      const nearExit = Math.hypot(player.x - activeExit.x, player.y - activeExit.y) < activeExit.radius;
      if (nearNpc) {
        if (nearNpc.autoDialogue) {
          showDialogue(nearNpc);
        } else if (nearNpc.action === "mrtPlatform") {
          enterMRTPlatform();
        } else if (nearNpc.action === "unlockBonsaiStaircase") {
          unlockBonsaiStaircase(nearNpc);
        } else if (nearNpc.action === "bonsaiGarden") {
          enterBonsaiGarden();
        } else if (nearNpc.action === "openScrollRack") {
          openScrollRack();
        } else if (nearNpc.action === "openMrtMap") {
          openMrtMapPanel();
        } else if (nearNpc.chat) {
          if (teacherChatOpen) closeTeacherChat();
          else openTeacherChat(nearNpc.chat);
        } else if (activeDialogueNpc === nearNpc) hideDialogue();
        else showDialogue(nearNpc);
      } else if (nearExit) {
        exitLocation();
      }
    }
    return;
  }

  if (introDone) return;
});




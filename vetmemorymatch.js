const board = document.getElementById("vetBoard");
const scoreText = document.getElementById("vetScore");
const bestText = document.getElementById("vetBest");
const pairsText = document.getElementById("vetPairs");
const pairGoalText = document.getElementById("vetPairGoal");
const livesText = document.getElementById("vetLives");
const timeText = document.getElementById("vetTime");
const statusText = document.getElementById("vetStatus");

const startBtn = document.getElementById("startVetBtn");
const claimRewardBtn = document.getElementById("claimVetRewardBtn");

const BEST_SCORE_KEY = "vetMemoryMatchBestScore";
const WELLNESS_STATE_KEY = "wellnessState";

// Optional sprite paths. Leave empty strings to keep fallback placeholders.
const SPRITE_ASSETS = {
  cardBack: "",
  cards: {
    syringe: "",
    bandage: "",
    stethoscope: "",
    medicine: "",
    thermometer: "",
    heartMonitor: "",
  },
};

const RUN_DURATION_SECONDS = 70;
const START_LIVES = 4;
const PAIR_TYPES = ["syringe", "bandage", "stethoscope", "medicine", "thermometer", "heartMonitor"];
const PAIR_GOAL = PAIR_TYPES.length;
const BASE_MATCH_SCORE = 14;

const CARD_LABELS = {
  syringe: "Syringe",
  bandage: "Bandage",
  stethoscope: "Stethoscope",
  medicine: "Medicine",
  thermometer: "Thermometer",
  heartMonitor: "Heart Monitor",
};

const CARD_GLYPHS = {
  syringe: "S",
  bandage: "B",
  stethoscope: "T",
  medicine: "M",
  thermometer: "H",
  heartMonitor: "C",
};

let score = 0;
let bestScore = 0;
let lives = START_LIVES;
let timeLeft = RUN_DURATION_SECONDS;
let rewardPending = 0;
let pairsFound = 0;
let streak = 0;

let cards = [];
let selectedCards = [];
let running = false;
let resolvingPair = false;
let lastFrame = 0;
let loopHandle = null;

const spriteLoadCache = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(array) {
  const output = [...array];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function loadSprite(path) {
  if (!path) {
    return Promise.resolve(false);
  }

  const cached = spriteLoadCache.get(path);
  if (cached) {
    return cached;
  }

  const promise = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = path;
  });

  spriteLoadCache.set(path, promise);
  return promise;
}

function enableSprite(element, path) {
  element.classList.add("vet-uses-sprite");
  element.style.backgroundImage = `url("${path}")`;
}

function disableSprite(element) {
  element.classList.remove("vet-uses-sprite");
  element.style.backgroundImage = "";
}

function applySpriteIfAvailable(element, path) {
  if (!path) {
    disableSprite(element);
    return;
  }

  element.dataset.spritePath = path;

  loadSprite(path).then((loaded) => {
    if (!element.isConnected || element.dataset.spritePath !== path) {
      return;
    }

    if (loaded) {
      enableSprite(element, path);
    } else {
      disableSprite(element);
    }
  });
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateHud() {
  scoreText.textContent = String(score);
  bestText.textContent = String(bestScore);
  pairsText.textContent = String(pairsFound);
  pairGoalText.textContent = String(PAIR_GOAL);
  livesText.textContent = String(lives);
  timeText.textContent = String(Math.max(0, Math.ceil(timeLeft)));
}

function loadBestScore() {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  const parsed = Number.parseInt(raw ?? "0", 10);
  bestScore = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function saveBestScore() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
}

function clearBoard() {
  board.innerHTML = "";
  cards = [];
  selectedCards = [];
}

function getCardFrontSprite(type) {
  return SPRITE_ASSETS.cards[type] ?? "";
}

function applyCardVisual(cardData) {
  const { element, type, faceUp, matched } = cardData;

  element.classList.toggle("vet-card--flipped", faceUp || matched);
  element.classList.toggle("vet-card--matched", matched);

  const front = element.querySelector(".vet-card-front");
  const back = element.querySelector(".vet-card-back");
  const glyph = element.querySelector(".vet-card-glyph");

  if (glyph) {
    glyph.textContent = CARD_GLYPHS[type] ?? "?";
  }

  applySpriteIfAvailable(back, SPRITE_ASSETS.cardBack);
  applySpriteIfAvailable(front, getCardFrontSprite(type));
}

function createCard(type, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vet-card";
  button.dataset.index = String(index);
  button.setAttribute("aria-label", `Vet card ${index + 1}`);

  const inner = document.createElement("span");
  inner.className = "vet-card-inner";

  const front = document.createElement("span");
  front.className = "vet-card-face vet-card-front";

  const glyph = document.createElement("span");
  glyph.className = "vet-card-glyph";
  glyph.textContent = CARD_GLYPHS[type] ?? "?";
  front.appendChild(glyph);

  const back = document.createElement("span");
  back.className = "vet-card-face vet-card-back";

  inner.appendChild(front);
  inner.appendChild(back);
  button.appendChild(inner);

  const cardData = {
    index,
    type,
    element: button,
    faceUp: false,
    matched: false,
  };

  button.addEventListener("click", () => onCardClick(cardData));
  cards.push(cardData);
  board.appendChild(button);
  applyCardVisual(cardData);
}

function buildBoard() {
  clearBoard();
  const deck = shuffle([...PAIR_TYPES, ...PAIR_TYPES]);
  for (let i = 0; i < deck.length; i += 1) {
    createCard(deck[i], i);
  }
}

function getMatchScore() {
  return BASE_MATCH_SCORE + Math.min(12, streak * 2);
}

function lockBoardInteraction(locked) {
  board.classList.toggle("vet-board--locked", locked);
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    card.element.disabled = locked || card.matched;
  }
}

function revealCard(cardData) {
  cardData.faceUp = true;
  applyCardVisual(cardData);
}

function hideCard(cardData) {
  cardData.faceUp = false;
  applyCardVisual(cardData);
}

async function resolveSelectedPair() {
  if (selectedCards.length < 2) {
    return;
  }

  resolvingPair = true;
  lockBoardInteraction(true);

  const [first, second] = selectedCards;

  if (first.type === second.type) {
    first.matched = true;
    second.matched = true;
    streak += 1;
    pairsFound += 1;
    score += getMatchScore();
    setStatus(`Match! ${CARD_LABELS[first.type]} pair found.`);

    applyCardVisual(first);
    applyCardVisual(second);

    await delay(220);
  } else {
    streak = 0;
    lives -= 1;
    score = Math.max(0, score - 4);
    setStatus("Mismatch. Try to remember their positions.");

    await delay(520);
    hideCard(first);
    hideCard(second);
  }

  selectedCards = [];
  updateHud();

  if (lives <= 0) {
    endRun("Out of lives.");
    return;
  }

  if (pairsFound >= PAIR_GOAL) {
    endRun("All pairs matched.");
    return;
  }

  lockBoardInteraction(false);
  resolvingPair = false;
}

function onCardClick(cardData) {
  if (!running || resolvingPair) {
    return;
  }

  if (cardData.matched || cardData.faceUp) {
    return;
  }

  revealCard(cardData);
  selectedCards.push(cardData);

  if (selectedCards.length === 2) {
    void resolveSelectedPair();
  }
}

function getRewardPoints() {
  const pairReward = pairsFound * 2;
  const scoreReward = Math.floor(score / 40);
  return clamp(pairReward + scoreReward + 1, 2, 16);
}

function endRun(reasonMessage) {
  running = false;
  resolvingPair = false;

  if (loopHandle) {
    cancelAnimationFrame(loopHandle);
    loopHandle = null;
  }

  saveBestScore();
  updateHud();

  const reward = getRewardPoints();
  rewardPending = Math.max(rewardPending, reward);
  claimRewardBtn.disabled = false;
  startBtn.textContent = "Start New Vet Round";
  lockBoardInteraction(true);
  setStatus(`${reasonMessage} Reward ready: +${reward} Health and +${Math.max(1, Math.ceil(reward / 2))} Intellectual`);
}

function step(timestamp) {
  if (!running) {
    return;
  }

  if (!lastFrame) {
    lastFrame = timestamp;
  }

  const dt = Math.min((timestamp - lastFrame) / 1000, 0.05);
  lastFrame = timestamp;
  timeLeft -= dt;

  updateHud();

  if (timeLeft <= 0) {
    endRun("Time up.");
    return;
  }

  loopHandle = requestAnimationFrame(step);
}

function startRun() {
  buildBoard();

  score = 0;
  lives = START_LIVES;
  timeLeft = RUN_DURATION_SECONDS;
  pairsFound = 0;
  streak = 0;
  selectedCards = [];
  resolvingPair = false;
  lastFrame = 0;
  running = true;

  claimRewardBtn.disabled = rewardPending <= 0;
  startBtn.textContent = "Restart Vet Round";

  updateHud();
  setStatus("Vet Memory Match running.");
  lockBoardInteraction(false);

  if (loopHandle) {
    cancelAnimationFrame(loopHandle);
  }
  loopHandle = requestAnimationFrame(step);
}

function applyReward(points) {
  const raw = localStorage.getItem(WELLNESS_STATE_KEY);
  let data = {
    physical: 70,
    mental: 70,
    social: 70,
    intellectual: 70,
    spiritual: 70,
  };

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      data = {
        physical: Number.isFinite(parsed?.physical) ? parsed.physical : 70,
        mental: Number.isFinite(parsed?.mental) ? parsed.mental : 70,
        social: Number.isFinite(parsed?.social) ? parsed.social : 70,
        intellectual: Number.isFinite(parsed?.intellectual) ? parsed.intellectual : 70,
        spiritual: Number.isFinite(parsed?.spiritual) ? parsed.spiritual : 70,
      };
    } catch {
      // Keep defaults when saved data is invalid.
    }
  }

  const healthGain = points;
  const intellectualGain = Math.max(1, Math.ceil(points / 2));

  data.physical = clamp(Math.round(data.physical) + healthGain, 0, 100);
  data.intellectual = clamp(Math.round(data.intellectual) + intellectualGain, 0, 100);

  localStorage.setItem(WELLNESS_STATE_KEY, JSON.stringify(data));
  return { healthGain, intellectualGain };
}

function claimReward() {
  if (rewardPending <= 0) {
    return;
  }

  const points = rewardPending;
  const gains = applyReward(points);

  rewardPending = 0;
  claimRewardBtn.disabled = true;
  setStatus(`Reward applied: +${gains.healthGain} Health and +${gains.intellectualGain} Intellectual`);
}

function bindEvents() {
  startBtn.addEventListener("click", startRun);
  claimRewardBtn.addEventListener("click", claimReward);
}

function init() {
  loadBestScore();
  updateHud();
  setStatus("Ready");
  pairGoalText.textContent = String(PAIR_GOAL);
  buildBoard();
  lockBoardInteraction(true);
  bindEvents();
}

init();

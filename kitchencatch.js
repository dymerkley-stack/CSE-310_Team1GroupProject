const field = document.getElementById("kitchenField");
const catcher = document.getElementById("kitchenCatcher");

const scoreText = document.getElementById("kitchenScore");
const bestText = document.getElementById("kitchenBest");
const livesText = document.getElementById("kitchenLives");
const timeText = document.getElementById("kitchenTime");
const statusText = document.getElementById("kitchenStatus");

const leftBtn = document.getElementById("kitchenLeftBtn");
const rightBtn = document.getElementById("kitchenRightBtn");
const startBtn = document.getElementById("startKitchenBtn");
const claimRewardBtn = document.getElementById("claimKitchenRewardBtn");

const BEST_SCORE_KEY = "kitchenCatchBestScore";
const WELLNESS_STATE_KEY = "wellnessState";

// Optional sprite paths. Leave empty strings to keep color-block fallbacks.
const SPRITE_ASSETS = {
  pet: "",
  items: {
    good: "",
    junk: "",
  },
};

const ITEM_TYPES = [
  {
    id: "good",
    cssClass: "kitchen-item--good",
    spawnWeight: 72,
    catchScoreDelta: 10,
    catchLifeDelta: 0,
    missLifeDelta: -1,
    catchStatus: "Healthy catch! Keep it up.",
    missStatus: "Healthy food missed. Kitchen routine slipped.",
  },
  {
    id: "junk",
    cssClass: "kitchen-item--junk",
    spawnWeight: 28,
    catchScoreDelta: -6,
    catchLifeDelta: -1,
    missLifeDelta: 0,
    catchStatus: "Junk caught! Your pet did not like that.",
    missStatus: "",
  },
];

const RUN_DURATION_SECONDS = 60;
const CATCHER_WIDTH = 88;
const CATCHER_HEIGHT = 20;
const CATCHER_Y_OFFSET = 18;
const ITEM_SIZE = 26;
const MOVE_STEP = 30;
const BASE_FALL_SPEED = 105;
const FALL_SPEED_RAMP = 5;
const SPAWN_START_MIN = 0.45;
const SPAWN_START_MAX = 0.9;
const SPAWN_END_MIN = 0.22;
const SPAWN_END_MAX = 0.45;
const SPAWN_RAMP_SECONDS = 60;

let score = 0;
let bestScore = 0;
let lives = 3;
let timeLeft = RUN_DURATION_SECONDS;
let rewardPending = 0;

let running = false;
let items = [];
let spawnTimer = 0;
let spawnInterval = 0.6;
let elapsedSeconds = 0;
let lastFrame = 0;
let loopHandle = null;

let catcherX = 0;
const spriteLoadCache = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateHud() {
  scoreText.textContent = String(score);
  bestText.textContent = String(bestScore);
  livesText.textContent = String(lives);
  timeText.textContent = String(Math.max(0, Math.ceil(timeLeft)));
}

function getFieldWidth() {
  return Math.max(120, field.clientWidth);
}

function getFieldHeight() {
  return Math.max(200, field.clientHeight);
}

function placeCatcher() {
  const y = getFieldHeight() - CATCHER_HEIGHT - CATCHER_Y_OFFSET;
  catcher.style.transform = `translate(${Math.round(catcherX)}px, ${Math.round(y)}px)`;
}

function clearItems() {
  for (let i = 0; i < items.length; i += 1) {
    items[i].element.remove();
  }
  items = [];
}

function loadBestScore() {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  const value = Number.parseInt(raw ?? "0", 10);
  bestScore = Number.isFinite(value) && value > 0 ? value : 0;
}

function saveBestScore() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
}

function moveCatcher(deltaX) {
  const fieldWidth = getFieldWidth();
  const maxX = fieldWidth - CATCHER_WIDTH;
  catcherX = clamp(catcherX + deltaX, 0, maxX);
  placeCatcher();
}

function moveLeft() {
  if (!running) return;
  moveCatcher(-MOVE_STEP);
}

function moveRight() {
  if (!running) return;
  moveCatcher(MOVE_STEP);
}

function getSpawnIntervalForTime(seconds) {
  const progress = clamp(seconds / SPAWN_RAMP_SECONDS, 0, 1);
  const min = SPAWN_START_MIN + (SPAWN_END_MIN - SPAWN_START_MIN) * progress;
  const max = SPAWN_START_MAX + (SPAWN_END_MAX - SPAWN_START_MAX) * progress;
  return randomBetween(min, max);
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
  element.classList.add("kitchen-uses-sprite");
  element.style.backgroundImage = `url("${path}")`;
}

function disableSprite(element) {
  element.classList.remove("kitchen-uses-sprite");
  element.style.backgroundImage = "";
}

function applySpriteIfAvailable(element, path) {
  if (!path) {
    disableSprite(element);
    return;
  }

  loadSprite(path).then((loaded) => {
    if (!element.isConnected) {
      return;
    }

    if (loaded) {
      enableSprite(element, path);
    } else {
      disableSprite(element);
    }
  });
}

function pickWeightedItemType() {
  let totalWeight = 0;
  for (let i = 0; i < ITEM_TYPES.length; i += 1) {
    totalWeight += ITEM_TYPES[i].spawnWeight;
  }

  let roll = Math.random() * totalWeight;
  for (let i = 0; i < ITEM_TYPES.length; i += 1) {
    roll -= ITEM_TYPES[i].spawnWeight;
    if (roll <= 0) {
      return ITEM_TYPES[i];
    }
  }

  return ITEM_TYPES[ITEM_TYPES.length - 1];
}

function getItemSpritePath(itemTypeId) {
  return SPRITE_ASSETS.items[itemTypeId] ?? "";
}

function spawnItem() {
  const type = pickWeightedItemType();
  const element = document.createElement("div");
  element.className = `kitchen-item ${type.cssClass}`;

  applySpriteIfAvailable(element, getItemSpritePath(type.id));

  field.appendChild(element);

  const maxX = Math.max(0, getFieldWidth() - ITEM_SIZE);
  const x = Math.random() * maxX;

  items.push({
    x,
    y: -ITEM_SIZE,
    speed: BASE_FALL_SPEED + elapsedSeconds * FALL_SPEED_RAMP + (Math.random() * 28 - 14),
    type,
    element,
  });
}

function renderItems() {
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    item.element.style.transform = `translate(${Math.round(item.x)}px, ${Math.round(item.y)}px)`;
  }
}

function removeItemAt(index) {
  const item = items[index];
  item.element.remove();
  items.splice(index, 1);
}

function processCaughtItem(item) {
  score = Math.max(0, score + item.type.catchScoreDelta);
  lives += item.type.catchLifeDelta;
  setStatus(item.type.catchStatus);
}

function processMissedItem(item) {
  if (item.type.missLifeDelta === 0) {
    return;
  }

  lives += item.type.missLifeDelta;
  setStatus(item.type.missStatus);
}

function checkCatch(item) {
  const catcherY = getFieldHeight() - CATCHER_HEIGHT - CATCHER_Y_OFFSET;
  const itemBottom = item.y + ITEM_SIZE;
  const itemRight = item.x + ITEM_SIZE;
  const catcherRight = catcherX + CATCHER_WIDTH;

  const isNearCatcher = itemBottom >= catcherY && item.y <= catcherY + CATCHER_HEIGHT;
  const overlapsX = itemRight >= catcherX && item.x <= catcherRight;

  return isNearCatcher && overlapsX;
}

function getRewardPoints(currentScore) {
  const base = Math.floor(currentScore / 40);
  return clamp(base + 1, 1, 12);
}

function endRun(reasonMessage) {
  running = false;

  if (loopHandle) {
    cancelAnimationFrame(loopHandle);
    loopHandle = null;
  }

  saveBestScore();
  updateHud();

  const reward = getRewardPoints(score);
  rewardPending = Math.max(rewardPending, reward);
  claimRewardBtn.disabled = false;
  startBtn.textContent = "Start New Round";
  setStatus(`${reasonMessage} Reward ready: +${reward} Physical and +${Math.max(1, Math.ceil(reward / 2))} Social`);
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

  elapsedSeconds += dt;
  timeLeft -= dt;

  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnInterval = getSpawnIntervalForTime(elapsedSeconds);
    spawnItem();
  }

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    item.y += item.speed * dt;

    if (checkCatch(item)) {
      processCaughtItem(item);
      removeItemAt(i);
      continue;
    }

    if (item.y > getFieldHeight() + ITEM_SIZE) {
      processMissedItem(item);
      removeItemAt(i);
    }
  }

  renderItems();
  updateHud();

  if (lives <= 0) {
    endRun("Out of lives.");
    return;
  }

  if (timeLeft <= 0) {
    endRun("Round complete.");
    return;
  }

  loopHandle = requestAnimationFrame(step);
}

function startRun() {
  clearItems();

  const fieldWidth = getFieldWidth();
  catcherX = Math.round((fieldWidth - CATCHER_WIDTH) / 2);

  score = 0;
  lives = 3;
  timeLeft = RUN_DURATION_SECONDS;
  elapsedSeconds = 0;
  spawnTimer = 0;
  spawnInterval = getSpawnIntervalForTime(0);
  lastFrame = 0;
  running = true;

  claimRewardBtn.disabled = rewardPending <= 0;
  startBtn.textContent = "Restart Round";

  placeCatcher();
  updateHud();
  setStatus("Kitchen Catch running.");

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
      // Keep defaults if saved data is invalid.
    }
  }

  const physicalGain = points;
  const socialGain = Math.max(1, Math.ceil(points / 2));

  data.physical = clamp(Math.round(data.physical) + physicalGain, 0, 100);
  data.social = clamp(Math.round(data.social) + socialGain, 0, 100);

  localStorage.setItem(WELLNESS_STATE_KEY, JSON.stringify(data));
  return { physicalGain, socialGain };
}

function claimReward() {
  if (rewardPending <= 0) {
    return;
  }

  const points = rewardPending;
  const gains = applyReward(points);

  rewardPending = 0;
  claimRewardBtn.disabled = true;
  setStatus(`Reward applied: +${gains.physicalGain} Physical and +${gains.socialGain} Social`);
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  if (event.key === "ArrowLeft" || key === "a") {
    event.preventDefault();
    moveLeft();
  }

  if (event.key === "ArrowRight" || key === "d") {
    event.preventDefault();
    moveRight();
  }

  if (event.key === " " && !running) {
    event.preventDefault();
    startRun();
  }
}

function bindEvents() {
  leftBtn.addEventListener("click", moveLeft);
  rightBtn.addEventListener("click", moveRight);
  startBtn.addEventListener("click", startRun);
  claimRewardBtn.addEventListener("click", claimReward);

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", () => {
    catcherX = clamp(catcherX, 0, getFieldWidth() - CATCHER_WIDTH);
    placeCatcher();
  });
}

function init() {
  loadBestScore();
  catcherX = Math.round((getFieldWidth() - CATCHER_WIDTH) / 2);
  placeCatcher();
  applySpriteIfAvailable(catcher, SPRITE_ASSETS.pet);
  updateHud();
  setStatus("Ready");
  bindEvents();
}

init();

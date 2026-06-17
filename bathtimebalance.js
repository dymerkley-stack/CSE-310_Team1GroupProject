import { getSelectedAvatarForCurrentProgress } from "./avatar-selection.js";

const arena = document.getElementById("harvestArena");
const playerSpud = document.getElementById("playerSpud");
const miniSpudsLayer = document.getElementById("miniSpudsLayer");

const scoreText = document.getElementById("harvestScore");
const bestText = document.getElementById("harvestBest");
const timeText = document.getElementById("harvestTime");
const sizeText = document.getElementById("harvestSize");
const statusText = document.getElementById("harvestStatus");

const startBtn = document.getElementById("startHarvestBtn");
const claimRewardBtn = document.getElementById("claimHarvestRewardBtn");

const BEST_SCORE_KEY = "potatoHarvestBestScore";
const WELLNESS_STATE_KEY = "wellnessState";

const SPRITE_ASSETS = {
  playerSpud: "",
};

const RUN_DURATION_SECONDS = 50;
const MAX_MINI_SPUDS = 6;
const MINI_SPUD_SIZE = 30;
const SPUD_BASE_WIDTH = 60;
const SPUD_BASE_HEIGHT = 48;
const SPUD_MAX_WIDTH = 180;
const SPUD_GROW_W = 5;
const PLAYER_SPEED = 220;
const PLAYER_TOP_LIMIT = 10;
const BASE_SPAWN_INTERVAL = 1.6;

let score = 0;
let bestScore = 0;
let timeLeft = RUN_DURATION_SECONDS;
let rewardPending = 0;
let spudWidth = SPUD_BASE_WIDTH;
let spudHeight = SPUD_BASE_HEIGHT;
let miniSpuds = [];
let running = false;
let spawnTimer = 0;
let spawnInterval = BASE_SPAWN_INTERVAL;
let elapsedSeconds = 0;
let lastFrame = 0;
let loopHandle = null;
let spudX = 0;
let spudY = 0;
const keysHeld = new Set();

const spriteLoadCache = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function loadSprite(path) {
  if (!path) return Promise.resolve(false);
  const cached = spriteLoadCache.get(path);
  if (cached) return cached;
  const promise = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = path;
  });
  spriteLoadCache.set(path, promise);
  return promise;
}

function applySpriteIfAvailable(element, path) {
  if (!path) {
    element.classList.remove("harvest-uses-sprite");
    element.style.backgroundImage = "";
    return;
  }
  element.dataset.spritePath = path;
  loadSprite(path).then((loaded) => {
    if (!element.isConnected || element.dataset.spritePath !== path) return;
    if (loaded) {
      element.classList.add("harvest-uses-sprite");
      element.style.backgroundImage = `url("${path}")`;
    } else {
      element.classList.remove("harvest-uses-sprite");
      element.style.backgroundImage = "";
    }
  });
}

function setStatus(message) {
  statusText.textContent = message;
}

function updatePlayerSpudSize() {
  playerSpud.style.width = `${spudWidth}px`;
  playerSpud.style.height = `${spudHeight}px`;
}

function updateHud() {
  scoreText.textContent = String(score);
  bestText.textContent = String(bestScore);
  timeText.textContent = String(Math.max(0, Math.ceil(timeLeft)));
  sizeText.textContent = String(Math.round(spudWidth));
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

function clearMiniSpuds() {
  for (let i = 0; i < miniSpuds.length; i += 1) {
    miniSpuds[i].element.remove();
  }
  miniSpuds = [];
}

function getArenaBounds() {
  return {
    width: Math.max(220, arena.clientWidth),
    height: Math.max(220, arena.clientHeight),
  };
}

function placePlayerSpud() {
  playerSpud.style.transform = `translate(${Math.round(spudX)}px, ${Math.round(spudY)}px)`;
}

function setPlayerSpudPosition(nextX, nextY) {
  const bounds = getArenaBounds();
  const maxX = Math.max(0, bounds.width - spudWidth);
  const maxY = Math.max(PLAYER_TOP_LIMIT, bounds.height - spudHeight - 8);
  spudX = clamp(nextX, 0, maxX);
  spudY = clamp(nextY, PLAYER_TOP_LIMIT, maxY);
  placePlayerSpud();
}

function resetPlayerSpud() {
  spudWidth = SPUD_BASE_WIDTH;
  spudHeight = SPUD_BASE_HEIGHT;
  updatePlayerSpudSize();
  const bounds = getArenaBounds();
  setPlayerSpudPosition(
    Math.round(bounds.width / 2 - SPUD_BASE_WIDTH / 2),
    Math.max(PLAYER_TOP_LIMIT, bounds.height - SPUD_BASE_HEIGHT - 20),
  );
}

function intersectsMiniSpud(miniSpudData) {
  const playerRight = spudX + spudWidth;
  const playerBottom = spudY + spudHeight;
  const miniRight = miniSpudData.x + MINI_SPUD_SIZE;
  const miniBottom = miniSpudData.y + MINI_SPUD_SIZE;
  return playerRight >= miniSpudData.x && spudX <= miniRight && playerBottom >= miniSpudData.y && spudY <= miniBottom;
}

function removeMiniSpud(miniSpudData) {
  const index = miniSpuds.indexOf(miniSpudData);
  if (index >= 0) {
    miniSpuds[index].element.remove();
    miniSpuds.splice(index, 1);
  }
}

function collectMiniSpud(miniSpudData) {
  if (!running) return;
  score += 10;
  spudWidth = Math.min(SPUD_MAX_WIDTH, spudWidth + SPUD_GROW_W);
  spudHeight = Math.min(Math.round(SPUD_MAX_WIDTH * 0.8), spudHeight + Math.round(SPUD_GROW_W * 0.8));
  updatePlayerSpudSize();
  removeMiniSpud(miniSpudData);
  updateHud();
  setStatus("Yum! Your spud is growing!");
}

function checkCollections() {
  if (!running) return;
  for (let i = miniSpuds.length - 1; i >= 0; i -= 1) {
    if (intersectsMiniSpud(miniSpuds[i])) {
      collectMiniSpud(miniSpuds[i]);
    }
  }
}

function createMiniSpud() {
  const el = document.createElement("div");
  el.className = "mini-spud";
  el.setAttribute("aria-hidden", "true");

  const bounds = getArenaBounds();
  const x = randomBetween(10, Math.max(10, bounds.width - MINI_SPUD_SIZE - 10));
  const y = randomBetween(10, Math.max(20, bounds.height - MINI_SPUD_SIZE - 14));
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;

  const miniSpudData = { element: el, x, y, size: MINI_SPUD_SIZE };
  miniSpudsLayer.appendChild(el);
  miniSpuds.push(miniSpudData);
}

function getSpawnInterval() {
  const progress = clamp(elapsedSeconds / RUN_DURATION_SECONDS, 0, 1);
  const min = Math.max(1.0, BASE_SPAWN_INTERVAL - progress * 1.0);
  const max = min + 0.5;
  return randomBetween(min, max);
}

function getSpawnBatchCount() {
  const progress = clamp(elapsedSeconds / RUN_DURATION_SECONDS, 0, 1);
  if (progress < 0.7) return 1;
  return Math.random() < 0.25 ? 2 : 1;
}

function getRewardPoints(currentScore) {
  const base = Math.floor(currentScore / 45);
  const total = base + 1;
  const boostedReward = Math.round(total * 1.2);
  return clamp(boostedReward, 1, 14);
}

function endRun(reasonMessage) {
  running = false;
  keysHeld.clear();

  if (loopHandle) {
    cancelAnimationFrame(loopHandle);
    loopHandle = null;
  }

  saveBestScore();
  updateHud();

  const reward = getRewardPoints(score);
  rewardPending = Math.max(rewardPending, reward);
  claimRewardBtn.disabled = false;
  startBtn.textContent = "Start New Harvest";
  setStatus(`${reasonMessage} Reward ready: +${reward} Physical and +${Math.max(1, Math.ceil(reward / 2))} Mental`);
}

function step(timestamp) {
  if (!running) return;

  if (!lastFrame) lastFrame = timestamp;
  const dt = Math.min((timestamp - lastFrame) / 1000, 0.05);
  lastFrame = timestamp;

  elapsedSeconds += dt;
  timeLeft -= dt;

  if (keysHeld.has("ArrowLeft")) setPlayerSpudPosition(spudX - PLAYER_SPEED * dt, spudY);
  if (keysHeld.has("ArrowRight")) setPlayerSpudPosition(spudX + PLAYER_SPEED * dt, spudY);
  if (keysHeld.has("ArrowUp")) setPlayerSpudPosition(spudX, spudY - PLAYER_SPEED * dt);
  if (keysHeld.has("ArrowDown")) setPlayerSpudPosition(spudX, spudY + PLAYER_SPEED * dt);

  checkCollections();

  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnInterval = getSpawnInterval();
    const batchCount = getSpawnBatchCount();
    for (let i = 0; i < batchCount; i += 1) {
      if (miniSpuds.length >= MAX_MINI_SPUDS) break;
      createMiniSpud();
    }
  }

  updateHud();

  if (miniSpuds.length >= MAX_MINI_SPUDS) {
    endRun("Too many spuds left behind!");
    return;
  }

  if (timeLeft <= 0) {
    endRun("Harvest complete!");
    return;
  }

  loopHandle = requestAnimationFrame(step);
}

function startRun() {
  clearMiniSpuds();
  resetPlayerSpud();

  score = 0;
  timeLeft = RUN_DURATION_SECONDS;
  rewardPending = Math.max(0, rewardPending);
  spawnTimer = 0;
  spawnInterval = getSpawnInterval();
  elapsedSeconds = 0;
  lastFrame = 0;
  keysHeld.clear();
  running = true;

  claimRewardBtn.disabled = rewardPending <= 0;
  startBtn.textContent = "Restart Harvest";

  updateHud();
  setStatus("Harvest running — collect those spuds!");

  if (loopHandle) cancelAnimationFrame(loopHandle);
  loopHandle = requestAnimationFrame(step);
}

function applyReward(points) {
  const raw = localStorage.getItem(WELLNESS_STATE_KEY);
  let data = { physical: 70, mental: 70, social: 70, intellectual: 70, spiritual: 70 };

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
      // Keep defaults when saved data cannot be parsed.
    }
  }

  const physicalGain = points;
  const mentalGain = Math.max(1, Math.ceil(points / 2));
  data.physical = clamp(Math.round(data.physical) + physicalGain, 0, 100);
  data.mental = clamp(Math.round(data.mental) + mentalGain, 0, 100);
  localStorage.setItem(WELLNESS_STATE_KEY, JSON.stringify(data));
  return { physicalGain, mentalGain };
}

function claimReward() {
  if (rewardPending <= 0) return;
  const points = rewardPending;
  const gains = applyReward(points);
  rewardPending = 0;
  claimRewardBtn.disabled = true;
  setStatus(`Reward applied: +${gains.physicalGain} Physical and +${gains.mentalGain} Mental`);
}

const ARROW_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

function handleKeyDown(event) {
  if (ARROW_KEYS.includes(event.key)) {
    event.preventDefault();
    if (running) keysHeld.add(event.key);
  }
  if (event.key === " " && !running) {
    event.preventDefault();
    startRun();
  }
}

function handleKeyUp(event) {
  keysHeld.delete(event.key);
}

function bindEvents() {
  startBtn.addEventListener("click", startRun);
  claimRewardBtn.addEventListener("click", claimReward);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("resize", resetPlayerSpud);
}

function init() {
  loadBestScore();
  applySpriteIfAvailable(playerSpud, getSelectedAvatarForCurrentProgress().src || SPRITE_ASSETS.playerSpud);
  resetPlayerSpud();
  updateHud();
  setStatus("Ready");
  bindEvents();
}

init();

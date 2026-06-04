import { getSelectedAvatarForCurrentProgress } from "./avatar-selection.js";

const arena = document.getElementById("bathArena");
const pet = document.getElementById("bathPet");
const spotsLayer = document.getElementById("bathSpotsLayer");
const tempNeedle = document.getElementById("bathTempNeedle");
const sponge = document.getElementById("bathSponge");

const scoreText = document.getElementById("bathScore");
const bestText = document.getElementById("bathBest");
const timeText = document.getElementById("bathTime");
const tempText = document.getElementById("bathTemp");
const statusText = document.getElementById("bathStatus");

const coolBtn = document.getElementById("coolBathBtn");
const heatBtn = document.getElementById("heatBathBtn");
const startBtn = document.getElementById("startBathBtn");
const claimRewardBtn = document.getElementById("claimBathRewardBtn");

const BEST_SCORE_KEY = "bathTimeBalanceBestScore";
const WELLNESS_STATE_KEY = "wellnessState";

// Optional sprite paths. Leave empty strings to keep fallback placeholders.
const SPRITE_ASSETS = {
  pet: "",
  dirtSpot: "",
  sponge: "",
};

const RUN_DURATION_SECONDS = 50;
const TEMP_MIN = 0;
const TEMP_MAX = 100;
const COMFORT_MIN = 42;
const COMFORT_MAX = 58;
const MAX_SPOTS = 5;
const SPOT_SIZE = 36;
const SPOT_SCRUB_REQUIRED_SECONDS = 0.45;
const SPOT_PROGRESS_VISIBLE_SECONDS = 0.4;
const SPONGE_WIDTH = 62;
const SPONGE_HEIGHT = 40;
const SPONGE_TOP_LIMIT = 72;
const BASE_SPAWN_INTERVAL = 1.35;
const TEMP_EDGE_WARNING_PADDING = 10;
const TEMP_WARNING_FLASH_DURATION = 220;

let score = 0;
let bestScore = 0;
let timeLeft = RUN_DURATION_SECONDS;
let rewardPending = 0;
let temperature = 50;
let spots = [];
let running = false;
let spawnTimer = 0;
let spawnInterval = BASE_SPAWN_INTERVAL;
let driftTimer = 0;
let driftRate = 0;
let elapsedSeconds = 0;
let lastFrame = 0;
let loopHandle = null;
let spongeX = 0;
let spongeY = 0;
let spongeScrubbing = false;
let tempWarningTimer = 0;

const spriteLoadCache = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
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
  element.classList.add("bath-uses-sprite");
  element.style.backgroundImage = `url("${path}")`;
}

function disableSprite(element) {
  element.classList.remove("bath-uses-sprite");
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

function isComfortTemperature() {
  return temperature >= COMFORT_MIN && temperature <= COMFORT_MAX;
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateNeedle() {
  const percent = ((temperature - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100;
  tempNeedle.style.left = `${clamp(percent, 0, 100)}%`;
}

function updateHud() {
  scoreText.textContent = String(score);
  bestText.textContent = String(bestScore);
  timeText.textContent = String(Math.max(0, Math.ceil(timeLeft)));
  tempText.textContent = String(Math.round(temperature));
  updateNeedle();
}

function updateTemperatureWarning() {
  const nearColdEdge = temperature <= TEMP_MIN + TEMP_EDGE_WARNING_PADDING;
  const nearHotEdge = temperature >= TEMP_MAX - TEMP_EDGE_WARNING_PADDING;

  if (nearColdEdge || nearHotEdge) {
    tempWarningTimer = TEMP_WARNING_FLASH_DURATION;
    arena.classList.toggle("bath-arena--danger", true);
    arena.classList.toggle("bath-arena--danger-cold", nearColdEdge);
    arena.classList.toggle("bath-arena--danger-hot", nearHotEdge);
    return;
  }

  if (tempWarningTimer > 0) {
    tempWarningTimer -= 16;
    arena.classList.toggle("bath-arena--danger", true);
    return;
  }

  arena.classList.remove("bath-arena--danger", "bath-arena--danger-cold", "bath-arena--danger-hot");
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

function clearSpots() {
  for (let i = 0; i < spots.length; i += 1) {
    spots[i].element.remove();
  }
  spots = [];
}

function getArenaBounds() {
  return {
    width: Math.max(220, arena.clientWidth),
    height: Math.max(220, arena.clientHeight),
  };
}

function placeSponge() {
  sponge.style.transform = `translate(${Math.round(spongeX)}px, ${Math.round(spongeY)}px)`;
}

function setSpongePosition(nextX, nextY) {
  const arenaBounds = getArenaBounds();
  const maxX = Math.max(0, arenaBounds.width - SPONGE_WIDTH);
  const maxY = Math.max(SPONGE_TOP_LIMIT, arenaBounds.height - SPONGE_HEIGHT - 8);

  spongeX = clamp(nextX, 0, maxX);
  spongeY = clamp(nextY, SPONGE_TOP_LIMIT, maxY);
  placeSponge();
}

function resetSponge() {
  const arenaBounds = getArenaBounds();
  const targetX = Math.max(8, Math.round(arenaBounds.width * 0.16));
  const targetY = Math.max(SPONGE_TOP_LIMIT, arenaBounds.height - SPONGE_HEIGHT - 16);
  setSpongePosition(targetX, targetY);
  spongeScrubbing = false;
  sponge.classList.remove("bath-sponge--scrubbing");
}

function getPointerPositionInArena(event) {
  const rect = arena.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function intersectsSponge(spotData) {
  const spongeRight = spongeX + SPONGE_WIDTH;
  const spongeBottom = spongeY + SPONGE_HEIGHT;
  const spotRight = spotData.x + spotData.size;
  const spotBottom = spotData.y + spotData.size;

  return spongeRight >= spotData.x && spongeX <= spotRight && spongeBottom >= spotData.y && spongeY <= spotBottom;
}

function updateSpotProgressVisual(spotData) {
  const ratio = clamp(spotData.scrubSeconds / SPOT_SCRUB_REQUIRED_SECONDS, 0, 1);
  spotData.progressFill.style.width = `${Math.round(ratio * 100)}%`;

  const shouldShow = spotData.progressVisibleTimer > 0 || (ratio > 0 && ratio < 1);
  spotData.progress.classList.toggle("bath-spot-progress--visible", shouldShow);
}

function tickSpotProgressVisibility(dt) {
  for (let i = 0; i < spots.length; i += 1) {
    const spotData = spots[i];
    spotData.progressVisibleTimer = Math.max(0, spotData.progressVisibleTimer - dt);
    updateSpotProgressVisual(spotData);
  }
}

function scrubSpots(dt) {
  if (!running || !spongeScrubbing) {
    return;
  }

  for (let i = spots.length - 1; i >= 0; i -= 1) {
    const spotData = spots[i];
    if (!intersectsSponge(spotData)) {
      continue;
    }

    spotData.progressVisibleTimer = SPOT_PROGRESS_VISIBLE_SECONDS;

    if (dt > 0) {
      spotData.scrubSeconds += dt;
    }

    updateSpotProgressVisual(spotData);

    if (spotData.scrubSeconds >= SPOT_SCRUB_REQUIRED_SECONDS) {
      cleanSpot(spotData);
    }
  }
}

function moveSpongeWithPointer(event) {
  const point = getPointerPositionInArena(event);
  setSpongePosition(point.x - SPONGE_WIDTH / 2, point.y - SPONGE_HEIGHT / 2);
  scrubSpots(0);
}

function createSpot() {
  const spot = document.createElement("button");
  spot.type = "button";
  spot.className = "bath-spot";
  spot.setAttribute("aria-label", "Clean muddy spot");
  applySpriteIfAvailable(spot, SPRITE_ASSETS.dirtSpot);

  const arenaBounds = getArenaBounds();
  const arenaWidth = arenaBounds.width;
  const arenaHeight = arenaBounds.height;
  const x = randomBetween(10, Math.max(10, arenaWidth - SPOT_SIZE - 10));
  const y = randomBetween(80, Math.max(85, arenaHeight - SPOT_SIZE - 14));

  spot.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;

  const progress = document.createElement("div");
  progress.className = "bath-spot-progress";

  const progressFill = document.createElement("div");
  progressFill.className = "bath-spot-progress-fill";

  progress.appendChild(progressFill);
  spot.appendChild(progress);

  const spotData = {
    element: spot,
    x,
    y,
    size: SPOT_SIZE,
    scrubSeconds: 0,
    progressVisibleTimer: 0,
    progress,
    progressFill,
  };

  updateSpotProgressVisual(spotData);

  spotsLayer.appendChild(spot);
  spots.push(spotData);
}

function removeSpot(spotData) {
  const index = spots.indexOf(spotData);
  if (index >= 0) {
    spots[index].element.remove();
    spots.splice(index, 1);
  }
}

function cleanSpot(spotData) {
  if (!running) {
    return;
  }

  if (isComfortTemperature()) {
    score += 10;
    setStatus("Great clean! Temperature is comfortable.");
  } else {
    score = Math.max(0, score + 3);
    setStatus("Spot cleaned, but the water temperature needs a little work.");
  }

  removeSpot(spotData);
  updateHud();
}

function getSpawnInterval() {
  const progress = clamp(elapsedSeconds / RUN_DURATION_SECONDS, 0, 1);
  const min = Math.max(0.25, BASE_SPAWN_INTERVAL - progress * 0.8);
  const max = Math.max(min + 0.12, BASE_SPAWN_INTERVAL + 0.32 - progress * 0.95);
  return randomBetween(min, max);
}

function getSpawnBatchCount() {
  const progress = clamp(elapsedSeconds / RUN_DURATION_SECONDS, 0, 1);

  if (progress < 0.35) {
    return 1;
  }

  if (progress < 0.7) {
    return Math.random() < 0.3 ? 2 : 1;
  }

  return Math.random() < 0.7 ? 2 : 1;
}

function adjustTemperature(delta) {
  if (!running) {
    return;
  }

  temperature = clamp(temperature + delta, TEMP_MIN, TEMP_MAX);
  updateHud();
  updateTemperatureWarning();

  if (temperature <= TEMP_MIN) {
    endRun("Water got too cold.");
  }

  if (temperature >= TEMP_MAX) {
    endRun("Water got too hot.");
  }
}

function coolWater() {
  adjustTemperature(-8);
}

function heatWater() {
  adjustTemperature(8);
}

function getRewardPoints(currentScore) {
  const base = Math.floor(currentScore / 45);
  const total = base + 1;
  const boostedReward = Math.round(total * 1.2);
  return clamp(boostedReward, 1, 14);
}

function endRun(reasonMessage) {
  running = false;
  spongeScrubbing = false;
  sponge.classList.remove("bath-sponge--scrubbing");

  if (loopHandle) {
    cancelAnimationFrame(loopHandle);
    loopHandle = null;
  }

  saveBestScore();
  updateHud();

  scrubSpots(0);

  const reward = getRewardPoints(score);
  rewardPending = Math.max(rewardPending, reward);
  claimRewardBtn.disabled = false;
  startBtn.textContent = "Start New Bath";
  setStatus(`${reasonMessage} Reward ready: +${reward} Social and +${Math.max(1, Math.ceil(reward / 2))} Spiritual`);
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

  driftTimer += dt;
  if (driftTimer >= 1.3) {
    driftTimer = 0;
    driftRate = randomBetween(-2.4, 2.4);
  }

  temperature = clamp(temperature + driftRate * dt * 4, TEMP_MIN, TEMP_MAX);
  updateTemperatureWarning();

  if (temperature <= TEMP_MIN) {
    updateHud();
    arena.classList.remove("bath-arena--danger", "bath-arena--danger-cold", "bath-arena--danger-hot");
    endRun("Water got too cold.");
    return;
  }

  if (temperature >= TEMP_MAX) {
    updateHud();
    arena.classList.remove("bath-arena--danger", "bath-arena--danger-cold", "bath-arena--danger-hot");
    endRun("Water got too hot.");
    return;
  }

  tickSpotProgressVisibility(dt);

  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnInterval = getSpawnInterval();
    const batchCount = getSpawnBatchCount();
    for (let i = 0; i < batchCount; i += 1) {
      if (spots.length >= MAX_SPOTS) {
        break;
      }
      createSpot();
    }
  }

  scrubSpots(dt);

  updateHud();

  if (spots.length >= MAX_SPOTS) {
    endRun("Too many dirty spots built up.");
    return;
  }

  if (timeLeft <= 0) {
    endRun("Bath complete.");
    return;
  }

  loopHandle = requestAnimationFrame(step);
}

function startRun() {
  clearSpots();
  resetSponge();

  score = 0;
  timeLeft = RUN_DURATION_SECONDS;
  temperature = 50;
  rewardPending = Math.max(0, rewardPending);
  spawnTimer = 0;
  spawnInterval = getSpawnInterval();
  driftTimer = 0;
  driftRate = randomBetween(-1.5, 1.5);
  elapsedSeconds = 0;
  lastFrame = 0;
  tempWarningTimer = 0;
  running = true;

  claimRewardBtn.disabled = rewardPending <= 0;
  startBtn.textContent = "Restart Bath";

  updateHud();
  updateTemperatureWarning();
  setStatus("Bath Time Balance running.");

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
      // Keep defaults when saved data cannot be parsed.
    }
  }

  const socialGain = points;
  const spiritualGain = Math.max(1, Math.ceil(points / 2));

  data.social = clamp(Math.round(data.social) + socialGain, 0, 100);
  data.spiritual = clamp(Math.round(data.spiritual) + spiritualGain, 0, 100);

  localStorage.setItem(WELLNESS_STATE_KEY, JSON.stringify(data));
  return { socialGain, spiritualGain };
}

function claimReward() {
  if (rewardPending <= 0) {
    return;
  }

  const points = rewardPending;
  const gains = applyReward(points);

  rewardPending = 0;
  claimRewardBtn.disabled = true;
  setStatus(`Reward applied: +${gains.socialGain} Social and +${gains.spiritualGain} Spiritual`);
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  if (event.key === "ArrowLeft" || key === "a") {
    event.preventDefault();
    coolWater();
  }

  if (event.key === "ArrowRight" || key === "d") {
    event.preventDefault();
    heatWater();
  }

  if (event.key === " " && !running) {
    event.preventDefault();
    startRun();
  }
}

function handleSpongePointerDown(event) {
  if (!running) {
    return;
  }

  event.preventDefault();
  spongeScrubbing = true;
  sponge.classList.add("bath-sponge--scrubbing");
  moveSpongeWithPointer(event);
}

function handlePointerMove(event) {
  if (!spongeScrubbing) {
    return;
  }

  event.preventDefault();
  moveSpongeWithPointer(event);
}

function stopScrub() {
  if (!spongeScrubbing) {
    return;
  }

  spongeScrubbing = false;
  sponge.classList.remove("bath-sponge--scrubbing");
}

function bindEvents() {
  coolBtn.addEventListener("click", coolWater);
  heatBtn.addEventListener("click", heatWater);
  startBtn.addEventListener("click", startRun);
  claimRewardBtn.addEventListener("click", claimReward);
  sponge.addEventListener("pointerdown", handleSpongePointerDown);

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("pointermove", handlePointerMove, { passive: false });
  window.addEventListener("pointerup", stopScrub);
  window.addEventListener("pointercancel", stopScrub);
  window.addEventListener("resize", resetSponge);
}

function init() {
  loadBestScore();
  applySpriteIfAvailable(pet, getSelectedAvatarForCurrentProgress().src || SPRITE_ASSETS.pet);
  applySpriteIfAvailable(sponge, SPRITE_ASSETS.sponge);
  resetSponge();
  updateHud();
  setStatus("Ready");
  bindEvents();
}

init();

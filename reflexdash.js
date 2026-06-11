import { getSelectedAvatarForCurrentProgress } from "./avatar-selection.js";

const track = document.getElementById("reflexTrack");
const player = document.getElementById("reflexPlayer");
const playerSprite = document.getElementById("reflexPlayerSprite");
const scoreText = document.getElementById("reflexScore");
const bestText = document.getElementById("reflexBest");
const livesText = document.getElementById("reflexLives");
const statusText = document.getElementById("reflexStatus");

const startBtn = document.getElementById("startReflexBtn");
const moveUpBtn = document.getElementById("moveUpBtn");
const moveDownBtn = document.getElementById("moveDownBtn");
const claimRewardBtn = document.getElementById("claimRewardBtn");

const BEST_SCORE_KEY = "reflexDashBestScore";
const WELLNESS_STATE_KEY = "wellnessState";

// Optional sprite paths. Leave empty strings to keep fallback placeholders.
const SPRITE_ASSETS = {
  player: "",
  obstacle: "Images/fork.png",
  obstacleDouble: "",
};

const PLAYER_X = 72;
const PLAYER_WIDTH = 56;
const PLAYER_HEIGHT = 76;
const OBSTACLE_SIZE = 30;
const DOUBLE_LANE_SPAWN_CHANCE = 0.08;
const DOUBLE_SPAWN_CHANCE = 0.12;
const BASE_SPEED = 240;
const SPAWN_START_MIN = 0.78;
const SPAWN_START_MAX = 1.18;
const SPAWN_END_MIN = 0.34;
const SPAWN_END_MAX = 0.68;
const SPAWN_RAMP_SECONDS = 120;

let laneHeights = [50, 130, 210];
let playerLane = 1;
let score = 0;
let lives = 3;
let bestScore = 0;
let runSeconds = 0;
let rewardPending = 0;
let obstacles = [];
let loopHandle = null;
let running = false;
let paused = false;
let spawnTimer = 0;
let spawnInterval = 0.95;
let lastFrame = 0;
const spriteLoadCache = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeLaneHeights() {
  const height = track.clientHeight;
  laneHeights = [
    Math.max(20, Math.floor(height * 0.2)),
    Math.max(55, Math.floor(height * 0.5)),
    Math.max(90, Math.floor(height * 0.8)),
  ];
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateHud() {
  scoreText.textContent = String(score);
  livesText.textContent = String(lives);
  bestText.textContent = String(bestScore);
}

function movePlayerToLane(laneIndex) {
  playerLane = clamp(laneIndex, 0, laneHeights.length - 1);
  const y = laneHeights[playerLane] - PLAYER_HEIGHT / 2;
  player.style.transform = `translate(${PLAYER_X}px, ${y}px)`;
}

function moveUp() {
  if (!running) return;
  movePlayerToLane(playerLane - 1);
}

function moveDown() {
  if (!running) return;
  movePlayerToLane(playerLane + 1);
}

function updateBestScore() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
}

function removeObstacleAt(index) {
  const obstacle = obstacles[index];
  obstacle.element.remove();
  obstacles.splice(index, 1);
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
  element.classList.add("reflex-uses-sprite");
  if (playerSprite && element === player) {
    playerSprite.src = path;
    playerSprite.hidden = false;
  } else {
    element.style.backgroundImage = `url("${path}")`;
  }
}

function disableSprite(element) {
  element.classList.remove("reflex-uses-sprite");
  if (playerSprite && element === player) {
    playerSprite.hidden = true;
    playerSprite.removeAttribute("src");
  } else {
    // Remove any inline background image and any obstacle <img> fallback.
    element.style.backgroundImage = "";
    const img = element.querySelector && element.querySelector("img.reflex-obstacle-img");
    if (img) {
      img.hidden = true;
      img.removeAttribute("src");
      // Keep element clean by removing the node.
      img.remove();
    }
  }
}

function applySpriteIfAvailable(element, path) {
  if (!path) {
    disableSprite(element);
    return;
  }

  // Optimistically apply the sprite so the element shows the image
  // immediately; keep track of the requested path so we can roll back
  // if the load fails.
  element.dataset.spritePath = path;
  if (playerSprite && element === player) {
    // For the player, set the img src immediately.
    playerSprite.src = path;
    playerSprite.hidden = false;
    element.classList.add("reflex-uses-sprite");
  } else {
    element.classList.add("reflex-uses-sprite");
    // Prefer an inner <img> for obstacles to avoid background-image timing issues
    // and to make sure the asset scales reliably.
    let img = element.querySelector && element.querySelector("img.reflex-obstacle-img");
    if (!img) {
      img = document.createElement("img");
      img.className = "reflex-obstacle-img";
      img.alt = "";
      img.draggable = false;
      element.appendChild(img);
    }
    img.src = path;
    img.hidden = false;
  }

  // Verify the asset actually loads; if it fails, remove the sprite.
  loadSprite(path).then((loaded) => {
    if (!element.isConnected || element.dataset.spritePath !== path) {
      return;
    }

    if (!loaded) {
      disableSprite(element);
    }
  });
}

function createObstacle(lanes) {
  const obstacle = document.createElement("div");
  obstacle.className = "reflex-obstacle";

  const sortedLanes = Array.from(new Set(lanes)).sort((a, b) => a - b);
  const topLane = sortedLanes[0];
  const bottomLane = sortedLanes[sortedLanes.length - 1];
  const centerY = Math.round((laneHeights[topLane] + laneHeights[bottomLane]) / 2);
  const height =
    sortedLanes.length > 1
      ? Math.max(OBSTACLE_SIZE + 8, laneHeights[bottomLane] - laneHeights[topLane] + OBSTACLE_SIZE)
      : OBSTACLE_SIZE;

  if (sortedLanes.length > 1) {
    obstacle.classList.add("reflex-obstacle--double");
  }

  const obstacleSprite =
    sortedLanes.length > 1 ? SPRITE_ASSETS.obstacleDouble : SPRITE_ASSETS.obstacle;
  applySpriteIfAvailable(obstacle, obstacleSprite);

  obstacle.style.height = `${height}px`;
  // Ensure the obstacle has the expected width so background sprites are visible
  obstacle.style.width = `${OBSTACLE_SIZE}px`;

  track.appendChild(obstacle);
  obstacles.push({
    x: track.clientWidth + OBSTACLE_SIZE,
    lanes: sortedLanes,
    y: centerY,
    width: OBSTACLE_SIZE,
    height,
    element: obstacle,
    hit: false,
  });
}

function spawnObstacle() {
  const roll = Math.random();
  const laneCount = laneHeights.length;

  if (roll < DOUBLE_LANE_SPAWN_CHANCE) {
    const startLane = Math.floor(Math.random() * (laneCount - 1));
    createObstacle([startLane, startLane + 1]);
    return;
  }

  if (roll < DOUBLE_LANE_SPAWN_CHANCE + DOUBLE_SPAWN_CHANCE) {
    const firstLane = Math.floor(Math.random() * laneCount);
    let secondLane = Math.floor(Math.random() * laneCount);
    while (secondLane === firstLane) {
      secondLane = Math.floor(Math.random() * laneCount);
    }
    createObstacle([firstLane]);
    createObstacle([secondLane]);
    return;
  }

  const lane = Math.floor(Math.random() * laneCount);
  createObstacle([lane]);
}

function renderObstacles() {
  for (let i = 0; i < obstacles.length; i += 1) {
    const item = obstacles[i];
    const y = item.y - item.height / 2;
    item.element.style.transform = `translate(${item.x}px, ${y}px)`;
  }
}

function checkCollision(obstacle) {
  if (!obstacle.lanes.includes(playerLane)) return false;

  const playerLeft = PLAYER_X;
  const playerRight = PLAYER_X + PLAYER_WIDTH;
  const obstacleLeft = obstacle.x;
  const obstacleRight = obstacle.x + obstacle.width;

  return obstacleRight >= playerLeft && obstacleLeft <= playerRight;
}

function playerHit() {
  lives -= 1;
  track.classList.add("reflex-hit");
  window.setTimeout(() => {
    track.classList.remove("reflex-hit");
  }, 140);

  if (lives <= 0) {
    endRun();
  }
}

function clearObstacles() {
  for (let i = 0; i < obstacles.length; i += 1) {
    obstacles[i].element.remove();
  }
  obstacles = [];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getSpawnIntervalForTime(seconds) {
  const progress = clamp(seconds / SPAWN_RAMP_SECONDS, 0, 1);
  const min = SPAWN_START_MIN + (SPAWN_END_MIN - SPAWN_START_MIN) * progress;
  const max = SPAWN_START_MAX + (SPAWN_END_MAX - SPAWN_START_MAX) * progress;
  return randomBetween(min, max);
}

function getRewardPoints(currentScore) {
  const scoreReward = Math.floor(currentScore / 40);
  const boostedReward = Math.round(scoreReward * 1.2);
  return clamp(boostedReward, 1, 14);
}

function endRun() {
  running = false;
  updateBestScore();
  updateHud();

  const points = getRewardPoints(score);
  rewardPending = Math.max(rewardPending, points);
  claimRewardBtn.disabled = false;
  startBtn.textContent = "Start New Run";
  setStatus(`Game Over - Reward ready: +${points} Physical`);

  if (loopHandle) {
    cancelAnimationFrame(loopHandle);
    loopHandle = null;
  }
}

function step(timestamp) {
  if (!running || paused) return;

  if (!lastFrame) {
    lastFrame = timestamp;
  }

  const dt = Math.min((timestamp - lastFrame) / 1000, 0.05);
  lastFrame = timestamp;

  runSeconds += dt;
  score = Math.floor(runSeconds * 18);

  const speed = BASE_SPEED + runSeconds * 12;
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnInterval = getSpawnIntervalForTime(runSeconds);
    spawnObstacle();
  }

  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = obstacles[i];
    obstacle.x -= speed * dt;

    if (!obstacle.hit && checkCollision(obstacle)) {
      obstacle.hit = true;
      removeObstacleAt(i);
      playerHit();
      continue;
    }

    if (obstacle.x < -OBSTACLE_SIZE * 1.4) {
      removeObstacleAt(i);
    }
  }

  renderObstacles();
  updateHud();

  if (running) {
    loopHandle = requestAnimationFrame(step);
  }
}

function startRun() {
  clearObstacles();
  computeLaneHeights();

  running = true;
  paused = false;
  score = 0;
  lives = 3;
  runSeconds = 0;
  spawnTimer = 0;
  spawnInterval = getSpawnIntervalForTime(0);
  lastFrame = 0;

  claimRewardBtn.disabled = rewardPending <= 0;
  startBtn.textContent = "Restart Run";
  setStatus("Running");

  movePlayerToLane(1);
  updateHud();

  if (loopHandle) {
    cancelAnimationFrame(loopHandle);
  }
  loopHandle = requestAnimationFrame(step);
}

function loadBestScore() {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  const value = Number.parseInt(raw ?? "0", 10);
  bestScore = Number.isFinite(value) && value > 0 ? value : 0;
}

function applyPhysicalReward(points) {
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
        intellectual: Number.isFinite(parsed?.intellectual)
          ? parsed.intellectual
          : 70,
        spiritual: Number.isFinite(parsed?.spiritual) ? parsed.spiritual : 70,
      };
    } catch {
      // Keep defaults if saved data is invalid.
    }
  }

  data.physical = clamp(Math.round(data.physical) + points, 0, 100);

  localStorage.setItem(WELLNESS_STATE_KEY, JSON.stringify(data));
}

function claimReward() {
  if (rewardPending <= 0) {
    return;
  }

  const points = rewardPending;
  applyPhysicalReward(points);

  rewardPending = 0;
  claimRewardBtn.disabled = true;
  setStatus(`Reward applied: +${points} Physical`);
}

function handleKeyDown(event) {
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
    event.preventDefault();
    moveUp();
  }

  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
    event.preventDefault();
    moveDown();
  }

  if (event.key === " " && !running) {
    event.preventDefault();
    startRun();
  }
}

function bindEvents() {
  startBtn.addEventListener("click", startRun);
  moveUpBtn.addEventListener("click", moveUp);
  moveDownBtn.addEventListener("click", moveDown);
  claimRewardBtn.addEventListener("click", claimReward);

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", () => {
    computeLaneHeights();
    movePlayerToLane(playerLane);

    // Keep active obstacles aligned to their lane centers after resize.
    for (let i = 0; i < obstacles.length; i += 1) {
      const item = obstacles[i];
      const topLane = item.lanes[0];
      const bottomLane = item.lanes[item.lanes.length - 1];
      item.y = Math.round((laneHeights[topLane] + laneHeights[bottomLane]) / 2);
      item.height =
        item.lanes.length > 1
          ? Math.max(OBSTACLE_SIZE + 8, laneHeights[bottomLane] - laneHeights[topLane] + OBSTACLE_SIZE)
          : OBSTACLE_SIZE;
      item.element.style.height = `${item.height}px`;
    }

    renderObstacles();
  });
}

function init() {
  loadBestScore();
  computeLaneHeights();
  movePlayerToLane(1);
  applySpriteIfAvailable(player, getSelectedAvatarForCurrentProgress().src || SPRITE_ASSETS.player);
  updateHud();
  bindEvents();
  setStatus("Ready");
}

init();

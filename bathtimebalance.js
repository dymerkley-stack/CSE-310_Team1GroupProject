import { getSelectedAvatarForCurrentProgress } from "./avatar-selection.js";

const arena = document.getElementById("harvestArena");
const playerBasket = document.getElementById("playerBasket");
const miniSpudsLayer = document.getElementById("miniSpudsLayer");
const barnEl = document.getElementById("barnElement");

const scoreText = document.getElementById("harvestScore");
const bestText = document.getElementById("harvestBest");
const timeText = document.getElementById("harvestTime");
const basketText = document.getElementById("harvestBasket");
const statusText = document.getElementById("harvestStatus");

const startBtn = document.getElementById("startHarvestBtn");
const claimRewardBtn = document.getElementById("claimHarvestRewardBtn");
const bonusBar = document.getElementById("harvestBonusBar");

const BEST_SCORE_KEY = "potatoHarvestBestScore";
const WELLNESS_STATE_KEY = "wellnessState";

const RUN_DURATION_SECONDS = 50;
const MAX_SPUDS_ON_FIELD = 8;
const SPUD_SIZE = 54;
const BASKET_WIDTH = 92;
const BASKET_HEIGHT = 76;
const BARN_WIDTH = 145;
const BARN_HEIGHT = 118;
const BARN_RIGHT_OFFSET = 10;
const BARN_TOP_OFFSET = 10;
const PLAYER_SPEED = 220;
const PLAYER_TOP_LIMIT = BARN_TOP_OFFSET + BARN_HEIGHT + 6;
const BASE_SPAWN_INTERVAL = 1.6;
const MAX_BASKET = 10;

let score = 0;
let bestScore = 0;
let timeLeft = RUN_DURATION_SECONDS;
let rewardPending = 0;
let basketCount = 0;
let miniSpuds = [];
let running = false;
let spawnTimer = 0;
let spawnInterval = BASE_SPAWN_INTERVAL;
let elapsedSeconds = 0;
let lastFrame = 0;
let loopHandle = null;
let basketX = 0;
let basketY = 0;
let wasAtBarn = false;
let avatarSrc = "";
let bonusBarTimeout = null;
const keysHeld = new Set();

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
  timeText.textContent = String(Math.max(0, Math.ceil(timeLeft)));
  basketText.textContent = basketCount >= MAX_BASKET ? "FULL" : `${basketCount} / ${MAX_BASKET}`;
  playerBasket.classList.toggle("player-basket--full", basketCount >= MAX_BASKET);
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

function getBarnBounds() {
  const bounds = getArenaBounds();
  return {
    x: bounds.width - BARN_WIDTH - BARN_RIGHT_OFFSET,
    y: BARN_TOP_OFFSET,
    width: BARN_WIDTH,
    height: BARN_HEIGHT,
  };
}

function placeBasket() {
  playerBasket.style.transform = `translate(${Math.round(basketX)}px, ${Math.round(basketY)}px)`;
}

function setBasketPosition(nextX, nextY) {
  const bounds = getArenaBounds();
  const maxX = Math.max(0, bounds.width - BASKET_WIDTH);
  const maxY = Math.max(0, bounds.height - BASKET_HEIGHT - 8);
  basketX = clamp(nextX, 0, maxX);
  basketY = clamp(nextY, 0, maxY);
  placeBasket();
}

function resetBasket() {
  basketCount = 0;
  playerBasket.classList.remove("player-basket--full");
  const bounds = getArenaBounds();
  setBasketPosition(
    Math.round(bounds.width / 2 - BASKET_WIDTH / 2),
    Math.max(0, bounds.height - BASKET_HEIGHT - 20),
  );
}

function intersectsBasket(x, y, w, h) {
  const basketRight = basketX + BASKET_WIDTH;
  const basketBottom = basketY + BASKET_HEIGHT;
  return basketRight >= x && basketX <= x + w && basketBottom >= y && basketY <= y + h;
}

function removeMiniSpud(miniSpudData) {
  const index = miniSpuds.indexOf(miniSpudData);
  if (index >= 0) {
    miniSpuds[index].element.remove();
    miniSpuds.splice(index, 1);
  }
}

function collectMiniSpud(miniSpudData) {
  if (!running || basketCount >= MAX_BASKET) return;
  basketCount += 1;
  removeMiniSpud(miniSpudData);
  updateHud();
  if (basketCount >= MAX_BASKET) {
    setStatus("Basket full! Head to the barn!");
  } else {
    setStatus(`Collected! ${basketCount} / ${MAX_BASKET} in basket.`);
  }
}

function showBonusBar(message, stat) {
  if (bonusBarTimeout) clearTimeout(bonusBarTimeout);
  bonusBar.textContent = message;
  bonusBar.classList.remove("harvest-bonus-bar--physical", "harvest-bonus-bar--mental");
  bonusBar.classList.add(stat === "Physical" ? "harvest-bonus-bar--physical" : "harvest-bonus-bar--mental");
  bonusBar.classList.add("harvest-bonus-bar--visible");
  bonusBarTimeout = setTimeout(() => {
    bonusBar.classList.remove("harvest-bonus-bar--visible");
    bonusBarTimeout = null;
  }, 2800);
}

function applyFullBasketBonus() {
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
  const stat = Math.random() < 0.5 ? "physical" : "mental";
  data[stat] = clamp(Math.round(data[stat]) + 5, 0, 100);
  localStorage.setItem(WELLNESS_STATE_KEY, JSON.stringify(data));
  return stat === "physical" ? "Physical" : "Mental";
}

function depositAtBarn() {
  if (!running || basketCount <= 0) return;
  const deposited = basketCount;
  const wasFull = deposited >= MAX_BASKET;
  score += deposited * 10;
  basketCount = 0;
  updateHud();

  if (wasFull) {
    const bonusStat = applyFullBasketBonus();
    setStatus(`Full basket delivered! +${deposited * 10} points`);
    showBonusBar(`+5 ${bonusStat} bonus for a full basket!`, bonusStat);
  } else {
    setStatus(`Deposited ${deposited} spud${deposited !== 1 ? "s" : ""}! +${deposited * 10} points`);
  }

  barnEl.classList.add("barn--flash");
  setTimeout(() => barnEl.classList.remove("barn--flash"), 350);
}

function checkCollections() {
  if (!running) return;
  for (let i = miniSpuds.length - 1; i >= 0; i -= 1) {
    const s = miniSpuds[i];
    if (basketCount < MAX_BASKET && intersectsBasket(s.x, s.y, SPUD_SIZE, SPUD_SIZE)) {
      collectMiniSpud(s);
    }
  }
}

function checkBarnDeposit() {
  if (!running) return;
  const barn = getBarnBounds();
  const atBarn = intersectsBasket(barn.x, barn.y, barn.width, barn.height);
  if (atBarn && !wasAtBarn && basketCount > 0) {
    depositAtBarn();
  }
  wasAtBarn = atBarn;
}

function createMiniSpud() {
  const el = document.createElement("div");
  el.className = "mini-spud";
  el.setAttribute("aria-hidden", "true");

  if (avatarSrc) {
    el.style.backgroundImage = `url("${avatarSrc}")`;
  }

  const bounds = getArenaBounds();
  const barn = getBarnBounds();

  let x, y, attempts = 0;
  do {
    x = randomBetween(10, Math.max(10, bounds.width - SPUD_SIZE - 10));
    y = randomBetween(PLAYER_TOP_LIMIT, Math.max(PLAYER_TOP_LIMIT + 20, bounds.height - SPUD_SIZE - 14));
    attempts += 1;
  } while (
    attempts < 12 &&
    x + SPUD_SIZE >= barn.x - 10 && x <= barn.x + barn.width + 10 &&
    y + SPUD_SIZE >= barn.y - 10 && y <= barn.y + barn.height + 10
  );

  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;

  const miniSpudData = { element: el, x, y, size: SPUD_SIZE };
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

  if (keysHeld.has("ArrowLeft")) setBasketPosition(basketX - PLAYER_SPEED * dt, basketY);
  if (keysHeld.has("ArrowRight")) setBasketPosition(basketX + PLAYER_SPEED * dt, basketY);
  if (keysHeld.has("ArrowUp")) setBasketPosition(basketX, basketY - PLAYER_SPEED * dt);
  if (keysHeld.has("ArrowDown")) setBasketPosition(basketX, basketY + PLAYER_SPEED * dt);

  checkBarnDeposit();
  checkCollections();

  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnInterval = getSpawnInterval();
    const batchCount = getSpawnBatchCount();
    for (let i = 0; i < batchCount; i += 1) {
      if (miniSpuds.length >= MAX_SPUDS_ON_FIELD) break;
      createMiniSpud();
    }
  }

  updateHud();

  if (miniSpuds.length >= MAX_SPUDS_ON_FIELD) {
    endRun("The field overflowed with spuds!");
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
  resetBasket();

  score = 0;
  timeLeft = RUN_DURATION_SECONDS;
  rewardPending = Math.max(0, rewardPending);
  spawnTimer = 0;
  spawnInterval = getSpawnInterval();
  elapsedSeconds = 0;
  lastFrame = 0;
  wasAtBarn = false;
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
  window.addEventListener("resize", resetBasket);
}

function init() {
  loadBestScore();
  avatarSrc = getSelectedAvatarForCurrentProgress().src || "";
  resetBasket();
  updateHud();
  setStatus("Ready");
  bindEvents();
}

init();

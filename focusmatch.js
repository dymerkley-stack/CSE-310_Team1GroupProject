const board = document.getElementById("focusBoard");
const cells = Array.from(board.querySelectorAll(".focus-cell"));
const scoreText = document.getElementById("focusScore");
const bestText = document.getElementById("focusBest");
const roundText = document.getElementById("focusRound");
const livesText = document.getElementById("focusLives");
const statusText = document.getElementById("focusStatus");

const startBtn = document.getElementById("startFocusBtn");
const claimRewardBtn = document.getElementById("claimFocusRewardBtn");

const BEST_SCORE_KEY = "focusMatchBestScore";
const WELLNESS_STATE_KEY = "wellnessState";

// Optional sprite paths. Leave empty strings to keep fallback placeholders.
const SPRITE_ASSETS = {
  cells: {
    idle: "",
    active: "",
    correct: "",
    wrong: "",
  },
};

let score = 0;
let bestScore = 0;
let round = 1;
let lives = 3;
let sequence = [];
let inputIndex = 0;
let rewardPending = 0;
let running = false;
let acceptingInput = false;
let runToken = 0;
const spriteLoadCache = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
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
  element.classList.add("focus-uses-sprite");
  element.style.backgroundImage = `url("${path}")`;
}

function disableSprite(element) {
  element.classList.remove("focus-uses-sprite");
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

function getCellSpritePathForState(state) {
  return SPRITE_ASSETS.cells[state] ?? "";
}

function applyCellSpriteState(cell, state) {
  applySpriteIfAvailable(cell, getCellSpritePathForState(state));
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateHud() {
  scoreText.textContent = String(score);
  bestText.textContent = String(bestScore);
  roundText.textContent = String(round);
  livesText.textContent = String(lives);
}

function saveBestScore() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
}

function loadBestScore() {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  const parsed = Number.parseInt(raw ?? "0", 10);
  bestScore = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildSequence(length) {
  const output = [];
  let prev = -1;

  for (let i = 0; i < length; i += 1) {
    let next = Math.floor(Math.random() * cells.length);
    while (next === prev) {
      next = Math.floor(Math.random() * cells.length);
    }
    output.push(next);
    prev = next;
  }

  return output;
}

function setBoardInteractive(enabled) {
  for (let i = 0; i < cells.length; i += 1) {
    cells[i].disabled = !enabled;
  }
  board.classList.toggle("focus-board--locked", !enabled);
}

function flashCell(index, className, duration = 260) {
  const cell = cells[index];
  if (!cell) return;

  let state = "active";
  if (className === "focus-cell--correct") {
    state = "correct";
  } else if (className === "focus-cell--wrong") {
    state = "wrong";
  }

  cell.classList.add(className);
  applyCellSpriteState(cell, state);

  window.setTimeout(() => {
    cell.classList.remove(className);
    applyCellSpriteState(cell, "idle");
  }, duration);
}

async function showSequence(token) {
  setBoardInteractive(false);

  const baseGap = Math.max(180, 340 - round * 8);
  const flashDuration = Math.max(170, 300 - round * 6);

  await sleep(260);

  for (let i = 0; i < sequence.length; i += 1) {
    if (token !== runToken || !running) {
      return;
    }

    flashCell(sequence[i], "focus-cell--active", flashDuration);
    await sleep(flashDuration + baseGap);
  }
}

function getRoundLength() {
  return clamp(2 + round, 3, 9);
}

function getRoundPoints(length) {
  return 8 + length * 3;
}

function getRewardPoints() {
  const base = Math.floor(score / 70);
  const bonus = Math.floor((round - 1) / 2);
  const total = base + bonus + 1;
  const boostedReward = Math.round(total * 1.2);
  return clamp(boostedReward, 2, 16);
}

function endRun() {
  running = false;
  acceptingInput = false;
  saveBestScore();
  updateHud();

  const reward = getRewardPoints();
  rewardPending = Math.max(rewardPending, reward);
  claimRewardBtn.disabled = false;
  startBtn.textContent = "Start New Run";
  setBoardInteractive(false);
  setStatus(`Game Over - Reward ready: +${reward} Mental and +${Math.max(1, Math.ceil(reward / 2))} Intellectual`);
}

async function beginRound(token) {
  if (!running || token !== runToken) return;

  acceptingInput = false;
  inputIndex = 0;

  const length = getRoundLength();
  sequence = buildSequence(length);

  setStatus(`Round ${round}: Memorize ${length} steps`);
  await showSequence(token);

  if (!running || token !== runToken) return;

  acceptingInput = true;
  setBoardInteractive(true);
  setStatus(`Round ${round}: Repeat the pattern`);
}

function onCorrectStep() {
  flashCell(sequence[inputIndex], "focus-cell--correct", 180);
  inputIndex += 1;

  if (inputIndex < sequence.length) {
    return;
  }

  score += getRoundPoints(sequence.length);
  round += 1;
  saveBestScore();
  updateHud();

  acceptingInput = false;
  setBoardInteractive(false);
  setStatus("Nice! Next round incoming...");

  const token = runToken;
  window.setTimeout(() => {
    beginRound(token);
  }, 650);
}

function onWrongStep(cellIndex) {
  flashCell(cellIndex, "focus-cell--wrong", 240);
  lives -= 1;
  updateHud();

  if (lives <= 0) {
    endRun();
    return;
  }

  acceptingInput = false;
  setBoardInteractive(false);
  setStatus(`Miss! ${lives} lives left. Watch the pattern again.`);

  const token = runToken;
  window.setTimeout(() => {
    inputIndex = 0;
    beginRound(token);
  }, 700);
}

function handleCellClick(event) {
  const target = event.target.closest(".focus-cell");
  if (!target || !acceptingInput || !running) {
    return;
  }

  const index = Number.parseInt(target.dataset.index ?? "-1", 10);
  if (!Number.isFinite(index) || index < 0) {
    return;
  }

  const expected = sequence[inputIndex];
  if (index === expected) {
    onCorrectStep();
  } else {
    onWrongStep(index);
  }
}

function startRun() {
  runToken += 1;
  const token = runToken;

  running = true;
  acceptingInput = false;
  score = 0;
  round = 1;
  lives = 3;
  sequence = [];
  inputIndex = 0;

  startBtn.textContent = "Restart Run";
  claimRewardBtn.disabled = rewardPending <= 0;

  updateHud();
  setBoardInteractive(false);
  setStatus("Get ready...");

  beginRound(token);
}

function applyRewardToWellness(points) {
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
      // Keep defaults when parsing fails.
    }
  }

  const mentalGain = points;
  const intellectualGain = Math.max(1, Math.ceil(points / 2));

  data.mental = clamp(Math.round(data.mental) + mentalGain, 0, 100);
  data.intellectual = clamp(
    Math.round(data.intellectual) + intellectualGain,
    0,
    100,
  );

  localStorage.setItem(WELLNESS_STATE_KEY, JSON.stringify(data));
  return { mentalGain, intellectualGain };
}

function claimReward() {
  if (rewardPending <= 0) {
    return;
  }

  const points = rewardPending;
  const gains = applyRewardToWellness(points);

  rewardPending = 0;
  claimRewardBtn.disabled = true;
  setStatus(
    `Reward applied: +${gains.mentalGain} Mental and +${gains.intellectualGain} Intellectual`,
  );
}

function bindEvents() {
  startBtn.addEventListener("click", startRun);
  claimRewardBtn.addEventListener("click", claimReward);
  board.addEventListener("click", handleCellClick);
}

function init() {
  loadBestScore();
  updateHud();
  setBoardInteractive(false);
  setStatus("Ready");

  for (let i = 0; i < cells.length; i += 1) {
    applyCellSpriteState(cells[i], "idle");
  }

  bindEvents();
}

init();

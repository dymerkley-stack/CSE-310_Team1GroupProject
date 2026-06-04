import {
  loadLatestState,
  saveGameState,
  saveToCloud,
  getPlayerId,
} from "./database.js";
import { getSelectedAvatarForLevel } from "./avatar-selection.js";

async function testDatabase() {
  // TEST SAVE
  await saveGameState(state);

  // TEST LOAD
  const pets = await loadLatestState();

  console.log("DATABASE RESPONSE:", pets);
}

const initialState = {
  physical: 50,
  mental: 50,
  social: 50,
  intellectual: 50,
  spiritual: 50,
  checkins: 0,
  level: 1,
  exp: 0,
  gameOver: false,
};

const state = { ...initialState };

async function syncCloudSave() {
  const cloudData = await loadLatestState();

  if (cloudData) {
    Object.keys(cloudData).forEach((key) => {
      if (key in state && cloudData[key] !== null) {
        state[key] = cloudData[key];
      }
    });
  }
}
async function initializeGame() {
  await syncCloudSave();
  console.log("Cloud save loaded:", state);
}

const wellnessKeys = [
  "physical",
  "mental",
  "social",
  "intellectual",
  "spiritual",
];
const DAILY_TASKS_PER_CATEGORY = 2;
const DAILY_TASKS_KEY = "wellnessDailyTasks";
const WELLNESS_PROGRESS_KEY = "wellnessProgress";
const EXP_BASE = 100;
const EXP_MULTIPLIER = 1.15;
const CONFETTI_COLORS = [
  "#ff6b6b",
  "#ffd93d",
  "#6bcB77",
  "#4d96ff",
  "#ff9f1c",
  "#f15bb5",
];

function expRequiredForLevel(level) {
  return Math.round(EXP_BASE * Math.pow(EXP_MULTIPLIER, level - 1));
}
const DEFAULT_CATEGORY_POINTS = {
  physical: 18,
  mental: 18,
  social: 20,
  intellectual: 20,
  spiritual: 18,
};
initializeGame();
testDatabase();
console.log("Before:", state.physical);

state.physical = 20;

console.log("After:", state.physical);

const taskPools = {
  physical: [
    {
      title: "Move for 10 minutes",
      details: "Take a walk, do push-ups, or stretch to build momentum.",
      points: 18,
    },
    {
      title: "Drink a full glass of water",
      details: "Hydration helps your body and focus stay stable.",
      points: 12,
    },
    {
      title: "Do 20 squats",
      details: "A quick bodyweight set boosts physical energy.",
      points: 20,
    },
    {
      title: "Take a posture break",
      details: "Stand up and reset your posture for 2 minutes.",
      points: 10,
    },
    {
      title: "Walk between classes",
      details: "Choose stairs or add a 10-minute brisk walk today.",
      points: 16,
    },
    {
      title: "Do a short mobility flow",
      details: "Spend 8 minutes loosening hips, shoulders, and back.",
      points: 18,
    },
    {
      title: "Prep one healthy snack",
      details: "Pick fruit, nuts, or yogurt instead of a random grab.",
      points: 14,
    },
    {
      title: "Sleep routine check",
      details: "Set a bedtime target and stop screens 20 minutes before.",
      points: 16,
    },
    {
      title: "Do a stair burst",
      details: "Climb stairs for 5 focused minutes to raise your heart rate.",
      points: 18,
    },
    {
      title: "Stretch after sitting",
      details: "Do a 6-minute stretch break after study time.",
      points: 14,
    },
    {
      title: "Pack a water bottle",
      details: "Keep water with you and refill it at least once.",
      points: 12,
    },
    {
      title: "Core mini-circuit",
      details: "Complete one quick core set: plank, crunches, and leg raises.",
      points: 20,
    },
  ],
  mental: [
    {
      title: "Journal one reflection",
      details: "Write down one thought and one next step.",
      points: 18,
    },
    {
      title: "Read for 15 minutes",
      details: "Spend focused time with a book or article.",
      points: 16,
    },
    {
      title: "Plan tomorrow",
      details: "List your top three priorities for tomorrow.",
      points: 14,
    },
    {
      title: "Do a focus sprint",
      details: "Work distraction-free for 20 minutes.",
      points: 20,
    },
    {
      title: "Brain dump for 5 minutes",
      details: "Write every worry or task on paper to clear your mind.",
      points: 14,
    },
    {
      title: "Use a pomodoro block",
      details: "Complete one 25-minute work sprint and short break.",
      points: 18,
    },
    {
      title: "Tidy your workspace",
      details: "Reset your desk to reduce mental clutter.",
      points: 12,
    },
    {
      title: "Do one hard-first task",
      details: "Knock out your most challenging item early.",
      points: 20,
    },
    {
      title: "Set three clear priorities",
      details: "Choose your top three wins for today and write them down.",
      points: 14,
    },
    {
      title: "Take a mindful reset",
      details: "Pause for 3 minutes and breathe slowly before your next task.",
      points: 12,
    },
    {
      title: "Limit distractions",
      details: "Turn off non-essential notifications for one focused session.",
      points: 16,
    },
    {
      title: "Reflect on one lesson",
      details: "Write one thing that worked well and one improvement.",
      points: 18,
    },
  ],
  social: [
    {
      title: "Send one kind message",
      details: "Reach out and encourage someone today.",
      points: 20,
    },
    {
      title: "Call a friend or family",
      details: "Have a short check-in conversation.",
      points: 18,
    },
    {
      title: "Thank someone",
      details: "Express appreciation to a person who helped you.",
      points: 12,
    },
    {
      title: "Do one helpful act",
      details: "Support someone with a small practical action.",
      points: 16,
    },
    {
      title: "Start a campus conversation",
      details: "Introduce yourself or chat with someone new for a few minutes.",
      points: 18,
    },
    {
      title: "Reply thoughtfully",
      details: "Send one meaningful response instead of a quick reaction.",
      points: 14,
    },
    {
      title: "Invite someone to study",
      details: "Coordinate one short study or accountability session.",
      points: 20,
    },
    {
      title: "Compliment with intent",
      details: "Give one specific, sincere compliment today.",
      points: 12,
    },
    {
      title: "Check in with a classmate",
      details: "Ask someone how they are doing and listen with attention.",
      points: 16,
    },
    {
      title: "Share a useful resource",
      details: "Send one article, note, or tip that could help someone.",
      points: 14,
    },
    {
      title: "Join one group discussion",
      details: "Contribute a thought in class, chat, or a study group.",
      points: 18,
    },
    {
      title: "Offer practical help",
      details: "Help with one small task like notes, setup, or planning.",
      points: 16,
    },
  ],
  intellectual: [
    {
      title: "Finish one course module",
      details: "Complete one lecture or assignment chunk in a class.",
      points: 22,
    },
    {
      title: "Review class notes",
      details: "Summarize your notes for one current course.",
      points: 16,
    },
    {
      title: "Solve 5 practice problems",
      details: "Work through a short set of practice questions.",
      points: 20,
    },
    {
      title: "Attend office hours or tutoring",
      details: "Ask one question to improve your understanding.",
      points: 18,
    },
    {
      title: "Teach back a concept",
      details: "Explain one concept out loud as if teaching a classmate.",
      points: 18,
    },
    {
      title: "Build a mini cheat sheet",
      details: "Create a one-page summary for a topic you are learning.",
      points: 20,
    },
    {
      title: "Watch one tutorial",
      details: "Complete a focused educational video and take two notes.",
      points: 14,
    },
    {
      title: "Practice spaced recall",
      details: "Quiz yourself on old material for 10 minutes.",
      points: 16,
    },
    {
      title: "Read one research abstract",
      details: "Find a short paper abstract and summarize the main idea.",
      points: 14,
    },
    {
      title: "Make 5 flashcards",
      details: "Create or review five cards for a current course topic.",
      points: 16,
    },
    {
      title: "Solve one challenge problem",
      details: "Attempt a harder question beyond routine homework.",
      points: 22,
    },
    {
      title: "Debug a small issue",
      details: "Fix one bug or misconception and note what caused it.",
      points: 18,
    },
  ],
  spiritual: [
    {
      title: "Practice calm breathing",
      details: "Take 10 slow breaths and center yourself.",
      points: 18,
    },
    {
      title: "Write one gratitude note",
      details: "Capture one thing you are grateful for.",
      points: 14,
    },
    {
      title: "Take a quiet pause",
      details: "Sit in silence for 5 minutes and reset.",
      points: 12,
    },
    {
      title: "Reflect on values",
      details: "Choose one value and one way to live it today.",
      points: 16,
    },
    {
      title: "Take a mindful walk",
      details: "Walk slowly for 10 minutes and notice your surroundings.",
      points: 16,
    },
    {
      title: "Do a short meditation",
      details: "Use a 5-10 minute guided meditation.",
      points: 18,
    },
    {
      title: "Write a self-kindness line",
      details: "Write one supportive statement to yourself.",
      points: 12,
    },
    {
      title: "Disconnect for 15 minutes",
      details: "Step away from screens and reset your attention.",
      points: 14,
    },
    {
      title: "Name today’s intention",
      details: "Choose one word for how you want to show up today.",
      points: 14,
    },
    {
      title: "Do a body scan pause",
      details: "Spend 5 minutes noticing tension and releasing it.",
      points: 16,
    },
    {
      title: "Step outside in silence",
      details: "Take a few quiet minutes outdoors without your phone.",
      points: 14,
    },
    {
      title: "End-day gratitude trio",
      details: "Write three small things that went well today.",
      points: 18,
    },
  ],
};

let dailyTasks = [];

const bars = {
  physical: document.getElementById("physicalBar"),
  mental: document.getElementById("mentalBar"),
  social: document.getElementById("socialBar"),
  intellectual: document.getElementById("intellectualBar"),
  spiritual: document.getElementById("spiritualBar"),
};

const labels = {
  physical: document.getElementById("physicalValue"),
  mental: document.getElementById("mentalValue"),
  social: document.getElementById("socialValue"),
  intellectual: document.getElementById("intellectualValue"),
  spiritual: document.getElementById("spiritualValue"),
};

const petMood = document.getElementById("petMood");
const petAvatar = document.getElementById("petAvatar");
const levelText = document.getElementById("levelText");
const expFill = document.getElementById("expFill");
const expText = document.getElementById("expText");
const taskHeader = document.getElementById("taskHeader");
const resetBtn = document.getElementById("resetBtn");
const resetGoalsBtn = document.getElementById("resetGoalsBtn");
const taskList = document.getElementById("taskList");
const tabButtons = Array.from(document.querySelectorAll(".tab[data-tab]"));
const customGoalToggle = document.getElementById("customGoalToggle");
const customGoalPanel = document.getElementById("customGoalPanel");
const customGoalForm = document.getElementById("customGoalForm");
const customGoalLabel = document.getElementById("customGoalLabel");
const customGoalInput = document.getElementById("customGoalInput");
const customGoalSubmit = document.getElementById("customGoalSubmit");
const customGoalHint = document.getElementById("customGoalHint");
const recommendationText = document.getElementById("recommendationText");
const recommendationButton = document.getElementById("recommendationButton");
const useRecommendationButton = document.getElementById("useRecommendationButton");

let activeCategory = "physical";
let currentRecommendation = "";
let isCustomGoalPanelOpen = false;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function averageWellness() {
  return (
    wellnessKeys.reduce((sum, key) => sum + state[key], 0) / wellnessKeys.length
  );
}

function currentLevel() {
  return state.level;
}

async function saveProgress() {
  localStorage.setItem(
    WELLNESS_PROGRESS_KEY,
    JSON.stringify({
      level: state.level,
      exp: state.exp,
      checkins: state.checkins,
    }),
  );
  saveWellnessState();
  const playerId = await getPlayerId();
  await saveToCloud(state, playerId);
}

function saveWellnessState() {
  localStorage.setItem(
    "wellnessState",
    JSON.stringify({
      physical: state.physical,
      mental: state.mental,
      social: state.social,
      intellectual: state.intellectual,
      spiritual: state.spiritual,
    }),
  );
}

function loadWellnessState() {
  const raw = localStorage.getItem("wellnessState");
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    wellnessKeys.forEach((key) => {
      if (Number.isFinite(parsed?.[key])) {
        state[key] = clamp(parsed[key]);
      }
    });
  } catch {
    // leave defaults intact
  }
}

function loadProgress() {
  const raw = localStorage.getItem(WELLNESS_PROGRESS_KEY);

  if (!raw) {
    const derivedLevel = Math.max(1, Math.floor(state.checkins / 5) + 1);
    state.level = derivedLevel;
    state.exp = 0;
    saveProgress();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const safeLevel = Number.isFinite(parsed?.level)
      ? Math.max(1, Math.floor(parsed.level))
      : 1;
    const safeExp = Number.isFinite(parsed?.exp)
      ? clamp(Math.floor(parsed.exp), 0, expRequiredForLevel(safeLevel) - 1)
      : 0;
    const safeCheckins = Number.isFinite(parsed?.checkins)
      ? Math.max(0, Math.floor(parsed.checkins))
      : 0;

    state.level = safeLevel;
    state.exp = safeExp;
    state.checkins = safeCheckins;
  } catch {
    state.level = 1;
    state.exp = 0;
    state.checkins = 0;
    saveProgress();
  }
}

function rainConfetti(options = {}) {
  const count = Number.isFinite(options.count)
    ? Math.max(20, Math.floor(options.count))
    : 110;
  const baseDuration = Number.isFinite(options.duration)
    ? Math.max(900, Math.floor(options.duration))
    : 2200;

  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "hidden";
  container.style.zIndex = "9999";

  document.body.appendChild(container);

  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("span");
    const size = 5 + Math.random() * 7;
    const drift = -120 + Math.random() * 240;
    const rotation = -540 + Math.random() * 1080;
    const duration = baseDuration + Math.random() * 900;
    const delay = Math.random() * 300;

    piece.style.position = "absolute";
    piece.style.top = "-10px";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * (Math.random() > 0.5 ? 1 : 0.55)}px`;
    piece.style.background =
      CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.opacity = String(0.8 + Math.random() * 0.2);
    piece.style.borderRadius = Math.random() > 0.5 ? "1px" : "50%";

    container.appendChild(piece);
    piece.animate(
      [
        { transform: "translate3d(0, -12px, 0) rotate(0deg)" },
        {
          transform: `translate3d(${drift}px, ${window.innerHeight + 50}px, 0) rotate(${rotation}deg)`,
        },
      ],
      {
        duration,
        delay,
        easing: "cubic-bezier(0.22, 0.7, 0.3, 1)",
        fill: "forwards",
      },
    );
  }

  setTimeout(() => {
    container.remove();
  }, baseDuration + 1400);
}

function showLevelUpBanner(levelsGained = 1) {
  const gained = Math.max(1, Math.floor(levelsGained));
  const banner = document.createElement("div");
  const message = gained > 1 ? `LEVEL UP x${gained}!` : "LEVEL UP!";

  banner.setAttribute("aria-live", "polite");
  banner.textContent = message;
  banner.style.position = "fixed";
  banner.style.left = "50%";
  banner.style.top = "18%";
  banner.style.transform = "translate(-50%, -20px) scale(0.96)";
  banner.style.padding = "0.75rem 1.25rem";
  banner.style.borderRadius = "999px";
  banner.style.fontFamily =
    "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
  banner.style.fontSize = "clamp(1.1rem, 2.8vw, 1.7rem)";
  banner.style.letterSpacing = "0.08em";
  banner.style.color = "#ffffff";
  banner.style.background = "linear-gradient(135deg, #ff9f1c, #ff4d6d)";
  banner.style.boxShadow = "0 14px 30px rgba(0, 0, 0, 0.28)";
  banner.style.zIndex = "10000";
  banner.style.pointerEvents = "none";
  banner.style.opacity = "0";

  document.body.appendChild(banner);

  banner.animate(
    [
      { opacity: 0, transform: "translate(-50%, -20px) scale(0.96)" },
      { opacity: 1, transform: "translate(-50%, 0) scale(1)" },
      { opacity: 1, transform: "translate(-50%, 0) scale(1)" },
      { opacity: 0, transform: "translate(-50%, -12px) scale(1.03)" },
    ],
    {
      duration: 1550,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      fill: "forwards",
    },
  );

  setTimeout(() => {
    banner.remove();
  }, 1650);
}

function addExp(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;

  state.exp += Math.floor(amount);
  let levelsGained = 0;
  while (state.exp >= expRequiredForLevel(state.level)) {
    state.exp -= expRequiredForLevel(state.level);
    state.level += 1;
    levelsGained += 1;
  }

  if (levelsGained > 0) {
    rainConfetti({ count: 100 + levelsGained * 15, duration: 2300 });
    showLevelUpBanner(levelsGained);
  }

  saveProgress();
  render();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function shuffleCopy(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateDailyTasks() {
  const tasks = [];
  wellnessKeys.forEach((category) => {
    const picked = shuffleCopy(taskPools[category]).slice(
      0,
      DAILY_TASKS_PER_CATEGORY,
    );
    picked.forEach((task, index) => {
      tasks.push({
        id: `${todayKey()}-${category}-${index}`,
        category,
        title: task.title,
        details: task.details,
        points: task.points,
        completed: false,
      });
    });
  });
  return tasks;
}

function fillMissingCategoryTasks(tasks) {
  const normalizedTasks = [...tasks];

  wellnessKeys.forEach((category) => {
    const baseCount = normalizedTasks.filter(
      (task) => task.category === category && !isCustomTask(task),
    ).length;

    if (baseCount >= DAILY_TASKS_PER_CATEGORY) return;

    const existingTitles = new Set(
      normalizedTasks
        .filter((task) => task.category === category)
        .map((task) => task.title),
    );

    const fallbackPool = shuffleCopy(taskPools[category]).filter(
      (task) => !existingTitles.has(task.title),
    );
    const needed = DAILY_TASKS_PER_CATEGORY - baseCount;
    fallbackPool.slice(0, needed).forEach((task, index) => {
      normalizedTasks.push({
        id: `${todayKey()}-${category}-migrated-${index}-${Math.floor(Math.random() * 10000)}`,
        category,
        title: task.title,
        details: task.details,
        points: task.points,
        completed: false,
      });
    });
  });

  return normalizedTasks;
}

function saveDailyTasks() {
  localStorage.setItem(
    DAILY_TASKS_KEY,
    JSON.stringify({
      date: todayKey(),
      tasks: dailyTasks,
    }),
  );
}

function loadDailyTasks() {
  const raw = localStorage.getItem(DAILY_TASKS_KEY);
  if (!raw) {
    dailyTasks = generateDailyTasks();
    saveDailyTasks();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.date !== todayKey() || !Array.isArray(parsed.tasks)) {
      dailyTasks = generateDailyTasks();
      saveDailyTasks();
      return;
    }

    dailyTasks = fillMissingCategoryTasks(parsed.tasks);
    saveDailyTasks();
  } catch {
    dailyTasks = generateDailyTasks();
    saveDailyTasks();
  }
}

function renderTaskList() {
  if (!taskList) return;

  taskList.innerHTML = "";
  dailyTasks.forEach((task) => {
    const card = document.createElement("article");
    card.className = "task-card";
    card.setAttribute("data-category", task.category);
    card.setAttribute("data-task-id", task.id);
    if (task.category !== activeCategory) {
      card.classList.add("hidden");
    }

    const checkboxClass = task.completed
      ? `checkbox complete ${task.category}`
      : "checkbox";
    const pointsClass = task.completed ? "points complete" : "points";
    const disabled = task.completed || state.gameOver ? "disabled" : "";
    const safeTitle = escapeHtml(task.title);
    const safeDetails = escapeHtml(task.details);

    card.innerHTML = `
      <button class="${checkboxClass}" data-task-id="${task.id}" data-action="${task.category}" aria-label="Complete ${task.category} task" ${disabled}></button>
      <div>
        <h3 class="task-title">${safeTitle}</h3>
        <p class="task-details">${safeDetails}</p>
        <div class="task-meta">
          <span class="timer" aria-live="polite"></span>
          <span class="status" aria-hidden="true"></span>
        </div>
      </div>
      <button class="${pointsClass}" data-task-id="${task.id}" data-action="${task.category}" type="button" aria-label="Complete ${task.category} task for ${task.points} points" ${disabled}>+${task.points} ${toTitleCase(task.category)}</button>
    `;

    taskList.appendChild(card);
  });
}

function toTitleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  const text = String(value ?? "");
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isCustomTask(task) {
  return task.isCustom === true || task.id.includes("-custom-");
}

function hasCustomGoalForCategory(category) {
  return dailyTasks.some(
    (task) => task.category === category && isCustomTask(task),
  );
}

function getGoalRecommendation(category) {
  const pool = taskPools[category] ?? [];
  const existingTitles = new Set(
    dailyTasks
      .filter((task) => task.category === category)
      .map((task) => task.title),
  );

  const candidate = shuffleCopy(pool).find(
    (task) => !existingTitles.has(task.title),
  );

  if (candidate) {
    return candidate.title;
  }

  const fallback = shuffleCopy(pool).find((task) => task.title);
  return (
    fallback?.title || `Add one extra ${category} goal for today.`
  );
}

function updateRecommendation() {
  if (!recommendationText || !recommendationButton || !useRecommendationButton) {
    return;
  }

  currentRecommendation = getGoalRecommendation(activeCategory);
  recommendationText.textContent = currentRecommendation
    ? `Try this: ${currentRecommendation}`
    : `No new recommendation available for ${activeCategory} right now.`;
  recommendationButton.disabled = false;
  useRecommendationButton.disabled = !currentRecommendation;
}

function syncCustomGoalForm() {
  if (
    !customGoalForm ||
    !customGoalLabel ||
    !customGoalInput ||
    !customGoalSubmit ||
    !customGoalHint ||
    !customGoalToggle ||
    !customGoalPanel
  ) {
    return;
  }

  const categoryTitle = toTitleCase(activeCategory);
  const limitReached = hasCustomGoalForCategory(activeCategory);

  customGoalLabel.textContent = categoryTitle;
  customGoalInput.placeholder = `Example: extra ${activeCategory} goal`;
  customGoalInput.disabled = limitReached;
  customGoalSubmit.disabled = limitReached;
  customGoalToggle.disabled = limitReached;
  customGoalToggle.textContent = `+ Add ${categoryTitle} Goal`;

  if (limitReached) {
    isCustomGoalPanelOpen = false;
  }

  customGoalPanel.hidden = !isCustomGoalPanelOpen;
  customGoalToggle.setAttribute("aria-expanded", String(isCustomGoalPanelOpen));

  if (limitReached) {
    customGoalHint.textContent = `You already added your one extra ${categoryTitle} goal for today.`;
    if (recommendationText) {
      recommendationText.textContent = `Goal recommendations are disabled once this category has its extra goal.`;
    }
    if (recommendationButton) {
      recommendationButton.disabled = true;
    }
    if (useRecommendationButton) {
      useRecommendationButton.disabled = true;
    }
  } else {
    customGoalHint.textContent = `Add one extra ${categoryTitle} goal for today.`;
    if (isCustomGoalPanelOpen) {
      updateRecommendation();
    }
  }
}

function renderTabs() {
  tabButtons.forEach((tab) => {
    const category = tab.getAttribute("data-tab");
    const isActive = category === activeCategory;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  const taskCards = Array.from(
    document.querySelectorAll(".task-card[data-category]"),
  );
  taskCards.forEach((card) => {
    const category = card.getAttribute("data-category");
    card.classList.toggle("hidden", category !== activeCategory);
  });

  if (taskHeader) {
    taskHeader.textContent = `${toTitleCase(activeCategory)} Tasks`;
  }

  syncCustomGoalForm();
}

function moodText(avg) {
  if (state.gameOver) return "Your pet needs help. Reset to try again.";
  if (avg >= 80) return "Your pet is thriving. Great consistency.";
  if (avg >= 60) return "Your pet feels good and steady.";
  if (avg >= 40) return "Your pet is getting worried. Time for a check-in.";
  return "Your pet feels neglected. Do a wellness action now.";
}
function updatePetAvatar() {
  if (!petAvatar) return;

  const currentAvatar = getSelectedAvatarForLevel(state.level);

  petAvatar.src = currentAvatar.src;
  petAvatar.alt = currentAvatar.alt;
  petAvatar.setAttribute("aria-label", currentAvatar.alt);
}

function render() {
  Object.keys(bars).forEach((key) => {
    const value = clamp(state[key]);
    bars[key].style.width = `${value}%`;
    labels[key].textContent = String(Math.round(value));
  });

  if (levelText) {
    levelText.textContent = `Level ${currentLevel()}`;
  }
  if (expFill) {
    const expRequired = expRequiredForLevel(state.level);
    const progressPercent = Math.round((state.exp / expRequired) * 100);
    expFill.style.width = `${progressPercent}%`;
  }
  if (expText) {
    const expRequired = expRequiredForLevel(state.level);
    expText.textContent = `${state.exp} / ${expRequired} EXP`;
  }

  updatePetAvatar();

  const actionButtons = Array.from(document.querySelectorAll("[data-action]"));
  actionButtons.forEach((button) => {
    button.disabled = state.gameOver;
  });
}

function applyAction(action) {
  if (state.gameOver) return;

  const boosts = {
    physical: { physical: 18, mental: 4 },
    mental: { mental: 18, spiritual: 3 },
    social: { social: 20, mental: 3 },
    intellectual: { intellectual: 20, mental: 4 },
    spiritual: { spiritual: 18, mental: 2 },
  };

  const selectedBoost = boosts[action];
  if (!selectedBoost) return;

  Object.entries(selectedBoost).forEach(([key, value]) => {
    state[key] = clamp(state[key] + value);
  });

  state.checkins += 1;
  saveProgress();
  render();
}

function completeTask(taskId, sourceButton) {
  const task = dailyTasks.find((item) => item.id === taskId);
  if (!task || task.completed || state.gameOver) return;

  task.completed = true;
    // start the 12-hour cooldown for this task when it's completed
    try {
      setTaskExpiry(task.id);
    } catch (e) {
      // ignore if timer helpers not yet available
    }
  applyAction(task.category);
  addExp(task.points);
  saveDailyTasks();
  renderTaskList();
  renderTabs();

  if (sourceButton && !state.gameOver) {
    sourceButton.classList.add("complete");
    setTimeout(() => {
      sourceButton.classList.remove("complete");
    }, 650);
  }
}

function addCustomGoal(category, title) {
  if (!wellnessKeys.includes(category)) return;
  if (hasCustomGoalForCategory(category)) {
    return;
  }

  const cleanedTitle = title.trim();
  if (!cleanedTitle) return;

  const newTask = {
    id: `${todayKey()}-${category}-custom-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    category,
    title: cleanedTitle,
    details: `Custom ${toTitleCase(category)} goal created by you.`,
    points: DEFAULT_CATEGORY_POINTS[category],
    completed: false,
    isCustom: true,
  };
  dailyTasks.push(newTask);
  try { ensureExpiry(newTask.id); } catch (e) { /* ignore */ }

  saveDailyTasks();
  renderTaskList();
  renderTabs();
}

function resetGame() {
  Object.assign(state, initialState);
  saveProgress();
  render();
}

function resetGoals() {
  dailyTasks = generateDailyTasks();
  isCustomGoalPanelOpen = false;
  saveDailyTasks();
  // ensure every generated task has a 12-hour expiry started
  try { dailyTasks.forEach((t) => ensureExpiry(t.id)); } catch (e) { /* ignore */ }
  renderTaskList();
  renderTabs();
}

if (taskList) {
  taskList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button[data-task-id]");
    if (!button) return;

    const taskId = button.getAttribute("data-task-id");
    if (!taskId) return;

    completeTask(taskId, button);
  });
}

tabButtons.forEach((tab) => {
  tab.addEventListener("click", () => {
    const category = tab.getAttribute("data-tab");
    if (!category || category === activeCategory) return;
    activeCategory = category;
    isCustomGoalPanelOpen = false;
    renderTabs();
  });
});

if (customGoalToggle) {
  customGoalToggle.addEventListener("click", () => {
    if (customGoalToggle.disabled) return;
    isCustomGoalPanelOpen = !isCustomGoalPanelOpen;
    syncCustomGoalForm();
  });
}

if (recommendationButton) {
  recommendationButton.addEventListener("click", () => {
    if (recommendationButton.disabled) return;
    updateRecommendation();
  });
}

if (useRecommendationButton) {
  useRecommendationButton.addEventListener("click", () => {
    if (
      !useRecommendationButton ||
      useRecommendationButton.disabled ||
      !currentRecommendation ||
      !(customGoalInput instanceof HTMLInputElement)
    ) {
      return;
    }
    customGoalInput.value = currentRecommendation;
    customGoalInput.focus();
  });
}

if (customGoalForm) {
  customGoalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!(customGoalInput instanceof HTMLInputElement)) return;

    addCustomGoal(activeCategory, customGoalInput.value);
    customGoalInput.value = "";
    isCustomGoalPanelOpen = false;
    syncCustomGoalForm();
  });
}

resetBtn.addEventListener("click", resetGame);
if (resetGoalsBtn) {
  resetGoalsBtn.addEventListener("click", resetGoals);
}

// --- Per-task 12-hour timer helpers ---------------------------------
const TIME_COUNTDOWN = 3 * 60 * 60 * 1000;

function setTaskExpiry(taskId) {
  const expiry = Date.now() + TIME;
  localStorage.setItem("taskExpiry:" + taskId, String(expiry));
  return expiry;
}

function getTaskExpiry(taskId) {
  const v = localStorage.getItem("taskExpiry:" + taskId);
  return v ? parseInt(v, 10) : null;
}

function ensureExpiry(taskId) {
  if (!getTaskExpiry(taskId)) setTaskExpiry(taskId);
}

function getRemainingMs(taskId) {
  const e = getTaskExpiry(taskId);
  return e ? e - Date.now() : 0;
}

function formatRemaining(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00';
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function handleTaskExpiry(taskId) {
  const taskIndex = dailyTasks.findIndex((t) => t.id === taskId);
  if (taskIndex === -1) return;

  const oldTask = dailyTasks[taskIndex];
  const category = oldTask.category;
  
  // Get existing task titles in this category to avoid duplicates
  const existingTitles = new Set(
    dailyTasks
      .filter((t) => t.category === category)
      .map((t) => t.title),
  );
  
  // Find a new task from the pool that doesn't already exist
  const pool = taskPools[category] ?? [];
  const availableTasks = shuffleCopy(pool).filter(
    (t) => !existingTitles.has(t.title),
  );
  
  // If we found a new task, replace the old one; otherwise just reset it
  if (availableTasks.length > 0) {
    const newTaskData = availableTasks[0];
    dailyTasks[taskIndex] = {
      id: `${todayKey()}-${category}-regenerated-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      category,
      title: newTaskData.title,
      details: newTaskData.details,
      points: newTaskData.points,
      completed: false,
    };
    // Start fresh expiry timer for the new task
    setTaskExpiry(dailyTasks[taskIndex].id);
    localStorage.removeItem("taskExpiry:" + taskId);
  } else {
    // Fallback: just reset the old task
    dailyTasks[taskIndex].completed = false;
    setTaskExpiry(taskId);
  }
  
  saveDailyTasks();
  renderTaskList();
  renderTabs();
}

function updateTimers() {
  document.querySelectorAll('[data-task-id]').forEach((card) => {
    const id = card.getAttribute('data-task-id');
    const task = dailyTasks.find((t) => t.id === id);
    const timerEl = card.querySelector('.timer');
    const statusEl = card.querySelector('.status');

    if (!task) {
      if (timerEl) timerEl.textContent = '';
      if (statusEl) statusEl.textContent = '';
      return;
    }

    if (task.completed) {
      const rem = getRemainingMs(id);
      if (rem <= 0) {
        handleTaskExpiry(id);
        // restart cooldown after refresh so UI shows full window
        setTaskExpiry(id);
        if (timerEl) timerEl.textContent = formatRemaining(TWELVE_HOURS);
        if (statusEl) statusEl.textContent = 'Available';
      } else {
        if (timerEl) timerEl.textContent = formatRemaining(rem);
        if (statusEl) statusEl.textContent = 'Available in';
      }
    } else {
      if (timerEl) timerEl.textContent = '';
      if (statusEl) statusEl.textContent = 'Available';
    }
  });
}

// start timer loop
updateTimers();
setInterval(updateTimers, 1000);

loadProgress();
loadWellnessState();
loadDailyTasks();
renderTaskList();
renderTabs();
render();

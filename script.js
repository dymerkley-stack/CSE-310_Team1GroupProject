const initialState = {
  physical: 70,
  mental: 70,
  social: 70,
  spiritual: 70,
  checkins: 0,
  gameOver: false,
};

const state = { ...initialState };
const wellnessKeys = ["physical", "mental", "social", "spiritual"];
const DAILY_TASKS_PER_CATEGORY = 2;
const DAILY_TASKS_KEY = "wellnessDailyTasks";
const DEFAULT_CATEGORY_POINTS = {
  physical: 18,
  mental: 18,
  social: 20,
  spiritual: 18,
};

const taskPools = {
  physical: [
    { title: "Move for 10 minutes", details: "Take a walk, do push-ups, or stretch to build momentum.", points: 18 },
    { title: "Drink a full glass of water", details: "Hydration helps your body and focus stay stable.", points: 12 },
    { title: "Do 20 squats", details: "A quick bodyweight set boosts physical energy.", points: 20 },
    { title: "Take a posture break", details: "Stand up and reset your posture for 2 minutes.", points: 10 },
  ],
  mental: [
    { title: "Journal one reflection", details: "Write down one thought and one next step.", points: 18 },
    { title: "Read for 15 minutes", details: "Spend focused time with a book or article.", points: 16 },
    { title: "Plan tomorrow", details: "List your top three priorities for tomorrow.", points: 14 },
    { title: "Do a focus sprint", details: "Work distraction-free for 20 minutes.", points: 20 },
  ],
  social: [
    { title: "Send one kind message", details: "Reach out and encourage someone today.", points: 20 },
    { title: "Call a friend or family", details: "Have a short check-in conversation.", points: 18 },
    { title: "Thank someone", details: "Express appreciation to a person who helped you.", points: 12 },
    { title: "Do one helpful act", details: "Support someone with a small practical action.", points: 16 },
  ],
  spiritual: [
    { title: "Practice calm breathing", details: "Take 10 slow breaths and center yourself.", points: 18 },
    { title: "Write one gratitude note", details: "Capture one thing you are grateful for.", points: 14 },
    { title: "Take a quiet pause", details: "Sit in silence for 5 minutes and reset.", points: 12 },
    { title: "Reflect on values", details: "Choose one value and one way to live it today.", points: 16 },
  ],
};

let dailyTasks = [];

const bars = {
  physical: document.getElementById("physicalBar"),
  mental: document.getElementById("mentalBar"),
  social: document.getElementById("socialBar"),
  spiritual: document.getElementById("spiritualBar"),
};

const labels = {
  physical: document.getElementById("physicalValue"),
  mental: document.getElementById("mentalValue"),
  social: document.getElementById("socialValue"),
  spiritual: document.getElementById("spiritualValue"),
};

const petMood = document.getElementById("petMood");
const petAvatar = document.getElementById("petAvatar");
const streakText = document.getElementById("streakText");
const levelText = document.getElementById("levelText");
const taskHeader = document.getElementById("taskHeader");
const statusText = document.getElementById("statusText");
const resetBtn = document.getElementById("resetBtn");
const taskList = document.getElementById("taskList");
const tabButtons = Array.from(document.querySelectorAll(".tab[data-tab]"));
const customGoalToggle = document.getElementById("customGoalToggle");
const customGoalPanel = document.getElementById("customGoalPanel");
const customGoalForm = document.getElementById("customGoalForm");
const customGoalLabel = document.getElementById("customGoalLabel");
const customGoalInput = document.getElementById("customGoalInput");
const customGoalSubmit = document.getElementById("customGoalSubmit");
const customGoalHint = document.getElementById("customGoalHint");

let activeCategory = "physical";
let isCustomGoalPanelOpen = false;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function averageWellness() {
  return wellnessKeys.reduce((sum, key) => sum + state[key], 0) / wellnessKeys.length;
}

function currentLevel() {
  return Math.floor(state.checkins / 5) + 1;
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
    const picked = shuffleCopy(taskPools[category]).slice(0, DAILY_TASKS_PER_CATEGORY);
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

function saveDailyTasks() {
  localStorage.setItem(
    DAILY_TASKS_KEY,
    JSON.stringify({
      date: todayKey(),
      tasks: dailyTasks,
    })
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

    dailyTasks = parsed.tasks;
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
    if (task.category !== activeCategory) {
      card.classList.add("hidden");
    }

    const checkboxClass = task.completed ? "checkbox complete" : "checkbox";
    const pointsClass = task.completed ? "points complete" : "points";
    const disabled = task.completed || state.gameOver ? "disabled" : "";
    const safeTitle = escapeHtml(task.title);
    const safeDetails = escapeHtml(task.details);

    card.innerHTML = `
      <button class="${checkboxClass}" data-task-id="${task.id}" data-action="${task.category}" aria-label="Complete ${task.category} task" ${disabled}></button>
      <div>
        <h3 class="task-title">${safeTitle}</h3>
        <p class="task-details">${safeDetails}</p>
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
  return value
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
  return dailyTasks.some((task) => task.category === category && isCustomTask(task));
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
  } else {
    customGoalHint.textContent = `Add one extra ${categoryTitle} goal for today.`;
  }
}

function renderTabs() {
  tabButtons.forEach((tab) => {
    const category = tab.getAttribute("data-tab");
    const isActive = category === activeCategory;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  const taskCards = Array.from(document.querySelectorAll(".task-card[data-category]"));
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

function avatarFace(avg) {
  if (state.gameOver) return "(x_x)";
  if (avg >= 80) return "(^o^)/";
  if (avg >= 60) return "(o^.^o)";
  if (avg >= 40) return "(._.)";
  return "(;_; )";
}

function render() {
  Object.keys(bars).forEach((key) => {
    const value = clamp(state[key]);
    bars[key].style.width = `${value}%`;
    labels[key].textContent = String(Math.round(value));
  });

  const avg = averageWellness();
  petMood.textContent = moodText(avg);
  petAvatar.textContent = avatarFace(avg);
  streakText.textContent = `Daily check-ins: ${state.checkins}`;
  if (levelText) {
    levelText.textContent = `Level ${currentLevel()}`;
  }

  statusText.classList.toggle("alert", state.gameOver);
  if (state.gameOver) {
    statusText.textContent = "Game over: one or more wellness stats reached zero.";
  }

  const actionButtons = Array.from(document.querySelectorAll("[data-action]"));
  actionButtons.forEach((button) => {
    button.disabled = state.gameOver;
  });
}

function gameTick() {
  if (state.gameOver) return;

  state.physical = clamp(state.physical - 2);
  state.mental = clamp(state.mental - 1.6);
  state.social = clamp(state.social - 1.8);
  state.spiritual = clamp(state.spiritual - 1.3);

  if (wellnessKeys.some((key) => state[key] === 0)) {
    state.gameOver = true;
  }

  render();
}

function applyAction(action) {
  if (state.gameOver) return;

  const boosts = {
    physical: { physical: 18, mental: 4 },
    mental: { mental: 18, spiritual: 3 },
    social: { social: 20, mental: 3 },
    spiritual: { spiritual: 18, mental: 2 },
  };

  const selectedBoost = boosts[action];
  if (!selectedBoost) return;

  Object.entries(selectedBoost).forEach(([key, value]) => {
    state[key] = clamp(state[key] + value);
  });

  state.checkins += 1;
  statusText.textContent = `Nice work. You completed a ${action} check-in.`;
  render();
}

function completeTask(taskId, sourceButton) {
  const task = dailyTasks.find((item) => item.id === taskId);
  if (!task || task.completed || state.gameOver) return;

  task.completed = true;
  applyAction(task.category);
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
    statusText.textContent = `You can only add one extra ${toTitleCase(category)} goal per day.`;
    return;
  }

  const cleanedTitle = title.trim();
  if (!cleanedTitle) return;

  dailyTasks.push({
    id: `${todayKey()}-${category}-custom-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    category,
    title: cleanedTitle,
    details: "Custom daily goal added by you.",
    points: DEFAULT_CATEGORY_POINTS[category],
    completed: false,
    isCustom: true,
  });

  saveDailyTasks();
  renderTaskList();
  renderTabs();
  statusText.textContent = `${toTitleCase(category)} goal added for today.`;
}

function resetGame() {
  Object.assign(state, initialState);
  statusText.textContent = "Start by choosing one self-care action you completed today.";
  render();
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

loadDailyTasks();
renderTaskList();
renderTabs();
render();
setInterval(gameTick, 12000);

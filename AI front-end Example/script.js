const goalTemplates = {
  physical: [
    "Do 5 push-ups",
    "Walk for 10 minutes",
    "Stretch for 5 minutes",
    "Drink a full glass of water",
  ],
  mental: [
    "Write 3 lines in a journal",
    "Do 2 minutes of deep breathing",
    "Read 5 pages of a book",
    "Take a 5-minute no-phone break",
  ],
  social: [
    "Send a kind message to someone",
    "Call or voice-note a friend",
    "Share one win from your day",
    "Ask someone how they are doing",
  ],
  spiritual: [
    "Spend 3 quiet minutes in reflection",
    "Practice gratitude: list one thing",
    "Do a short meditation",
    "Read a meaningful quote or verse",
  ],
};

const attributeKeys = ["physical", "mental", "social", "spiritual"];

const initialState = {
  physical: 78,
  mental: 78,
  social: 78,
  spiritual: 78,
  goalsCompleted: 0,
  level: 1,
  xp: 0,
  gameOver: false,
};

const state = { ...initialState };
let goals = [];
let goalIdCounter = 1;

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
const statusText = document.getElementById("statusText");
const resetBtn = document.getElementById("resetBtn");
const goalList = document.getElementById("goalList");
const goalForm = document.getElementById("goalForm");
const goalTextInput = document.getElementById("goalText");
const goalTypeInput = document.getElementById("goalType");
const refreshGoalsBtn = document.getElementById("refreshGoalsBtn");
const levelText = document.getElementById("levelText");
const xpText = document.getElementById("xpText");
const xpBar = document.getElementById("xpBar");

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function xpNeededForLevel(level) {
  return 120 + (level - 1) * 35;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function averageWellness() {
  return (state.physical + state.mental + state.social + state.spiritual) / 4;
}

function moodText(avg) {
  if (state.gameOver) return "Your pet needs help. Reset to try again.";
  if (avg >= 85) return "Your pet is thriving and energized.";
  if (avg >= 65) return "Your pet feels steady and supported.";
  if (avg >= 40) return "Your pet is a bit stressed. Finish a goal soon.";
  return "Your pet is struggling. Complete a wellness goal now.";
}

function avatarFace(avg) {
  if (state.gameOver) return "(x_x)";
  if (avg >= 85) return "(^o^)/";
  if (avg >= 65) return "(o^.^o)";
  if (avg >= 40) return "(._.)";
  return "(;_; )";
}

function getGoalBoosts(type) {
  const boosts = {
    physical: { physical: 12, mental: 3 },
    mental: { mental: 12, spiritual: 2 },
    social: { social: 13, mental: 2 },
    spiritual: { spiritual: 12, mental: 2 },
  };

  return boosts[type] || {};
}

function createGoal(type, text, xpReward = 30) {
  return {
    id: goalIdCounter++,
    type,
    text,
    xpReward,
    completed: false,
  };
}

function generateSuggestedGoals() {
  const generated = attributeKeys.map((type) => {
    const randomGoal = randomFrom(goalTemplates[type]);
    return createGoal(type, randomGoal, 26);
  });

  goals = generated;
}

function addXp(amount) {
  state.xp += amount;

  while (state.xp >= xpNeededForLevel(state.level)) {
    state.xp -= xpNeededForLevel(state.level);
    state.level += 1;

    attributeKeys.forEach((key) => {
      state[key] = clamp(state[key] + 4);
    });

    statusText.textContent = `Level up! Your pet reached level ${state.level}.`;
  }
}

function renderGoals() {
  goalList.innerHTML = "";

  goals.forEach((goal) => {
    const item = document.createElement("li");
    item.className = "goal-item";
    if (goal.completed) {
      item.classList.add("completed");
    }

    const label = document.createElement("p");
    label.className = "goal-text";
    label.textContent = `${goal.text} (${goal.type}, +${goal.xpReward} XP)`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "goal-complete-btn";
    button.textContent = goal.completed ? "Done" : "Complete";
    button.disabled = goal.completed || state.gameOver;
    button.addEventListener("click", () => completeGoal(goal.id));

    item.append(label, button);
    goalList.appendChild(item);
  });
}

function render() {
  attributeKeys.forEach((key) => {
    const value = clamp(state[key]);
    bars[key].style.width = `${value}%`;
    labels[key].textContent = String(Math.round(value));
  });

  const needed = xpNeededForLevel(state.level);
  const xpPercent = clamp((state.xp / needed) * 100);
  levelText.textContent = `Level ${state.level}`;
  xpText.textContent = `${Math.round(state.xp)} / ${needed} XP`;
  xpBar.style.width = `${xpPercent}%`;

  const avg = averageWellness();
  petMood.textContent = moodText(avg);
  petAvatar.textContent = avatarFace(avg);
  streakText.textContent = `Goals completed: ${state.goalsCompleted}`;

  statusText.classList.toggle("alert", state.gameOver);
  if (state.gameOver) {
    statusText.textContent = "Game over: one or more wellness stats reached zero.";
  }

  renderGoals();
}

function gameTick() {
  if (state.gameOver) return;

  state.physical = clamp(state.physical - 0.9);
  state.mental = clamp(state.mental - 0.75);
  state.social = clamp(state.social - 0.8);
  state.spiritual = clamp(state.spiritual - 0.65);

  const depleted = attributeKeys.some((key) => state[key] === 0);
  if (depleted) {
    state.gameOver = true;
  }

  render();
}

function completeGoal(goalId) {
  if (state.gameOver) return;

  const goal = goals.find((entry) => entry.id === goalId);
  if (!goal || goal.completed) return;

  goal.completed = true;
  state.goalsCompleted += 1;

  const boosts = getGoalBoosts(goal.type);
  Object.entries(boosts).forEach(([key, value]) => {
    state[key] = clamp(state[key] + value);
  });

  addXp(goal.xpReward);
  statusText.textContent = `Completed: ${goal.text}. Wellness and XP increased.`;
  render();
}

function addCustomGoal(event) {
  event.preventDefault();
  if (state.gameOver) return;

  const text = goalTextInput.value.trim();
  const type = goalTypeInput.value;

  if (!text || !attributeKeys.includes(type)) return;

  goals.push(createGoal(type, text, 32));
  goalTextInput.value = "";
  statusText.textContent = `Custom ${type} goal added.`;
  render();
}

function refreshSuggestedGoals() {
  if (state.gameOver) return;

  generateSuggestedGoals();
  statusText.textContent = "New suggested goals generated.";
  render();
}

function resetGame() {
  Object.assign(state, initialState);
  generateSuggestedGoals();
  statusText.textContent = "Complete goals to improve wellness and earn pet XP.";
  render();
}

goalForm.addEventListener("submit", addCustomGoal);
refreshGoalsBtn.addEventListener("click", refreshSuggestedGoals);
resetBtn.addEventListener("click", resetGame);

generateSuggestedGoals();
render();
setInterval(gameTick, 12000);

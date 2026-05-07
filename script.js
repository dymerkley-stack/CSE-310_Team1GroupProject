const initialState = {
  physical: 70,
  mental: 70,
  social: 70,
  spiritual: 70,
  checkins: 0,
  gameOver: false,
};

const state = { ...initialState };

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
const actionButtons = Array.from(document.querySelectorAll("[data-action]"));

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function averageWellness() {
  return (state.physical + state.mental + state.social + state.spiritual) / 4;
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

  statusText.classList.toggle("alert", state.gameOver);
  if (state.gameOver) {
    statusText.textContent = "Game over: one or more wellness stats reached zero.";
  }

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

  if (Object.values(state).some((value) => typeof value === "number" && value === 0)) {
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

function resetGame() {
  Object.assign(state, initialState);
  statusText.textContent = "Start by choosing one self-care action you completed today.";
  render();
}

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.getAttribute("data-action");
    applyAction(action);
  });
});

resetBtn.addEventListener("click", resetGame);

render();
setInterval(gameTick, 12000);

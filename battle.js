const WELLNESS_PROGRESS_KEY = "wellnessProgress";
const WELLNESS_STATE_KEY = "wellnessState";
const BATTLE_LOG_LIMIT = 5;
const EXP_BASE = 100;
const EXP_MULTIPLIER = 1.15;

let playerProgress = { level: 1, exp: 0, checkins: 0 };
let playerState = { physical: 70, mental: 70, social: 70, intellectual: 70, spiritual: 70 };
let battleState = {
  playerHealth: 500,
  playerMaxHealth: 500,
  enemyHealth: 300,
  enemyMaxHealth: 300,
  isPlayerTurn: true,
  isDefending: false,
  currentEnemy: null,
  battleLog: [],
};

const monsters = [
  { name: "Slime", baseHealth: 150, difficulty: 1 },
  { name: "Goblin", baseHealth: 200, difficulty: 1.2 },
  { name: "Orc", baseHealth: 250, difficulty: 1.5 },
  { name: "Dragon", baseHealth: 400, difficulty: 2 },
  { name: "Demon", baseHealth: 500, difficulty: 2.5 },
];

function expRequiredForLevel(level) {
  return Math.round(EXP_BASE * Math.pow(EXP_MULTIPLIER, level - 1));
}

function loadPlayerData() {
  const progressRaw = localStorage.getItem(WELLNESS_PROGRESS_KEY);
  const stateRaw = localStorage.getItem(WELLNESS_STATE_KEY);

  if (progressRaw) {
    try {
      playerProgress = JSON.parse(progressRaw);
    } catch {
      playerProgress = { level: 1, exp: 0, checkins: 0 };
    }
  }

  if (stateRaw) {
    try {
      playerState = JSON.parse(stateRaw);
    } catch {
      playerState = { physical: 70, mental: 70, social: 70, intellectual: 70, spiritual: 70 };
    }
  }
}

function savePlayerData() {
  localStorage.setItem(WELLNESS_STATE_KEY, JSON.stringify(playerState));
  localStorage.setItem(WELLNESS_PROGRESS_KEY, JSON.stringify(playerProgress));
}

function calculatePetStats(attribute) {
  const baseAttribute = playerState[attribute] || 70;
  return Math.round((baseAttribute / 100) * playerProgress.level * 20);
}

function generateMonster() {
  const avgPlayerStat = 70;
  const playerDifficulty = playerProgress.level / 5;
  const selected = monsters.find((m) => m.difficulty <= playerDifficulty + 1) || monsters[0];

  const health = Math.round(selected.baseHealth * (1 + playerProgress.level * 0.1));

  return {
    name: selected.name,
    maxHealth: health,
    health: health,
    difficulty: selected.difficulty,
  };
}

function getAttackCost(attribute) {
  const costs = {
    physical: 10,
    mental: 8,
    social: 12,
    intellectual: 9,
    spiritual: 6,
  };
  return costs[attribute] || 0;
}

function getAttackDamage(attribute) {
  const petStat = calculatePetStats(attribute);
  const baseMultiplier = {
    physical: 1.2,
    mental: 1.0,
    social: 0.9,
    intellectual: 1.1,
    spiritual: 0.8,
  };
  return Math.round(petStat * (baseMultiplier[attribute] || 1));
}

function addBattleLog(message) {
  battleState.battleLog.push(message);
  if (battleState.battleLog.length > BATTLE_LOG_LIMIT) {
    battleState.battleLog.shift();
  }
  renderBattleLog();
}

function renderBattleLog() {
  const logElement = document.getElementById("battleLog");
  logElement.innerHTML = battleState.battleLog.map((msg) => `<p>${msg}</p>`).join("");
  logElement.scrollTop = logElement.scrollHeight;
}

function renderBattleUI() {
  document.getElementById("playerLevel").textContent = `Level ${playerProgress.level}`;
  document.getElementById("playerPhysical").textContent = calculatePetStats("physical");
  document.getElementById("playerMental").textContent = calculatePetStats("mental");
  document.getElementById("playerSocial").textContent = calculatePetStats("social");
  document.getElementById("playerIntellectual").textContent = calculatePetStats("intellectual");
  document.getElementById("playerSpiritual").textContent = calculatePetStats("spiritual");

  const playerHealthPercent = Math.round((battleState.playerHealth / battleState.playerMaxHealth) * 100);
  document.getElementById("playerHealthFill").style.width = `${playerHealthPercent}%`;
  document.getElementById("playerHealth").textContent = `Health: ${Math.max(0, battleState.playerHealth)} / ${battleState.playerMaxHealth}`;

  if (battleState.currentEnemy) {
    document.getElementById("enemyName").textContent = battleState.currentEnemy.name;
    const enemyHealthPercent = Math.round((battleState.currentEnemy.health / battleState.currentEnemy.maxHealth) * 100);
    document.getElementById("enemyHealthFill").style.width = `${enemyHealthPercent}%`;
    document.getElementById("enemyHealth").textContent = `Health: ${Math.max(0, battleState.currentEnemy.health)} / ${battleState.currentEnemy.maxHealth}`;
  }

  document.getElementById("battleStatus").textContent = battleState.isPlayerTurn ? "Your Turn" : "Enemy Attacking...";
}

function performAction(attribute) {
  if (!battleState.isPlayerTurn || !battleState.currentEnemy) return;

  const cost = getAttackCost(attribute);
  if (playerState[attribute] < cost) {
    addBattleLog("Not enough energy!");
    return;
  }

  const damage = getAttackDamage(attribute);
  playerState[attribute] = Math.max(0, playerState[attribute] - cost);
  battleState.currentEnemy.health = Math.max(0, battleState.currentEnemy.health - damage);

  addBattleLog(`You used ${attribute}! Dealt ${damage} damage.`);

  if (battleState.currentEnemy.health <= 0) {
    endBattle(true);
  } else {
    battleState.isPlayerTurn = false;
    setTimeout(enemyTurn, 1000);
  }

  renderBattleUI();
}

function performDefend() {
  if (!battleState.isPlayerTurn || !battleState.currentEnemy) return;

  battleState.isDefending = true;
  addBattleLog("You brace for impact!");
  battleState.isPlayerTurn = false;
  setTimeout(enemyTurn, 1000);
}

function enemyTurn() {
  if (!battleState.currentEnemy) return;

  const attributes = ["physical", "mental", "social", "intellectual", "spiritual"];
  const randomAttr = attributes[Math.floor(Math.random() * attributes.length)];
  const damage = Math.round(calculatePetStats(randomAttr) * 0.8);

  let actualDamage = damage;
  if (battleState.isDefending) {
    actualDamage = Math.round(damage * 0.4);
    addBattleLog(`Enemy attacks! You defend. Reduced to ${actualDamage} damage.`);
    battleState.isDefending = false;
  } else {
    addBattleLog(`Enemy attacks with ${randomAttr}! ${damage} damage!`);
  }

  battleState.playerHealth = Math.max(0, battleState.playerHealth - actualDamage);

  if (battleState.playerHealth <= 0) {
    endBattle(false);
  } else {
    battleState.isPlayerTurn = true;
  }

  renderBattleUI();
}

function endBattle(playerWon) {
  const rewardsSection = document.getElementById("rewardsSection");
  const actionButtons = document.querySelector(".action-buttons");
  actionButtons.style.pointerEvents = "none";
  actionButtons.style.opacity = "0.5";

  if (playerWon) {
    const baseExp = Math.round(100 * battleState.currentEnemy.difficulty);
    const bonus = Math.round(baseExp * 0.5);
    const totalExp = baseExp + bonus;

    playerProgress.exp += totalExp;
    while (playerProgress.exp >= expRequiredForLevel(playerProgress.level)) {
      playerProgress.exp -= expRequiredForLevel(playerProgress.level);
      playerProgress.level += 1;
    }

    addBattleLog(`Victory! Gained ${totalExp} EXP!`);
    document.getElementById("rewardExp").textContent = `Gained ${totalExp} EXP (+${bonus} Battle Bonus)`;
  } else {
    addBattleLog("Defeated! Your pet needs rest.");
    document.getElementById("rewardExp").textContent = `Battle Lost. Return to wellness!`;
  }

  savePlayerData();
  rewardsSection.hidden = false;
  renderBattleUI();
}

function startNewBattle() {
  battleState.currentEnemy = generateMonster();
  battleState.playerHealth = battleState.playerMaxHealth;
  battleState.enemyHealth = battleState.currentEnemy.maxHealth;
  battleState.isPlayerTurn = true;
  battleState.isDefending = false;
  battleState.battleLog = [];

  const rewardsSection = document.getElementById("rewardsSection");
  rewardsSection.hidden = true;

  const actionButtons = document.querySelector(".action-buttons");
  actionButtons.style.pointerEvents = "auto";
  actionButtons.style.opacity = "1";

  addBattleLog(`A wild ${battleState.currentEnemy.name} appears!`);
  renderBattleUI();
}

document.getElementById("physicalAttackBtn").addEventListener("click", () => performAction("physical"));
document.getElementById("mentalAttackBtn").addEventListener("click", () => performAction("mental"));
document.getElementById("socialAttackBtn").addEventListener("click", () => performAction("social"));
document.getElementById("intellectualAttackBtn").addEventListener("click", () => performAction("intellectual"));
document.getElementById("spiritualAttackBtn").addEventListener("click", () => performAction("spiritual"));
document.getElementById("defendBtn").addEventListener("click", performDefend);
document.getElementById("nextBattleBtn").addEventListener("click", startNewBattle);

loadPlayerData();
startNewBattle();

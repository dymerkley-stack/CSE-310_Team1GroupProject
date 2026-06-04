import { getSelectedAvatarForLevel } from "./avatar-selection.js";

const WELLNESS_PROGRESS_KEY = "wellnessProgress";
const WELLNESS_STATE_KEY = "wellnessState";
const BATTLE_LOG_LIMIT = 5;
const EXP_BASE = 100;
const EXP_MULTIPLIER = 1.15;
const CRITICAL_HIT_CHANCE = 0.2;
const CRITICAL_HIT_MULTIPLIER = 1.5;
const PLAYER_REGEN_AMOUNT = 25;
const SYNERGY_BONUS_MULTIPLIER = 1.3;
const SPECIAL_MOVE_CHANCE = 0.3;
const DUNGEON_TOTAL_FLOORS = 3;
const DUNGEON_PARTIAL_HEAL_PERCENT = 0.2;
const BASE_PLAYER_MAX_HEALTH = 500;
const PLAYER_HEALTH_LEVEL_MODIFIER = 0.08;
const CONFETTI_COLORS = ["#ff6b6b", "#ffd93d", "#6bcB77", "#4d96ff", "#ff9f1c", "#f15bb5"];

// Optional sprite paths for battle avatars. Leave paths empty for text fallback.
const SPRITE_ASSETS = {
  player: "",
  enemies: {
    Slime: "",
    Goblin: "",
    Orc: "",
    Dragon: "",
    Demon: "",
  },
};

const PLAYER_FALLBACK_AVATAR = "(o^.^o)";

let playerProgress = { level: 1, exp: 0, checkins: 0 };
let playerState = { physical: 70, mental: 70, social: 70, intellectual: 70, spiritual: 70 };
let battleState = {
  playerHealth: 500,
  playerMaxHealth: BASE_PLAYER_MAX_HEALTH,
  enemyHealth: 300,
  enemyMaxHealth: 300,
  isPlayerTurn: true,
  isDefending: false,
  currentEnemy: null,
  battleLog: [],
  playerStatus: { regenTurns: 0, focusTurns: 0 },
  enemyStatus: { stunnedTurns: 0, weakenedTurns: 0, vulnerableTurns: 0 },
  pendingEnemyAttack: null,
  lastPlayerAttribute: null,
  pendingEnemySpecial: null,
  dungeon: { active: false, floor: 0, totalFloors: DUNGEON_TOTAL_FLOORS },
  lastBattleWon: null,
};

const spriteLoadCache = new Map();

const monsters = [
  { name: "Slime", baseHealth: 150, difficulty: 1 },
  { name: "Goblin", baseHealth: 200, difficulty: 1.2 },
  { name: "Orc", baseHealth: 250, difficulty: 1.5 },
  { name: "Dragon", baseHealth: 400, difficulty: 2 },
  { name: "Demon", baseHealth: 500, difficulty: 2.5 },
];

const attributeSynergies = {
  "mental->intellectual": {
    name: "Focus Blast",
    bonusMultiplier: SYNERGY_BONUS_MULTIPLIER,
    applyEffect: () => {
      const restored = getScaledSynergyEnergyRestore();
      playerState.intellectual = Math.min(100, playerState.intellectual + restored);
      addBattleLog(`Synergy effect: Restored ${restored} Intellectual energy.`);
    },
  },
  "social->spiritual": {
    name: "Harmonized Aura",
    bonusMultiplier: SYNERGY_BONUS_MULTIPLIER,
    applyEffect: () => {
      const heal = getScaledSynergyHeal();
      const before = battleState.playerHealth;
      battleState.playerHealth = Math.min(battleState.playerMaxHealth, battleState.playerHealth + heal);
      const healed = battleState.playerHealth - before;
      if (healed > 0) {
        addBattleLog(`Synergy effect: Healed ${healed} health.`);
        showCombatText({ target: "player", value: healed, type: "heal" });
      }
    },
  },
  "physical->mental": {
    name: "Body-Mind Surge",
    bonusMultiplier: SYNERGY_BONUS_MULTIPLIER,
    applyEffect: () => {
      const restored = 4;
      playerState.mental = Math.min(100, playerState.mental + restored);
      addBattleLog(`Synergy effect: Restored ${restored} Mental energy.`);
    },
  },
  "intellectual->social": {
    name: "Inspiring Insight",
    bonusMultiplier: SYNERGY_BONUS_MULTIPLIER,
    applyEffect: () => {
      const restored = 4;
      playerState.social = Math.min(100, playerState.social + restored);
      addBattleLog(`Synergy effect: Restored ${restored} Social energy.`);
    },
  },
};

const monsterAsciiMap = {
  Slime: ["  .--.  ", " ( oo ) ", "  '--'  "].join("\n"),
  Goblin: ["   ,_,   ", "   (o.o)  ", "  /|_|\\ "].join("\n"),
  Orc: ["    ___   ", "   (O_O)  ", " /| |\\ "].join("\n"),
  Dragon: [" /\\_/\\ ", " ( o.o )>", " \_^_/  "].join("\n"),
  Demon: ["  /\\_/\\ ", "  ( x.x ) ", "   <_||_>  "].join("\n"),
};

const enemySpecialMoves = {
  Slime: { name: "Gelatin Slam", multiplier: 1.4 },
  Goblin: { name: "Backstab Barrage", multiplier: 1.6 },
  Orc: { name: "Brutal Cleave", multiplier: 1.8 },
  Dragon: { name: "Fire Breath", multiplier: 2.0 },
  Demon: { name: "Abyssal Ruin", multiplier: 2.2 },
};

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

function enableAvatarSprite(element, path) {
  element.classList.add("battle-avatar-uses-sprite");
  element.style.backgroundImage = `url("${path}")`;
}

function disableAvatarSprite(element) {
  element.classList.remove("battle-avatar-uses-sprite");
  element.style.backgroundImage = "";
}

function applyAvatarSpriteWithFallback(element, spritePath, fallbackText) {
  element.textContent = fallbackText;

  if (!spritePath) {
    disableAvatarSprite(element);
    return;
  }

  element.dataset.spritePath = spritePath;

  loadSprite(spritePath).then((loaded) => {
    if (!element.isConnected || element.dataset.spritePath !== spritePath) {
      return;
    }

    if (loaded) {
      enableAvatarSprite(element, spritePath);
    } else {
      disableAvatarSprite(element);
    }
  });
}

function getEnemySpritePath(enemyName) {
  return SPRITE_ASSETS.enemies[enemyName] ?? "";
}

function getScaledSynergyEnergyRestore() {
  return Math.min(12, 4 + Math.floor(playerProgress.level / 5));
}

function getScaledSynergyHeal() {
  const byLevel = 16 + playerProgress.level * 2;
  const byMaxHealth = Math.round(battleState.playerMaxHealth * 0.08);
  return Math.max(byLevel, byMaxHealth);
}

function expRequiredForLevel(level) {
  return Math.round(EXP_BASE * Math.pow(EXP_MULTIPLIER, level - 1));
}

function calculatePlayerMaxHealth(level) {
  const safeLevel = Math.max(1, Math.floor(level || 1));
  return Math.round(BASE_PLAYER_MAX_HEALTH * (1 + (safeLevel - 1) * PLAYER_HEALTH_LEVEL_MODIFIER));
}

function syncPlayerMaxHealthWithLevel() {
  const previousMax = battleState.playerMaxHealth;
  const newMax = calculatePlayerMaxHealth(playerProgress.level);
  const healthDelta = newMax - previousMax;

  battleState.playerMaxHealth = newMax;
  if (healthDelta > 0) {
    battleState.playerHealth = Math.min(newMax, battleState.playerHealth + healthDelta);
  } else if (battleState.playerHealth > newMax) {
    battleState.playerHealth = newMax;
  }
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

  syncPlayerMaxHealthWithLevel();
}

function savePlayerData() {
  localStorage.setItem(WELLNESS_STATE_KEY, JSON.stringify(playerState));
  localStorage.setItem(WELLNESS_PROGRESS_KEY, JSON.stringify(playerProgress));
}

function rainConfetti(options = {}) {
  const count = Number.isFinite(options.count) ? Math.max(20, Math.floor(options.count)) : 110;
  const baseDuration = Number.isFinite(options.duration) ? Math.max(900, Math.floor(options.duration)) : 2200;

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
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.opacity = String(0.8 + Math.random() * 0.2);
    piece.style.borderRadius = Math.random() > 0.5 ? "1px" : "50%";

    container.appendChild(piece);
    piece.animate(
      [
        { transform: "translate3d(0, -12px, 0) rotate(0deg)" },
        { transform: `translate3d(${drift}px, ${window.innerHeight + 50}px, 0) rotate(${rotation}deg)` },
      ],
      {
        duration,
        delay,
        easing: "cubic-bezier(0.22, 0.7, 0.3, 1)",
        fill: "forwards",
      }
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
  banner.style.fontFamily = "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
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
    }
  );

  setTimeout(() => {
    banner.remove();
  }, 1650);
}

function getCombatantContainer(target) {
  if (target === "player") {
    return document.querySelector(".player-side");
  }
  if (target === "enemy") {
    return document.querySelector(".enemy-side");
  }
  return null;
}

function showCombatText({ target, value, type = "damage" }) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  if (amount <= 0) return;

  const container = getCombatantContainer(target);
  if (!container) return;

  const text = document.createElement("div");
  const isHeal = type === "heal";

  text.textContent = `${isHeal ? "+" : "-"}${amount}`;
  text.setAttribute("aria-hidden", "true");
  text.style.position = "absolute";
  text.style.left = "50%";
  text.style.top = "18%";
  text.style.transform = "translate(-50%, 0) scale(0.9)";
  text.style.fontFamily = "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
  text.style.fontSize = "clamp(1.05rem, 2.5vw, 1.55rem)";
  text.style.letterSpacing = "0.05em";
  text.style.fontWeight = "700";
  text.style.color = isHeal ? "#ecfff1" : "#ffffff";
  text.style.textShadow = isHeal
    ? "0 2px 8px rgba(20, 93, 42, 0.55)"
    : "0 2px 8px rgba(90, 0, 0, 0.55)";
  text.style.background = isHeal
    ? "linear-gradient(135deg, #31b96b, #1f8f57)"
    : "linear-gradient(135deg, #ff4d6d, #cc2f43)";
  text.style.border = "2px solid rgba(255, 255, 255, 0.7)";
  text.style.borderRadius = "999px";
  text.style.padding = "0.2rem 0.55rem";
  text.style.pointerEvents = "none";
  text.style.zIndex = "25";
  text.style.opacity = "0";

  container.appendChild(text);

  text.animate(
    [
      { opacity: 0, transform: "translate(-50%, 10px) scale(0.85)" },
      { opacity: 1, transform: "translate(-50%, -4px) scale(1.02)", offset: 0.22 },
      { opacity: 1, transform: "translate(-50%, -18px) scale(1)", offset: 0.7 },
      { opacity: 0, transform: "translate(-50%, -34px) scale(1.03)" },
    ],
    {
      duration: 1050,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      fill: "forwards",
    }
  );

  setTimeout(() => {
    text.remove();
  }, 1150);
}

function showEnemyIntentText(message, options = {}) {
  const container = getCombatantContainer("enemy");
  if (!container || !message) return;

  const existing = container.querySelector(".enemy-intent-banner");
  const text = existing || document.createElement("div");
  const isSpecialCharge = options.variant === "charge";
  const isSpecialIncoming = options.variant === "special";

  if (!existing) {
    text.className = "enemy-intent-banner";
    text.setAttribute("aria-hidden", "true");
    text.style.position = "absolute";
    text.style.left = "50%";
    text.style.top = "8%";
    text.style.transform = "translate(-50%, 0) scale(0.95)";
    text.style.fontFamily = "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    text.style.fontSize = "clamp(0.82rem, 2.1vw, 1.05rem)";
    text.style.letterSpacing = "0.04em";
    text.style.fontWeight = "700";
    text.style.color = "#ffffff";
    text.style.border = "2px solid rgba(255, 255, 255, 0.75)";
    text.style.borderRadius = "999px";
    text.style.padding = "0.22rem 0.62rem";
    text.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.22)";
    text.style.whiteSpace = "nowrap";
    text.style.pointerEvents = "none";
    text.style.zIndex = "30";
    container.appendChild(text);
  }

  text.textContent = message;
  text.style.background = isSpecialCharge
    ? "linear-gradient(135deg, #5a3fd0, #2d5bdb)"
    : isSpecialIncoming
      ? "linear-gradient(135deg, #c44536, #f39c12)"
      : "linear-gradient(135deg, #ff9f1c, #ff4d6d)";
  text.style.opacity = "1";

  text.animate(
    [
      { opacity: 0, transform: "translate(-50%, 10px) scale(0.92)" },
      { opacity: 1, transform: "translate(-50%, 0) scale(1)" },
    ],
    {
      duration: 250,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      fill: "forwards",
    }
  );
}

function clearEnemyIntentText() {
  const container = getCombatantContainer("enemy");
  if (!container) return;
  const existing = container.querySelector(".enemy-intent-banner");
  if (existing) {
    existing.remove();
  }
}

function planNextEnemyIntent() {
  if (!battleState.currentEnemy) return;

  const attributes = ["physical", "mental", "social", "intellectual", "spiritual"];
  const specialMove = enemySpecialMoves[battleState.currentEnemy.name];

  if (battleState.pendingEnemySpecial && specialMove) {
    const randomAttr = attributes[Math.floor(Math.random() * attributes.length)];
    let damage = Math.round(calculatePetStats(randomAttr) * specialMove.multiplier);

    if (battleState.enemyStatus.weakenedTurns > 0) {
      damage = Math.round(damage * 0.5);
      battleState.enemyStatus.weakenedTurns -= 1;
      addBattleLog("Enemy is weakened. Its attack power drops!");
    }

    battleState.pendingEnemyAttack = {
      damage,
      attribute: randomAttr,
      isSpecial: true,
      specialName: specialMove.name,
    };
    return;
  }

  if (specialMove && Math.random() < SPECIAL_MOVE_CHANCE) {
    battleState.pendingEnemySpecial = specialMove.name;
    battleState.pendingEnemyAttack = null;
    showEnemyIntentText(`Charging ${specialMove.name}!`, { variant: "charge" });
    return;
  }

  const randomAttr = attributes[Math.floor(Math.random() * attributes.length)];
  let damage = Math.round(calculatePetStats(randomAttr) * 0.8);

  if (battleState.enemyStatus.weakenedTurns > 0) {
    damage = Math.round(damage * 0.5);
    battleState.enemyStatus.weakenedTurns -= 1;
    addBattleLog("Enemy is weakened. Its attack power drops!");
  }

  battleState.pendingEnemyAttack = {
    damage,
    attribute: randomAttr,
    isSpecial: false,
    specialName: null,
  };
  showEnemyIntentText(`Incoming ${damage} damage`);
}

function calculatePetStats(attribute) {
  const baseAttribute = playerState[attribute] || 70;
  return Math.round((baseAttribute / 100) * playerProgress.level * 20);
}

function getUnlockedMonsterIndexForLevel(level) {
  if (level >= 20) return 4;
  if (level >= 15) return 3;
  if (level >= 10) return 2;
  if (level >= 5) return 1;
  return 0;
}

function generateMonster() {
  const strongestUnlockedIndex = getUnlockedMonsterIndexForLevel(playerProgress.level);
  let selectedIndex = strongestUnlockedIndex;

  if (battleState.dungeon.active && battleState.dungeon.floor < battleState.dungeon.totalFloors) {
    if (strongestUnlockedIndex > 0) {
      selectedIndex = Math.floor(Math.random() * strongestUnlockedIndex);
    }
  }

  const selected = monsters[selectedIndex];

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

function applyCriticalStatusEffect(attribute) {
  switch (attribute) {
    case "physical":
      battleState.enemyStatus.stunnedTurns = Math.max(battleState.enemyStatus.stunnedTurns, 1);
      addBattleLog("Critical effect: Stun! Enemy loses its next turn.");
      break;
    case "mental":
      battleState.enemyStatus.weakenedTurns = Math.max(battleState.enemyStatus.weakenedTurns, 2);
      addBattleLog("Critical effect: Mind Break! Enemy damage is reduced for 2 turns.");
      break;
    case "social":
      battleState.enemyStatus.vulnerableTurns = Math.max(battleState.enemyStatus.vulnerableTurns, 2);
      addBattleLog("Critical effect: Exposed! Enemy takes extra damage for 2 turns.");
      break;
    case "intellectual":
      battleState.playerStatus.focusTurns = Math.max(battleState.playerStatus.focusTurns, 2);
      addBattleLog("Critical effect: Focus! Your attacks deal extra damage for 2 turns.");
      break;
    case "spiritual":
      battleState.playerStatus.regenTurns = Math.max(battleState.playerStatus.regenTurns, 3);
      addBattleLog("Critical effect: Regeneration! You recover health for 3 turns.");
      break;
    default:
      break;
  }
}

function applyStartOfPlayerTurnEffects() {
  if (battleState.playerStatus.regenTurns > 0) {
    const before = battleState.playerHealth;
    battleState.playerHealth = Math.min(
      battleState.playerMaxHealth,
      battleState.playerHealth + PLAYER_REGEN_AMOUNT
    );
    const healed = battleState.playerHealth - before;
    battleState.playerStatus.regenTurns -= 1;
    if (healed > 0) {
      addBattleLog(`Regeneration restores ${healed} health.`);
      showCombatText({ target: "player", value: healed, type: "heal" });
    }
  }
}

function getActiveSynergy(currentAttribute) {
  if (!battleState.lastPlayerAttribute) return null;
  const key = `${battleState.lastPlayerAttribute}->${currentAttribute}`;
  return attributeSynergies[key] || null;
}

function formatAttributeName(attribute) {
  return attribute.charAt(0).toUpperCase() + attribute.slice(1);
}

function getComboSeedHint() {
  if (!battleState.lastPlayerAttribute) return "Combo Seed: None";
  return `Combo Seed: ${formatAttributeName(battleState.lastPlayerAttribute)}`;
}

function getMonsterAscii(monsterName) {
  return monsterAsciiMap[monsterName] || "o_o";
}

function getDungeonStatusText() {
  if (!battleState.dungeon.active) return "Dungeon Mode: Off";
  return `Dungeon Run: Floor ${battleState.dungeon.floor}/${battleState.dungeon.totalFloors}`;
}

function applyDungeonRecovery() {
  const baseRecovery = Math.round(battleState.playerMaxHealth * DUNGEON_PARTIAL_HEAL_PERCENT);
  const recovery = Math.max(1, baseRecovery);
  const before = battleState.playerHealth;
  battleState.playerHealth = Math.min(battleState.playerMaxHealth, battleState.playerHealth + recovery);
  const healed = battleState.playerHealth - before;
  addBattleLog(`Dungeon recovery: +${healed} health for the next floor.`);
}

function addBattleLog(message) {
  void message;
}

function renderBattleLog() {
  return;
}

function renderBattleUI() {
  const playerAvatar = document.getElementById("playerPetAvatar");
  const playerAvatarConfig = getSelectedAvatarForLevel(playerProgress.level);
  applyAvatarSpriteWithFallback(
    playerAvatar,
    playerAvatarConfig.src || SPRITE_ASSETS.player,
    PLAYER_FALLBACK_AVATAR,
  );
  playerAvatar.setAttribute("aria-label", playerAvatarConfig.alt);

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
    const enemyAvatar = document.getElementById("enemyAvatar");
    const enemyFallbackAvatar = getMonsterAscii(battleState.currentEnemy.name);
    applyAvatarSpriteWithFallback(
      enemyAvatar,
      getEnemySpritePath(battleState.currentEnemy.name),
      enemyFallbackAvatar
    );

    document.getElementById("enemyName").textContent = battleState.currentEnemy.name;
    const enemyHealthPercent = Math.round((battleState.currentEnemy.health / battleState.currentEnemy.maxHealth) * 100);
    document.getElementById("enemyHealthFill").style.width = `${enemyHealthPercent}%`;
    document.getElementById("enemyHealth").textContent = `Health: ${Math.max(0, battleState.currentEnemy.health)} / ${battleState.currentEnemy.maxHealth}`;
  }

  document.getElementById("battleStatus").textContent = battleState.isPlayerTurn ? "Your Turn" : "Enemy Attacking...";
  document.getElementById("comboSeedHint").textContent = getComboSeedHint();
  document.getElementById("dungeonStatus").textContent = getDungeonStatusText();

  const dungeonButton = document.getElementById("startDungeonBtn");
  if (dungeonButton) {
    dungeonButton.textContent = battleState.dungeon.active
      ? "Restart Dungeon Run (Reset HP)"
      : "Start Dungeon Run";
  }
}

function performAction(attribute) {
  if (!battleState.isPlayerTurn || !battleState.currentEnemy) return;

  clearEnemyIntentText();

  const cost = getAttackCost(attribute);
  if (playerState[attribute] < cost) {
    addBattleLog("Not enough energy!");
    return;
  }

  const isCritical = Math.random() < CRITICAL_HIT_CHANCE;
  let damage = getAttackDamage(attribute);
  const activeSynergy = getActiveSynergy(attribute);

  if (battleState.playerStatus.focusTurns > 0) {
    damage = Math.round(damage * 1.2);
    battleState.playerStatus.focusTurns -= 1;
    addBattleLog("Focus boosts your attack power!");
  }

  if (battleState.enemyStatus.vulnerableTurns > 0) {
    damage = Math.round(damage * 1.25);
    battleState.enemyStatus.vulnerableTurns -= 1;
    addBattleLog("Enemy vulnerability increases your damage!");
  }

  if (activeSynergy) {
    damage = Math.round(damage * activeSynergy.bonusMultiplier);
    addBattleLog(`Synergy triggered: ${activeSynergy.name}!`);
    activeSynergy.applyEffect();
  }

  if (isCritical) {
    damage = Math.round(damage * CRITICAL_HIT_MULTIPLIER);
  }

  playerState[attribute] = Math.max(0, playerState[attribute] - cost);
  battleState.currentEnemy.health = Math.max(0, battleState.currentEnemy.health - damage);
  showCombatText({ target: "enemy", value: damage, type: "damage" });

  if (isCritical) {
    addBattleLog(`Critical hit! You used ${attribute} and dealt ${damage} damage!`);
    applyCriticalStatusEffect(attribute);
  } else {
    addBattleLog(`You used ${attribute}! Dealt ${damage} damage.`);
  }

  battleState.lastPlayerAttribute = attribute;

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

  clearEnemyIntentText();

  battleState.isDefending = true;
  battleState.lastPlayerAttribute = null;
  addBattleLog("You brace for impact!");
  battleState.isPlayerTurn = false;
  renderBattleUI();
  setTimeout(enemyTurn, 1000);
}

function enemyTurn() {
  if (!battleState.currentEnemy) return;

  if (battleState.enemyStatus.stunnedTurns > 0) {
    battleState.enemyStatus.stunnedTurns -= 1;
    battleState.pendingEnemyAttack = null;
    battleState.pendingEnemySpecial = null;
    clearEnemyIntentText();
    addBattleLog("Enemy is stunned and cannot act!");
    battleState.isPlayerTurn = true;
    applyStartOfPlayerTurnEffects();
    renderBattleUI();
    return;
  }

  if (!battleState.pendingEnemyAttack) {
    planNextEnemyIntent();
  }

  if (battleState.pendingEnemyAttack) {
    const queuedAttack = battleState.pendingEnemyAttack;
    let actualDamage = queuedAttack.damage;

    if (battleState.isDefending) {
      actualDamage = Math.round(queuedAttack.damage * 0.4);
      battleState.isDefending = false;
    }

    battleState.playerHealth = Math.max(0, battleState.playerHealth - actualDamage);
    showCombatText({ target: "player", value: actualDamage, type: "damage" });

    battleState.pendingEnemyAttack = null;
    battleState.pendingEnemySpecial = null;

    if (battleState.playerHealth <= 0) {
      endBattle(false);
      return;
    }
  }

  planNextEnemyIntent();
  battleState.isPlayerTurn = true;
  applyStartOfPlayerTurnEffects();
  renderBattleUI();
}

function endBattle(playerWon) {
  const rewardsSection = document.getElementById("rewardsSection");
  const actionButtons = document.querySelector(".action-buttons");
  actionButtons.style.pointerEvents = "none";
  actionButtons.style.opacity = "0.5";

  if (playerWon) {
    const levelBefore = playerProgress.level;
    const baseExp = Math.round(100 * battleState.currentEnemy.difficulty);
    const bonus = Math.round(baseExp * 0.5);
    const totalExp = baseExp + bonus;

    playerProgress.exp += totalExp;
    while (playerProgress.exp >= expRequiredForLevel(playerProgress.level)) {
      playerProgress.exp -= expRequiredForLevel(playerProgress.level);
      playerProgress.level += 1;
    }

    syncPlayerMaxHealthWithLevel();
    const levelsGained = playerProgress.level - levelBefore;
    if (levelsGained > 0) {
      rainConfetti({ count: 100 + levelsGained * 15, duration: 2300 });
      showLevelUpBanner(levelsGained);
      addBattleLog(`Level up! Max health increased to ${battleState.playerMaxHealth}.`);
    }

    battleState.lastBattleWon = true;

    if (battleState.dungeon.active && battleState.dungeon.floor < battleState.dungeon.totalFloors) {
      applyDungeonRecovery();
    }

    addBattleLog(`Victory! Gained ${totalExp} EXP!`);
    if (battleState.dungeon.active) {
      if (battleState.dungeon.floor >= battleState.dungeon.totalFloors) {
        document.getElementById("rewardsTitle").textContent = "Dungeon Cleared!";
        document.getElementById("rewardExp").textContent = `Final floor cleared! Gained ${totalExp} EXP (+${bonus} Battle Bonus)`;
        document.getElementById("nextBattleBtn").textContent = "Return to Arena";
      } else {
        document.getElementById("rewardsTitle").textContent = "Floor Cleared!";
        document.getElementById("rewardExp").textContent = `Gained ${totalExp} EXP (+${bonus} Battle Bonus). Recovery applied for next floor.`;
        document.getElementById("nextBattleBtn").textContent = "Next Dungeon Floor";
      }
    } else {
      document.getElementById("rewardsTitle").textContent = "Battle Won!";
      document.getElementById("rewardExp").textContent = `Gained ${totalExp} EXP (+${bonus} Battle Bonus)`;
      document.getElementById("nextBattleBtn").textContent = "Next Battle";
    }
  } else {
    battleState.lastBattleWon = false;
    addBattleLog("Defeated! Your pet needs rest.");
    if (battleState.dungeon.active) {
      document.getElementById("rewardsTitle").textContent = "Dungeon Failed";
      document.getElementById("rewardExp").textContent = "Dungeon run ended. Start a new dungeon to reset and try again.";
      document.getElementById("nextBattleBtn").textContent = "Return to Arena";
      battleState.dungeon.active = false;
      battleState.dungeon.floor = 0;
    } else {
      document.getElementById("rewardsTitle").textContent = "Defeated!";
      document.getElementById("rewardExp").textContent = `Battle Lost. Return to wellness!`;
      document.getElementById("nextBattleBtn").textContent = "Next Battle";
    }
  }

  savePlayerData();
  rewardsSection.hidden = false;
  renderBattleUI();
}

function startNewBattle(options = {}) {
  const { preserveHealth = false } = options;
  syncPlayerMaxHealthWithLevel();
  battleState.currentEnemy = generateMonster();
  if (!preserveHealth) {
    battleState.playerHealth = battleState.playerMaxHealth;
  }
  battleState.enemyHealth = battleState.currentEnemy.maxHealth;
  battleState.isPlayerTurn = true;
  battleState.isDefending = false;
  battleState.pendingEnemyAttack = null;
  battleState.playerStatus = { regenTurns: 0, focusTurns: 0 };
  battleState.enemyStatus = { stunnedTurns: 0, weakenedTurns: 0, vulnerableTurns: 0 };
  battleState.lastPlayerAttribute = null;
  battleState.pendingEnemySpecial = null;
  clearEnemyIntentText();
  planNextEnemyIntent();

  const rewardsSection = document.getElementById("rewardsSection");
  rewardsSection.hidden = true;

  const actionButtons = document.querySelector(".action-buttons");
  actionButtons.style.pointerEvents = "auto";
  actionButtons.style.opacity = "1";

  addBattleLog(`A wild ${battleState.currentEnemy.name} appears!`);
  renderBattleUI();
}

function startDungeonRun() {
  battleState.dungeon.active = true;
  battleState.dungeon.floor = 1;
  battleState.lastBattleWon = null;
  startNewBattle({ preserveHealth: false });
  addBattleLog("Dungeon run started! Clear all floors in one run.");
}

function handleNextBattle() {
  if (battleState.dungeon.active) {
    if (battleState.lastBattleWon && battleState.dungeon.floor < battleState.dungeon.totalFloors) {
      battleState.dungeon.floor += 1;
      startNewBattle({ preserveHealth: true });
      return;
    }

    if (battleState.lastBattleWon && battleState.dungeon.floor >= battleState.dungeon.totalFloors) {
      battleState.dungeon.active = false;
      battleState.dungeon.floor = 0;
      startNewBattle({ preserveHealth: false });
      return;
    }
  }

  startNewBattle({ preserveHealth: false });
}

document.getElementById("physicalAttackBtn").addEventListener("click", () => performAction("physical"));
document.getElementById("mentalAttackBtn").addEventListener("click", () => performAction("mental"));
document.getElementById("socialAttackBtn").addEventListener("click", () => performAction("social"));
document.getElementById("intellectualAttackBtn").addEventListener("click", () => performAction("intellectual"));
document.getElementById("spiritualAttackBtn").addEventListener("click", () => performAction("spiritual"));
document.getElementById("defendBtn").addEventListener("click", performDefend);
document.getElementById("startDungeonBtn").addEventListener("click", startDungeonRun);
document.getElementById("nextBattleBtn").addEventListener("click", handleNextBattle);

loadPlayerData();
startNewBattle();

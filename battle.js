import { getSelectedAvatarForLevel } from "./avatar-selection.js";

const WELLNESS_PROGRESS_KEY = "wellnessProgress";
const WELLNESS_STATE_KEY = "wellnessState";
const WORLD_RUN_STATE_KEY = "worldRunState";
const BATTLE_SESSION_KEY = "battleSession";
const WORLD_RUN_STATE_VERSION = 1;
const WORLD_START_NODE_ID = "meadow-gate";
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
const MAX_STACKED_BUFF_TURNS = 6;
const MAX_PENDING_BATTLE_HEAL = 260;
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
let worldRunState = createDefaultWorldRunState();
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
  lastComboMessage: "Last Combo: None",
  returnToWorldMapNext: false,
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

const WORLD_ENCOUNTER_POOLS = {
  "meadow-gate": ["Slime"],
  "forest-trail": ["Slime", "Goblin"],
  "cavern-bend": ["Goblin", "Orc"],
  "ruins-crossing": ["Orc", "Dragon"],
  "storm-peak": ["Orc", "Dragon", "Demon"],
  "rift-core": ["Dragon", "Demon"],
};

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
  "physical->spiritual": {
    name: "Guardian Stance",
    bonusMultiplier: 1.2,
    applyEffect: () => {
      battleState.playerStatus.regenTurns = Math.max(battleState.playerStatus.regenTurns, 1);
      addBattleLog("Synergy effect: Regeneration primed for your next turn.");
    },
  },
  "spiritual->physical": {
    name: "Vital Strike",
    bonusMultiplier: 1.25,
    applyEffect: () => {
      const restored = 5;
      playerState.physical = Math.min(100, playerState.physical + restored);
      addBattleLog(`Synergy effect: Restored ${restored} Physical energy.`);
    },
  },
  "mental->social": {
    name: "Silver Tongue",
    bonusMultiplier: 1.2,
    applyEffect: () => {
      battleState.enemyStatus.weakenedTurns = Math.max(battleState.enemyStatus.weakenedTurns, 1);
      addBattleLog("Synergy effect: Enemy is weakened for 1 turn.");
    },
  },
  "social->mental": {
    name: "Crowd Read",
    bonusMultiplier: 1.2,
    applyEffect: () => {
      const restored = 5;
      playerState.mental = Math.min(100, playerState.mental + restored);
      addBattleLog(`Synergy effect: Restored ${restored} Mental energy.`);
    },
  },
  "intellectual->spiritual": {
    name: "Zen Equation",
    bonusMultiplier: 1.2,
    applyEffect: () => {
      const restored = 5;
      playerState.spiritual = Math.min(100, playerState.spiritual + restored);
      addBattleLog(`Synergy effect: Restored ${restored} Spiritual energy.`);
    },
  },
  "spiritual->intellectual": {
    name: "Clarity Pulse",
    bonusMultiplier: 1.2,
    applyEffect: () => {
      battleState.playerStatus.focusTurns = Math.max(battleState.playerStatus.focusTurns, 1);
      addBattleLog("Synergy effect: Focus empowered for 1 turn.");
    },
  },
  "physical->intellectual": {
    name: "Precision Drill",
    bonusMultiplier: 1.22,
    applyEffect: () => {
      battleState.enemyStatus.vulnerableTurns = Math.max(battleState.enemyStatus.vulnerableTurns, 1);
      addBattleLog("Synergy effect: Enemy becomes vulnerable for 1 turn.");
    },
  },
  "social->physical": {
    name: "Rally Charge",
    bonusMultiplier: 1.2,
    applyEffect: () => {
      const restored = 4;
      playerState.physical = Math.min(100, playerState.physical + restored);
      addBattleLog(`Synergy effect: Restored ${restored} Physical energy.`);
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

const WORLD_NODES = {
  "meadow-gate": { fightsInRow: 2, healthScale: 0.95, damageScale: 0.94, rewardBias: 1.02 },
  "forest-trail": { fightsInRow: 3, healthScale: 1.0, damageScale: 1.0, rewardBias: 1.0 },
  "cavern-bend": { fightsInRow: 3, healthScale: 1.08, damageScale: 1.06, rewardBias: 0.98 },
  "ruins-crossing": { fightsInRow: 4, healthScale: 1.16, damageScale: 1.12, rewardBias: 0.96 },
  "storm-peak": { fightsInRow: 5, healthScale: 1.24, damageScale: 1.2, rewardBias: 0.95 },
  "rift-core": { fightsInRow: 6, healthScale: 1.34, damageScale: 1.28, rewardBias: 0.92 },
};

const ATTRIBUTE_KEYS = ["physical", "mental", "social", "intellectual", "spiritual"];

function createDefaultWorldRunState() {
  return {
    version: WORLD_RUN_STATE_VERSION,
    currentNodeId: WORLD_START_NODE_ID,
    unlockedNodeIds: [WORLD_START_NODE_ID],
    completedNodeIds: [],
    streakFightsRemaining: 0,
    gauntlet: {
      active: false,
      nodeId: WORLD_START_NODE_ID,
      totalFights: 0,
      completedFights: 0,
    },
    activeBuffs: {
      damageBoostTurns: 0,
      defenseBoostTurns: 0,
      regenBoostTurns: 0,
    },
    pendingAttributeHeals: {
      physical: 0,
      mental: 0,
      social: 0,
      intellectual: 0,
      spiritual: 0,
    },
    pendingBattleHeal: 0,
    petCurrency: 0,
    completedRuns: 0,
  };
}

function toNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, parsed);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeUnlockedNodeIds(value) {
  const raw = Array.isArray(value) ? value : [];
  const unique = [...new Set(raw.filter((item) => typeof item === "string" && item.trim().length > 0))];
  if (!unique.includes(WORLD_START_NODE_ID)) {
    unique.unshift(WORLD_START_NODE_ID);
  }
  return unique;
}

function sanitizeWorldRunState(rawState) {
  const defaults = createDefaultWorldRunState();
  const source = rawState && typeof rawState === "object" ? rawState : {};
  const activeBuffs = source.activeBuffs && typeof source.activeBuffs === "object" ? source.activeBuffs : {};
  const pendingAttributeHeals = source.pendingAttributeHeals && typeof source.pendingAttributeHeals === "object"
    ? source.pendingAttributeHeals
    : {};
  const gauntlet = source.gauntlet && typeof source.gauntlet === "object" ? source.gauntlet : {};

  const merged = {
    ...defaults,
    version: WORLD_RUN_STATE_VERSION,
    currentNodeId: typeof source.currentNodeId === "string" && source.currentNodeId.trim().length > 0
      ? source.currentNodeId
      : WORLD_START_NODE_ID,
    unlockedNodeIds: sanitizeUnlockedNodeIds(source.unlockedNodeIds),
    completedNodeIds: Array.isArray(source.completedNodeIds)
      ? [...new Set(source.completedNodeIds.filter((item) => typeof item === "string" && item.trim().length > 0))]
      : [],
    streakFightsRemaining: toNonNegativeInteger(source.streakFightsRemaining, defaults.streakFightsRemaining),
    gauntlet: {
      active: Boolean(gauntlet.active),
      nodeId: typeof gauntlet.nodeId === "string" && gauntlet.nodeId.trim().length > 0
        ? gauntlet.nodeId
        : WORLD_START_NODE_ID,
      totalFights: toNonNegativeInteger(gauntlet.totalFights, defaults.gauntlet.totalFights),
      completedFights: toNonNegativeInteger(gauntlet.completedFights, defaults.gauntlet.completedFights),
    },
    activeBuffs: {
      damageBoostTurns: toNonNegativeInteger(activeBuffs.damageBoostTurns, defaults.activeBuffs.damageBoostTurns),
      defenseBoostTurns: toNonNegativeInteger(activeBuffs.defenseBoostTurns, defaults.activeBuffs.defenseBoostTurns),
      regenBoostTurns: toNonNegativeInteger(activeBuffs.regenBoostTurns, defaults.activeBuffs.regenBoostTurns),
    },
    pendingAttributeHeals: {
      physical: toNonNegativeInteger(pendingAttributeHeals.physical, defaults.pendingAttributeHeals.physical),
      mental: toNonNegativeInteger(pendingAttributeHeals.mental, defaults.pendingAttributeHeals.mental),
      social: toNonNegativeInteger(pendingAttributeHeals.social, defaults.pendingAttributeHeals.social),
      intellectual: toNonNegativeInteger(pendingAttributeHeals.intellectual, defaults.pendingAttributeHeals.intellectual),
      spiritual: toNonNegativeInteger(pendingAttributeHeals.spiritual, defaults.pendingAttributeHeals.spiritual),
    },
    pendingBattleHeal: toNonNegativeInteger(source.pendingBattleHeal, defaults.pendingBattleHeal),
    petCurrency: toNonNegativeInteger(source.petCurrency, defaults.petCurrency),
    completedRuns: toNonNegativeInteger(source.completedRuns, defaults.completedRuns),
  };

  if (!merged.unlockedNodeIds.includes(merged.currentNodeId)) {
    merged.unlockedNodeIds.push(merged.currentNodeId);
  }

  return merged;
}

function loadWorldRunState() {
  const raw = localStorage.getItem(WORLD_RUN_STATE_KEY);
  if (!raw) {
    worldRunState = createDefaultWorldRunState();
    saveWorldRunState();
    return;
  }

  try {
    worldRunState = sanitizeWorldRunState(JSON.parse(raw));
  } catch {
    worldRunState = createDefaultWorldRunState();
  }

  saveWorldRunState();
}

function saveWorldRunState() {
  localStorage.setItem(WORLD_RUN_STATE_KEY, JSON.stringify(worldRunState));
}

function resetWorldRunState() {
  worldRunState = createDefaultWorldRunState();
  clearBattleSession();
  saveWorldRunState();
  renderBattleUI();
}

function isWorldGauntletActive() {
  return Boolean(worldRunState.gauntlet?.active);
}

function initializeBattleModeFromWorldState() {
  if (!isWorldGauntletActive()) {
    return;
  }

  const totalFights = Math.max(1, toNonNegativeInteger(worldRunState.gauntlet.totalFights, 1));
  const completedFights = Math.min(totalFights - 1, toNonNegativeInteger(worldRunState.gauntlet.completedFights, 0));

  battleState.dungeon.active = true;
  battleState.dungeon.totalFloors = totalFights;
  battleState.dungeon.floor = Math.max(1, completedFights + 1);

  worldRunState.gauntlet.totalFights = totalFights;
  worldRunState.gauntlet.completedFights = completedFights;
}

function completeWorldNodeProgression(nodeId) {
  if (!nodeId) {
    return;
  }

  if (!worldRunState.completedNodeIds.includes(nodeId)) {
    worldRunState.completedNodeIds.push(nodeId);
  }

  const unlocked = [WORLD_START_NODE_ID];
  const nodeIds = Object.keys(WORLD_NODES);

  for (let i = 1; i < nodeIds.length; i += 1) {
    if (!worldRunState.completedNodeIds.includes(nodeIds[i - 1])) {
      break;
    }
    unlocked.push(nodeIds[i]);
  }

  worldRunState.unlockedNodeIds = unlocked;
}

function clearActiveWorldGauntlet() {
  worldRunState.gauntlet = {
    active: false,
    nodeId: worldRunState.currentNodeId || WORLD_START_NODE_ID,
    totalFights: 0,
    completedFights: 0,
  };
  worldRunState.streakFightsRemaining = 0;
}

function syncWorldRunBattleSnapshot() {
  if (!battleState.dungeon.active) {
    worldRunState.streakFightsRemaining = 0;
    return;
  }

  const fightsCleared = Math.max(0, battleState.dungeon.floor - 1);
  worldRunState.streakFightsRemaining = Math.max(0, battleState.dungeon.totalFloors - fightsCleared);

  if (isWorldGauntletActive()) {
    worldRunState.gauntlet.totalFights = battleState.dungeon.totalFloors;
    worldRunState.gauntlet.completedFights = fightsCleared;
  }
}

function getWorldRunStatusText() {
  const buffs = worldRunState.activeBuffs;
  return `World: Node ${worldRunState.currentNodeId} | Unlocked ${worldRunState.unlockedNodeIds.length} | Completed ${worldRunState.completedNodeIds.length} | Streak ${worldRunState.streakFightsRemaining} | Coins ${worldRunState.petCurrency} | Runs ${worldRunState.completedRuns} | HealPack ${worldRunState.pendingBattleHeal} | Buffs D${buffs.damageBoostTurns}/T${buffs.defenseBoostTurns}/R${buffs.regenBoostTurns}`;
}

function getActiveWorldNodeBalance() {
  const nodeId = worldRunState.gauntlet?.nodeId || worldRunState.currentNodeId;
  return WORLD_NODES[nodeId] || WORLD_NODES[WORLD_START_NODE_ID];
}

function getGauntletProgressScalar() {
  if (!isWorldGauntletActive() || battleState.dungeon.totalFloors <= 1) {
    return 0;
  }

  const progress = (Math.max(1, battleState.dungeon.floor) - 1) / (battleState.dungeon.totalFloors - 1);
  return clamp(progress, 0, 1);
}

function getNodeCombatScales() {
  if (!isWorldGauntletActive()) {
    return { healthScale: 1, damageScale: 1, rewardBias: 1 };
  }

  const node = getActiveWorldNodeBalance();
  const progressScalar = getGauntletProgressScalar();
  return {
    healthScale: node.healthScale + progressScalar * 0.08,
    damageScale: node.damageScale + progressScalar * 0.06,
    rewardBias: node.rewardBias,
  };
}

function getNodeRewardRollCount(finalFight) {
  if (!isWorldGauntletActive()) {
    return finalFight ? 2 : 1;
  }

  const node = getActiveWorldNodeBalance();
  if (finalFight) {
    return node.fightsInRow >= 5 ? 2 : 2;
  }
  return 1;
}

function clearBattleSession() {
  localStorage.removeItem(BATTLE_SESSION_KEY);
}

function saveBattleSession() {
  if (!battleState.currentEnemy) {
    return;
  }

  const rewardsSection = document.getElementById("rewardsSection");
  const snapshot = {
    playerHealth: battleState.playerHealth,
    playerMaxHealth: battleState.playerMaxHealth,
    currentEnemy: battleState.currentEnemy,
    isPlayerTurn: battleState.isPlayerTurn,
    isDefending: battleState.isDefending,
    playerStatus: battleState.playerStatus,
    enemyStatus: battleState.enemyStatus,
    pendingEnemyAttack: battleState.pendingEnemyAttack,
    pendingEnemySpecial: battleState.pendingEnemySpecial,
    lastPlayerAttribute: battleState.lastPlayerAttribute,
    lastComboMessage: battleState.lastComboMessage,
    returnToWorldMapNext: battleState.returnToWorldMapNext,
    dungeon: battleState.dungeon,
    lastBattleWon: battleState.lastBattleWon,
    rewardsVisible: rewardsSection ? !rewardsSection.hidden : false,
    timestamp: Date.now(),
  };

  localStorage.setItem(BATTLE_SESSION_KEY, JSON.stringify(snapshot));
}

function restoreBattleSession() {
  const raw = localStorage.getItem(BATTLE_SESSION_KEY);
  if (!raw) {
    return false;
  }

  hideRewardPopup();

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.currentEnemy) {
      clearBattleSession();
      return false;
    }

    battleState.playerHealth = toNonNegativeInteger(parsed.playerHealth, battleState.playerHealth);
    battleState.playerMaxHealth = toNonNegativeInteger(parsed.playerMaxHealth, battleState.playerMaxHealth);
    battleState.currentEnemy = parsed.currentEnemy;
    battleState.isPlayerTurn = Boolean(parsed.isPlayerTurn);
    battleState.isDefending = Boolean(parsed.isDefending);
    battleState.playerStatus = parsed.playerStatus || { regenTurns: 0, focusTurns: 0 };
    battleState.enemyStatus = parsed.enemyStatus || { stunnedTurns: 0, weakenedTurns: 0, vulnerableTurns: 0 };
    battleState.pendingEnemyAttack = parsed.pendingEnemyAttack || null;
    battleState.pendingEnemySpecial = parsed.pendingEnemySpecial || null;
    battleState.lastPlayerAttribute = parsed.lastPlayerAttribute || null;
    battleState.lastComboMessage = parsed.lastComboMessage || "Last Combo: None";
    battleState.returnToWorldMapNext = Boolean(parsed.returnToWorldMapNext);
    battleState.dungeon = parsed.dungeon || battleState.dungeon;
    battleState.lastBattleWon = typeof parsed.lastBattleWon === "boolean" ? parsed.lastBattleWon : null;

    const rewardsSection = document.getElementById("rewardsSection");
    if (rewardsSection) {
      rewardsSection.hidden = !Boolean(parsed.rewardsVisible);
    }

    const actionButtons = document.querySelector(".action-buttons");
    if (actionButtons) {
      const blocked = Boolean(parsed.rewardsVisible);
      actionButtons.style.pointerEvents = blocked ? "none" : "auto";
      actionButtons.style.opacity = blocked ? "0.5" : "1";
    }

    return true;
  } catch {
    clearBattleSession();
    return false;
  }
}

function applyPendingBattleHealIfAvailable() {
  if (worldRunState.pendingBattleHeal <= 0) {
    return;
  }

  if (battleState.playerHealth >= battleState.playerMaxHealth) {
    return;
  }

  const before = battleState.playerHealth;
  battleState.playerHealth = Math.min(battleState.playerMaxHealth, battleState.playerHealth + worldRunState.pendingBattleHeal);
  const healed = Math.max(0, battleState.playerHealth - before);
  worldRunState.pendingBattleHeal = Math.max(0, worldRunState.pendingBattleHeal - healed);

  if (healed > 0) {
    addBattleLog(`Heal Pack restores ${healed} health before battle.`);
  }
}

function randomInt(min, max) {
  const safeMin = Math.ceil(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function getRandomAttributeKey() {
  const index = randomInt(0, ATTRIBUTE_KEYS.length - 1);
  return ATTRIBUTE_KEYS[index];
}

function getRandomGauntletRewardType() {
  const node = getActiveWorldNodeBalance();
  const rewardBias = clamp(node.rewardBias ?? 1, 0.85, 1.2);
  const lowBuffSpace = worldRunState.activeBuffs.damageBoostTurns >= MAX_STACKED_BUFF_TURNS
    && worldRunState.activeBuffs.defenseBoostTurns >= MAX_STACKED_BUFF_TURNS
    && worldRunState.activeBuffs.regenBoostTurns >= MAX_STACKED_BUFF_TURNS;

  const pool = [
    { type: "heal", weight: Math.round(22 * rewardBias) },
    { type: "damageBuff", weight: lowBuffSpace ? 4 : Math.round(14 * rewardBias) },
    { type: "defenseBuff", weight: lowBuffSpace ? 4 : Math.round(14 * rewardBias) },
    { type: "regenBuff", weight: lowBuffSpace ? 4 : Math.round(12 * rewardBias) },
    { type: "attributeHeal", weight: Math.round(19 * rewardBias) },
    { type: "currency", weight: Math.round(19 * rewardBias) },
  ];

  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = randomInt(1, totalWeight);

  for (let i = 0; i < pool.length; i += 1) {
    roll -= pool[i].weight;
    if (roll <= 0) {
      return pool[i].type;
    }
  }

  return "currency";
}

function addCappedBuffTurns(buffKey, turnsToAdd) {
  const current = toNonNegativeInteger(worldRunState.activeBuffs[buffKey], 0);
  worldRunState.activeBuffs[buffKey] = Math.min(MAX_STACKED_BUFF_TURNS, current + turnsToAdd);
}

function applyGauntletRewardType(rewardType, options = {}) {
  const finalFight = Boolean(options.finalFight);

  if (rewardType === "heal") {
    const healPercent = finalFight ? randomInt(24, 36) : randomInt(14, 24);
    const healAmount = Math.max(1, Math.round((battleState.playerMaxHealth * healPercent) / 100));
    const before = battleState.playerHealth;
    battleState.playerHealth = Math.min(battleState.playerMaxHealth, battleState.playerHealth + healAmount);
    const recovered = Math.max(0, battleState.playerHealth - before);
    return recovered > 0 ? `Recovered ${recovered} health.` : "Health was already full.";
  }

  if (rewardType === "damageBuff") {
    const turns = finalFight ? 3 : 2;
    addCappedBuffTurns("damageBoostTurns", turns);
    return `Damage Boost applied for ${turns} turns.`;
  }

  if (rewardType === "defenseBuff") {
    const turns = finalFight ? 3 : 2;
    addCappedBuffTurns("defenseBoostTurns", turns);
    return `Defense Boost applied for ${turns} turns.`;
  }

  if (rewardType === "regenBuff") {
    const turns = finalFight ? 3 : 2;
    addCappedBuffTurns("regenBoostTurns", turns);
    return `Regeneration Boost applied for ${turns} turns.`;
  }

  if (rewardType === "attributeHeal") {
    const attribute = getRandomAttributeKey();
    const restoreAmount = finalFight ? randomInt(18, 30) : randomInt(10, 20);
    playerState[attribute] = Math.min(100, playerState[attribute] + restoreAmount);
    return `Restored ${restoreAmount} ${formatAttributeName(attribute)} energy.`;
  }

  const currencyGain = finalFight ? randomInt(16, 32) : randomInt(8, 18);
  worldRunState.petCurrency += currencyGain;
  return `Gained ${currencyGain} Pet Coins.`;
}

function rollGauntletRewards(options = {}) {
  const finalFight = Boolean(options.finalFight);
  const rollCount = getNodeRewardRollCount(finalFight);
  const lines = [];
  const rolledTypes = [];

  for (let i = 0; i < rollCount; i += 1) {
    let type = getRandomGauntletRewardType();
    if (rolledTypes.includes(type)) {
      type = "currency";
    }
    rolledTypes.push(type);
    lines.push(applyGauntletRewardType(type, { finalFight }));
  }

  return {
    title: finalFight ? "Node Rewards" : "Fight Reward",
    summary: finalFight
      ? "Your final gauntlet rewards are ready."
      : "You earned a random reward for clearing this fight.",
    lines,
  };
}

function isRewardPopupOpen() {
  const modal = document.getElementById("gauntletRewardModal");
  return Boolean(modal) && !modal.hidden;
}

function showRewardPopup(packageData) {
  const modal = document.getElementById("gauntletRewardModal");
  if (!modal || !packageData) {
    return;
  }

  const title = document.getElementById("rewardModalTitle");
  const summary = document.getElementById("rewardModalSummary");
  const list = document.getElementById("rewardModalList");
  const nextButton = document.getElementById("nextBattleBtn");

  title.textContent = packageData.title;
  summary.textContent = packageData.summary;
  list.innerHTML = "";

  for (let i = 0; i < packageData.lines.length; i += 1) {
    const item = document.createElement("li");
    item.textContent = packageData.lines[i];
    list.appendChild(item);
  }

  if (nextButton) {
    nextButton.disabled = true;
  }

  modal.hidden = false;
}

function hideRewardPopup() {
  const modal = document.getElementById("gauntletRewardModal");
  const nextButton = document.getElementById("nextBattleBtn");
  if (modal) {
    modal.hidden = true;
  }
  if (nextButton) {
    nextButton.disabled = false;
  }
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
  saveWorldRunState();
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
    const scales = getNodeCombatScales();
    let damage = Math.round(calculatePetStats(randomAttr) * specialMove.multiplier * scales.damageScale);

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
  const scales = getNodeCombatScales();
  let damage = Math.round(calculatePetStats(randomAttr) * 0.8 * scales.damageScale);

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

function getCurrentWorldNodeId() {
  if (isWorldGauntletActive()) {
    return worldRunState.gauntlet.nodeId;
  }
  return worldRunState.currentNodeId;
}

function getWorldEncounterPool() {
  const nodeId = getCurrentWorldNodeId();
  return WORLD_ENCOUNTER_POOLS[nodeId] || [];
}

function getMonsterByName(monsterName) {
  for (let i = 0; i < monsters.length; i += 1) {
    if (monsters[i].name === monsterName) {
      return monsters[i];
    }
  }
  return null;
}

function generateMonster() {
  const worldPool = getWorldEncounterPool();
  let selected = null;

  if (worldPool.length > 0) {
    const randomName = worldPool[Math.floor(Math.random() * worldPool.length)];
    selected = getMonsterByName(randomName);
  }

  if (!selected) {
    const strongestUnlockedIndex = getUnlockedMonsterIndexForLevel(playerProgress.level);
    selected = monsters[strongestUnlockedIndex];
  }

  const scales = getNodeCombatScales();
  const health = Math.round(selected.baseHealth * (1 + playerProgress.level * 0.1) * scales.healthScale);
  const difficulty = Number((selected.difficulty * ((scales.healthScale + scales.damageScale) / 2)).toFixed(2));

  return {
    name: selected.name,
    maxHealth: health,
    health: health,
    difficulty,
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
  if (worldRunState.activeBuffs.regenBoostTurns > 0) {
    const boostedHeal = Math.max(1, Math.round(battleState.playerMaxHealth * 0.06));
    const beforeBoost = battleState.playerHealth;
    battleState.playerHealth = Math.min(battleState.playerMaxHealth, battleState.playerHealth + boostedHeal);
    const healed = battleState.playerHealth - beforeBoost;
    worldRunState.activeBuffs.regenBoostTurns -= 1;
    if (healed > 0) {
      addBattleLog(`Regeneration boost restores ${healed} health.`);
      showCombatText({ target: "player", value: healed, type: "heal" });
    }
  }

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

function getComboResultText() {
  return battleState.lastComboMessage || "Last Combo: None";
}

function getMonsterAscii(monsterName) {
  return monsterAsciiMap[monsterName] || "o_o";
}

function getDungeonStatusText() {
  if (isWorldGauntletActive()) {
    return `World Gauntlet: Fight ${battleState.dungeon.floor}/${battleState.dungeon.totalFloors}`;
  }
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
  document.getElementById("comboResult").textContent = getComboResultText();
  document.getElementById("comboSeedHint").textContent = getComboSeedHint();
  document.getElementById("dungeonStatus").textContent = getDungeonStatusText();
  document.getElementById("worldRunStatus").textContent = getWorldRunStatusText();

  const dungeonButton = document.getElementById("startDungeonBtn");
  if (dungeonButton) {
    if (isWorldGauntletActive()) {
      dungeonButton.textContent = "World Gauntlet Active";
      dungeonButton.disabled = true;
    } else {
      dungeonButton.disabled = false;
      dungeonButton.textContent = battleState.dungeon.active
        ? "Restart Dungeon Run (Reset HP)"
        : "Start Dungeon Run";
    }
  }

  savePlayerData();
  saveBattleSession();
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
  const previousAttribute = battleState.lastPlayerAttribute;

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

  if (worldRunState.activeBuffs.damageBoostTurns > 0) {
    damage = Math.round(damage * 1.18);
    worldRunState.activeBuffs.damageBoostTurns -= 1;
    addBattleLog("Damage Boost increases your attack!");
  }

  if (activeSynergy) {
    damage = Math.round(damage * activeSynergy.bonusMultiplier);
    addBattleLog(`Synergy triggered: ${activeSynergy.name}!`);
    battleState.lastComboMessage = `Last Combo: ${activeSynergy.name} (${formatAttributeName(previousAttribute)} -> ${formatAttributeName(attribute)})`;
    activeSynergy.applyEffect();
  } else {
    battleState.lastComboMessage = "Last Combo: None this turn";
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
  battleState.lastComboMessage = "Last Combo: None (Defend used)";
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

    if (worldRunState.activeBuffs.defenseBoostTurns > 0) {
      actualDamage = Math.round(actualDamage * 0.76);
      worldRunState.activeBuffs.defenseBoostTurns -= 1;
      addBattleLog("Defense Boost softens incoming damage!");
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
  const isWorldGauntlet = isWorldGauntletActive();

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

    if (battleState.dungeon.active && battleState.dungeon.floor < battleState.dungeon.totalFloors && !isWorldGauntlet) {
      applyDungeonRecovery();
    }

    addBattleLog(`Victory! Gained ${totalExp} EXP!`);
    if (battleState.dungeon.active) {
      if (isWorldGauntlet) {
        const finalGauntletFight = battleState.dungeon.floor >= battleState.dungeon.totalFloors;
        const rewardPack = rollGauntletRewards({ finalFight: finalGauntletFight });
        showRewardPopup(rewardPack);
      }

      if (battleState.dungeon.floor >= battleState.dungeon.totalFloors) {
        if (isWorldGauntlet) {
          const nodeId = worldRunState.gauntlet.nodeId || worldRunState.currentNodeId;
          completeWorldNodeProgression(nodeId);
          worldRunState.completedRuns += 1;
          clearActiveWorldGauntlet();
          battleState.returnToWorldMapNext = true;
          battleState.dungeon.active = false;
          battleState.dungeon.floor = 0;
          document.getElementById("rewardsTitle").textContent = "World Node Cleared!";
          document.getElementById("rewardExp").textContent = `Gauntlet complete! Gained ${totalExp} EXP (+${bonus} Battle Bonus). Rewards granted. Returning to world map.`;
          document.getElementById("nextBattleBtn").textContent = "Return to World Map";
        } else {
          document.getElementById("rewardsTitle").textContent = "Dungeon Cleared!";
          document.getElementById("rewardExp").textContent = `Final floor cleared! Gained ${totalExp} EXP (+${bonus} Battle Bonus)`;
          document.getElementById("nextBattleBtn").textContent = "Return to Arena";
        }
      } else if (isWorldGauntlet) {
        document.getElementById("rewardsTitle").textContent = "Fight Cleared!";
        document.getElementById("rewardExp").textContent = `Gained ${totalExp} EXP (+${bonus} Battle Bonus). Random reward granted. HP and buffs carry to the next fight.`;
        document.getElementById("nextBattleBtn").textContent = "Next Gauntlet Fight";
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
      if (isWorldGauntlet) {
        clearActiveWorldGauntlet();
        battleState.returnToWorldMapNext = true;
        document.getElementById("rewardsTitle").textContent = "World Node Failed";
        document.getElementById("rewardExp").textContent = "Gauntlet failed. Return to world map to pick your next challenge.";
        document.getElementById("nextBattleBtn").textContent = "Return to World Map";
      } else {
        document.getElementById("rewardsTitle").textContent = "Dungeon Failed";
        document.getElementById("rewardExp").textContent = "Dungeon run ended. Start a new dungeon to reset and try again.";
        document.getElementById("nextBattleBtn").textContent = "Return to Arena";
      }
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
  const { preserveHealth = false, preservePlayerStatus = false } = options;
  battleState.returnToWorldMapNext = false;
  syncWorldRunBattleSnapshot();
  saveWorldRunState();
  syncPlayerMaxHealthWithLevel();
  battleState.currentEnemy = generateMonster();
  if (!preserveHealth) {
    battleState.playerHealth = battleState.playerMaxHealth;
  }
  applyPendingBattleHealIfAvailable();
  battleState.enemyHealth = battleState.currentEnemy.maxHealth;
  battleState.isPlayerTurn = true;
  battleState.isDefending = false;
  battleState.pendingEnemyAttack = null;
  if (!preservePlayerStatus) {
    battleState.playerStatus = { regenTurns: 0, focusTurns: 0 };
  }
  battleState.enemyStatus = { stunnedTurns: 0, weakenedTurns: 0, vulnerableTurns: 0 };
  battleState.lastPlayerAttribute = null;
  battleState.pendingEnemySpecial = null;
  battleState.lastComboMessage = "Last Combo: None";
  hideRewardPopup();
  clearEnemyIntentText();
  planNextEnemyIntent();

  const rewardsSection = document.getElementById("rewardsSection");
  rewardsSection.hidden = true;

  const actionButtons = document.querySelector(".action-buttons");
  actionButtons.style.pointerEvents = "auto";
  actionButtons.style.opacity = "1";

  addBattleLog(`A wild ${battleState.currentEnemy.name} appears!`);
  savePlayerData();
  renderBattleUI();
}

function startDungeonRun() {
  clearActiveWorldGauntlet();
  battleState.dungeon.active = true;
  battleState.dungeon.floor = 1;
  battleState.dungeon.totalFloors = DUNGEON_TOTAL_FLOORS;
  battleState.lastBattleWon = null;
  syncWorldRunBattleSnapshot();
  saveWorldRunState();
  startNewBattle({ preserveHealth: false });
  addBattleLog("Dungeon run started! Clear all floors in one run.");
}

function handleNextBattle() {
  if (isRewardPopupOpen()) {
    return;
  }

  if (battleState.returnToWorldMapNext) {
    battleState.returnToWorldMapNext = false;
    clearBattleSession();
    window.location.href = "worldmap.html";
    return;
  }

  if (!battleState.lastBattleWon && !battleState.dungeon.active && !isWorldGauntletActive()) {
    startNewBattle({ preserveHealth: false });
    return;
  }

  if (!battleState.lastBattleWon && !battleState.dungeon.active) {
    clearBattleSession();
    window.location.href = "worldmap.html";
    return;
  }

  if (battleState.dungeon.active) {
    if (battleState.lastBattleWon && battleState.dungeon.floor < battleState.dungeon.totalFloors) {
      battleState.dungeon.floor += 1;
      syncWorldRunBattleSnapshot();
      saveWorldRunState();
      startNewBattle({
        preserveHealth: true,
        preservePlayerStatus: isWorldGauntletActive(),
      });
      return;
    }

    if (battleState.lastBattleWon && battleState.dungeon.floor >= battleState.dungeon.totalFloors) {
      if (isWorldGauntletActive()) {
        clearBattleSession();
        window.location.href = "worldmap.html";
        return;
      }

      battleState.dungeon.active = false;
      battleState.dungeon.floor = 0;
      syncWorldRunBattleSnapshot();
      saveWorldRunState();
      startNewBattle({ preserveHealth: false });
      return;
    }
  }

  if (isWorldGauntletActive()) {
    clearBattleSession();
    window.location.href = "worldmap.html";
    return;
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
document.getElementById("acceptRewardBtn").addEventListener("click", hideRewardPopup);
const resetWorldRunBtn = document.getElementById("resetWorldRunBtn");
if (resetWorldRunBtn) {
  resetWorldRunBtn.addEventListener("click", () => {
    resetWorldRunState();
    addBattleLog("World run state reset (Dev).");
  });
}

loadPlayerData();
loadWorldRunState();
initializeBattleModeFromWorldState();
syncWorldRunBattleSnapshot();
saveWorldRunState();
if (isWorldGauntletActive() && restoreBattleSession()) {
  renderBattleUI();
} else {
  startNewBattle();
}

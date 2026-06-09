const WORLD_RUN_STATE_KEY = "worldRunState";
const WELLNESS_STATE_KEY = "wellnessState";
const WORLD_RUN_STATE_VERSION = 1;
const WORLD_START_NODE_ID = "meadow-gate";

const WORLD_NODES = [
  { id: "meadow-gate", name: "Meadow Gate", difficulty: "Easy", fightsInRow: 2, rewardTier: "Common" },
  { id: "forest-trail", name: "Forest Trail", difficulty: "Easy+", fightsInRow: 3, rewardTier: "Common+" },
  { id: "cavern-bend", name: "Cavern Bend", difficulty: "Medium", fightsInRow: 3, rewardTier: "Uncommon" },
  { id: "ruins-crossing", name: "Ruins Crossing", difficulty: "Medium+", fightsInRow: 4, rewardTier: "Uncommon+" },
  { id: "storm-peak", name: "Storm Peak", difficulty: "Hard", fightsInRow: 5, rewardTier: "Rare" },
  { id: "rift-core", name: "Rift Core", difficulty: "Boss", fightsInRow: 6, rewardTier: "Epic" },
];

let worldRunState = createDefaultWorldRunState();
let wellnessState = createDefaultWellnessState();
let selectedNodeId = null;

const SHOP_ITEMS = {
  healPack: { cost: 12, label: "Heal Pack" },
  attributeTonic: { cost: 14, label: "Attribute Tonic" },
  damageBuff: { cost: 10, label: "Battle Damage Buff" },
  defenseBuff: { cost: 10, label: "Battle Defense Buff" },
  regenBuff: { cost: 10, label: "Battle Regen Buff" },
};

const MAX_WORLD_BUFF_TURNS = 6;
const MAX_PENDING_BATTLE_HEAL = 260;

function createDefaultWellnessState() {
  return {
    physical: 70,
    mental: 70,
    social: 70,
    intellectual: 70,
    spiritual: 70,
  };
}

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

function saveWorldRunState() {
  localStorage.setItem(WORLD_RUN_STATE_KEY, JSON.stringify(worldRunState));
}

function loadWellnessState() {
  const raw = localStorage.getItem(WELLNESS_STATE_KEY);
  if (!raw) {
    wellnessState = createDefaultWellnessState();
    saveWellnessState();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const defaults = createDefaultWellnessState();
    wellnessState = {
      physical: toNonNegativeInteger(parsed?.physical, defaults.physical),
      mental: toNonNegativeInteger(parsed?.mental, defaults.mental),
      social: toNonNegativeInteger(parsed?.social, defaults.social),
      intellectual: toNonNegativeInteger(parsed?.intellectual, defaults.intellectual),
      spiritual: toNonNegativeInteger(parsed?.spiritual, defaults.spiritual),
    };
  } catch {
    wellnessState = createDefaultWellnessState();
  }

  saveWellnessState();
}

function saveWellnessState() {
  localStorage.setItem(WELLNESS_STATE_KEY, JSON.stringify(wellnessState));
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

function resetWorldRunState() {
  worldRunState = createDefaultWorldRunState();
  selectedNodeId = WORLD_START_NODE_ID;
  saveWorldRunState();
}

function getNodeIndex(nodeId) {
  return WORLD_NODES.findIndex((node) => node.id === nodeId);
}

function isNodeUnlocked(nodeId) {
  const index = getNodeIndex(nodeId);
  if (index <= 0) {
    return true;
  }

  const previousNode = WORLD_NODES[index - 1];
  return worldRunState.completedNodeIds.includes(previousNode.id);
}

function syncNodeUnlocksFromCompletion() {
  const unlocked = [WORLD_START_NODE_ID];

  for (let i = 1; i < WORLD_NODES.length; i += 1) {
    const previousNode = WORLD_NODES[i - 1];
    if (!worldRunState.completedNodeIds.includes(previousNode.id)) {
      break;
    }
    unlocked.push(WORLD_NODES[i].id);
  }

  worldRunState.unlockedNodeIds = unlocked;

  if (!isNodeUnlocked(worldRunState.currentNodeId)) {
    worldRunState.currentNodeId = unlocked[unlocked.length - 1] || WORLD_START_NODE_ID;
  }
}

function formatSelectionMeta(node) {
  return `Difficulty: ${node.difficulty} | Fights In Row: ${node.fightsInRow}`;
}

function renderSummary() {
  const summary = document.getElementById("worldMapSummary");
  const gauntletText = worldRunState.gauntlet.active
    ? `Active Gauntlet: ${worldRunState.gauntlet.nodeId} (${worldRunState.gauntlet.completedFights}/${worldRunState.gauntlet.totalFights})`
    : "Active Gauntlet: None";
  summary.textContent = `Current Node: ${worldRunState.currentNodeId} | Unlocked: ${worldRunState.unlockedNodeIds.length}/${WORLD_NODES.length} | Completed: ${worldRunState.completedNodeIds.length} | Coins: ${worldRunState.petCurrency} | ${gauntletText}`;
}

function setShopFeedback(text) {
  const element = document.getElementById("shopFeedback");
  if (element) {
    element.textContent = text;
  }
}

function canAfford(itemKey) {
  const item = SHOP_ITEMS[itemKey];
  return Boolean(item) && worldRunState.petCurrency >= item.cost;
}

function canBuyItem(itemKey) {
  if (!canAfford(itemKey)) {
    return false;
  }

  if (itemKey === "healPack" && worldRunState.pendingBattleHeal >= MAX_PENDING_BATTLE_HEAL) {
    return false;
  }

  if (itemKey === "damageBuff" && worldRunState.activeBuffs.damageBoostTurns >= MAX_WORLD_BUFF_TURNS) {
    return false;
  }

  if (itemKey === "defenseBuff" && worldRunState.activeBuffs.defenseBoostTurns >= MAX_WORLD_BUFF_TURNS) {
    return false;
  }

  if (itemKey === "regenBuff" && worldRunState.activeBuffs.regenBoostTurns >= MAX_WORLD_BUFF_TURNS) {
    return false;
  }

  return true;
}

function spendCoins(itemKey) {
  const item = SHOP_ITEMS[itemKey];
  if (!item) {
    return false;
  }

  if (worldRunState.petCurrency < item.cost) {
    setShopFeedback(`Not enough coins for ${item.label}.`);
    return false;
  }

  worldRunState.petCurrency -= item.cost;
  return true;
}

function applyAttributeTonic() {
  const keys = ["physical", "mental", "social", "intellectual", "spiritual"];
  const key = keys[randomInt(0, keys.length - 1)];
  const amount = randomInt(15, 24);
  wellnessState[key] = Math.min(100, wellnessState[key] + amount);
  return `Attribute Tonic restored ${amount} ${key}.`;
}

function applyHealPack() {
  const amount = randomInt(90, 130);
  const before = worldRunState.pendingBattleHeal;
  worldRunState.pendingBattleHeal = Math.min(MAX_PENDING_BATTLE_HEAL, worldRunState.pendingBattleHeal + amount);
  const gained = worldRunState.pendingBattleHeal - before;
  return gained > 0
    ? `Heal Pack stored +${gained} battle heal for your next damaged fight.`
    : "Heal Pack reserve is already capped.";
}

function purchaseShopItem(itemKey) {
  if (!canBuyItem(itemKey)) {
    if (itemKey === "healPack") {
      setShopFeedback("Heal Pack reserve is capped. Use some in battle first.");
    } else if (itemKey === "damageBuff") {
      setShopFeedback("Damage Buff turns are capped right now.");
    } else if (itemKey === "defenseBuff") {
      setShopFeedback("Defense Buff turns are capped right now.");
    } else if (itemKey === "regenBuff") {
      setShopFeedback("Regen Buff turns are capped right now.");
    } else {
      setShopFeedback("You cannot buy this item right now.");
    }

    renderAll();
    return;
  }

  if (!spendCoins(itemKey)) {
    renderAll();
    return;
  }

  let message = "Purchase complete.";

  if (itemKey === "healPack") {
    message = applyHealPack();
  } else if (itemKey === "attributeTonic") {
    message = applyAttributeTonic();
  } else if (itemKey === "damageBuff") {
    worldRunState.activeBuffs.damageBoostTurns = Math.min(
      MAX_WORLD_BUFF_TURNS,
      worldRunState.activeBuffs.damageBoostTurns + 2,
    );
    message = `Battle Damage Buff purchased: now ${worldRunState.activeBuffs.damageBoostTurns} turns queued.`;
  } else if (itemKey === "defenseBuff") {
    worldRunState.activeBuffs.defenseBoostTurns = Math.min(
      MAX_WORLD_BUFF_TURNS,
      worldRunState.activeBuffs.defenseBoostTurns + 2,
    );
    message = `Battle Defense Buff purchased: now ${worldRunState.activeBuffs.defenseBoostTurns} turns queued.`;
  } else if (itemKey === "regenBuff") {
    worldRunState.activeBuffs.regenBoostTurns = Math.min(
      MAX_WORLD_BUFF_TURNS,
      worldRunState.activeBuffs.regenBoostTurns + 2,
    );
    message = `Battle Regen Buff purchased: now ${worldRunState.activeBuffs.regenBoostTurns} turns queued.`;
  }

  saveWellnessState();
  saveWorldRunState();
  setShopFeedback(message);
  renderAll();
}

function renderShop() {
  const balance = document.getElementById("shopBalanceText");
  if (balance) {
    balance.textContent = `Pet Coins: ${worldRunState.petCurrency}`;
  }

  const buttonMap = {
    buyHealPackBtn: "healPack",
    buyAttributeTonicBtn: "attributeTonic",
    buyDamageBuffBtn: "damageBuff",
    buyDefenseBuffBtn: "defenseBuff",
    buyRegenBuffBtn: "regenBuff",
  };

  const buttonIds = Object.keys(buttonMap);
  for (let i = 0; i < buttonIds.length; i += 1) {
    const id = buttonIds[i];
    const key = buttonMap[id];
    const btn = document.getElementById(id);
    if (!btn) {
      continue;
    }
    btn.disabled = !canBuyItem(key);
  }
}

function randomInt(min, max) {
  const safeMin = Math.ceil(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function renderSelectedNode() {
  const title = document.getElementById("worldNodeTitle");
  const meta = document.getElementById("worldNodeMeta");
  const reward = document.getElementById("worldNodeReward");
  const challengeBtn = document.getElementById("challengeNodeBtn");

  const node = WORLD_NODES.find((item) => item.id === selectedNodeId);
  if (!node) {
    title.textContent = "Select a node";
    meta.textContent = "Choose an unlocked node to prepare your next gauntlet.";
    reward.textContent = "Reward Tier: -";
    challengeBtn.disabled = true;
    return;
  }

  title.textContent = node.name;
  meta.textContent = formatSelectionMeta(node);
  reward.textContent = `Reward Tier: ${node.rewardTier}`;
  challengeBtn.disabled = !isNodeUnlocked(node.id);
}

function renderNodes() {
  const container = document.getElementById("worldMapNodes");
  container.innerHTML = "";

  for (let i = 0; i < WORLD_NODES.length; i += 1) {
    const node = WORLD_NODES[i];
    const unlocked = isNodeUnlocked(node.id);
    const completed = worldRunState.completedNodeIds.includes(node.id);
    const selected = selectedNodeId === node.id;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "world-node";
    button.classList.toggle("world-node--locked", !unlocked);
    button.classList.toggle("world-node--complete", completed);
    button.classList.toggle("world-node--selected", selected);
    button.disabled = false;
    button.setAttribute("aria-disabled", String(!unlocked));
    button.dataset.nodeId = node.id;
    button.title = `${node.name}: ${node.difficulty} difficulty, ${node.fightsInRow} fights in a row, ${node.rewardTier} reward tier.`;

    const title = document.createElement("span");
    title.className = "world-node-title";
    title.textContent = `${i + 1}. ${node.name}`;

    const meta = document.createElement("span");
    meta.className = "world-node-meta";
    meta.textContent = `${node.difficulty} | ${node.fightsInRow} fights | ${node.rewardTier}`;

    const state = document.createElement("span");
    state.className = "world-node-state";
    state.textContent = completed ? "Completed" : unlocked ? "Unlocked" : "Locked";

    button.appendChild(title);
    button.appendChild(meta);
    button.appendChild(state);

    button.addEventListener("click", () => {
      if (!unlocked) {
        setShopFeedback(`Node locked: clear ${i}. ${WORLD_NODES[i - 1]?.name ?? "previous node"} first.`);
        return;
      }

      if (selectedNodeId === node.id) {
        handleChallengeSelectedNode();
        return;
      }

      selectedNodeId = node.id;
      worldRunState.currentNodeId = node.id;
      worldRunState.streakFightsRemaining = node.fightsInRow;
      setShopFeedback(`Selected ${node.name}. Click it again or use Challenge Selected Node.`);
      saveWorldRunState();
      renderAll();
    });

    container.appendChild(button);

    if (i < WORLD_NODES.length - 1) {
      const connector = document.createElement("span");
      connector.className = "world-node-connector";
      container.appendChild(connector);
    }
  }
}

function completeCurrentNodeDev() {
  const currentId = worldRunState.currentNodeId;
  if (!currentId) {
    return;
  }

  if (!worldRunState.completedNodeIds.includes(currentId)) {
    worldRunState.completedNodeIds.push(currentId);
  }

  syncNodeUnlocksFromCompletion();
  saveWorldRunState();
  renderAll();
}

function handleChallengeSelectedNode() {
  const selected = WORLD_NODES.find((node) => node.id === selectedNodeId);
  if (!selected || !isNodeUnlocked(selected.id)) {
    return;
  }

  worldRunState.currentNodeId = selected.id;
  worldRunState.streakFightsRemaining = selected.fightsInRow;
  worldRunState.gauntlet = {
    active: true,
    nodeId: selected.id,
    totalFights: selected.fightsInRow,
    completedFights: 0,
  };
  saveWorldRunState();
  window.location.href = "battle.html";
}

function bindEvents() {
  document.getElementById("challengeNodeBtn").addEventListener("click", handleChallengeSelectedNode);
  document.getElementById("completeNodeDevBtn").addEventListener("click", completeCurrentNodeDev);
  document.getElementById("buyHealPackBtn").addEventListener("click", () => purchaseShopItem("healPack"));
  document.getElementById("buyAttributeTonicBtn").addEventListener("click", () => purchaseShopItem("attributeTonic"));
  document.getElementById("buyDamageBuffBtn").addEventListener("click", () => purchaseShopItem("damageBuff"));
  document.getElementById("buyDefenseBuffBtn").addEventListener("click", () => purchaseShopItem("defenseBuff"));
  document.getElementById("buyRegenBuffBtn").addEventListener("click", () => purchaseShopItem("regenBuff"));
  document.getElementById("resetWorldMapDevBtn").addEventListener("click", () => {
    resetWorldRunState();
    loadWellnessState();
    setShopFeedback("World state reset.");
    renderAll();
  });
}

function renderAll() {
  renderSummary();
  renderNodes();
  renderSelectedNode();
  renderShop();
}

function init() {
  loadWellnessState();
  loadWorldRunState();
  syncNodeUnlocksFromCompletion();

  if (isNodeUnlocked(worldRunState.currentNodeId)) {
    selectedNodeId = worldRunState.currentNodeId;
  } else {
    selectedNodeId = WORLD_START_NODE_ID;
    worldRunState.currentNodeId = WORLD_START_NODE_ID;
  }

  const selected = WORLD_NODES.find((node) => node.id === selectedNodeId);
  if (selected) {
    worldRunState.streakFightsRemaining = selected.fightsInRow;
  }

  saveWorldRunState();
  bindEvents();
  setShopFeedback("Shop ready.");
  renderAll();
}

init();

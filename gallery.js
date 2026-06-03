import { loadLatestState } from "./database.js";

const DESIGN_CARDS_SELECTOR = ".character-design-card[data-level]";
const LOCAL_PROGRESS_KEY = "wellnessProgress";

function loadLocalProgressLevel() {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    if (!raw) return 1;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.level === "number" && parsed.level >= 1) {
      return Math.max(1, Math.floor(parsed.level));
    }
  } catch (error) {
    console.error("Unable to read local progress level:", error);
  }

  return 1;
}

async function initializeGalleryUnlocks() {
  let currentLevel = loadLocalProgressLevel();

  try {
    const savedState = await loadLatestState();
    if (savedState && typeof savedState.level === "number") {
      currentLevel = Math.max(currentLevel, Math.floor(savedState.level));
    }
  } catch (error) {
    console.error("Unable to load player level:", error);
  }

  const cards = document.querySelectorAll(DESIGN_CARDS_SELECTOR);

  cards.forEach((card) => {
    const requiredLevel = Number(card.dataset.level) || 1;
    if (currentLevel >= requiredLevel) {
      card.classList.remove("locked");
    } else {
      card.classList.add("locked");
    }
  });

  updatePreviewCard(currentLevel);
}

function updatePreviewCard(currentLevel) {
  const previewImage = document.getElementById("previewImage");
  const previewLabel = document.getElementById("previewLabel");
  const previewText = document.getElementById("previewText");

  const unlockOrder = [
    { level: 1, src: "Avatar/Default.png", label: "The Spud Bud" },
    { level: 5, src: "Avatar/Sprout.png", label: "The Spud Sprout" },
    { level: 10, src: "Avatar/Farmer.png", label: "The Spud Farmer" },
    { level: 15, src: "Avatar/Gym.png", label: "The Gym Spud" },
    { level: 20, src: "Avatar/Sleepwear.png", label: "The Sleepy Spud" },
    { level: 25, src: "Avatar/Old_Money.png", label: "The Loaded Spud" },
  ];

  const currentDesign = unlockOrder
    .filter((item) => currentLevel >= item.level)
    .pop() || unlockOrder[0];

  if (previewImage) {
    previewImage.src = currentDesign.src;
    previewImage.alt = `${currentDesign.label} preview`;
  }

  if (previewLabel) {
    previewLabel.textContent = currentDesign.label;
  }

  if (previewText) {
    previewText.textContent = `Unlocked at level ${currentDesign.level}.`;
  }
}

initializeGalleryUnlocks();

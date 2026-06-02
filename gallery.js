import { loadLatestState } from "./database.js";

const DESIGN_CARDS_SELECTOR = ".character-design-card[data-level]";

async function initializeGalleryUnlocks() {
  let currentLevel = 1;

  try {
    const savedState = await loadLatestState();
    if (savedState && typeof savedState.level === "number") {
      currentLevel = savedState.level;
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

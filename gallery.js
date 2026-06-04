import { loadLatestState } from "./database.js";
import {
  AVATAR_OPTIONS,
  SELECTED_AVATAR_KEY,
  getSelectedAvatarForLevel,
  getUnlockedAvatars,
} from "./avatar-selection.js";

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
  const unlockedDesigns = getUnlockedDesigns(currentLevel);
  const selectedDesign = getSelectedDesign(currentLevel);

  cards.forEach((card) => {
    const requiredLevel = Number(card.dataset.level) || 1;
    const matchingDesign = AVATAR_OPTIONS.find((item) => item.minLevel === requiredLevel);
    if (matchingDesign) {
      card.dataset.avatarSrc = matchingDesign.src;
    }

    if (currentLevel >= requiredLevel) {
      card.classList.remove("locked");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-pressed", String(card.dataset.avatarSrc === selectedDesign.src));
    } else {
      card.classList.add("locked");
      card.tabIndex = -1;
      card.removeAttribute("role");
      card.setAttribute("aria-pressed", "false");
    }

    card.classList.toggle(
      "character-design-card--selected",
      card.dataset.avatarSrc === selectedDesign.src,
    );
  });

  bindCardSelection(cards, unlockedDesigns, currentLevel);
  updatePreviewCard(currentLevel, selectedDesign);
}

function getUnlockedDesigns(currentLevel) {
  return getUnlockedAvatars(currentLevel).map((item) => ({
    level: item.minLevel,
    src: item.src,
    label: item.alt,
  }));
}

function getSelectedDesign(currentLevel) {
  const selectedAvatar = getSelectedAvatarForLevel(currentLevel);
  return {
    level: selectedAvatar.minLevel,
    src: selectedAvatar.src,
    label: selectedAvatar.alt,
  };
}

function selectDesign(card, design, currentLevel, cards) {
  localStorage.setItem(SELECTED_AVATAR_KEY, design.src);

  cards.forEach((currentCard) => {
    const isSelected = currentCard === card;
    currentCard.classList.toggle("character-design-card--selected", isSelected);
    currentCard.setAttribute("aria-pressed", String(isSelected));
  });

  updatePreviewCard(currentLevel, design);
}

function bindCardSelection(cards, unlockedDesigns, currentLevel) {
  cards.forEach((card) => {
    if (card.dataset.selectionBound === "true") {
      return;
    }

    const requiredLevel = Number(card.dataset.level) || 1;
    const design = unlockedDesigns.find((item) => item.level === requiredLevel);
    if (!design) {
      return;
    }

    const handleSelection = () => selectDesign(card, design, currentLevel, cards);

    card.addEventListener("click", handleSelection);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      handleSelection();
    });

    card.dataset.selectionBound = "true";
    card.dataset.avatarSrc = design.src;
  });
}

function updatePreviewCard(currentLevel, selectedDesign = getSelectedDesign(currentLevel)) {
  const previewImage = document.getElementById("previewImage");
  const previewLabel = document.getElementById("previewLabel");
  const previewText = document.getElementById("previewText");

  if (previewImage) {
    previewImage.src = selectedDesign.src;
    previewImage.alt = `${selectedDesign.label} preview`;
  }

  if (previewLabel) {
    previewLabel.textContent = selectedDesign.label;
  }

  if (previewText) {
    previewText.textContent = `Selected for Home and games. Unlocked at level ${selectedDesign.level}.`;
  }
}

initializeGalleryUnlocks();

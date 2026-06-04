export const WELLNESS_PROGRESS_KEY = "wellnessProgress";
export const SELECTED_AVATAR_KEY = "selectedAvatarSrc";

export const AVATAR_OPTIONS = [
  { minLevel: 1, src: "Avatar/Default.png", alt: "The Spud Bud" },
  { minLevel: 5, src: "Avatar/Sprout.png", alt: "The Spud Sprout" },
  { minLevel: 10, src: "Avatar/Farmer.png", alt: "The Spud Farmer" },
  { minLevel: 15, src: "Avatar/Gym.png", alt: "The Gym Spud" },
  { minLevel: 20, src: "Avatar/Sleepwear.png", alt: "The Sleepy Spud" },
  { minLevel: 25, src: "Avatar/Old_Money.png", alt: "The Loaded Spud" },
];

export function getUnlockedAvatars(level) {
  return AVATAR_OPTIONS.filter((item) => level >= item.minLevel);
}

export function getStoredPlayerLevel() {
  try {
    const raw = localStorage.getItem(WELLNESS_PROGRESS_KEY);
    if (!raw) return 1;

    const parsed = JSON.parse(raw);
    if (typeof parsed?.level === "number" && parsed.level >= 1) {
      return Math.max(1, Math.floor(parsed.level));
    }
  } catch {
    // Keep default level when progress data is invalid.
  }

  return 1;
}

export function getSelectedAvatarForLevel(level) {
  const unlockedAvatars = getUnlockedAvatars(level);
  const savedAvatarSrc = localStorage.getItem(SELECTED_AVATAR_KEY);

  return (
    unlockedAvatars.find((item) => item.src === savedAvatarSrc) ||
    unlockedAvatars[unlockedAvatars.length - 1] ||
    AVATAR_OPTIONS[0]
  );
}

export function getSelectedAvatarForCurrentProgress() {
  return getSelectedAvatarForLevel(getStoredPlayerLevel());
}
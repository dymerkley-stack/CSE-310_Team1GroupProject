import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
//makeing sure things save
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function getPlayerId() {
  let playerId = localStorage.getItem("player_id");

  if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem("player_id", playerId);
  }

  return playerId;
}

// SAVE GAME STATE
export async function saveGameState(state) {
  const playerId = getPlayerId();
  const user = await getCurrentUser();

  console.log("PLAYER ID:", playerId);
  console.log("STATE TO SAVE:", state);

  const saveData = {
    user_id: user?.id,

    physical: state.physical,
    mental: state.mental,
    social: state.social,
    intellectual: state.intellectual,
    spiritual: state.spiritual,
    level: state.level,
    exp: state.exp,
    checkins: state.checkins,
    gameOver: state.gameOver,
  };

  console.log("SAVE DATA:", saveData);

  const { data, error } = await supabase
    .from("pets")
    .upsert([saveData], {
      onConflict: "user_id",
    })
    .select();

  console.log("DATABASE RESPONSE:", data);
  console.log("DATABASE ERROR:", error);

  if (error) {
    console.error("Save failed:", error);
    return null;
  }

  return data;
}

// LOAD PLAYER STATE
export async function loadLatestState() {
  const user = await getCurrentUser();

  if (!user) return null;

  // Try modern save first
  let { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (data) return data;

  // Fallback to legacy save
  const playerId = getPlayerId();

  const legacy = await supabase
    .from("pets")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();

  if (legacy.data) {
    console.log("Legacy save found, migrating");

    // attach user id to existing record
    await supabase
      .from("pets")
      .update({
        user_id: user.id,
      })
      .eq("player_id", playerId);

    return legacy.data;
  }

  return null;
}

export async function saveToCloud(state) {
  console.log("SAVE CALLED", structuredClone(state));
  const user = await getCurrentUser();
  const playerId = getPlayerId();

  if (!user) return null;

  const saveData = {
    user_id: user.id,
    player_id: playerId,

    physical: state.physical,
    mental: state.mental,
    social: state.social,
    intellectual: state.intellectual,
    spiritual: state.spiritual,

    level: state.level,
    exp: state.exp,
    checkins: state.checkins,
  };

  console.log("Saving state:", {
    level: state.level,
    exp: state.exp,
    physical: state.physical,
    mental: state.mental,
  });

  return await supabase
    .from("pets")
    .upsert(saveData, { onConflict: "user_id" })
    .select();
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  console.log("SIGNUP DATA:", data);
  console.log("SIGNUP ERROR:", error);

  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  console.log("LOGIN DATA:", data);
  console.log("LOGIN ERROR:", error);

  return { data, error };
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function loadLegacyState() {
  const playerId = getPlayerId();

  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();

  if (error) {
    console.error("Legacy load failed:", error);
    return null;
  }

  return data;
}

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getPlayerId() {
  let playerId = localStorage.getItem("player_id");

  if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem("player_id", playerId);
  }

  return playerId;
}

// SAVE GAME STATE
export async function saveGameState(state) {
  const playerId = await getPlayerId();

  console.log("PLAYER ID:", playerId);
  console.log("STATE TO SAVE:", state);

  const saveData = {
    player_id: playerId,
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
      onConflict: "player_id",
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
  const playerId = getPlayerId();

  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();

  if (error) {
    console.error("Load failed:");
    console.error(error);
    return null;
  }

  return data;
}

export async function saveToCloud(state, playerId) {
  const saveData = {
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

  const { data, error } = await supabase
    .from("pets")
    .upsert(saveData, { onConflict: "player_id" })
    .select();

  if (error) {
    console.error("Cloud save failed:", error);
    return null;
  }

  console.log("Cloud save successful:", data);
  return data;
}

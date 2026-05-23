import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// SAVE GAME STATE
export async function saveGameState(state) {
  const { data, error } = await supabase.from("pets").insert([state]);

  if (error) {
    console.error("Save failed:", error);
    return null;
  }

  return data;
}

// LOAD LATEST GAME STATE
export async function loadLatestState() {
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Load failed:", error);
    return null;
  }

  return data[0];
}

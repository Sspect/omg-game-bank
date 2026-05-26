import { supabase } from "./supabase.js";

document.querySelector("#import-btn").addEventListener("click", async () => {
  const text = document.querySelector("#json-input").value;

  let game;

  try {
    game = JSON.parse(text);
  } catch (error) {
    alert("Invalid JSON");
    return;
  }

  const { data, error } = await supabase
    .from("Game")
    .insert(game)
    .select();

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  console.log(data);
  alert("Game imported!");
});
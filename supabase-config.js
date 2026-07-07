// Life On Other Planets? — Supabase connection config
//
// The project URL is already filled in. To turn ON cloud sync (shared progress,
// leaderboard, discoveries, and the project scoreboard), paste your project's
// PUBLIC anon key between the quotes below and save this file.
//
// Where to find it: Supabase dashboard -> your "life-on-other-planets" project
//   -> Project Settings -> API Keys -> "anon"/"publishable" key.
// This key is safe to expose in client-side code (that's what it's for).
//
// If anonKey is left blank, the game and Data Lab still work perfectly — they
// just save your progress locally in your browser instead of the cloud.

window.LOP_SUPABASE = {
  url: "https://fxzmzgkxvpqopswyrutc.supabase.co",
  anonKey: ""   // <-- paste your anon public key here
};

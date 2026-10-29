/* ==========================================================
   JUMINO — configuration
   Fill in your credentials. Empty optional keys cause the
   corresponding feature to show a clear "not configured"
   message rather than faking results.
   ========================================================== */

export const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY",
  authDomain:        "PASTE.firebaseapp.com",
  projectId:         "PASTE",
  storageBucket:     "PASTE.appspot.com",
  messagingSenderId: "PASTE",
  appId:             "PASTE",
};

export const OPENWEATHER_KEY = "";
export const ANTHROPIC_KEY   = "";
export const ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";

export const FEATURES = {
  ai:      () => Boolean(ANTHROPIC_KEY),
  weather: () => Boolean(OPENWEATHER_KEY),
};

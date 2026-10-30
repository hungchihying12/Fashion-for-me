import { OPENWEATHER_KEY } from "./config.js";

export async function fetchWeather(location) {
  if (!OPENWEATHER_KEY) return { error: "Weather service is not configured." };
  if (!location) return { error: "Location is required." };
  try {
    const r = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=metric&appid=${OPENWEATHER_KEY}`
    );
    if (!r.ok) return { error: "Weather not found for that location." };
    const d = await r.json();
    return {
      description: d.weather?.[0]?.description ?? "",
      tempC: d.main?.temp,
      wind: d.wind?.speed,
    };
  } catch {
    return { error: "Could not reach the weather service." };
  }
}

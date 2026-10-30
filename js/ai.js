import { ANTHROPIC_KEY, ANTHROPIC_MODEL } from "./config.js";

const HEADERS = {
  "x-api-key": ANTHROPIC_KEY,
  "anthropic-version": "2023-06-01",
  "content-type": "application/json",
  "dangerously-allow-browser": "true",
};

function parseFirstJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function callClaude({ system, userContent, maxTokens = 1024 }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) throw new Error(`AI responded ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  return parseFirstJSON(text);
}

const OUTFIT_SYSTEM = `You are Jumino, a gentle chibi donkey styling assistant.
Reply with VALID JSON ONLY, matching this exact shape:
{
  "summary":    string,
  "itemIds":    string[],
  "reason":     string,
  "alternatives": string[],
  "essentials": string[],
  "weather":    string|null,
  "note":       string|null
}
Rules:
- Only ever recommend items that appear in the wardrobe list (match by id).
- Never describe the user's body or face as a flaw.
- If the wardrobe is empty, return itemIds: [] and explain gently in summary.
- Essentials should be context-appropriate.`;

export async function requestOutfit({ occasion, prefs, weather, wardrobe, profile }) {
  if (!ANTHROPIC_KEY) return heuristicOutfit({ occasion, weather, wardrobe });
  const payload = {
    occasion, preferences: prefs, weather: weather || null,
    wardrobe: wardrobe.map(i => ({ id: i.id, name: i.name, category: i.category, subcategory: i.subcategory })),
    profile: profile || null,
  };
  let json;
  try {
    json = await callClaude({ system: OUTFIT_SYSTEM, userContent: JSON.stringify(payload) });
  } catch (e) {
    return { ...heuristicOutfit({ occasion, weather, wardrobe }), note: `AI call failed (${e.message}) — showing heuristic suggestion.` };
  }
  if (!json || !json.summary) {
    return { ...heuristicOutfit({ occasion, weather, wardrobe }), note: "AI reply could not be parsed — showing heuristic suggestion." };
  }
  const wardrobeIds = new Set(wardrobe.map(i => i.id));
  json.itemIds = (json.itemIds || []).filter(id => wardrobeIds.has(id));
  if (json.itemIds.length === 0 && wardrobe.length > 0) {
    json.note = (json.note ? json.note + " " : "") + "No saved wardrobe items were matched — try again or add more pieces.";
  }
  return json;
}

function heuristicOutfit({ occasion = "", weather, wardrobe }) {
  if (!wardrobe || wardrobe.length === 0) {
    return {
      summary: "Your wardrobe is empty — add some pieces and I can plan a look ♡",
      itemIds: [], reason: "", alternatives: [],
      essentials: defaultEssentials(occasion, weather),
      weather: weather || null,
      note: "Heuristic suggestion (AI not configured).",
    };
  }
  const pick = (cat) => wardrobe.find(i => i.category === cat);
  const top = pick("Tops");
  const bottom = pick("Long Pants") || pick("Short Pants") || pick("Skirts");
  const outer = pick("Jackets");
  const dress = pick("Dresses");
  let ids = [];
  let summary;
  if (dress) {
    ids = [dress.id, ...(outer ? [outer.id] : [])];
    summary = `A cosy ${dress.name || "dress"}${outer ? ` with your ${outer.name || "jacket"}` : ""} felt right for today.`;
  } else {
    ids = [top?.id, bottom?.id, outer?.id].filter(Boolean);
    summary = ids.length
      ? `A simple pick from your own wardrobe for ${occasion || "today"}.`
      : "Add some tops and bottoms to your wardrobe and I can help.";
  }
  return {
    summary, itemIds: ids,
    reason: "Heuristic pick based on category coverage from your saved items.",
    alternatives: [],
    essentials: defaultEssentials(occasion, weather),
    weather: weather || null,
    note: "Heuristic suggestion (AI not configured).",
  };
}

function defaultEssentials(occasion = "", weather = "") {
  const out = ["Phone", "Keys", "Wallet"];
  const w = (weather || "").toLowerCase();
  const o = (occasion || "").toLowerCase();
  if (w.includes("rain") || w.includes("drizzle")) out.push("Umbrella");
  if (w.includes("sun") || w.includes("clear")) out.push("Sunglasses", "Water bottle");
  if (w.includes("cold") || w.includes("snow")) out.push("Gloves", "Warm scarf");
  if (o.includes("work") || o.includes("office") || o.includes("interview")) out.push("Notebook", "Laptop charger");
  if (o.includes("outdoor") || o.includes("hike") || o.includes("walk")) out.push("Water bottle");
  return Array.from(new Set(out));
}

const COLOUR_SYSTEM = `You are Jumino, a gentle chibi donkey colour-styling assistant.
You are warm, specific, and honest about limits. You never judge appearance.
You never claim to physically measure undertones from a photo.
Reply with VALID JSON ONLY, matching this exact shape:
{
  "summary":       string,
  "harmony":       string[],
  "experiment":    string[],
  "neutralAdvice": string,
  "jewellery":     string,
  "confidence":    string,
  "nextSteps":     string,
  "note":          string|null
}
Rules:
- Use ONLY the colour names provided in the input; never invent new ones.
- Never claim to have measured skin undertones.
- Treat the drape responses as the primary evidence; a photo, if present,
  is context only — do not override the user's own felt responses.`;

export async function requestColourFeedback({ responses, drapeNotes, photoDataURL }) {
  if (!ANTHROPIC_KEY) return heuristicColourFeedback({ responses, drapeNotes });

  const payloadText = JSON.stringify({
    selfReported: responses,
    drapeResponses: drapeNotes.map(d => ({ colour: d.name, hex: d.hex, harmony: d.harmony, note: d.note || "" })),
    hasPhoto: Boolean(photoDataURL),
    instruction: photoDataURL
      ? "A still frame from the camera is attached. Use it only as context (lighting, warmth). Base your answer primarily on the drape responses."
      : "No photo was shared. Interpret the drape responses directly.",
  });

  const content = [];
  if (photoDataURL) {
    const [meta, b64] = photoDataURL.split(",");
    const mediaType = meta.match(/data:(.*?);/)?.[1] || "image/jpeg";
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: b64 } });
  }
  content.push({ type: "text", text: payloadText });

  let json;
  try {
    json = await callClaude({ system: COLOUR_SYSTEM, userContent: content, maxTokens: 900 });
  } catch (e) {
    return { ...heuristicColourFeedback({ responses, drapeNotes }), note: `AI call failed (${e.message}) — showing heuristic feedback.` };
  }
  if (!json || !json.summary) {
    return { ...heuristicColourFeedback({ responses, drapeNotes }), note: "AI reply could not be parsed — showing heuristic feedback." };
  }
  return json;
}

function heuristicColourFeedback({ responses, drapeNotes }) {
  const loved = drapeNotes.filter(d => d.harmony === "loved");
  const unsure = drapeNotes.filter(d => d.harmony === "not-sure");
  const lovedNames = loved.map(d => d.name);
  const unsureNames = unsure.map(d => d.name);
  const warmNames = ["cream","oat","peach","terracotta","chestnut"];
  const coolNames = ["powder blue","sky","denim","lavender","navy","berry"];
  const warmCount = loved.filter(d => warmNames.includes(d.name)).length;
  const coolCount = loved.filter(d => coolNames.includes(d.name)).length;
  const jewellery =
    warmCount > coolCount ? "gold" :
    coolCount > warmCount ? "silver" :
    "try both — trust what feels calmer";
  return {
    summary: lovedNames.length
      ? `You responded warmly to ${lovedNames.slice(0, 3).join(", ")}. ` +
        (warmCount > coolCount
          ? "That leans your palette towards warmer tones."
          : coolCount > warmCount
          ? "That leans your palette towards cooler tones."
          : "That mix of warm and cool makes sense — trust what you liked most.")
      : "Let's try a few more drapes together — the more you note, the clearer the pattern.",
    harmony: lovedNames.length ? lovedNames : ["cream", "soft sage", "dusty blue"],
    experiment: unsureNames.length ? unsureNames : ["berry", "lavender", "navy"],
    neutralAdvice: warmCount >= coolCount
      ? "Try warm neutrals: cream, oat, mushroom — they'll likely feel like home."
      : "Try cool neutrals: linen, stone, graphite — they'll likely feel like home.",
    jewellery,
    confidence: "This is a style sketch based on your own drape responses, not a physical undertone measurement.",
    nextSteps: "Wear your favourite drape colour for a whole day and notice how you feel by the evening — that's the real test.",
    note: "Heuristic feedback (AI not configured).",
  };
}

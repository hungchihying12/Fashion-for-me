const PALETTES = {
  "Light Spring":   { hexes: ["#f7d5c4","#f9e2b0","#bfe3d0","#a8c8e6","#f3c1c8","#e9d4a8"], jewellery: "gold" },
  "True Spring":    { hexes: ["#ffb87a","#f4c542","#8fc68a","#e57769","#79b8d1","#e5a85c"], jewellery: "gold" },
  "Soft Autumn":    { hexes: ["#a68c6a","#b8a577","#8a9a7c","#c1a68a","#9a8770","#cab68c"], jewellery: "gold (matte)" },
  "Deep Autumn":    { hexes: ["#5e3317","#7b3f22","#403b21","#3f5240","#a06a29","#6b4c2a"], jewellery: "gold" },
  "Light Summer":   { hexes: ["#d7e3f3","#c8dbd0","#f2d8dc","#e7e2f0","#d7cfee","#f0e6d2"], jewellery: "silver" },
  "Soft Summer":    { hexes: ["#aebac4","#c2b9c8","#c3cbb6","#dcd2c2","#b7c3d0","#d7cec0"], jewellery: "silver" },
  "Clear Winter":   { hexes: ["#0b1229","#d3164b","#0d6fb3","#1a8970","#8a2f6d","#101010"], jewellery: "silver" },
  "Deep Winter":    { hexes: ["#1f2a44","#3f2e5e","#7a2f3e","#12252a","#4b3d61","#3c4a63"], jewellery: "silver" },
};
const SEASON_MAP = {
  "warm-light-bright": "Light Spring",
  "warm-light-soft":   "Light Summer",
  "warm-deep-bright":  "True Spring",
  "warm-deep-soft":    "Soft Autumn",
  "cool-light-bright": "Clear Winter",
  "cool-light-soft":   "Light Summer",
  "cool-deep-bright":  "Deep Winter",
  "cool-deep-soft":    "Soft Summer",
};

export function classifyColour(answers) {
  const { temperature, value, chroma } = answers;
  const key = `${temperature}-${value}-${chroma}`;
  const season = SEASON_MAP[key] || "Soft Summer";
  const palette = PALETTES[season];
  return {
    season,
    palette: palette.hexes,
    jewellery: palette.jewellery,
    confidence: 0.55,
    notes:
      "Estimated from temperature, value and chroma signals. " +
      "An ordinary camera can't measure physical undertones — treat this as a starting point.",
  };
}

export const DRAPES = [
  { hex: "#f5e2c0", name: "cream",       family: "warm",    seasonHint: "Spring/Autumn", note: "warm & light" },
  { hex: "#d9c39a", name: "oat",         family: "warm",    seasonHint: "Autumn",        note: "warm muted" },
  { hex: "#e3a678", name: "peach",       family: "warm",    seasonHint: "Spring",        note: "warm bright" },
  { hex: "#c66b4a", name: "terracotta",  family: "warm",    seasonHint: "Autumn",        note: "warm deep" },
  { hex: "#8a4b2f", name: "chestnut",    family: "warm",    seasonHint: "Autumn",        note: "warm deep" },
  { hex: "#d7e3f3", name: "powder blue", family: "cool",    seasonHint: "Summer",        note: "cool light" },
  { hex: "#a3c0d8", name: "sky",         family: "cool",    seasonHint: "Summer",        note: "cool light" },
  { hex: "#7b93b3", name: "denim",       family: "cool",    seasonHint: "Summer/Winter", note: "cool medium" },
  { hex: "#a58fb8", name: "lavender",    family: "cool",    seasonHint: "Summer",        note: "cool soft" },
  { hex: "#1f2a44", name: "navy",        family: "cool",    seasonHint: "Winter",        note: "cool deep" },
  { hex: "#8a2f3e", name: "berry",       family: "cool",    seasonHint: "Winter",        note: "deep bright" },
  { hex: "#efe6d2", name: "linen",       family: "neutral", seasonHint: "any",           note: "neutral light" },
  { hex: "#b8b0a0", name: "stone",       family: "neutral", seasonHint: "Soft Autumn",   note: "neutral muted" },
  { hex: "#6a6a6a", name: "graphite",    family: "neutral", seasonHint: "Winter",        note: "neutral deep" },
  { hex: "#e04f5f", name: "poppy",       family: "bright",  seasonHint: "Winter/Spring", note: "bright clear" },
  { hex: "#0d6fb3", name: "azure",       family: "bright",  seasonHint: "Winter",        note: "bright clear" },
  { hex: "#1a8970", name: "emerald",     family: "bright",  seasonHint: "Winter/Spring", note: "bright clear" },
  { hex: "#8a9a7c", name: "sage",        family: "muted",   seasonHint: "Soft Autumn",   note: "soft muted" },
  { hex: "#c3a6a0", name: "dusty rose",  family: "muted",   seasonHint: "Soft Summer",   note: "soft muted" },
  { hex: "#a98f7c", name: "mushroom",    family: "muted",   seasonHint: "Soft Autumn",   note: "soft muted" },
  { hex: "#3f2e5e", name: "plum",        family: "deep",    seasonHint: "Deep Winter",   note: "deep cool" },
  { hex: "#403b21", name: "olive",       family: "deep",    seasonHint: "Deep Autumn",   note: "deep warm" },
];

export const DRAPE_ORDER = [
  "cream", "powder blue", "peach", "denim", "sage", "berry",
  "oat", "lavender", "terracotta", "sky", "olive", "navy",
  "linen", "dusty rose", "poppy", "chestnut", "plum", "azure",
  "stone", "mushroom", "emerald", "graphite",
];

export function drapeByName(name) {
  return DRAPES.find(d => d.name === name);
}

const BODY_ALIASES = {
  "Inverted Triangle": "Inverted Triangle",
  "Hourglass": "Hourglass",
  "Pear": "Pear",
  "Apple": "Apple",
  "Rectangle": "Rectangle",
  "Balanced": "Rectangle",
  "Unknown": "Unknown",
};

export function classifyBody(m) {
  const { bust, waist, hips, shoulders, height } = m;
  if (!bust || !waist || !hips) {
    return { shape: "Unknown", confidence: 0, notes: "Enter at least bust, waist and hips." };
  }
  const wb = waist / bust;
  const wh = waist / hips;
  const bh = bust / hips;
  const sh = shoulders ? shoulders / hips : null;
  let shape;
  if (sh && sh >= 1.05 && hips < bust + 5) shape = "Inverted Triangle";
  else if (Math.abs(bh - 1) <= 0.05 && wb < 0.8) shape = "Hourglass";
  else if (hips > bust + 5) shape = "Pear";
  else if (bust > hips + 5) shape = "Apple";
  else if (wb > 0.85 && wh > 0.8) shape = "Rectangle";
  else shape = "Balanced";
  return {
    shape: BODY_ALIASES[shape] || shape,
    confidence: 0.6,
    notes:
      "Proportions only — not a health measure. Every body is beautiful; " +
      "wear whatever makes you comfortable.",
  };
}

export const BODY_TIPS = {
  Hourglass: { tops: "wrap tops, fitted knits, belted shirts", bottoms: "high-waist trousers, pencil skirts, straight-leg jeans", dresses: "wrap dresses, bias-cut slips, belted shirt-dresses", jackets: "cropped blazers, belted trenches", necklines: "V-neck, scoop, sweetheart", accessories: "belt at the waist, structured bags", tips: "Emphasise the waist; avoid shapeless boxy cuts." },
  Pear: { tops: "structured shoulders, boat necklines, prints", bottoms: "bootcut, A-line, wide-leg trousers", dresses: "fit-and-flare, A-line", jackets: "cropped or structured-shoulder", necklines: "boat neck, off-shoulder, square", accessories: "statement earrings, scarf at neck", tips: "Balance by adding interest up top; skim the hips." },
  Apple: { tops: "V-neck tunics, empire seams, longline shirts", bottoms: "straight-leg or slightly flared", dresses: "empire, wrap, A-line", jackets: "longline, unstructured", necklines: "V-neck, deep scoop", accessories: "long necklaces, medium bags", tips: "Create vertical lines; skim the midsection." },
  Rectangle: { tops: "peplum, ruffled, cropped, belted", bottoms: "pleated, flared, paperbag-waist", dresses: "fit-and-flare, belted shirt-dresses", jackets: "cropped, belted", necklines: "boat neck, halter, ruffled", accessories: "belts, layered necklaces", tips: "Add shape with belts, peplums, or layering." },
  "Inverted Triangle": { tops: "V-necks, soft drape, raglan sleeves", bottoms: "wide-leg, pleated, printed, bootcut", dresses: "A-line, fit-and-flare", jackets: "cropped without shoulder emphasis", necklines: "V-neck, scoop", accessories: "statement lower-body interest, minimal at shoulders", tips: "Balance the shoulders with fuller bottoms." },
  Unknown: {},
};

export function classifyFace(m) {
  const { length, forehead, cheek, jaw } = m;
  if (!length || !forehead || !cheek || !jaw) {
    return { shape: "Unknown", confidence: 0, notes: "Enter all four measurements." };
  }
  const lw = length / cheek;
  const fw = forehead / cheek;
  const jw = jaw / cheek;
  let shape;
  if (lw <= 1.1 && Math.abs(fw - jw) < 0.1) shape = "Round";
  else if (lw >= 1.5) shape = "Oblong";
  else if (fw > jw + 0.1 && lw <= 1.4) shape = "Heart";
  else if (jw > fw + 0.05) shape = "Triangle";
  else if (Math.abs(fw - jw) < 0.1 && cheek > forehead) shape = "Diamond";
  else if (lw > 1.3 && Math.abs(fw - jw) < 0.1) shape = "Oval";
  else shape = "Oval";
  return { shape, confidence: 0.55, notes: "Proportional estimate — every face shape is beautiful." };
}

export const FACE_TIPS = {
  Oval:     { hair: "most lengths; keep some volume", earrings: "medium dangles", necklines: "most necklines", glasses: "most frames" },
  Round:    { hair: "long layers, side part, height on top", earrings: "long drop earrings", necklines: "V-neck, open collar", glasses: "angular frames" },
  Heart:    { hair: "chin-length bobs, side-swept", earrings: "teardrop, chandelier", necklines: "wide scoop", glasses: "rimless, oval" },
  Triangle: { hair: "volume at crown, layered", earrings: "studs, small hoops", necklines: "boat neck, wide scoop", glasses: "browline, wider frames" },
  Diamond:  { hair: "soft waves, chin-length", earrings: "small studs", necklines: "V-neck, sweetheart", glasses: "oval, cat-eye" },
  Oblong:   { hair: "chin-length bob, waves, fringe", earrings: "small round studs", necklines: "crew, turtleneck", glasses: "oversized, square" },
  Unknown: {},
};

import { auth, storage, userDoc, userSub } from "./firebase.js";
import { bindAuthScreen } from "./auth.js";
import {
  toast, showLoading, openModal, closeModal, confirmDialog,
  escapeHTML, shrinkImage, dataURLtoBlob, debounce,
} from "./ui.js";
import { mountDonkey, donkeySVG } from "./donkey.js";
import { register, navigate } from "./router.js";
import {
  classifyColour, classifyBody, classifyFace,
  BODY_TIPS, FACE_TIPS,
} from "./rules.js";
import { requestOutfit, requestColourFeedback } from "./ai.js";
import { fetchWeather } from "./weather.js";
import { FEATURES } from "./config.js";

bindAuthScreen(user => {
  if (user) {
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-screen").classList.remove("hidden");
    hydrateNav(user);
    registerAllViews(user);
    wiredNavigate("home");
  } else {
    document.getElementById("auth-screen").classList.remove("hidden");
    document.getElementById("app-screen").classList.add("hidden");
    mountDonkey(document.getElementById("donkey-auth"), "idle", 110);
  }
});

document.getElementById("btn-back").onclick = () => wiredNavigate("home");
document.querySelectorAll("[data-nav]").forEach(b => {
  b.onclick = () => wiredNavigate(b.dataset.nav);
});
document.getElementById("modal-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "modal-backdrop") closeModal();
});

async function hydrateNav(user) {
  const navProfile = document.getElementById("nav-profile");
  try {
    const snap = await userDoc(user.uid).get();
    const data = snap.data() || {};
    if (data.avatarUrl) navProfile.innerHTML = `<img src="${data.avatarUrl}" alt="profile" />`;
    else navProfile.textContent = (data.username || user.email || "P").charAt(0).toUpperCase();
  } catch {
    navProfile.textContent = "P";
  }
}

async function getUserDoc(uid) {
  const snap = await userDoc(uid).get();
  return snap.exists ? snap.data() : {};
}
async function saveUserDoc(uid, patch) {
  await userDoc(uid).set(patch, { merge: true });
}
async function listSub(uid, col) {
  const snap = await userSub(uid, col).orderBy("createdAt", "desc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function addSub(uid, col, data) {
  const ref = userSub(uid, col).doc();
  await ref.set({ createdAt: Date.now(), ...data });
  return { id: ref.id, ...data };
}
async function deleteSub(uid, col, id) {
  await userSub(uid, col).doc(id).delete();
}
async function updateSub(uid, col, id, patch) {
  await userSub(uid, col).doc(id).update(patch);
}
async function uploadImage(uid, folder, dataURL) {
  const blob = dataURLtoBlob(dataURL);
  const ref = storage.ref(`${folder}/${uid}/${Date.now()}.jpg`);
  await ref.put(blob);
  return ref.getDownloadURL();
}

/* HOME */
async function homeView({ user }) {
  const doc = await getUserDoc(user.uid);
  const checklist = await listSub(user.uid, "checklist").catch(() => []);
  const pending = checklist.filter(i => !i.done);
  const done = checklist.filter(i => i.done);

  return `
  <div class="home">
    <div class="hero">
      <div id="hero-donkey"></div>
      <div id="hero-bubble" class="bubble">Hi ${escapeHTML(doc.username || "friend")}! Ready for a styling adventure?</div>
    </div>
    <div class="nav-grid">
      <button class="btn-mint" data-go="color"><span class="icon">(๑•̀ㅂ•́)و✧</span>Colour Analysis</button>
      <button class="btn-mint" data-go="body"><span class="icon">(◕ᴗ◕✿)</span>Body Analysis</button>
      <button class="btn-mint" data-go="face"><span class="icon">(◍•ᴗ•◍)</span>Face Analysis</button>
      <button class="btn-mint" data-go="wardrobe"><span class="icon">(๑˃ᴗ˂)ﻭ</span>Wardrobe</button>
      <button class="btn-mint" data-go="profile"><span class="icon">(•‿•)</span>Profile</button>
    </div>
    <section class="paper checklist">
      <h2 class="hand">To Bring (✎)</h2>
      <div class="add-row">
        <input id="cl-input" placeholder="Add your own item…" maxlength="60" />
        <button class="btn-mint" id="cl-add">Add</button>
      </div>
      <ul id="cl-list">${renderChecklistItems(pending, done)}</ul>
    </section>
  </div>
  `;
}

function renderChecklistItems(pending, done) {
  if (pending.length === 0 && done.length === 0) {
    return `<li class="empty">Nothing yet — add something for tomorrow ♡</li>`;
  }
  const item = (i) => `
    <li class="${i.done ? "done" : ""}" data-id="${i.id}">
      <button class="chk" data-toggle="${i.id}" aria-label="toggle">${i.done ? "✓" : ""}</button>
      <span>${escapeHTML(i.label)}</span>
      ${i.source === "ai" ? `<span class="tag">AI</span>` : ""}
      <button class="remove" data-remove="${i.id}">remove</button>
    </li>`;
  return [...pending.map(item), ...done.map(item)].join("");
}

function mountHome(user, { navigate: nav }) {
  mountDonkey(document.getElementById("hero-donkey"), "cheer", 150);
  document.querySelectorAll("[data-go]").forEach(b => {
    b.onclick = () => nav(b.dataset.go, { name: b.dataset.go });
  });

  document.getElementById("cl-add").onclick = addChecklist;
  document.getElementById("cl-input").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addChecklist(); }
  });

  async function refreshList() {
    const items = await listSub(user.uid, "checklist").catch(() => []);
    const pending = items.filter(i => !i.done);
    const done = items.filter(i => i.done);
    document.getElementById("cl-list").innerHTML = renderChecklistItems(pending, done);
    wireItemButtons();
  }
  async function addChecklist() {
    const input = document.getElementById("cl-input");
    const label = input.value.trim();
    if (!label) return;
    const existing = await listSub(user.uid, "checklist").catch(() => []);
    if (existing.some(i => i.label.toLowerCase() === label.toLowerCase())) {
      toast("That's already on the list ♡");
      return;
    }
    await addSub(user.uid, "checklist", { label, done: false, source: "user" });
    input.value = "";
    await refreshList();
  }
  function wireItemButtons() {
    document.querySelectorAll("[data-toggle]").forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.toggle;
        const item = (await listSub(user.uid, "checklist")).find(i => i.id === id);
        if (!item) return;
        await updateSub(user.uid, "checklist", id, { done: !item.done });
        await refreshList();
      };
    });
    document.querySelectorAll("[data-remove]").forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.remove;
        const ok = await confirmDialog("Remove this item?", { okLabel: "Remove", danger: true });
        if (!ok) return;
        await deleteSub(user.uid, "checklist", id);
        await refreshList();
      };
    });
  }
  wireItemButtons();
}

/* COLOUR ANALYSIS */
async function colourView({ user }) {
  const doc = await getUserDoc(user.uid);
  const saved = doc.colorResult || null;
  const savedFeedback = doc.colorFeedback || null;
  return `
  <div class="page">
    <h1 class="hand">Colour Analysis (๑•̀ㅂ•́)و✧</h1>
    <p class="sub">Drape colours, note how each feels, then let Jumino offer gentle feedback. Everything is an estimate — an in-person analysis is the gold standard.</p>

    <section class="paper">
      <h3 class="hand">1. Your starting point</h3>
      <p class="sub" style="font-size:.85rem">These help Jumino calibrate.</p>
      <div class="field">
        <label>Warm or cool leaning?</label>
        <select id="c-temp">
          <option value="warm">Warm — golds, peach, cream</option>
          <option value="cool">Cool — silvers, pinks, blue</option>
          <option value="unsure">Not sure yet</option>
        </select>
      </div>
      <div class="field">
        <label>Light or deep overall?</label>
        <select id="c-val">
          <option value="light">Light — softer tones</option>
          <option value="deep">Deep — richer tones</option>
          <option value="unsure">Not sure yet</option>
        </select>
      </div>
      <div class="field">
        <label>Bright or muted?</label>
        <select id="c-chroma">
          <option value="bright">Bright — clear, saturated</option>
          <option value="soft">Muted — gentle, dusty</option>
          <option value="unsure">Not sure yet</option>
        </select>
      </div>
    </section>

    <section class="paper">
      <h3 class="hand">2. Fabric drapes</h3>
      <p class="sub" style="font-size:.85rem">Turn on the camera or just look at the colour swatch. Note how each colour feels, then move on.</p>
      <div id="drape-session"></div>
    </section>

    <section class="paper">
      <h3 class="hand">3. Ask Jumino ♡</h3>
      <p class="sub" style="font-size:.85rem">Jumino can look at your drape notes and offer warm feedback. Optionally share a still frame — it isn't saved.</p>
      <label style="display:flex;gap:.4rem;align-items:center;font-size:.85rem;margin-bottom:.6rem">
        <input type="checkbox" id="cf-share-photo" />
        Share a still photo of my face (opt-in, not saved)
      </label>
      <button class="btn-mint full" id="cf-run">ask Jumino for feedback ♡</button>
      <div id="cf-result" style="margin-top:.8rem">${savedFeedback ? renderColourFeedback(savedFeedback) : ""}</div>
    </section>

    <section class="paper" id="c-result">
      <h3 class="hand">Saved palette</h3>
      ${saved ? renderColourResult(saved) : `<p class="sub">Nothing saved yet — after Jumino offers feedback, your palette will appear here.</p>`}
    </section>
  </div>
  `;
}

function renderColourResult(r) {
  return `
    <p style="margin:.3rem 0"><strong>${escapeHTML(r.season)}</strong> · confidence ${((r.confidence || 0.5) * 100).toFixed(0)}%</p>
    <div class="palette-strip">${(r.palette || []).map(h => `<div class="sw" style="background:${h}" title="${h}"></div>`).join("")}</div>
    <div class="jewellery-row">
      <span class="dot" style="background:${(r.jewellery || "").includes("gold") ? "#d8a844" : "#b8bcc4"}"></span>
      <span>Suggested jewellery: <strong>${escapeHTML(r.jewellery || "try both")}</strong></span>
    </div>
    <p style="font-size:.85rem;opacity:.8">${escapeHTML(r.notes || "")}</p>
  `;
}

function renderColourFeedback(fb) {
  return `
    <div class="result-section">
      <h4 class="hand" style="font-size:1.2rem">Jumino's note ♡</h4>
      <p>${escapeHTML(fb.summary || "")}</p>
    </div>
    ${fb.harmony?.length ? `<div class="result-section"><h4>Felt harmonious</h4><p>${fb.harmony.map(escapeHTML).join(" · ")}</p></div>` : ""}
    ${fb.experiment?.length ? `<div class="result-section"><h4>Worth experimenting with</h4><p>${fb.experiment.map(escapeHTML).join(" · ")}</p></div>` : ""}
    ${fb.neutralAdvice ? `<div class="result-section"><h4>Neutrals</h4><p>${escapeHTML(fb.neutralAdvice)}</p></div>` : ""}
    ${fb.jewellery ? `<div class="result-section"><h4>Jewellery</h4><p>${escapeHTML(fb.jewellery)}</p></div>` : ""}
    ${fb.confidence ? `<div class="result-section"><h4>Confidence</h4><p>${escapeHTML(fb.confidence)}</p></div>` : ""}
    ${fb.nextSteps ? `<div class="result-section"><h4>Try next</h4><p>${escapeHTML(fb.nextSteps)}</p></div>` : ""}
    ${fb.note ? `<p style="font-size:.78rem;opacity:.6;margin-top:.4rem">${escapeHTML(fb.note)}</p>` : ""}
  `;
}

function mountColour(user, { setCleanup }) {
  const sessionHost = document.getElementById("drape-session");
  let session = null;
  (async () => {
    const { mountDrapeSession } = await import("./drapes.js");
    session = await mountDrapeSession(sessionHost);
    setCleanup(() => session?.destroy());
  })();

  document.getElementById("cf-run").onclick = async () => {
    if (!session) { toast("Give the drapes a moment to load ♡"); return; }
    const responses = session.getResponses();
    if (responses.length < 2) { toast("Note at least two drapes first."); return; }

    const sharePhoto = document.getElementById("cf-share-photo").checked;
    const photo = sharePhoto ? session.capturePhoto() : null;
    if (sharePhoto && !photo) toast("No camera frame — continuing with notes only.");

    const selfReport = {
      temperature: document.getElementById("c-temp").value,
      value: document.getElementById("c-val").value,
      chroma: document.getElementById("c-chroma").value,
    };

    showLoading(true);
    try {
      const feedback = await requestColourFeedback({
        responses: selfReport, drapeNotes: responses, photoDataURL: photo,
      });
      const lovedHexes = responses.filter(r => r.harmony === "loved").map(r => r.hex).slice(0, 6);
      const guessed = classifyColour({
        temperature: selfReport.temperature === "unsure" ? "cool" : selfReport.temperature,
        value: selfReport.value === "unsure" ? "light" : selfReport.value,
        chroma: selfReport.chroma === "unsure" ? "soft" : selfReport.chroma,
      });
      const fallbackPalette = ["#efe6d2", "#bfe3d0", "#a3c0d8", "#d9c39a", "#c3a6a0", "#1f2a44"];
      const colourResult = {
        ...guessed,
        palette: lovedHexes.length >= 3 ? lovedHexes : (guessed.palette || fallbackPalette),
        notes: feedback.summary || guessed.notes,
      };
      await saveUserDoc(user.uid, { colorResult: colourResult, colorFeedback: feedback });
      document.getElementById("cf-result").innerHTML = renderColourFeedback(feedback);
      document.getElementById("c-result").innerHTML = `<h3 class="hand">Saved palette</h3>${renderColourResult(colourResult)}`;
      toast("Palette & feedback saved ♡");
    } catch {
      toast("Something went wrong — try again in a moment.");
    } finally { showLoading(false); }
  };
}

/* BODY ANALYSIS */
async function bodyView({ user }) {
  const doc = await getUserDoc(user.uid);
  const saved = doc.bodyResult || null;
  return `
  <div class="page">
    <h1 class="hand">Body Analysis (◕ᴗ◕✿)</h1>
    <p class="sub">Proportion-based styling hints. Not a health measure.</p>
    <div class="apple">
      <h2>measurements ♡</h2>
      <p class="hint">Centimetres. Every field is optional.</p>
      <div class="grid2">
        <div class="field"><label>Bust</label><input id="b-bust" type="number" inputmode="decimal" placeholder="e.g. 88" /></div>
        <div class="field"><label>Waist</label><input id="b-waist" type="number" inputmode="decimal" placeholder="e.g. 70" /></div>
        <div class="field"><label>Hips</label><input id="b-hips" type="number" inputmode="decimal" placeholder="e.g. 96" /></div>
        <div class="field"><label>Shoulders (optional)</label><input id="b-shoulders" type="number" inputmode="decimal" placeholder="e.g. 40" /></div>
        <div class="field"><label>Height (optional)</label><input id="b-height" type="number" inputmode="decimal" placeholder="e.g. 165" /></div>
      </div>
      <button class="btn-mint full" id="b-run" style="margin-top:1rem">send in an envelope (✉)</button>
    </div>
    <div id="b-envelope" class="hidden"></div>
    ${saved ? `
    <section class="paper" style="margin-top:1rem">
      <h3 class="hand">Saved result</h3>
      ${renderBodyCard(saved.shape, saved.notes)}
    </section>` : ""}
  </div>
  `;
}

function renderBodyCard(shape, notes) {
  const tips = BODY_TIPS[shape] || {};
  return `
    <div class="result-section">
      <h4>Estimated shape: <strong>${escapeHTML(shape)}</strong></h4>
      <p>${escapeHTML(notes || "")}</p>
    </div>
    <div class="tab-row">
      ${["tops","bottoms","dresses","jackets","necklines","accessories","tips"].map(t => `<button class="btn-mint" data-btab="${t}">${t}</button>`).join("")}
    </div>
    <div id="b-tab-content" class="result-section"><p>Choose a tab above for styling ideas.</p></div>
    <input type="hidden" id="b-tips-data" value="${escapeHTML(JSON.stringify(tips))}" />
  `;
}

function mountBody(user) {
  wireBodyTabs();
  function wireBodyTabs() {
    document.querySelectorAll("[data-btab]").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll("[data-btab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const data = JSON.parse(document.getElementById("b-tips-data")?.value || "{}");
        const text = data[btn.dataset.btab] || "No suggestion for this category.";
        document.getElementById("b-tab-content").innerHTML = `<p>${escapeHTML(text)}</p>`;
      };
    });
  }
  document.getElementById("b-run").onclick = async () => {
    const m = {
      bust: +document.getElementById("b-bust").value || null,
      waist: +document.getElementById("b-waist").value || null,
      hips: +document.getElementById("b-hips").value || null,
      shoulders: +document.getElementById("b-shoulders").value || null,
      height: +document.getElementById("b-height").value || null,
    };
    if (!m.bust || !m.waist || !m.hips) { toast("Enter bust, waist and hips at least."); return; }
    showLoading(true);
    const result = classifyBody(m);
    await saveUserDoc(user.uid, { bodyResult: { ...result, measures: m } });
    showLoading(false);
    renderEnvelopeResult({
      containerId: "b-envelope",
      title: "Your styling envelope ♡",
      body: renderBodyCard(result.shape, result.notes),
      afterOpen: wireBodyTabs,
    });
  };
}

/* FACE ANALYSIS */
async function faceView({ user }) {
  const doc = await getUserDoc(user.uid);
  const saved = doc.faceResult || null;
  return `
  <div class="page">
    <h1 class="hand">Face Analysis (◍•ᴗ•◍)</h1>
    <p class="sub">Proportion-based hints. Every face shape is lovely.</p>
    <div class="apple">
      <h2>measurements ♡</h2>
      <p class="hint">Centimetres. All optional.</p>
      <div class="grid2">
        <div class="field"><label>Face length</label><input id="f-length" type="number" inputmode="decimal" placeholder="e.g. 20" /></div>
        <div class="field"><label>Forehead width</label><input id="f-fore" type="number" inputmode="decimal" placeholder="e.g. 12" /></div>
        <div class="field"><label>Cheekbone width</label><input id="f-cheek" type="number" inputmode="decimal" placeholder="e.g. 14" /></div>
        <div class="field"><label>Jawline width</label><input id="f-jaw" type="number" inputmode="decimal" placeholder="e.g. 11" /></div>
      </div>
      <button class="btn-mint full" id="f-run" style="margin-top:1rem">send in an envelope (✉)</button>
    </div>
    <div id="f-envelope" class="hidden"></div>
    ${saved ? `
    <section class="paper" style="margin-top:1rem">
      <h3 class="hand">Saved result</h3>
      ${renderFaceCard(saved.shape, saved.notes)}
    </section>` : ""}
  </div>
  `;
}

function renderFaceCard(shape, notes) {
  const tips = FACE_TIPS[shape] || {};
  return `
    <div class="result-section">
      <h4>Estimated shape: <strong>${escapeHTML(shape)}</strong></h4>
      <p>${escapeHTML(notes || "")}</p>
    </div>
    <div class="tab-row">
      ${["hair","earrings","necklines","glasses"].map(t => `<button class="btn-mint" data-ftab="${t}">${t}</button>`).join("")}
    </div>
    <div id="f-tab-content" class="result-section"><p>Choose a tab above for ideas.</p></div>
    <input type="hidden" id="f-tips-data" value="${escapeHTML(JSON.stringify(tips))}" />
  `;
}

function mountFace(user) {
  wireFaceTabs();
  function wireFaceTabs() {
    document.querySelectorAll("[data-ftab]").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll("[data-ftab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const data = JSON.parse(document.getElementById("f-tips-data")?.value || "{}");
        const text = data[btn.dataset.ftab] || "No suggestion for this category.";
        document.getElementById("f-tab-content").innerHTML = `<p>${escapeHTML(text)}</p>`;
      };
    });
  }
  document.getElementById("f-run").onclick = async () => {
    const m = {
      length: +document.getElementById("f-length").value || null,
      forehead: +document.getElementById("f-fore").value || null,
      cheek: +document.getElementById("f-cheek").value || null,
      jaw: +document.getElementById("f-jaw").value || null,
    };
    if (!m.length || !m.forehead || !m.cheek || !m.jaw) { toast("Please enter all four values."); return; }
    showLoading(true);
    const result = classifyFace(m);
    await saveUserDoc(user.uid, { faceResult: { ...result, measures: m } });
    showLoading(false);
    renderEnvelopeResult({
      containerId: "f-envelope",
      title: "Your styling envelope ♡",
      body: renderFaceCard(result.shape, result.notes),
      afterOpen: wireFaceTabs,
    });
  };
}

function renderEnvelopeResult({ containerId, title, body, afterOpen }) {
  const c = document.getElementById(containerId);
  c.classList.remove("hidden");
  c.innerHTML = `
    <div class="envelope">
      <button class="btn-mint open-btn" id="env-open">Open (✉)</button>
      <div id="env-card" class="hidden">
        <div class="card">
          <h3 class="hand">${escapeHTML(title)}</h3>
          ${body}
        </div>
      </div>
    </div>
  `;
  document.getElementById("env-open").onclick = () => {
    document.getElementById("env-open").classList.add("hidden");
    document.getElementById("env-card").classList.remove("hidden");
    afterOpen && afterOpen();
  };
  c.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* WARDROBE */
const WARDROBE_CATEGORIES = [
  { key: "Accessories", icon: "(◕‿◕)" },
  { key: "Skirts",      icon: "(・ω・)" },
  { key: "Long Pants",  icon: "(・ε・)" },
  { key: "Short Pants", icon: "(◔_◔)" },
  { key: "Jackets",     icon: "(・∀・)" },
  { key: "Tops",        icon: "(・_・)" },
  { key: "Dresses",     icon: "(๑˃ᴗ˂)ﻭ" },
];
const SUBCATS = {
  "Accessories": ["Bags", "Jewellery", "Belts", "Hats", "Scarves", "Other"],
  "Skirts":      ["Mini", "Midi", "Maxi", "Other"],
  "Long Pants":  ["Jeans", "Trousers", "Other"],
  "Short Pants": ["Shorts", "Other"],
  "Jackets":     ["Blazer", "Coat", "Cardigan", "Other"],
  "Tops":        ["T-shirt", "Blouse", "Shirt", "Knitwear", "Other"],
  "Dresses":     ["Casual", "Formal", "Other"],
};
const WARDROBE_COLOURS = ["#d9b896", "#c7a07a", "#a8d9c1", "#bfd9e3", "#e3c8d9", "#d9d0c0"];

async function wardrobeView({ user, navigate: nav }) {
  const doc = await getUserDoc(user.uid);
  const chosen = doc.wardrobeColour || WARDROBE_COLOURS[0];
  const items = await listSub(user.uid, "clothing").catch(() => []);
  return `
  <div class="page">
    <h1 class="hand">Wardrobe (๑˃ᴗ˂)ﻭ</h1>
    <p class="sub">Pick a colour for your wardrobe, then open it.</p>
    <div class="wardrobe-shell" id="wr-shell" style="background:${chosen}">
      <div class="handle l"></div>
      <div class="handle r"></div>
      <div class="color-row">
        ${WARDROBE_COLOURS.map(c => `<button class="swatch ${c === chosen ? "sel" : ""}" data-colour="${c}" style="background:${c}"></button>`).join("")}
      </div>
      <div class="cat-grid">
        ${WARDROBE_CATEGORIES.map(c => `<button class="btn-mint cat-tile" data-cat="${c.key}"><span class="icon">${c.icon}</span>${c.key}</button>`).join("")}
      </div>
      <button class="btn-mint full outfits-cta" data-go="outfits">(｡•̀ᴗ-)✧ Open Outfits (｡•̀ᴗ-)✧</button>
    </div>
    <section class="paper">
      <h3 class="hand">Recently added</h3>
      ${items.length === 0 ? `
        <div class="empty-state"><div class="icon">(・_・;)</div><p>No clothes saved yet. Open a category and photograph something ♡</p></div>
      ` : `
        <div class="wardrobe-grid">
          ${items.slice(0, 8).map(i => `
            <div class="wardrobe-item">
              <img src="${i.imageUrl}" alt="${escapeHTML(i.name || i.category)}" />
              <div class="meta">
                <strong>${escapeHTML(i.name || "(unnamed)")}</strong>
                <div class="sub">${escapeHTML(i.category)}${i.subcategory ? " · " + escapeHTML(i.subcategory) : ""}</div>
              </div>
            </div>
          `).join("")}
        </div>
      `}
    </section>
  </div>
  `;
}

function mountWardrobe(user, { navigate: nav }) {
  document.querySelectorAll("[data-colour]").forEach(b => {
    b.onclick = async () => {
      await saveUserDoc(user.uid, { wardrobeColour: b.dataset.colour });
      document.getElementById("wr-shell").style.background = b.dataset.colour;
      document.querySelectorAll("[data-colour]").forEach(s => s.classList.remove("sel"));
      b.classList.add("sel");
    };
  });
  document.querySelectorAll("[data-cat]").forEach(b => {
    b.onclick = () => nav("wardrobeCategory", { name: "wardrobeCategory", category: b.dataset.cat });
  });
  document.querySelectorAll("[data-go]").forEach(b => {
    b.onclick = () => nav(b.dataset.go, { name: b.dataset.go });
  });
}

async function wardrobeCategoryView({ user, category }) {
  const items = (await listSub(user.uid, "clothing").catch(() => [])).filter(i => i.category === category);
  const subs = SUBCATS[category] || [];
  return `
  <div class="page">
    <h1 class="hand">${escapeHTML(category)}</h1>
    <p class="sub">Save a photo and a name. You can edit or delete later.</p>
    <section class="paper">
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <label class="upload-btn" style="flex:1;min-width:140px">
          <input type="file" id="wc-camera" accept="image/*" capture="environment" />
          <span>(⌐■_■) photograph</span>
        </label>
        <label class="upload-btn" style="flex:1;min-width:140px">
          <input type="file" id="wc-upload" accept="image/*" />
          <span>(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ upload</span>
        </label>
      </div>
      <div id="wc-preview" style="margin-top:.8rem;text-align:center"></div>
    </section>
    <section class="paper">
      <div class="filters">
        <input id="wc-search" placeholder="search by name…" />
        <select id="wc-sub">
          <option value="">all subcategories</option>
          ${subs.map(s => `<option value="${s}">${s}</option>`).join("")}
        </select>
      </div>
      <div id="wc-grid" class="wardrobe-grid">${renderWardrobeGrid(items)}</div>
    </section>
  </div>
  `;
}

function renderWardrobeGrid(items) {
  if (items.length === 0) {
    return `<div class="empty-state" style="grid-column:1/-1"><div class="icon">(・_・;)</div><p>Nothing here yet. Use the camera or upload a photo above ♡</p></div>`;
  }
  return items.map(i => `
    <div class="wardrobe-item" data-id="${i.id}">
      <img src="${i.imageUrl}" alt="${escapeHTML(i.name || i.category)}" />
      <button class="icon-btn edit" data-edit="${i.id}">(✎)</button>
      <button class="icon-btn del" data-del="${i.id}">(×)</button>
      <div class="meta">
        <strong>${escapeHTML(i.name || "(unnamed)")}</strong>
        <div class="sub">${escapeHTML(i.subcategory || "")}</div>
      </div>
    </div>
  `).join("");
}

function mountWardrobeCategory(user, { category }) {
  let pendingImage = null;
  const preview = document.getElementById("wc-preview");
  const grid = document.getElementById("wc-grid");
  const search = document.getElementById("wc-search");
  const subSelect = document.getElementById("wc-sub");

  async function handleFile(file) {
    if (!file) return;
    const shrunk = await shrinkImage(file, 900);
    pendingImage = shrunk;
    preview.innerHTML = `<img src="${shrunk}" style="max-width:180px;border-radius:12px;border:2px solid var(--brown)" />
      <div style="margin-top:.5rem;display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap">
        <input id="wc-name" placeholder="item name (optional)" style="max-width:180px" />
        <select id="wc-newsub" style="max-width:160px">
          <option value="">no subcategory</option>
          ${(SUBCATS[category] || []).map(s => `<option value="${s}">${s}</option>`).join("")}
        </select>
        <button class="btn-mint sm" id="wc-save">save ♡</button>
        <button class="btn-mint sm" id="wc-cancel">cancel</button>
      </div>`;
    document.getElementById("wc-cancel").onclick = () => { pendingImage = null; preview.innerHTML = ""; };
    document.getElementById("wc-save").onclick = async () => {
      showLoading(true);
      try {
        const name = document.getElementById("wc-name").value.trim() || null;
        const sub = document.getElementById("wc-newsub").value || null;
        const imageUrl = await uploadImage(user.uid, "clothing", pendingImage);
        await addSub(user.uid, "clothing", { category, subcategory: sub, name, imageUrl });
        toast("Saved to wardrobe ♡");
        pendingImage = null; preview.innerHTML = "";
        await refresh();
      } catch { toast("Could not save — check storage rules."); }
      finally { showLoading(false); }
    };
  }

  document.getElementById("wc-camera").onchange = e => handleFile(e.target.files?.[0]);
  document.getElementById("wc-upload").onchange = e => handleFile(e.target.files?.[0]);

  async function refresh() {
    const all = (await listSub(user.uid, "clothing").catch(() => [])).filter(i => i.category === category);
    const q = search.value.trim().toLowerCase();
    const sub = subSelect.value;
    let filtered = all;
    if (q) filtered = filtered.filter(i => (i.name || "").toLowerCase().includes(q));
    if (sub) filtered = filtered.filter(i => i.subcategory === sub);
    grid.innerHTML = renderWardrobeGrid(filtered);
    wire();
  }

  function wire() {
    document.querySelectorAll("[data-del]").forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.del;
        const ok = await confirmDialog("Delete this item?", { okLabel: "Delete", danger: true });
        if (!ok) return;
        await deleteSub(user.uid, "clothing", id);
        await refresh();
      };
    });
    document.querySelectorAll("[data-edit]").forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.edit;
        const all = await listSub(user.uid, "clothing");
        const item = all.find(i => i.id === id);
        if (!item) return;
        openModal(`
          <h2>Edit item</h2>
          <div class="field"><label>Name</label><input id="e-name" value="${escapeHTML(item.name || "")}" /></div>
          <div class="field"><label>Subcategory</label>
            <select id="e-sub">
              <option value="">none</option>
              ${(SUBCATS[category] || []).map(s => `<option value="${s}" ${s === item.subcategory ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Replace picture (optional)</label>
            <input type="file" id="e-img" accept="image/*" />
          </div>
          <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem;flex-wrap:wrap">
            <button class="btn-mint sm" id="e-cancel">cancel</button>
            <button class="btn-mint sm" id="e-save">save</button>
          </div>
        `);
        document.getElementById("e-cancel").onclick = closeModal;
        document.getElementById("e-save").onclick = async () => {
          showLoading(true);
          try {
            const name = document.getElementById("e-name").value.trim() || null;
            const subcategory = document.getElementById("e-sub").value || null;
            let imageUrl = item.imageUrl;
            const file = document.getElementById("e-img").files?.[0];
            if (file) {
              const shrunk = await shrinkImage(file, 900);
              imageUrl = await uploadImage(user.uid, "clothing", shrunk);
            }
            await updateSub(user.uid, "clothing", id, { name, subcategory, imageUrl });
            closeModal();
            await refresh();
            toast("Updated ♡");
          } catch { toast("Could not update item."); }
          finally { showLoading(false); }
        };
      };
    });
  }

  search.oninput = debounce(refresh, 200);
  subSelect.onchange = refresh;
  wire();
}

/* OUTFITS */
async function outfitsView() {
  return `
  <div class="page">
    <h1 class="hand">Outfits (｡•̀ᴗ-)✧</h1>
    <p class="sub">Tell me where you're going, and I'll put together a look from your own wardrobe.</p>
    <section class="paper">
      <div id="oc-chat" class="chat">
        <div class="msg ai">
          <span class="donkey-mini">${donkeySVG("idle", 36)}</span>
          Hi! Where are you headed today? Feel free to include the time, weather and any style you're in the mood for.
        </div>
      </div>
      <div class="chat-input">
        <textarea id="oc-input" placeholder="e.g. brunch on Sunday, casual, maybe rainy…"></textarea>
        <button class="btn-mint" id="oc-send">send</button>
      </div>
      <div class="field" style="margin-top:.6rem">
        <label>Optional: location for weather</label>
        <div style="display:flex;gap:.5rem">
          <input id="oc-location" placeholder="e.g. Singapore" />
          <button class="btn-mint sm" id="oc-weather">check weather</button>
        </div>
      </div>
      <div id="oc-weather-info" class="sub" style="font-size:.85rem"></div>
    </section>
    <section class="paper">
      <h3 class="hand">Recent outfits</h3>
      <div id="oc-history"></div>
    </section>
  </div>
  `;
}

function mountOutfits(user) {
  const chat = document.getElementById("oc-chat");
  const input = document.getElementById("oc-input");
  const sendBtn = document.getElementById("oc-send");
  let weatherInfo = null;

  document.getElementById("oc-weather").onclick = async () => {
    const loc = document.getElementById("oc-location").value.trim();
    if (!loc) { toast("Enter a location first."); return; }
    if (!FEATURES.weather()) { document.getElementById("oc-weather-info").textContent = "Weather service not configured."; return; }
    showLoading(true);
    try {
      const w = await fetchWeather(loc);
      if (w.error) { document.getElementById("oc-weather-info").textContent = w.error; weatherInfo = null; }
      else {
        weatherInfo = w;
        document.getElementById("oc-weather-info").textContent =
          `Weather in ${loc}: ${w.description}, ${w.tempC}°C, wind ${w.wind} m/s`;
      }
    } finally { showLoading(false); }
  };

  sendBtn.onclick = send;
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    appendUser(text);
    input.value = "";
    const typing = document.createElement("div");
    typing.className = "msg ai";
    typing.innerHTML = `<span class="typing">Jumino is thinking…</span>`;
    chat.appendChild(typing);
    chat.scrollTop = chat.scrollHeight;
    sendBtn.disabled = true;

    try {
      const [wardrobe, doc] = await Promise.all([
        listSub(user.uid, "clothing").catch(() => []),
        getUserDoc(user.uid),
      ]);
      const result = await requestOutfit({
        occasion: text,
        prefs: {},
        weather: weatherInfo ? `${weatherInfo.description} ${weatherInfo.tempC}°C` : "",
        wardrobe,
        profile: { color: doc.colorResult, body: doc.bodyResult, face: doc.faceResult },
      });
      typing.remove();
      appendOutfit(result, wardrobe);
      await addSub(user.uid, "outfits", {
        summary: result.summary || "",
        itemIds: JSON.stringify(result.itemIds || []),
        occasion: text,
      });
      loadHistory();
    } catch {
      typing.remove();
      appendAI("Something went wrong while planning — try again in a moment ♡");
    } finally { sendBtn.disabled = false; }
  }

  function appendUser(text) {
    const el = document.createElement("div");
    el.className = "msg user";
    el.textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }
  function appendAI(text) {
    const el = document.createElement("div");
    el.className = "msg ai";
    el.innerHTML = `<span class="donkey-mini">${donkeySVG("idle", 32)}</span>${escapeHTML(text)}`;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }
  function appendOutfit(result, wardrobe) {
    const map = new Map(wardrobe.map(i => [i.id, i]));
    const items = (result.itemIds || []).map(id => map.get(id)).filter(Boolean);
    const el = document.createElement("div");
    el.className = "msg outfit";
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
        <span class="donkey-mini">${donkeySVG("present", 40)}</span>
        <strong>${escapeHTML(result.summary || "Here's an idea ♡")}</strong>
      </div>
      ${items.length ? `
        <div class="outfit-items">
          ${items.map(i => `
            <div>
              <img src="${i.imageUrl}" alt="${escapeHTML(i.name || i.category)}" />
              <div style="font-size:.7rem;text-align:center;margin-top:.2rem">${escapeHTML(i.name || i.category)}</div>
            </div>`).join("")}
        </div>
      ` : `<p style="opacity:.75;font-size:.85rem">No wardrobe items were matched — try again after adding some pieces.</p>`}
      ${result.reason ? `<p class="reason">${escapeHTML(result.reason)}</p>` : ""}
      ${result.alternatives?.length ? `<p class="reason"><em>Alternatives:</em> ${result.alternatives.map(escapeHTML).join(", ")}</p>` : ""}
      ${result.note ? `<p class="reason" style="opacity:.65"><em>${escapeHTML(result.note)}</em></p>` : ""}
      ${(result.essentials || []).length ? `
        <div class="essentials">
          <div style="width:100%;font-size:.82rem;opacity:.8;margin-bottom:.2rem">Bring along ♡</div>
          ${result.essentials.map(e => `
            <span class="chip" data-ess="${escapeHTML(e)}">
              ${escapeHTML(e)}
              <button data-ok>OK</button>
            </span>
          `).join("")}
        </div>
      ` : ""}
    `;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    el.querySelectorAll("[data-ok]").forEach(btn => {
      btn.onclick = async () => {
        const label = btn.closest(".chip").dataset.ess;
        try {
          const existing = await listSub(user.uid, "checklist").catch(() => []);
          if (existing.some(i => i.label.toLowerCase() === label.toLowerCase())) {
            toast("Already on your checklist ♡");
            btn.disabled = true; btn.textContent = "added";
            return;
          }
          await addSub(user.uid, "checklist", { label, done: false, source: "ai" });
          toast("Added to To Bring ♡");
          btn.disabled = true; btn.textContent = "added";
        } catch { toast("Could not add item."); }
      };
    });
  }

  async function loadHistory() {
    const outfits = await listSub(user.uid, "outfits").catch(() => []);
    const el = document.getElementById("oc-history");
    if (outfits.length === 0) { el.innerHTML = `<p class="sub">No saved outfits yet.</p>`; return; }
    el.innerHTML = outfits.slice(0, 5).map(o => `
      <div class="result-section">
        <p><strong>${escapeHTML(o.occasion || "occasion")}</strong></p>
        <p>${escapeHTML(o.summary || "")}</p>
      </div>
    `).join("");
  }
  loadHistory();
}

/* PROFILE */
async function profileView({ user }) {
  const doc = await getUserDoc(user.uid);
  return `
  <div class="page">
    <h1 class="hand">Profile (•‿•)</h1>
    <section class="paper">
      <div class="profile-hero">
        <div class="profile-avatar">
          ${doc.avatarUrl ? `<img src="${doc.avatarUrl}" alt="avatar" />` : (doc.username || "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <p style="margin:0"><strong>${escapeHTML(doc.username || "")}</strong></p>
          <p style="margin:.2rem 0 0;opacity:.7;font-size:.85rem">Country: ${escapeHTML(doc.country || "not set")}</p>
        </div>
      </div>
      <div class="grid2" style="margin-top:1rem">
        <button class="btn-mint" id="p-edit">edit profile</button>
        <button class="btn-mint" id="p-pass">update password</button>
      </div>
    </section>
    <section class="paper">
      <h3 class="hand">Saved analyses</h3>
      <div class="kv"><span>Colour palette</span><span>${doc.colorResult ? escapeHTML(doc.colorResult.season) : "not saved"}</span></div>
      <div class="kv"><span>Body shape</span><span>${doc.bodyResult ? escapeHTML(doc.bodyResult.shape) : "not saved"}</span></div>
      <div class="kv"><span>Face shape</span><span>${doc.faceResult ? escapeHTML(doc.faceResult.shape) : "not saved"}</span></div>
    </section>
    <section class="paper">
      <h3 class="hand">Danger zone</h3>
      <p class="sub" style="font-size:.85rem">Deleting your account removes your profile, images, wardrobe and analyses.</p>
      <button class="btn-mint danger" id="p-delete">delete my account</button>
    </section>
  </div>
  `;
}

function mountProfile(user) {
  document.getElementById("p-edit").onclick = async () => {
    const doc = await getUserDoc(user.uid);
    openModal(`
      <h2>Edit profile</h2>
      <div class="field"><label>Username</label><input id="pp-username" value="${escapeHTML(doc.username || "")}" /></div>
      <div class="field"><label>Country</label><input id="pp-country" value="${escapeHTML(doc.country || "")}" /></div>
      <div class="field"><label>New picture (optional)</label><input type="file" id="pp-img" accept="image/*" /></div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem;flex-wrap:wrap">
        <button class="btn-mint sm" id="pp-cancel">cancel</button>
        <button class="btn-mint sm" id="pp-save">save</button>
      </div>
    `);
    document.getElementById("pp-cancel").onclick = closeModal;
    document.getElementById("pp-save").onclick = async () => {
      showLoading(true);
      try {
        const username = document.getElementById("pp-username").value.trim();
        const country = document.getElementById("pp-country").value.trim() || null;
        if (username && !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
          toast("Username must be 3–24 letters/numbers/_."); return;
        }
        const file = document.getElementById("pp-img").files?.[0];
        let avatarUrl = doc.avatarUrl || null;
        if (file) {
          const shrunk = await shrinkImage(file, 400);
          const blob = dataURLtoBlob(shrunk);
          const ref = storage.ref(`avatars/${user.uid}`);
          await ref.put(blob);
          avatarUrl = await ref.getDownloadURL();
        }
        await saveUserDoc(user.uid, { username, country, avatarUrl });
        closeModal();
        toast("Saved ♡");
        wiredNavigate("profile");
        hydrateNav(user);
      } catch { toast("Could not save changes."); }
      finally { showLoading(false); }
    };
  };

  document.getElementById("p-pass").onclick = () => {
    openModal(`
      <h2>Update password</h2>
      <div class="field"><label>New password (8+ chars)</label><input id="pw-new" type="password" /></div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem;flex-wrap:wrap">
        <button class="btn-mint sm" id="pw-cancel">cancel</button>
        <button class="btn-mint sm" id="pw-save">save</button>
      </div>
    `);
    document.getElementById("pw-cancel").onclick = closeModal;
    document.getElementById("pw-save").onclick = async () => {
      const pw = document.getElementById("pw-new").value;
      if (pw.length < 8) { toast("Password must be 8+ characters."); return; }
      try { await user.updatePassword(pw); closeModal(); toast("Password updated ♡"); }
      catch { toast("Could not update password — sign in again to retry."); }
    };
  };

  document.getElementById("p-delete").onclick = async () => {
    const ok = await confirmDialog(
      "Delete your account and all associated data? This cannot be undone.",
      { okLabel: "Delete forever", danger: true }
    );
    if (!ok) return;
    showLoading(true);
    try {
      for (const col of ["checklist", "clothing", "outfits"]) {
        const snap = await userSub(user.uid, col).get();
        await Promise.all(snap.docs.map(d => d.ref.delete()));
      }
      await userDoc(user.uid).delete();
      await user.delete();
      location.reload();
    } catch {
      toast("Could not delete — try again later.");
      showLoading(false);
    }
  };
}

function registerAllViews(user) {
  register("home", () => homeView({ user }));
  register("color", () => colourView({ user }));
  register("body", () => bodyView({ user }));
  register("face", () => faceView({ user }));
  register("wardrobe", () => wardrobeView({ user, navigate: wiredNavigate }));
  register("wardrobeCategory", (opts) => wardrobeCategoryView({ user, category: opts.category }));
  register("outfits", () => outfitsView({ user }));
  register("profile", () => profileView({ user }));
}

async function wiredNavigate(name, opts = {}) {
  const user = auth.currentUser;
  if (!user) return;
  registerAllViews(user);
  let cleanup = null;
  await navigate(name, {
    ...opts, name, push: opts.push !== false,
    onMount: () => {
      if (name === "home")             mountHome(user, { navigate: wiredNavigate });
      if (name === "color")            mountColour(user, { setCleanup: fn => cleanup = fn });
      if (name === "body")             mountBody(user);
      if (name === "face")             mountFace(user);
      if (name === "wardrobe")         mountWardrobe(user, { navigate: wiredNavigate });
      if (name === "wardrobeCategory") mountWardrobeCategory(user, { category: opts.category });
      if (name === "outfits")          mountOutfits(user);
      if (name === "profile")          mountProfile(user);
    },
  });
}

window.__navigate = wiredNavigate;

auth.onAuthStateChanged(user => {
  if (user) registerAllViews(user);
});

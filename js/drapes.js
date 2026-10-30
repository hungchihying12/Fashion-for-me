import { DRAPES, DRAPE_ORDER, drapeByName } from "./rules.js";
import { escapeHTML, toast } from "./ui.js";
import { donkeySVG } from "./donkey.js";
import { startCamera, stopCamera, captureFrame } from "./camera.js";

export async function mountDrapeSession(container) {
  let responses = [];
  let currentDrape = null;
  let compareMode = false;
  let comparePicks = [];
  let cameraStream = null;
  let orderIdx = 0;

  container.innerHTML = `
    <div class="drape-stage">
      <div class="drape-video-wrap">
        <video id="ds-video" autoplay playsinline muted></video>
        <div class="drape-fabric" id="ds-fabric"></div>
        <div class="drape-donkey" id="ds-donkey"></div>
      </div>
      <div class="drape-controls">
        <div class="drape-btn-row">
          <button class="btn-mint sm" id="ds-cam">(◉‿◉) camera</button>
          <button class="btn-mint sm" id="ds-replay" title="replay current drape">↺ replay</button>
          <button class="btn-mint sm" id="ds-skip" title="next drape">skip →</button>
          <button class="btn-mint sm" id="ds-compare">⇄ compare</button>
        </div>
        <div class="drape-family-row" id="ds-families">
          ${["all","warm","cool","neutral","bright","muted","deep"].map(f => `
            <button class="drape-chip ${f === "all" ? "sel" : ""}" data-family="${f}">${f}</button>
          `).join("")}
        </div>
        <div class="drape-picker">
          <p class="sub" style="margin:0 0 .4rem;font-size:.78rem">or pick a colour to drape:</p>
          <div id="ds-picker-grid"></div>
        </div>
        <div class="drape-verdicts hidden" id="ds-verdicts">
          <p style="margin:.4rem 0 .3rem;font-size:.85rem">How does this colour feel?</p>
          <div class="verdict-row">
            <button class="btn-mint sm" data-verdict="loved">♡ loved</button>
            <button class="btn-mint sm" data-verdict="ok">・ okay</button>
            <button class="btn-mint sm" data-verdict="not-sure">? not sure</button>
          </div>
          <input id="ds-note" placeholder="optional note (e.g. 'felt grey')" maxlength="80" />
        </div>
        <div class="drape-compare-panel hidden" id="ds-compare-panel">
          <p style="margin:.4rem 0;font-size:.85rem">Tap two colours to compare side by side.</p>
          <div class="compare-slots">
            <div class="compare-slot" id="cs-a">A</div>
            <div class="compare-slot" id="cs-b">B</div>
          </div>
          <button class="btn-mint sm" id="cs-clear">clear</button>
        </div>
        <p class="drape-counter" id="ds-counter"></p>
      </div>
    </div>
  `;

  const video = document.getElementById("ds-video");
  const fabric = document.getElementById("ds-fabric");
  const donkeyEl = document.getElementById("ds-donkey");
  const verdicts = document.getElementById("ds-verdicts");

  donkeyEl.innerHTML = donkeySVG("think", 90);

  document.getElementById("ds-cam").onclick = async () => {
    if (cameraStream) return;
    try {
      cameraStream = await startCamera(video);
      toast("Camera ready — drapes will appear over the lower half ♡");
      donkeyEl.innerHTML = donkeySVG("idle", 90);
    } catch (e) { toast(e.message); }
  };

  function buildPicker(family = "all") {
    const grid = document.getElementById("ds-picker-grid");
    const list = DRAPES.filter(d => family === "all" || d.family === family);
    grid.innerHTML = list.map(d => `
      <button class="drape-swatch" data-pick="${escapeHTML(d.name)}"
              style="background:${d.hex}" title="${escapeHTML(d.name)} · ${escapeHTML(d.note || "")}"></button>
    `).join("");
    grid.querySelectorAll("[data-pick]").forEach(b => {
      b.onclick = () => {
        if (compareMode) pickCompare(b.dataset.pick);
        else applyDrape(drapeByName(b.dataset.pick));
      };
    });
  }
  buildPicker();

  document.querySelectorAll("[data-family]").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("[data-family]").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel");
      buildPicker(b.dataset.family);
    };
  });

  function applyDrape(d) {
    if (!d) return;
    currentDrape = d;
    orderIdx = DRAPE_ORDER.indexOf(d.name);
    if (orderIdx < 0) orderIdx = 0;
    fabric.style.background = d.hex;
    fabric.textContent = `${d.name} · ${d.note || ""}`;
    fabric.classList.remove("show");
    void fabric.offsetWidth;
    fabric.classList.add("show");
    verdicts.classList.remove("hidden");
    updateCounter();
    donkeyEl.innerHTML = donkeySVG("point", 90);
  }

  document.querySelectorAll("[data-verdict]").forEach(b => {
    b.onclick = () => {
      if (!currentDrape) return;
      const note = document.getElementById("ds-note").value.trim();
      responses = responses.filter(r => r.name !== currentDrape.name);
      responses.push({ hex: currentDrape.hex, name: currentDrape.name, harmony: b.dataset.verdict, note });
      document.getElementById("ds-note").value = "";
      toast(`Noted: ${currentDrape.name} → ${b.dataset.verdict}`);
      const nextName = DRAPE_ORDER[(orderIdx + 1) % DRAPE_ORDER.length];
      const next = drapeByName(nextName);
      if (next) applyDrape(next);
    };
  });

  document.getElementById("ds-replay").onclick = () => { if (currentDrape) applyDrape(currentDrape); };
  document.getElementById("ds-skip").onclick = () => {
    const nextName = DRAPE_ORDER[(orderIdx + 1) % DRAPE_ORDER.length];
    const next = drapeByName(nextName);
    if (next) applyDrape(next);
  };

  document.getElementById("ds-compare").onclick = () => {
    compareMode = !compareMode;
    document.getElementById("ds-compare-panel").classList.toggle("hidden", !compareMode);
    fabric.classList.toggle("hidden", compareMode);
    document.getElementById("ds-compare").textContent = compareMode ? "⇄ exit compare" : "⇄ compare";
  };

  function pickCompare(name) {
    if (comparePicks.includes(name)) comparePicks = comparePicks.filter(n => n !== name);
    else { if (comparePicks.length >= 2) comparePicks.shift(); comparePicks.push(name); }
    const [a, b] = comparePicks;
    const slotA = document.getElementById("cs-a");
    const slotB = document.getElementById("cs-b");
    const da = a ? drapeByName(a) : null;
    const db = b ? drapeByName(b) : null;
    slotA.style.background = da ? da.hex : "#fffdf7";
    slotA.textContent = da ? da.name : "A";
    slotB.style.background = db ? db.hex : "#fffdf7";
    slotB.textContent = db ? db.name : "B";
  }
  document.getElementById("cs-clear").onclick = () => { comparePicks = []; pickCompare(""); };

  function updateCounter() {
    document.getElementById("ds-counter").textContent =
      `${responses.length} drape${responses.length === 1 ? "" : "s"} noted`;
  }
  updateCounter();

  return {
    getResponses: () => responses.slice(),
    getCurrentDrape: () => currentDrape,
    capturePhoto: () => {
      if (!cameraStream || !video.srcObject) return null;
      try { return captureFrame(video, 900); } catch { return null; }
    },
    destroy: () => {
      if (cameraStream) { stopCamera(cameraStream); cameraStream = null; }
    },
  };
}

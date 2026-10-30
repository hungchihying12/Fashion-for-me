const views = new Map();
let currentCleanup = null;
let history = [];

export function register(name, render) {
  views.set(name, render);
}

export async function navigate(name, opts = {}) {
  if (typeof currentCleanup === "function") {
    try { currentCleanup(); } catch {}
    currentCleanup = null;
  }
  const render = views.get(name);
  if (!render) { console.warn("unknown view", name); return; }
  if (opts.push !== false && opts.name !== name) {
    history.push({ name, opts });
  }
  const view = document.getElementById("view");
  view.innerHTML = `<div class="page"><p class="sub">loading view…</p></div>`;
  const html = await render({ navigate, setCleanup: (fn) => { currentCleanup = fn; }, ...opts });
  view.innerHTML = html;
  window.scrollTo({ top: 0, behavior: "instant" });
  if (opts.onMount) opts.onMount();
}

export function back() {
  history.pop();
  const prev = history.pop();
  navigate(prev?.name || "home", { ...(prev?.opts || {}), push: false, name: prev?.name });
}

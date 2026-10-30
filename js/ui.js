let toastTimer = null;
export function toast(msg, ms = 2200) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), ms);
}

export function showLoading(on = true) {
  document.getElementById("loading").classList.toggle("hidden", !on);
}

export function openModal(html) {
  const content = document.getElementById("modal-content");
  content.innerHTML = html;
  document.getElementById("modal-backdrop").classList.remove("hidden");
}

export function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.getElementById("modal-content").innerHTML = "";
}
window.__closeModal = closeModal;

export function confirmDialog(message, { okLabel = "Confirm", danger = false } = {}) {
  return new Promise(resolve => {
    openModal(`
      <p style="margin-top:0">${escapeHTML(message)}</p>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem;flex-wrap:wrap">
        <button class="btn-mint sm" id="confirm-cancel">cancel</button>
        <button class="btn-mint sm ${danger ? "danger" : ""}" id="confirm-ok">${escapeHTML(okLabel)}</button>
      </div>
    `);
    document.getElementById("confirm-cancel").onclick = () => { closeModal(); resolve(false); };
    document.getElementById("confirm-ok").onclick = () => { closeModal(); resolve(true); };
  });
}

export function escapeHTML(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export async function shrinkImage(file, maxDim = 900) {
  const url = await fileToDataURL(file);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.src = url;
  });
}

export function dataURLtoBlob(dataurl) {
  const [meta, data] = dataurl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

import { auth, storage } from "./firebase.js";
import { toast, shrinkImage, dataURLtoBlob, showLoading } from "./ui.js";

export function bindAuthScreen(onAuthed) {
  document.querySelectorAll("#tabs .tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll("#tabs .tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      document.getElementById("login-form").classList.toggle("hidden", !isLogin);
      document.getElementById("signup-form").classList.toggle("hidden", isLogin);
      document.getElementById("login-err").textContent = "";
      document.getElementById("signup-err").textContent = "";
    };
  });

  const preview = document.getElementById("signup-avatar-preview");
  let avatarDataURL = null;
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      avatarDataURL = await shrinkImage(file, 400);
      preview.innerHTML = `<img src="${avatarDataURL}" alt="preview" />`;
    } catch { toast("Could not read that image."); }
  };
  document.getElementById("signup-avatar-file").onchange = handleFile;
  document.getElementById("signup-avatar-upload").onchange = handleFile;

  document.getElementById("login-form").onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById("login-err");
    err.textContent = "";
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    if (!username || !password) { err.textContent = "Enter a username and password."; return; }
    showLoading(true);
    try {
      await auth.signInWithEmailAndPassword(`${username}@jumino.local`, password);
    } catch {
      err.textContent = "Username or password isn't right.";
    } finally { showLoading(false); }
  };

  document.getElementById("signup-form").onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById("signup-err");
    err.textContent = "";
    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value;
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      err.textContent = "Username must be 3–24 letters, numbers or underscores.";
      return;
    }
    if (password.length < 8) { err.textContent = "Password must be at least 8 characters."; return; }
    showLoading(true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(`${username}@jumino.local`, password);
      await cred.user.updateProfile({ displayName: username });
      let avatarUrl = null;
      if (avatarDataURL) {
        try {
          const blob = dataURLtoBlob(avatarDataURL);
          const ref = storage.ref(`avatars/${cred.user.uid}`);
          await ref.put(blob);
          avatarUrl = await ref.getDownloadURL();
        } catch { toast("Picture upload failed — you can add it later."); }
      }
      const { userDoc } = await import("./firebase.js");
      await userDoc(cred.user.uid).set({
        username, avatarUrl, country: null, createdAt: new Date().toISOString(),
      });
    } catch (e2) {
      const msg =
        e2?.code === "auth/email-already-in-use" ? "That username is taken." :
        e2?.code === "auth/weak-password"        ? "Password is too weak." :
                                                   "Could not create account.";
      err.textContent = msg;
    } finally { showLoading(false); }
  };

  auth.onAuthStateChanged(user => onAuthed(user));

  document.getElementById("btn-logout").onclick = async () => {
    await auth.signOut();
    location.reload();
  };
}

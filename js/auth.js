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
    } catch (e2) {
      console.error("[login] Firebase error:", e2?.code, e2?.message);
      const code = e2?.code || "";
      let msg;
      switch (code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          msg = "Username or password isn't right.";
          break;
        case "auth/too-many-requests":
          msg = "Too many attempts. Try again in a minute.";
          break;
        case "auth/network-request-failed":
          msg = "Network error — check your connection.";
          break;
        case "auth/operation-not-allowed":
          msg = "Email/Password sign-in is not enabled in Firebase.";
          break;
        case "auth/invalid-email":
          msg = "That username isn't valid.";
          break;
        default:
          msg = "Login failed. Check the console for details.";
      }
      err.textContent = msg;
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
        } catch (e3) {
          console.warn("[signup] avatar upload failed:", e3?.code, e3?.message);
          toast("Picture upload failed — you can add it later.");
        }
      }
      const { userDoc } = await import("./firebase.js");
      await userDoc(cred.user.uid).set({
        username, avatarUrl, country: null, createdAt: new Date().toISOString(),
      });
    } catch (e2) {
      console.error("[signup] Firebase error:", e2?.code, e2?.message);
      const code = e2?.code || "";
      let msg;
      switch (code) {
        case "auth/email-already-in-use":
          msg = "That username is taken. Try another.";
          break;
        case "auth/weak-password":
          msg = "Password is too weak. Use 8+ characters with a number or symbol.";
          break;
        case "auth/operation-not-allowed":
          msg = "Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.";
          break;
        case "auth/invalid-email":
          msg = "That username can't be used. Try letters, numbers or underscores only.";
          break;
        case "auth/network-request-failed":
          msg = "Network error — check your connection and try again.";
          break;
        case "auth/too-many-requests":
          msg = "Too many attempts. Try again in a minute.";
          break;
        case "auth/invalid-api-key":
        case "auth/api-key-not-valid":
          msg = "Firebase API key is invalid. Check js/config.js.";
          break;
        case "auth/unauthorized-domain":
          msg = "This domain isn't authorized in Firebase Auth settings.";
          break;
        case "auth/admin-restricted-operation":
          msg = "Account creation is disabled for this project.";
          break;
        default:
          msg = "Could not create account. Check the browser console for details.";
      }
      err.textContent = msg;
    } finally { showLoading(false); }
  };

  auth.onAuthStateChanged(user => onAuthed(user));

  document.getElementById("btn-logout").onclick = async () => {
    await auth.signOut();
    location.reload();
  };
}

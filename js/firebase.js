/* ==========================================================
   Firebase bootstrap — Firestore + Storage only.
   Auth is handled by js/auth.js with a local user table
   stored in Firestore.
   ========================================================== */
import { firebaseConfig } from "./config.js";

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

export const db      = firebase.firestore();
export const storage = firebase.storage();

export function userDoc(uid) {
  return db.collection("users").doc(uid);
}
export function userSub(uid, collection) {
  return userDoc(uid).collection(collection);
}

// Local account record lives at the top-level collection "accounts".
// Fields: username, saltHex, passwordHashHex, createdAt, uid
export const accountsCol = db.collection("accounts");

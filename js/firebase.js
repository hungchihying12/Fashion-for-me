import { firebaseConfig } from "./config.js";

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

export const auth    = firebase.auth();
export const db      = firebase.firestore();
export const storage = firebase.storage();

export function userDoc(uid) {
  return db.collection("users").doc(uid);
}
export function userSub(uid, collection) {
  return userDoc(uid).collection(collection);
}

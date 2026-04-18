 export function test() {
  console.log("rohit")
}

// IMPORTS


import {
  auth,
  provider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  signInAnonymously
} from "./firebase.js";

import { supabaseClient } from "./supabase.js";

console.log("auth.js")
/* =========================
        LOGIN
========================= */

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);

    console.log("Google login:", result.user.uid);

  } catch (err) {
    console.error("Google login error:", err);
  }
}

export async function loginAsGuest() {
  try {
    const result = await signInAnonymously(auth);

    console.log("Guest login:", result.user.uid);

  } catch (err) {
    console.error("Guest login error:", err);
  }
}


/* =========================

========================= */

export async function logout() {
  try {
    await signOut(auth);
    console.log("Logged out");
  } catch (err) {
    console.error(err);
  }
}


/* =========================
        AUTH LISTENER
========================= */


export function listenAuth(callback) {

  onAuthStateChanged(auth, (user) => {

    if (user) {
      callback(user);
    } else {
      callback(null);
    }

  });

}
/* =========================
        PROFILE SYNC
========================= */


 

  /***********END***********/
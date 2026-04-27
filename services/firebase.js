console.log("firebase starting")

//  FIREBASE CORE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

//  FIRESTORE (ONE IMPORT ONLY)
import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  writeBatch,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// AUTH
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


// CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCPwWhQCM6DdqyseQxxs-KmH7kDlGbCuXo",
  authDomain: "timplets-62493.firebaseapp.com",
  projectId: "timplets-62493",
  storageBucket: "timplets-62493.firebasestorage.app",
  messagingSenderId: "216373115282",
  appId: "1:216373115282:web:a4090eef50f54b756a294b",
  measurementId: "G-LVZ75KXR5Z"
};

// INIT
const app = initializeApp(firebaseConfig);

// EXPORTS
export const db = getFirestore(app);
 const auth = getAuth(app);
 const provider = new GoogleAuthProvider();

// FIRESTORE EXPORTS
export {
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  writeBatch,
  onSnapshot
};

// AUTH EXPORTS
export {
  auth,
  provider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  signInAnonymously
};
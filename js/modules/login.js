console.log("Login.js")

import {
  loginWithGoogle,
  loginAsGuest,
  test
} from "../../services/auth.js"

import {navigate} from "../router.js";




export function initLoginPage() {

  console.log("login init");

  const googleBtn = document.getElementById("googleLoginBtn");
  const guestBtn = document.getElementById("guestLoginBtn");

  if (googleBtn) {
    googleBtn.onclick = async () => {
      await loginWithGoogle();
      navigate("flashcards")
      return;
    };
  }

  if (guestBtn) {
    guestBtn.onclick = async () => {
      await loginAsGuest();
      navigate("flashcards")
      return;
    };
  }
}




/*


export function initLoginPage() {

  console.log("login init");

  const googleBtn = document.getElementById("googleLoginBtn");
  const guestBtn = document.getElementById("guestLoginBtn");

  if (googleBtn) {
    googleBtn.onclick = () => {
      console.log("Google button clicked");
      alert("Google login (UI only)");
    };
  }

  if (guestBtn) {
    guestBtn.onclick = () => {
      console.log("Guest button clicked");
      alert("Guest login (UI only)");
    };
  }
}
*/
window.addEventListener("error", (event) => {
  console.log(" GLOBAL ERROR CAUGHT");
  console.log("Message:", event.message);
  console.log("File:", event.filename);
  console.log("Line:", event.lineno, "Column:", event.colno);
});

window.addEventListener("unhandledrejection", (event) => {
  console.log("PROMISE ERROR")
  console.log("event.reason")
});


import { initRouter } from "./router.js";
import { initLoginPage } from "./modules/login.js";
import { initProfile } from "./modules/profile.js";
import { initVideoFeed } from "./modules/videofeed.js";
import { initVoiceRooms } from "./modules/voiceroom.js";
import { listenAuth} from "../services/auth.js";
import { syncUserProfile,initSetupProfile } from "../helper/Syncuser.js";
import { Id } from "./state.js";
import { navigate } from "./router.js";



function startApp() {

  console.log("App starting...");

  initRouter();
  initLoginPage();

  let initialized = false;

  listenAuth(async (user) => {

    if (user) {

      console.log("User:", user.uid);

      Id.CURRENT_USER_ID = user.uid;

      await syncUserProfile(user);

      //  AFTER NAVIGATION → INIT SETUP PAGE
      setTimeout(() => {
        initSetupProfile();
      }, 200);

      if (!initialized) {
        initialized = true;

        initProfile();
        initVideoFeed();
        initVoiceRooms();
      }

    } else {

      console.log("No user");
      Id.CURRENT_USER_ID = null;

      // optional
      navigate("login");
    }

  });

}

document.addEventListener("DOMContentLoaded", startApp);







//document.addEventListener("DOMContentLoaded", startApp);



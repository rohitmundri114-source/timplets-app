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
import { initVoiceRooms,joinRoom,
joinRoomAsAdmin} from "./modules/voiceroom.js";
import { listenAuth} from "../services/auth.js";
import { syncUserProfile,initSetupProfile } from "../helper/Syncuser.js";
import { Id, STORAGE } from "./state.js";
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

      // setup profile page init
      setTimeout(() => {
        initSetupProfile();
      }, 200);

    } else {

      console.log("Guest mode");

      Id.CURRENT_USER_ID = null;
    }

    //  IMPORTANT: INIT APP FOR BOTH (user + guest)
    if (!initialized) {
      initialized = true;

      initProfile();
      initVideoFeed();
      initVoiceRooms();

      //  DEFAULT PAGE
      navigate("flashcards");
    }
    
    //REJION
  if (user) {

    const lastRoom = localStorage.getItem(STORAGE.STORAGE_KEY);

    if (lastRoom) {

      const userRef = doc(
        db,
        "rooms",
        lastRoom,
        "users",
        Id.CURRENT_USER_ID
      );

      try {
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const role = snap.data().role;

          console.log("Rejoining as:", role);

          if (role === "admin") {
            await joinRoomAsAdmin(lastRoom);
          } else {
            await joinRoom(lastRoom);
          }
        } else {
          localStorage.removeItem(STORAGE.STORAGE_KEY);
        }

      } catch (err) {
        console.error("Rejoin error:", err);
      }
    }
  }

  });

}

document.addEventListener("DOMContentLoaded", startApp);







//document.addEventListener("DOMContentLoaded", startApp);



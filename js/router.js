import { stopAllVideos } from "../helper/Syncuser.js";
import { AppState, Id } from "./state.js";
import { openProfile, openEditProfile } from "./modules/profile.js";
import { restartObserver } from "./modules/videofeed.js";

console.log("router starting")

const CURRENT_USER_ID = Id.CURRENT_USER_ID;
let navButtons=[];
let isNavigating=false;

function hideAllPages(){
document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
}


export function navigate(targetId){

if(isNavigating) return;
 isNavigating=true;

 const nextPage=document.getElementById(targetId);
if(!nextPage){isNavigating=false;return;}

hideAllPages();
nextPage.classList.add("active");
AppState.currentPage=nextPage;

navButtons.forEach(btn=>btn.classList.remove("active-btn"));

document.querySelector(`[data-target="${targetId}"]`)?.classList.add("active-btn");

history.pushState({}, "", `#${targetId}`);

setTimeout(()=>{isNavigating=false;},100);
console.log("Navigating to:", targetId);
}


export function initRouter(){

navButtons=document.querySelectorAll(".nav-container button");
navButtons.forEach(btn => {

  btn.addEventListener("click", () => {

    const target = btn.dataset.target;

    console.log("Navigating to:", target);

    // ⭐ PROFILE LOGIC HERE
    if (target === "profile") {

      if (!Id.CURRENT_USER_ID) {
        console.log("No user → login");

        navigate("login");
        return;
      }

      navigate("profile");
      openProfile(Id.CURRENT_USER_ID);

      return;
    }

    if(target === "flashcards"){
      setTimeout(()=>{
        restartObserver();
      }, 200)
    }
    
        // normal pages
    navigate(target);
    stopAllVideos();
    

  });

});

console.log("router-int")
}


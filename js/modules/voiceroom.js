import { Id, Voice } from "../state.js";
import { openProfile } from "./profile.js";
import { navigate } from "../router.js";
import {
  db,
  doc,
  setDoc,
  addDoc,
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
} from "../../services/firebase.js";
import { stopAllVideos,requireAuth } from "../../helper/Syncuser.js";
import { supabaseClient } from "../../services/supabase.js";
import { Joinvoicechannel, leaveVoicechannel, updateMicUI } from "../../services/agora.js"; 

console.log("voice room starting")


export function initVoiceRooms(){

  if (isVoiceInitialized) return;
  isVoiceInitialized = true;

  if (createbtn) {
    createbtn.addEventListener("click", showCreateUI);
  } else {
    console.warn("createbtn missing");
  }
  
  if (Close) {
    Close.addEventListener("click", hideCreateUI);
  }

  if (confirmbtn) {
    confirmbtn.addEventListener("click", handleConfirm);
  }

  if (raiseBtn) {
    raiseBtn.addEventListener("click", raiseHand);
  }

  const requestBtn = document.getElementById("requestBtn");

  if (requestBtn) {
    requestBtn.addEventListener("click", () => {
      document.getElementById("requestPanel")
        ?.classList.toggle("hidden");
    });
  }

  loadRooms()

}



const CURRENT_USER_ID = Id.CURRENT_USER_ID;


const participants = new Map();


const createbtn = document.getElementById("create-room");
const container = document.getElementById("input-container");
const confirmbtn = document.getElementById("Confirm-btn");
const Data = document.getElementById("data");
 const raiseBtn = document.getElementById("raiseHandBtn");
 const Close = document.querySelector(".close");


let isVoiceInitialized = false;





/*********ROOM-CREATE***********/

async function createRoom() {

  //block-if-not-log
  if(!requireAuth()){
    
    //hide-UI
    hideCreateUI();
    
    return;
  };
  
  Voice.isRoomAdmin = true;

 const UserInput = Data.value.trim();

  if (!UserInput || UserInput.length > 30) {
    alert("Invalid room name");
    return;
  }

  try {

    // ⭐ fetch avatar from Supabase profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("avatar_url")
      .eq("id", Id.CURRENT_USER_ID)
      .single();

    const avatarUrl = profile?.avatar_url || null;

    // ⭐ create firebase room
  
    const docRef = await addDoc(collection(db, "rooms"), {
  name: UserInput,
  createdBy: Id.CURRENT_USER_ID,
  adminAvatar: avatarUrl,
  createdAt: serverTimestamp()
});

    
    
    Data.value = "";
    container.classList.add("hidden");
    createbtn.classList.remove("hidden");

    joinRoomAsAdmin(docRef.id);


  } catch (err) {
    console.error(err);
  }
  console.log("createroom")
}


function loadRooms() {

  const VoiceContainer = document.getElementById("voice-card");
  if (!VoiceContainer) return;

  // create query
  const q = query(
    collection(db, "rooms"),
    orderBy("createdAt", "desc")
  );

  //  realtime listener
  onSnapshot(q, (snapshot) => {

    if (!snapshot) return;

    VoiceContainer.replaceChildren();

    snapshot.forEach((docSnap) => {

      const data = docSnap.data();

      const roomId = docSnap.id;
      const roomName = data?.name || "Room";
      const avatar = data?.adminAvatar || "default.png";
      const createdBy = data?.createdBy || null;

      voicecard(roomId, roomName, avatar, createdBy);
    });

  });

  console.log("room-loaded");
}



/*********JOINING-FTN***********/



async function joinRoomAsAdmin(roomId) {

  Voice.currentRoomId = roomId;
  Voice.isRoomAdmin = true;

  console.log("ROOM ID:", roomId);
  console.log("USER ID:", Id.CURRENT_USER_ID);

  if (!Id.CURRENT_USER_ID) {
    console.error("User not logged in ❌");
    return;
  }

  try {

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", Id.CURRENT_USER_ID)
      .single();

    const name = profile?.username || "User";
    const avatarUrl = profile?.avatar_url || null;

    await setDoc(
      doc(db, "rooms", roomId, "users", Id.CURRENT_USER_ID),
      {
        name,
        avatarUrl,
        role: "admin",
        joinedAt: serverTimestamp()
      }
    );

    roomUI();

    document.getElementById("requestPanel")?.classList.add("hidden");
    document.getElementById("raiseHandBtn")?.classList.add("hidden");

    Joinvoicechannel(roomId).catch(err => {
      console.error("Agora join failed:", err);
    });

    Voice.chatUnsub = listenMessages(roomId);
    listenForRequests(roomId);

    Voice.unsubscribeRoom = listeners(roomId);
    Voice.roomDeleteUnsub = watchRoomDeletion(roomId);

  } catch (err) {
    console.error(err);
  }

  console.log("joinRoomAsAdmin");
}


/*
async function joinRoom(docId) {
  
  //if(!requireAuth()) return;

  Voice.isRoomAdmin = false;

  //  prevent rejoin
  if (Voice.currentRoomId === docId) return;

  //  cleanup previous listeners
  if (Voice.unsubscribeRoom) Voice.unsubscribeRoom();
  if (Voice.roomDeleteUnsub) Voice .roomDeleteUnsub();

  //  cleanup previous voice (NEW)
  await leaveVoicechannel();

  Voice.currentRoomId = docId;

  try {

    //  ensure participant
    await ensureUserJoined(docId);

    //  load metadata
    await roomData(docId);
    Voice.isReady= true;

    //  JOIN VOICE (FIXED)
    await Joinvoicechannel(docId);

    //  show UI
    roomUI();
    
    //raise-Hand
    if (!Voice.isRoomAdmin) {
  document.getElementById("raiseHandBtn").classList.remove("hidden");
}

    //  listeners
    Voice.unsubscribeRoom = listeners(docId);
    Voice.roomDeleteUnsub = watchRoomDeletion(docId);

    //  pause feed
    stopAllVideos?.();

  } catch (err) {
    console.error(err);
  }

  console.log("joinroom-Worked");
}*/

async function joinRoom(docId) {
  
  // prevent rejoin
  if (Voice.currentRoomId === docId) return;

  Voice.isRoomAdmin = false;
  Voice.isReady = false; // 🔥 reset state

  // cleanup previous listeners
  Voice.unsubscribeRoom?.();
  Voice.roomDeleteUnsub?.();
  Voice.unsubscribeMessages?.(); // 🔥 ADD THIS

  // cleanup previous voice
  await leaveVoicechannel();

  Voice.currentRoomId = docId;

  try {

    // 🔥 STEP 1: ensure user exists in room
    await ensureUserJoined(docId);

    // 🔥 STEP 2: write/update user data
    await roomData(docId);

    // 🔥 STEP 3: start listeners BEFORE UI (important)
    Voice.unsubscribeMessages = listenMessages(docId); // ✅ ADD THIS
    Voice.unsubscribeRoom = listeners(docId);
    Voice.roomDeleteUnsub = watchRoomDeletion(docId);

    // 🔥 STEP 4: join voice
    await Joinvoicechannel(docId);

    // 🔥 STEP 5: show UI
    roomUI();

    // 🔥 STEP 6: show raise hand
    if (!Voice.isRoomAdmin) {
      document.getElementById("raiseHandBtn")?.classList.remove("hidden");
    }

    // 🔥 STEP 7: mark ready (LAST)
    Voice.isReady = true;

    // pause feed
    stopAllVideos?.();

  } catch (err) {
    console.error("joinRoom error:", err);
    Voice.isReady = false;
  }

  console.log("joinroom-Worked");
}


/******************************
         UI-FUNCTIONS
*******************************/

function showCreateUI(){
  
  createbtn.classList.add("hidden");
  container.classList.remove("hidden");
  Data.focus();



}

function hideCreateUI(){
  createbtn.classList.remove("hidden");
  container.classList.add
  ("hidden");
  
  if(Data.value){
    Data.value ="";
  }
}


function voicecard(docId, roomName, avatarUrl, createdBy) {

  const Container = document.getElementById("voice-card");
  if (!Container) return;

  const card = document.createElement("div");
  card.className = "voice-card";
  card.dataset.roomId = docId;

  card.innerHTML = `
    <div class="vc-left">
      <img class="vc-avatar"
           src="${avatarUrl || "default.png"}"
           loading="lazy"
           decoding="async"
           onerror="this.src='default.png'">
    </div>

    <div class="vc-right">
      <div class="vc-top">
        <div class="live-dot"></div>
        <span class="live-text">Live now</span>
        <i class="ri-group-fill">
          <span class="member-count">0</span>
        </i>
      </div>

      <p class="room-name">${roomName}</p>
      <button class="join-btn">Join</button>
    </div>
  `;

  Container.appendChild(card);

  // ⭐ JOIN
  card.querySelector(".join-btn")
    .addEventListener("click", () => joinRoom(docId));

  // ⭐ MEMBER COUNT (MODULAR + SAFE)
  const countEl = card.querySelector(".member-count");

  const unsubscribe = onSnapshot(
    collection(db, "rooms", docId, "users"),
    (snap) => {
      countEl.textContent = snap.size;
    }
  );

  // 🔥 STORE UNSUBSCRIBE (IMPORTANT)
  if (!Voice.cardListeners) Voice.cardListeners = [];
  Voice.cardListeners.push(unsubscribe);

  // ⭐ PROFILE CLICK
  if (createdBy) {
    card.querySelector(".vc-avatar")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        openProfile(createdBy);
      });
  }

  console.log("voice-card");
}


function roomUI() {
  document.getElementById("roomUI").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  document.querySelector(".nav-container").classList.add("hidden");
  
  const raiseBtn = document.getElementById("raiseHandBtn");

if (!Voice.isRoomAdmin) {
  raiseBtn.classList.remove("hidden");
} else {
  raiseBtn.classList.add("hidden");
}
  
  Voice.isMuted = true;
updateMicUI(true);
}


function showmessage(name, actionText, avatarUrl, type = "join") {

  const Msgcontainer = document.getElementById("room-messages");
  if (!Msgcontainer) return;

  const msg = document.createElement("div");
  msg.className = `room-msg ${type}`;

  msg.innerHTML = `
    <img src="${avatarUrl || "default.png"}" onerror="this.src='default.png'">
    <span><b>${name}</b> ${actionText}</span>
  `;

  Msgcontainer.appendChild(msg);

  // limit messages
  if (Msgcontainer.children.length > 3) {
    Msgcontainer.firstChild.remove();
  }

  // auto scroll
  Msgcontainer.scrollTop = Msgcontainer.scrollHeight;

  // auto remove
  setTimeout(() => {
    msg.style.animation = "msgExit 500ms ease forwards";
    setTimeout(() => msg.remove(), 500);
  }, 8000);
}


function resetUI() {
  document.getElementById("roomUI")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");
  document.querySelector(".nav-container")?.classList.remove("hidden");
}





/***********ROOM-DATA************/



async function ensureUserJoined(roomId) {

  //  capture stable userId
  const userId = Id.CURRENT_USER_ID;

  if (!roomId || !userId) {
    console.warn("Missing roomId or userId");
    return;
  }

  try {

    const userRef = doc(db, "rooms", roomId, "users", userId);

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile fetch error:", error);
      return;
    }

    //  fallback (important)
    const username = profile?.username || "User";
    const avatar = profile?.avatar_url || "default.png";

    await setDoc(userRef, {
      name: username,
      avatarUrl: avatar,
      role: "listener",
      joinedAt: serverTimestamp()
    }, { merge: true });

    console.log("User ensured in room ");

  } catch (err) {
    console.error("ensureUserJoined error:", err);
  }
}



async function roomData(docId) {

  try {

    const name = Id.CURRENT_USER?.username || "User";
    const avatarUrl = Id.CURRENT_USER?.avatar_url || null;

    await setDoc(
      doc(db, "rooms", docId, "users", Id.CURRENT_USER_ID), //  FIX
      {
        name,
        avatarUrl,
        role: "audience",
        joinedAt: serverTimestamp()
      },
      { merge: true }
    );

    console.log("room-Data");

  } catch (err) {
    console.error("roomData error:", err);
  }
}




async function raiseHand() {
  
  //block-if-no-log
  if(!Id.CURRENT_USER_ID){
    alert("login to message")
  } return;

  if (!Voice.currentRoomId) return;

  const userId = Id.CURRENT_USER_ID;

  if (!userId) {
    console.warn("User missing");
    return;
  }

  try {

    await setDoc(
      doc(db, "rooms", Voice.currentRoomId, "requests", userId),
      {
        name: Id.CURRENT_USER?.username || "User",
        avatarUrl: Id.CURRENT_USER?.avatar_url || "default.png",
        requestedAt: serverTimestamp()
      },
      { merge: true }
    );

    console.log("Hand raised ✋");

  } catch (e) {
    console.error("raiseHand error:", e);
  }
}



function listenForRequests(roomId) {

  //  cleanup old listener
  Voice.unsubscribeRequests?.();

  Voice.unsubscribeRequests = onSnapshot(
    collection(db, "rooms", roomId, "requests"),

    (snapshot) => {

      const panel = document.getElementById("requestPanel");
      if (!panel) return;

      panel.innerHTML = "";

      if (snapshot.empty) {
        panel.innerHTML = `<p class="no-requests">No requests</p>`;
        return;
      }

      snapshot.forEach((docSnap) => {

        const data = docSnap.data();
        const uid = docSnap.id;

        const item = document.createElement("div");
        item.className = "request-item";

        item.innerHTML = `
          <img src="${data.avatarUrl || 'default.png'}" />
          <span>${data.name || "User"}</span>
          <button class="approve">Accept</button>
        `;

        item.querySelector(".approve")
          .addEventListener("click", () => approveRequest(uid));

        panel.appendChild(item);
      });

    },

    (error) => {
      console.error("Request listener error:", error);
    }
  );

  console.log("Request listener started ");
}




async function approveRequest(uid) {

  const roomId = Voice.currentRoomId;

  if (!roomId || !uid) {
    console.warn("Invalid approve request data");
    return;
  }

  try {

    const userRef = doc(db, "rooms", roomId, "users", uid);

    //  check if user exists
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.warn("User not in room, skipping promote");
    } else {
      //  promote to speaker
      await updateDoc(userRef, { role: "speaker" });
    }

    //  remove request ALWAYS
    await deleteDoc(
      doc(db, "rooms", roomId, "requests", uid)
    );

    console.log("Approved ");

  } catch (e) {
    console.error("approveRequest error:", e);
  }
}


function listeners(docId) {

  console.log("listeners-Started");

  return onSnapshot(
    collection(db, "rooms", docId, "users"),
    (snapshot) => {

      snapshot.docChanges().forEach(change => {

        const data = change.doc.data();
        const id = change.doc.id;
        const avatar = data?.avatarUrl || "default.png";

        //  store UID WITH data
        if (change.type === "added") {
          participants.set(id, {
            uid: id,
            ...data
          });
        }

        if (change.type === "removed") {
          participants.delete(id);
        }

        //  join/leave messages (skip initial load)
        if (!Voice.initialLoad) {

          if (change.type === "added") {
            showmessage(data.name, "joined the room", avatar, "join");
          }

          if (change.type === "removed") {
            showmessage(data.name, "left the room", avatar, "leave");
          }
        }
      });

      // render UI
      renderParticipants(Array.from(participants.values()));

      //  mark initial load done
      Voice.initialLoad = false;
    }
  );
  console.log("Snapshot size:", snapshot.size);
 console.log("Message:", msg.text, msg.userId);
}



function renderParticipants(users) {

  const slots = document.querySelectorAll(".avatar");

  //  clear all
  slots.forEach(slot => {
    slot.innerHTML = "";
    slot.style.backgroundImage = "";
    slot.dataset.uid = "";
  });

  //  ORDER USERS (THIS IS THE NEW PART)

  const stageUsers = users.filter(
    u => u.role === "admin" || u.role === "speaker"
  );

  const audienceUsers = users.filter(
    u => !u.role || u.role === "audience"
  );

  const orderedUsers = [...stageUsers, ...audienceUsers];

  console.log("orderedUsers:", orderedUsers);

  // fill slots
  orderedUsers.forEach((user, index) => {

    if (index >= slots.length) return;

    const slot = slots[index];

    //  speaking detection mapping
    slot.dataset.uid = user.uid || user.id;

    if (user.avatarUrl) {
      slot.style.backgroundImage = `url(${user.avatarUrl})`;
      slot.style.backgroundSize = "cover";
      slot.style.backgroundPosition = "center";
    } else {
      slot.textContent = user.name?.[0] || "U";
    }
  });
}




function watchRoomDeletion(roomId) {

  return onSnapshot(
    doc(db, "rooms", roomId),
    async (docSnap) => {

      //  IMPORTANT: modular uses exists()
      if (!docSnap.exists()) {

        //  system message
        showmessage("System", "room ended", null, "leave");

        //  cleanup listeners
        Voice.unsubscribeRoom?.();
        Voice.roomDeleteUnsub?.();
        Voice.unsubscribeRequests?.();

        Voice.unsubscribeRoom = null;
        Voice.roomDeleteUnsub = null;
        Voice.unsubscribeRequests = null;

        try {
          //  remove self (optional)
          await deleteDoc(
            doc(db, "rooms", roomId, "users", CURRENT_USER_ID)
          );
        } catch (e) {
          // ignore if already deleted
        }

        //  reset UI
        setTimeout(() => {
          resetUI();
        }, 1500);
      }
    }
  );
}



async function leaveroom() {

  if (!Voice.currentRoomId) return;

  if (Voice.isLeaving) return;
  Voice.isLeaving = true;

  const roomId = Voice.currentRoomId;

  try {

    // SAFE Agora leave
    try {
      await leaveVoicechannel();
    } catch (e) {
      console.warn("Agora leave failed:", e);
    }

    // show message
    showmessage("You", "left the room", null, "leave");
    
    const currentId = Id.CURRENT_USER_ID

    // SAFE Firestore delete
    if (currentId) {
      await deleteDoc(
        doc(db, "rooms", roomId, "users", currentId)
      );
    } else {
      console.warn("User ID missing during leave");
    }

  } catch (err) {
    console.error("leaveRoom error:", err);
  }

  //  ALWAYS CLEANUP (even if error)
  try {
    Voice.unsubscribeRoom?.();
    Voice.roomDeleteUnsub?.();
    Voice.unsubscribeRequests?.();
    Voice.unsubscribeMessages?.();
  } catch (e) {
    console.warn("Unsub error:", e);
  }

  Voice.unsubscribeRoom = null;
  Voice.roomDeleteUnsub = null;
  Voice.unsubscribeRequests = null;
  Voice.unsubscribeMessages = null;

  //  card listeners
  if (Voice.cardListeners) {
    Voice.cardListeners.forEach(unsub => {
      try { unsub(); } catch {}
    });
    Voice.cardListeners = [];
  }

  //  RESET STATE
  Voice.currentRoomId = null;
  Voice.isRoomAdmin = false;
  Voice.isLeaving = false;

  //  CLEAR UI
  document.getElementById("room-messages")?.replaceChildren();
  document.getElementById("requestPanel")?.replaceChildren();

  //  CLEAR MEMORY
  participants.clear();

  Voice.initialLoad = true;
  Voice.roomEnded = false;

  //  UI reset
  setTimeout(() => {
    resetUI();
  }, 500);

  console.log("users-left");
}


async function adminLeaveRoom(roomId) {

  if (!roomId) return;

  try {

    //prevent double execution
    if (Voice.isLeaving) return;
    Voice.isLeaving = true;

    // leave voice FIRST
    await leaveVoicechannel();

    //  UX message
    showmessage("You", "ended the room", null, "leave");

    const roomRef = doc(db, "rooms", roomId);

    //  get collections
    const usersSnap = await getDocs(
      collection(db, "rooms", roomId, "users")
    );

    const requestsSnap = await getDocs(
      collection(db, "rooms", roomId, "requests")
    );

    const messagesSnap = await getDocs(
      collection(db, "rooms", roomId, "messages")
    );

    // batch delete
    const batch = writeBatch(db);

    usersSnap.forEach(d => batch.delete(d.ref));
    requestsSnap.forEach(d => batch.delete(d.ref));
    messagesSnap.forEach(d => batch.delete(d.ref));

    batch.delete(roomRef);

    await batch.commit();

    console.log("Room deleted successfully");

  } catch (err) {
    console.error("adminLeaveRoom error:", err);
    return; //  stop cleanup if failed
  }

  // CLEANUP LISTENERS
  Voice.unsubscribeRoom?.();
  Voice.roomDeleteUnsub?.();
  Voice.unsubscribeRequests?.();
  Voice.unsubscribeMessages?.();

  Voice.unsubscribeRoom = null;
  Voice.roomDeleteUnsub = null;
  Voice.unsubscribeRequests = null;
  Voice.unsubscribeMessages = null;

  //  CLEAN CARD LISTENERS
  if (Voice.cardListeners) {
    Voice.cardListeners.forEach(unsub => unsub());
    Voice.cardListeners = [];
  }

  //  RESET STATE
  Voice.currentRoomId = null;
  Voice.isRoomAdmin = false;
  Voice.isLeaving = false;

  //  CLEAR UI (SAFE)
  const msgEl = document.getElementById("room-messages");
  const reqEl = document.getElementById("requestPanel");

  if (msgEl) msgEl.innerHTML = "";
  if (reqEl) reqEl.innerHTML = "";

  //  CLEAR MEMORY
  participants.clear();

  Voice.initialLoad = true;
  Voice.roomEnded = false;

  //  RESET UI
  setTimeout(() => {
    resetUI();
  }, 800);

  console.log("admin-left");
}


 /***** CHAT-SYSTEM ******/
 
 document.getElementById("sendChatBtn")
?.addEventListener("click", () => {

  const input = document.getElementById("chatInput");
  const text = input.value;

  sendMessage(Voice.currentRoomId, text);

  input.value = "";
});
 
 
 
 



async function sendMessage(roomId, text) {
  
  //Guard
  if (!Voice.isReady) {
  console.log("User not ready yet");
  return;
}

  if (!text || !text.trim()) return;

  try {

    let username = Cache.currentUsername;

    if (!username) {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("username")
        .eq("id", Id.CURRENT_USER_ID)
        .single();

      if (error) {
        console.error("Profile fetch error:", error);
      }

      username = data?.username || "User";
      Cache.currentUsername = username;
    }

    const messageData = {
      text: text.trim(),
      userId: Id.CURRENT_USER_ID,
      username,
      createdAt: serverTimestamp(),   // server time
      clientTime: Date.now()          //  instant fallback
    };

    //  SEND
    await addDoc(
      collection(db, "rooms", roomId, "messages"),
      messageData
    );

  } catch (err) {
    console.error("Send message error:", err);
  }
}






function listenMessages(roomId) {

  const q = query(
    collection(db, "rooms", roomId, "messages"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {

    const container = document.getElementById("room-messages");
    if (!container) return;

    container.innerHTML = "";

    snapshot.forEach(doc => {
      const msg = doc.data();
      renderMessage(msg);
    });

    container.scrollTop = container.scrollHeight;

  });
}




function renderMessage(msg) {

  const container = document.getElementById("room-messages");
  if (!container) return;

  // CHECK BEFORE ADDING MESSAGE
  const isAtBottom =
    container.scrollTop + container.clientHeight >= container.scrollHeight - 50;

  // SAFE DATA
  const username = msg?.username || "User";
  const text = msg?.text || "";

  const div = document.createElement("div");
  div.className = "chat-item";
  

  const isMe = msg?.userId === Id.CURRENT_USER_ID;
  if (isMe) div.classList.add("me");

  div.innerHTML = `
    <span class="chat-username ${isMe ? "me" : ""}">
      ${username}
    </span>:
    <span class="chat-text">${text}</span>
  `;

  container.appendChild(div);
  
  


  //  SCROLL ONLY IF USER IS AT BOTTOM
  if (isAtBottom) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth"
    });
  }
    
  console.log("MSG DATA:", msg);
}



/***** VOICE ROOM HELPERS *****/



//exit-Logic
const exitBtn = document.getElementById("close");
exitBtn?.addEventListener("click", () => {

  // ⭐ if admin → end room
  if (Voice.isRoomAdmin) {
    adminLeaveRoom(Voice.currentRoomId);
    console.log("exit-Clicked")
  } 
  // ⭐ else → normal leave
  else {
    leaveroom();
  }

});

//handle-loader.
async function handleConfirm() {

  try {

    showLoader("Creating...");

    await createRoom();

  } catch (err) {

    console.error("Create room error:", err);

  } finally {

    hideLoader();   // ⭐ always hide even if error
  }
}

//Loader-function.
function showLoader(text = "Loading...") {

  const loader = document.getElementById("loader");
  const btntext = document.querySelector(".btn-text")

  if (!loader) return;   // safety check

  loader.textContent = text;
  loader.classList.remove("hidden");
  btntext.classList.add("hidden")
}

function hideLoader() {

  const loader = document.getElementById("loader");
  const btntext = document.querySelector(".btn-text")


  if (!loader) return;

  loader.classList.add("hidden");
  btntext.classList.remove("hidden");
}



 /**Leave-modal**/

function showLeaveModal() {
  document.getElementById("leaveModal").classList.remove("hidden");
}

function hideLeaveModal() {
  const modal = document.getElementById("leaveModal")
  
  if(modal){modal.classList.add("hidden");
  }
  
  
}


window.addEventListener("popstate", () => {

  if (!Voice.currentRoomId) return;

  showLeaveModal();

  // prevent navigation
  history.pushState(null, "");
  console.log("modal-showed")
});


document.getElementById("cancelLeave")
?.addEventListener("click", () => {
  hideLeaveModal();
});

 const Confirmleave = document.getElementById("confirmLeave")
 
 Confirmleave?.addEventListener("click", () => {
  exitRoom();
  console.log("exit-room")
});



async function exitRoom() {

  if (!Voice.currentRoomId) return;

  if (Voice.isRoomAdmin) {
    await adminLeaveRoom(Voice.currentRoomId); // DB + Agora
  } else {
    await leaveroom();        // DB + Agora
  }

  // 🔥 KEEP THIS (VERY IMPORTANT)
  Voice.currentRoomId = null;
  Voice.isRoomAdmin = false;

  Voice.unsubscribeRoom?.();
  Voice.roomDeleteUnsub?.();

  Voice.unsubscribeRoom = null;
  Voice.roomDeleteUnsub = null;
  
  hideLeaveModal();

  navigate("flashcards");
}


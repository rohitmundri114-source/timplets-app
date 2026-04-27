console.log("agora-Starting")


import { Id,Voice } from "../js/state.js";



console.log("AgoraRTC:", window.AgoraRTC);

/***********************
    INIT UI (SAFE)
***********************/
document.addEventListener("DOMContentLoaded", () => {
  initAgoraUI();
});

export function initAgoraUI() {

  const micBtn = document.getElementById("micBtn");

  if (!micBtn) {
    console.warn("micBtn not found");
    return;
  }

  // prevent duplicate listeners
  micBtn.replaceWith(micBtn.cloneNode(true));

  const newBtn = document.getElementById("micBtn");

  newBtn.addEventListener("click", toggleMute);
}


/***********************
    GLOBAL STATE
***********************/
const APP_ID = "c0aaefec9bad469eaa9f3d5562bf8dc0"; 

let client = null;
let localAudioTrack = null;
 let isMuted = Voice.isMuted;


/***********************
    JOIN CHANNEL
***********************/
export async function Joinvoicechannel(docId) {

  if (!window.AgoraRTC) {
    console.error("Agora SDK not loaded ");
    return;
  }

  try {

    if (!client) {
      client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    }

    // speaking detection
    client.enableAudioVolumeIndicator();

    client.on("volume-indicator", (volumes) => {
      volumes.forEach(v => {
        const speaking = v.level > 3;
        updateSpeakingUI(v.uid, speaking);
      });
    });

    // remote audio
    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") {
        user.audioTrack.play();
      }
    });

    const channel = getSafeChannelName(docId);

    await client.join(APP_ID, channel, null, Id.CURRENT_USER_ID);

    console.log("Joined Agora:", channel);

  } catch (err) {
    console.error("Join error:", err);
  }
}


/***********************
    SAFE CHANNEL NAME
***********************/
function getSafeChannelName(roomId) {
  return roomId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
}


/***********************
    SPEAKING UI
***********************/
function updateSpeakingUI(uid, speaking) {

  const slot = document.querySelector(`.avatar[data-uid="${uid}"]`);
  if (!slot) return;

  slot.classList.toggle("speaking", speaking);
}


/***********************
    LEAVE CHANNEL
***********************/
export async function leaveVoicechannel() {
  
  
  
  try {

    if (client && localAudioTrack) {
      await client.unpublish([localAudioTrack]);
    }

    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
      localAudioTrack = null;
    }

    if (client) {
      await client.leave();
      client = null;
    }

    console.log("Left Agora");

  } catch (err) {
    console.error("Leave error:", err);
  }
  
  if (Voice.chatUnsub) {
  Voice.chatUnsub();
  Voice.chatUnsub = null;
}
}


/***********************
    TOGGLE MIC
***********************/
async function toggleMute() {

  if (!client) {
    console.warn("Join voice room first");
    return;
  }

  try {

    // first time → create mic
    if (!localAudioTrack) {

      localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();

      await client.publish([localAudioTrack]);

      isMuted = false;

      updateMicUI(false);

      console.log("Mic started");
      return;
    }

    // toggle
    isMuted = !isMuted;

    await localAudioTrack.setEnabled(!isMuted);

    updateMicUI(isMuted);

    console.log("Mic toggled:", isMuted);

  } catch (err) {
    console.error("Mic error:", err);
  }
}


/***********************
    MIC UI
***********************/
export function updateMicUI(muted) {

  const btn = document.getElementById("micBtn");
  const icon = document.getElementById("micIcon");

  if (!btn || !icon) return;

  if (muted) {
    btn.classList.add("muted");
    icon.className = "ri-mic-off-line";
  } else {
    btn.classList.remove("muted");
    icon.className = "ri-mic-line";
  }
}
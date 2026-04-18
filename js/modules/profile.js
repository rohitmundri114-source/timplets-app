import { navigate } from "../router.js";
import { Cache, Id } from "../state.js";
import { supabaseClient } from "../../services/supabase.js";
import { logout } from "../../services/auth.js";
import { openFeedAtVideo } from "./videofeed.js";
import { stopAllVideos } from "../../helper/Syncuser.js";

console.log("profile loading")

export function initProfile(){
  
  
  document.addEventListener("click", async (e) => {

  if (e.target.id === "logoutBtn") {

    console.log("Logout clicked");

    await logout();
  }

});
  
  
  
  document.getElementById("exitProfileBtn")
    .addEventListener("click", () => {
      navigate("flashcards");
  });
  
  
  
  document.getElementById("editProfileBtn").addEventListener("click", () => {
   openEditProfile();
 });





//Close-Edit.
document.getElementById("exitEditProfile").addEventListener("click", () => {
  navigate("profile")
});

}


 


export async function openProfile(userId) {
  
delete Cache.profilePostsCache[userId];

 if(stopAllVideos()){
   console.log("videos-stoped")
 }
 
  navigate("profile");

  // 🔴 INIT CACHE
  Cache.profileCache = Cache.profileCache || {};
  
  Cache.profilePostsCache = Cache.profilePostsCache || {};

  const key = String(userId);

  let profile;
  let posts;

  const editBtn = document.getElementById("editProfileBtn");
  const followBtn = document.getElementById("follow-btn");

  // 🔴 BUTTON VISIBILITY
  if (editBtn && followBtn) {
    if (userId === Id.CURRENT_USER_ID) {
      editBtn.style.display = "block";
      followBtn.style.display = "none";
    } else {
      editBtn.style.display = "none";
      followBtn.style.display = "block";
    }
  }

  /* =========================
        1️⃣ PROFILE
  ========================= */

  if (Cache.profileCache[key]) {
    profile = Cache.profileCache[key];
  } else {

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile fetch error:", error);
      return;
    }

    profile = data;
    Cache.profileCache[key] = data;
  }

  // 🔴 SAFE DOM UPDATE
  const avatarEl = document.getElementById("profileAvatar");
  const usernameEl = document.getElementById("profileUsername");
  const bioEl = document.getElementById("User-Bio");

  if (avatarEl) avatarEl.src = profile?.avatar_url || "default.png";
  if (usernameEl) usernameEl.textContent = profile?.username || "User";
  if (bioEl) bioEl.textContent = profile?.bio || "";

  /* =========================
        2️⃣ POSTS
  ========================= */

  if (Cache.profilePostsCache[key]) {
    posts = Cache.profilePostsCache[key];
  } else {

    const { data, error } = await supabaseClient
      .from("video_posts")
      .select("id, video_url, thumbnail_url, views")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Posts fetch error:", error);
      return;
    }

    posts = data || []; // 🔥 IMPORTANT FIX
    Cache.profilePostsCache[key] = posts;
  }

  console.log("Posts:", posts); // 🔥 DEBUG

  renderProfileVideos(posts);

  /* =========================
        3️⃣ STATS
  ========================= */

  const postCount = posts.length;
  const viewCount = posts.reduce((sum, p) => sum + (p.views || 0), 0);

  const postCountEl = document.getElementById("postCount");
  const viewCountEl = document.getElementById("viewCount");

  if (postCountEl) postCountEl.textContent = postCount;
  if (viewCountEl) viewCountEl.textContent = viewCount;

  /* =========================
        4️⃣ FOLLOWERS
  ========================= */

  const { count } = await supabaseClient
    .from("followers")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);

  const followerEl = document.getElementById("followerCount");
  if (followerEl) followerEl.textContent = count || 0;

  // 🔥 SET DATASET BEFORE CHECK
  if (followBtn) {
    followBtn.dataset.profileId = String(userId);
  }

  await checkFollowState(userId);
  console.log("openprofile")
}







//checking-follow-state.
/*
 async function checkFollowState(profileId) {

  const { data } = await supabaseClient
    .from("followers")
    .select("*")
    .eq("follower_id",
    Id.CURRENT_USER_ID)
    .eq("following_id", profileId)
    .maybeSingle();

  const btn = document.getElementById("follow-btn");

  if (data) {
    btn.textContent = "Following";
    btn.dataset.following = "true";
  } else {
    btn.textContent = "Follow";
    btn.dataset.following = "false";
  }
}*/

async function checkFollowState(profileId) {

  Cache.followCache = Cache.followCache || {};

  const btn = document.getElementById("follow-btn");
  if (!btn) return;

  // CACHE
  if (Cache.followCache[profileId] !== undefined) {

    const isFollowing = Cache.followCache[profileId];

    btn.textContent = isFollowing ? "Following" : "Follow";
    btn.dataset.following = isFollowing ? "true" : "false";

    return;
  }

  // DB
  const { data, error } = await supabaseClient
    .from("followers")
    .select("*")
    .eq("follower_id", Id.CURRENT_USER_ID)
    .eq("following_id", profileId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  const isFollowing = !!data;

  // UI
  btn.textContent = isFollowing ? "Following" : "Follow";
  btn.dataset.following = isFollowing ? "true" : "false";

  // CACHE SAVE
  Cache.followCache[profileId] = isFollowing;
}




//toggle-follow-BTN.

document.getElementById("follow-btn")
?.addEventListener("click", async () => {

  const btn = document.getElementById("follow-btn");
  if (!btn) return;

  const profileId = btn.dataset.profileId;
  if (!profileId) return;

  const isFollowing = btn.dataset.following === "true";

  console.log("dataset:", btn.dataset);

  const countEl = document.getElementById("followerCount");
  if (!countEl) return;

  let count = parseInt(countEl.innerText) || 0;

  btn.style.pointerEvents = "none";

  try {

    if (isFollowing) {

      await supabaseClient
        .from("followers")
        .delete()
        .eq("follower_id", Id.CURRENT_USER_ID)
        .eq("following_id", profileId);

      btn.textContent = "Follow";
      btn.dataset.following = "false";
      countEl.innerText = Math.max(0, count - 1);

      Cache.followCache[profileId] = false;

    } else {

      await supabaseClient
        .from("followers")
        .insert({
          follower_id: Id.CURRENT_USER_ID,
          following_id: profileId
        });

      btn.textContent = "Following";
      btn.dataset.following = "true";
      countEl.innerText = count + 1;

      Cache.followCache[profileId] = true;
    }

  } catch (err) {

    console.error(err);

    // revert UI
    btn.dataset.following = isFollowing ? "true" : "false";
    btn.textContent = isFollowing ? "Following" : "Follow";
    countEl.innerText = count;
  }

  btn.style.pointerEvents = "auto";
});


/*
document.getElementById("follow-btn").addEventListener("click", async () => {

  const btn = document.getElementById("follow-btn");
  const profileId = btn.dataset.profileId;
  const isFollowing = btn.dataset.following === "true";

  if (isFollowing) {

    // UNFOLLOW
    await supabaseClient
      .from("followers")
      .delete()
      .eq("follower_id",
      Id.CURRENT_USER_ID)
      .eq("following_id", profileId);

    btn.textContent = "Follow";
    btn.dataset.following = "false";

  } else {

    // FOLLOW
    await supabaseClient
      .from("followers")
      .insert({
        follower_id: 
        Id.CURRENT_USER_ID,
        following_id: profileId
      });

    btn.textContent = "Following";
    btn.dataset.following = "true";
  }

  // refresh follower count
  updateFollowerCount(profileId);

});*/

//render-Profile



function renderProfileVideos(posts) {

  if (!Array.isArray(posts) || posts.length === 0) return;

  const container = document.getElementById("profileVideo-cnt");
  if (!container) return;

  container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  posts.slice(0, 12).forEach(post => {

    if (!post?.id || !post?.video_url) return;

    const tile = document.createElement("div");
    tile.className = "profile-tile";
    tile.dataset.videoId = String(post.id);

    const video = document.createElement("video");
    video.src = post.video_url;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "metadata";

    tile.addEventListener("touchstart", () => {
      video.play().catch(()=>{});
    }, { passive: true });

    tile.addEventListener("touchend", () => {
      video.pause();
    });

    tile.addEventListener("mouseenter", () => video.play());
    tile.addEventListener("mouseleave", () => video.pause());

    const overlay = document.createElement("div");
    overlay.className = "profile-overlay";
    overlay.innerHTML = `<i class="ri-play-fill"></i>`;

    overlay.addEventListener("click", (e) => {
      e.stopPropagation()
      openFeedAtVideo(post.id);  
    });

    tile.append(video, overlay);
    fragment.appendChild(tile);
  });

  container.appendChild(fragment);
}





//Open-Feed-At-Video
/*function openFeedAtVideo(videoId) {

  if (!videoId) return;

  navigate("flashcards");

  let tries = 0;

  const interval = setInterval(() => {

    try {

      const safeId = CSS.escape(String(videoId));

      const target = document.querySelector(
        `.short[data-video-id="${safeId}"]`
      );

      if (target) {
        clearInterval(interval);

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }

    } catch (err) {
      console.error("Selector error:", err);
      clearInterval(interval);
    }

    if (++tries > 20) {
      clearInterval(interval);
      console.log("Video not found");
    }

  }, 200);
  console.log("Feed-at-video")
}*/







//Open-Edit-Profile.
export async function openEditProfile() {

  navigate("edit-profile");

  const avatar = document.getElementById("editAvatarPreview");
  const usernameEl = document.getElementById("editUsername");
  const bioEl = document.getElementById("editBio");

  if (usernameEl) usernameEl.value = "Loading...";

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", Id.CURRENT_USER_ID)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (!data) return;

  if (avatar) avatar.src = data.avatar_url || "default.png";
  if (usernameEl) usernameEl.value = data.username || "";
  if (bioEl) bioEl.value = data.bio || "";
}







//Open-Edit-Profile.

 //1.Avatar-Change.
const avatarInput = document.getElementById("avatarInput");



//change-avatar-btn.
document.getElementById("changeAvatarBtn")?.addEventListener("click", () => {
  avatarInput.click();
});

 if (avatarInput) {
  avatarInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const preview = document.getElementById("editAvatarPreview");

    if (preview) {
      const url = URL.createObjectURL(file);
      preview.src = url;

      preview.onload = () => URL.revokeObjectURL(url);
    }
  });
}






 //Saving-edits.
document.getElementById("saveProfileBtn")
?.addEventListener("click", async () => {

  const btn = document.getElementById("saveProfileBtn");

  const username = document.getElementById("editUsername")?.value.trim();
  const bio = document.getElementById("editBio")?.value.trim();
  const avatarFile = avatarInput?.files[0];

  if (!username) {
    alert("Username required");
    return;
  }

  let avatarUrl;

  btn.textContent = "Saving...";
  btn.disabled = true;

  try {

    // VALIDATION
    if (avatarFile && !avatarFile.type.startsWith("image/")) {
      alert("Upload valid image");
      return;
    }

    // UPLOAD
    if (avatarFile) {

      const fileName = `${Date.now()}_${avatarFile.name}`;

      const { error: uploadError } =
        await supabaseClient.storage
          .from("avatars")
          .upload(fileName, avatarFile);

      if (uploadError) throw uploadError;

      const { data } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(fileName);

      avatarUrl = data.publicUrl;
    }

    // UPDATE DB
    const { error } = await supabaseClient
      .from("profiles")
      .update({
        username,
        bio,
        ...(avatarUrl && { avatar_url: avatarUrl })
      })
      .eq("id", Id.CURRENT_USER_ID);

    if (error) throw error;

    alert("Profile updated ");

    // CLEAR CACHE
    delete Cache.profileCache[Id.CURRENT_USER_ID];
    delete Cache.profilePostsCache[Id.CURRENT_USER_ID];

    openProfile(Id.CURRENT_USER_ID);

  } catch (err) {

    console.error(err);
    alert("Update failed");

  }

  btn.textContent = "Save";
  btn.disabled = false;
});


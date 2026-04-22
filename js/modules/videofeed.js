import { Cache, Id } from "../state.js";    
import {navigate} from "../router.js";
import { openProfile } from "./profile.js";           
import { supabaseClient } from "../../services/supabase.js";
import { requireAuth, stopAllVideos } from "../../helper/Syncuser.js";

console.log("videofeed module loaded");

let container;
let sentinel;
let isMuted = true;
const Dev = true;
let PAGE_SIZE = 5;
let page = 0;
let isLoading = false;
let hasMore = true;
const viewedVideos = new Set();

/***********************
    INIT VIDEO FEED
***********************/

export function initVideoFeed() {

  container = document.getElementById("video-container");

  if (!container) {
    console.warn("video container missing");
    return;
  }

  setupObservers();

  createSentinel();

  if (Cache.feedCache.length > 0) {
    renderVideos(Cache.feedCache);
  } else {
    loadVideoFeed();
  }

}


/***********************
     SENTINEL
***********************/

function createSentinel(){

  sentinel = document.getElementById("scroll-sentinel");

  if(!sentinel){

    sentinel = document.createElement("div");
    sentinel.id = "scroll-sentinel";
    sentinel.style.height = "1px";

    container.appendChild(sentinel);

  }

  infiniteObserver.observe(sentinel);

}


/***********************
     LOAD VIDEOS
***********************/


 async function loadVideoFeed(){
  
  if(Dev) return;

  if(isLoading || !hasMore) return;

  isLoading = true;

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: posts, error } = await supabaseClient
    .from("video_posts")
    .select(`
      id,
      user_id,
      video_url,
      caption,
      views,
      profiles(username, avatar_url)
    `)
    .order("created_at",{ascending:false})
    .range(from,to);

  if(error){
    console.error("Feed error:", error);
    isLoading = false;
    return;
  }

  if(!posts || posts.length === 0){
    isLoading = false;
    return;
  }

  /* --------------------------------
      Collect video IDs
  -------------------------------- */

  const videoIds = posts.map(p => p.id);

  /* --------------------------------
      Fetch like counts
  -------------------------------- */

  const { data: likeCounts } = await supabaseClient
    .from("likes")
    .select("post_id")
    .in("post_id", videoIds);

  /* --------------------------------
      Fetch comment counts
  -------------------------------- */

  const { data: commentCounts } =  await supabaseClient
     .from("comments")
     .select("post_id")
     .in("post_id", videoIds)
     .is("parent_id", null);

  /* --------------------------------
      Fetch user likes
  -------------------------------- */

  const { data: userLikes } = await supabaseClient
    .from("likes")
    .select("post_id")
    .eq("user_id", Id.CURRENT_USER_ID)
    .in("post_id", videoIds);

  /* --------------------------------
      Build lookup maps
  -------------------------------- */

  const likeMap = {};
  const commentMap = {};
  const likedSet = new Set();

  likeCounts?.forEach(l => {
    likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1;
  });

  commentCounts?.forEach(c => {
    commentMap[c.post_id] = (commentMap[c.post_id] || 0) + 1;
  });

  userLikes?.forEach(l => likedSet.add(l.post_id));

  /* --------------------------------
      Attach data to posts
  -------------------------------- */

  posts.forEach(post => {

    post.likeCount = likeMap[post.id] || 0;
    post.commentCount = commentMap[post.id] || 0;
    post.isLiked = likedSet.has(post.id);

  });

  /* --------------------------------
      Cache + render
  -------------------------------- */
  console.log("POSTS:", posts);

  Cache.feedCache.push(...posts);

  renderVideos(posts);

  if(posts.length < PAGE_SIZE){
    hasMore = false;
  }

  page++;
  isLoading = false;

}


/***********************
     RENDER VIDEOS
***********************/




 function renderVideos(posts){

  const Videocontainer = document.getElementById("video-container");

  posts.forEach(post => {

    const wrapper = document.createElement("div");
    wrapper.className = "short";
    wrapper.dataset.videoId = post.id;

    /* ================= VIDEO ================= */

    const video = document.createElement("video");
    video.src = post.video_url;
    video.muted = true; // MUST for autoplay
    video.autoplay = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "metadata";

    /* ================= ACTIONS ================= */

    const actions = document.createElement("div");
    actions.className = "video-actions";

    actions.innerHTML = `
      <div class="sound-icon">
      <i class="ri-volume-mute-fill"></i></div>

      <button class="action-btn like-btn" data-id="${post.id}">
        <i class="ri-heart-line"></i>
        <span class="like-count">${post.likeCount || 0}</span>
      </button>

      <button class="action-btn comment-btn" data-id="${post.id}">
        <i class="ri-chat-3-line"></i>
        <span class="comment-count">${post.commentCount || 0}</span>
      </button>

      <button class="action-btn share-btn">
        <i class="ri-share-forward-line"></i>
      </button>
    `;

    /* ================= BOTTOM USER INFO ================= */

    const bottomInfo = document.createElement("div");
    bottomInfo.className = "video-bottom-info";

    bottomInfo.innerHTML = `
      <div class="user-row">
        <img class="user-avatar clickable-avatar"
        src="${post.profiles?.avatar_url || 'default.png'}"
        loading="lazy">

        <span class="username">
          ${post.profiles?.username || "user"}
        </span>
      </div>

      <div class="video-caption">
        ${post.caption || ""}
      </div>
    `;

    /* ================= APPEND ================= */

    wrapper.append(video, actions, bottomInfo);
    Videocontainer.insertBefore(wrapper, sentinel);

    console.log("VIDEO URL:", post.video_url);

    /* ================= SOUND CONTROL ================= */

const soundIcon = wrapper.querySelector(".sound-icon");

// set initial state
video.muted = isMuted;

//  show icon ONLY when muted
soundIcon.style.display = isMuted ? "block" : "none";

// reusable function
function updateSoundUI() {

  // update all videos
  document.querySelectorAll("video").forEach(v => {
    v.muted = isMuted;
  });

  //  show/hide icon (NO emoji, keep icon clean)
  document.querySelectorAll(".sound-icon").forEach(icon => {
    icon.style.display = isMuted ? "block" : "none";
  });
}

// click on video → toggle sound
video.addEventListener("click", () => {
  isMuted = !isMuted;
  updateSoundUI();
});

// click on icon → toggle sound
soundIcon.addEventListener("click", (e) => {
  e.stopPropagation();
  isMuted = !isMuted;
  updateSoundUI();
});

    /* ================= LIKE STATE ================= */

    const likeBtn = wrapper.querySelector(".like-btn");
    const icon = likeBtn.querySelector("i");

    if(post.isLiked){
      likeBtn.classList.add("liked");
      icon.classList.replace("ri-heart-line","ri-heart-fill");
      icon.style.color = "#ff3b5c";
    }

    /* ================= VIDEO OBSERVER ================= */

    videoObserver?.observe(video);

    /* ================= PROFILE OPEN ================= */

    wrapper.querySelector(".clickable-avatar")
    .addEventListener("click", () => {
      openProfile(post.user_id);
    });

  });

  trimOldVideos();

  console.log("renderVideos working");
}

 function updateSoundUI() {
  document.querySelectorAll("video").forEach(v => {
    v.muted = isMuted;
  });

  //  show icon ONLY when muted
  document.querySelectorAll(".sound-icon").forEach(icon => {
    icon.style.display = isMuted ? "block" : "none";
  });
}


 export function restartObserver() {

  if (!videoObserver) return;

  document.querySelectorAll("video").forEach(video => {
    videoObserver.unobserve(video); // reset
    videoObserver.observe(video);   // re-trigger
  });

  console.log("Observer restarted ");
}



/***********************
    VIDEO OBSERVER
***********************/



let videoObserver = null;


function setupObservers(){

  videoObserver = new IntersectionObserver(entries => {

    entries.forEach(entry => {

      const video = entry.target;

      const wrapper = video.closest(".short");
      if (!wrapper) return;

      const videoId = wrapper.dataset.videoId;

      if(entry.isIntersecting && entry.intersectionRatio > 0.6){

        if(!viewedVideos.has(videoId)){
          viewedVideos.add(videoId);

          if (typeof recordView === "function") {
            recordView(videoId);
          }
        }

        video.play().catch(()=>{});

        if (typeof preloadNextVideo === "function") {
          preloadNextVideo(video);
        }

      } else {
        video.pause();
      }

    });

  }, { threshold: 0.6 });

}


/***********************
    PRELOAD NEXT VIDEO
***********************/

function preloadNextVideo(currentVideo){

  const nextWrapper =
  currentVideo.closest(".short")?.nextElementSibling;

  if(!nextWrapper) return;

  const nextVideo = nextWrapper.querySelector("video");

  if(nextVideo && nextVideo.preload !== "auto"){

    nextVideo.preload = "auto";

  }

}


/***********************
     INFINITE SCROLL
***********************/

const infiniteObserver =
new IntersectionObserver(entries=>{

  if(entries[0].isIntersecting){

    loadVideoFeed();

  }

},{threshold:1});


/***********************
      RECORD VIEW
***********************/

async function recordView(videoId){

  try{

    await supabaseClient.rpc("increment_view",{
      video_id: videoId
    });

  }catch(err){

    console.error("view error:",err);

  }

}


/***********************
      TRIM VIDEOS
***********************/

function trimOldVideos(){

  const videos = document.querySelectorAll(".short");

  if(videos.length <= 8) return;

  const removeCount = videos.length - 8;

  for(let i=0;i<removeCount;i++){

    videos[i].remove();

  }
  console.log("videos-trimd")

}

/*
export function openFeedAtVideo(videoId) 
 export function openFeedAtVideo(videoId) {

  // 1️⃣ Navigate back to feed
  navigate("flashcards");   // your feed page id

  // 2️⃣ Wait for DOM paint
  setTimeout(() => {

    const target = document.querySelector(
      `.short[data-video-id="${videoId}"]`
    );

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } else {
      console.log("Video not loaded yet");
    }

  }, 300);
}
*/



 export function openFeedAtVideo(videoId) {

  // 1️⃣ Navigate to feed
  navigate("flashcards");

  // 2️⃣ Wait for DOM render
  setTimeout(() => {

    const target = document.querySelector(
      `.short[data-video-id="${CSS.escape(String(videoId))}"]`
    );

    if (!target) {
      console.log("Video not loaded yet");
      return;
    }

    //  Scroll to video
    target.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    //  IMPORTANT: force play
    const video = target.querySelector("video");

    if (video) {

      // pause all others
      document.querySelectorAll("video").forEach(v => v.pause());

      video.muted = isMuted; // keep your mute state
      video.play().catch(() => {});

    }

  }, 400); // slightly more safe than 300

}




/*******************************
         LIKES-LOGIC
*******************************/


// toggle-like
document.addEventListener("click", async (e) => {

  const btn = e.target.closest(".like-btn");
  if (!btn) return;
  
  //if-not-log-in
  if(!requireAuth()) return 

  const postId = btn.dataset.id;
  const icon = btn.querySelector("i");
  const countSpan = btn.querySelector(".like-count");

  let count = parseInt(countSpan.innerText) || 0;

  // prevent spam clicks
  btn.style.pointerEvents = "none";

  try {

    const isLiked = btn.classList.contains("liked");

    console.log("USER ID:", Id.CURRENT_USER_ID);

    if (!isLiked) {

      // ✅ LIKE
      const { error } = await supabaseClient
        .from("likes")
        .insert({
          post_id: postId,
          user_id: Id.CURRENT_USER_ID
        });

      if (error) {
        console.error("LIKE INSERT ERROR:", error);
        throw error;
      }

      // 🔥 UI update (only after success)
      btn.classList.add("liked");
      icon.classList.replace("ri-heart-line", "ri-heart-fill");
      icon.style.color = "#ff3b5c";
      countSpan.innerText = count + 1;

      heartBurst(btn);

    } else {

      // ✅ UNLIKE
      const { error } = await supabaseClient
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", Id.CURRENT_USER_ID);

      if (error) {
        console.error("UNLIKE ERROR:", error);
        throw error;
      }

      // 🔥 UI update
      btn.classList.remove("liked");
      icon.classList.replace("ri-heart-fill", "ri-heart-line");
      icon.style.color = "white";
      countSpan.innerText = Math.max(0, count - 1);
    }

  } catch (err) {
    console.error("Like system error:", err);
  }

  btn.style.pointerEvents = "auto";
});




//like-tap.

let lastTapMap = new Map();
let lastTouchTime = 0;

/* =========================
   SHARED HANDLER
========================= */

function handleDoubleTap(e) {

  const video = e.target.closest("video");
  if (!video) return;

  const wrapper = video.closest(".short");
  if (!wrapper) return;

  const videoId = wrapper.dataset.videoId;
  const now = Date.now();

  const lastTap = lastTapMap.get(videoId) || 0;

  if (now - lastTap < 300) {

    const btn = wrapper.querySelector(".like-btn");

    if (btn && !btn.classList.contains("liked")) {
      btn.click();
      showBigHeart(wrapper);
    }
  }

  lastTapMap.set(videoId, now);
}

/* =========================
   TOUCH (PRIMARY)
========================= */

document.addEventListener("touchend", (e) => {
  lastTouchTime = Date.now();
  handleDoubleTap(e);
});

/* =========================
   CLICK (FALLBACK)
========================= */

document.addEventListener("click", (e) => {

  // ignore fake click after touch
  if (Date.now() - lastTouchTime < 400) return;

  handleDoubleTap(e);

});


//Animation.
function heartBurst(btn) {

  const container = btn.closest(".short");
  if (!container) return;

  const btnRect = btn.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const baseX = btnRect.left - containerRect.left;
  const baseY = btnRect.top - containerRect.top;

  for (let i = 0; i < 6; i++) {

    const heart = document.createElement("div");
    heart.className = "heart-burst";
    heart.innerText = "❤️";

    // random burst direction
    const x = (Math.random() - 0.5) * 80;
    const y = (Math.random() - 1) * 80;

    heart.style.left = baseX + "px";
    heart.style.top = baseY + "px";

    heart.style.setProperty("--x", `${x}px`);
    heart.style.setProperty("--y", `${y}px`);

    heart.style.pointerEvents = "none"; // 🔥 important

    container.appendChild(heart);

    setTimeout(() => heart.remove(), 700);
  }
}
function showBigHeart(container) {

  const heart = document.createElement("div");
  heart.className = "big-heart";
  heart.innerText = "❤️";

  container.appendChild(heart);

  setTimeout(() => heart.remove(), 800);
}






/****************************
         COMMENTS 
           
****************************/



async function loadComments(postId){

  const { data: comments, error } = await supabaseClient
    .from("comments")
    .select(`
      id,
      content,
      created_at,
      user_id,
      parent_id,
      profiles(username, avatar_url)
    `)
    .eq("post_id", postId)
    .order("created_at",{ascending:false});

  if(error){
    console.error("Load comments error:", error);
    return;
  }
  
  
  
  const list = document.getElementById("commentList");
  if(!list) return;

  if(!comments || comments.length === 0){
    list.innerHTML = "";
    return;
  }

  /* -----------------------------
      GET COMMENT IDS
  ----------------------------- */

  const commentIds = comments.map(c => c.id);

  /* -----------------------------
      FETCH COMMENT LIKES
  ----------------------------- */

  const { data: likes } = await supabaseClient
    .from("comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);

  /* -----------------------------
      BUILD LIKE MAP
  ----------------------------- */

  const likeMap = {};
  const likedSet = new Set();

  likes?.forEach(l => {

    likeMap[l.comment_id] = (likeMap[l.comment_id] || 0) + 1;

    if (l.user_id === Id.CURRENT_USER_ID) {
      likedSet.add(l.comment_id);
    }

  });

  /* -----------------------------
      ATTACH LIKE DATA (ALL COMMENTS)
  ----------------------------- */

  comments.forEach(comment => {

    comment.likeCount = likeMap[comment.id] || 0;
    comment.isLiked = likedSet.has(comment.id);

    // fallback profile (important)
    comment.profiles = comment.profiles || {
      username: "user",
      avatar_url: "default.png"
    };

  });

  /* -----------------------------
      BUILD TREE (KEY PART)
  ----------------------------- */

  const treeComments = buildTree(comments);

  // optional debug / global access
  window.currentComments = treeComments;

  /* -----------------------------
      RENDER
  ----------------------------- */

  list.innerHTML = "";

  treeComments.forEach(comment => {
    renderComment(comment); // recursive render
  });

}


function renderComment(comment, parentContainer = null) {

  const container = parentContainer || document.getElementById("commentList");
  if (!container) return;

  const div = document.createElement("div");
  div.className = parentContainer ? "reply-item" : "comment-item";
  div.dataset.id = comment.id;
  div.dataset.userId = comment.user_id;

  const isOwner = comment.user_id === Id.CURRENT_USER_ID;
   
  const formatedtext =
  formatCommentText(comment.content);

  div.innerHTML = `
    <img class="comment-avatar"
    src="${comment.profiles?.avatar_url || "default.png"}">

    <div class="comment-body">

      <span class="comment-username reply-user-click"
        data-id="${comment.id}"
        data-username="${comment.profiles?.username || "user"}">
        ${comment.profiles?.username || "user"}
      </span>

      
      <p class="comment-text">
      ${formatCommentText(comment.content)}
      </p>

      <div class="comment-actions">

        <button class="reply-btn" data-id="${comment.id}">
          reply
        </button>

        <button class="comment-like-btn" data-id="${comment.id}">
          ❤️ <span class="comment-like-count">
            ${comment.likeCount || 0}
          </span>
        </button>

        ${isOwner ? `
        <button class="delete-btn" data-id="${comment.id}">
          <i class="ri-delete-bin-line"></i>
        </button>
        ` : ""}

      </div>

      <div class="reply-container"></div>

    </div>
  `;

  // like state
  const likeBtn = div.querySelector(".comment-like-btn");
  if (comment.isLiked) {
    likeBtn.classList.add("liked");
  }

  container.appendChild(div);

  const replyContainer = div.querySelector(".reply-container");
  const replies = comment.replies || [];

  // 🔥 ONLY SHOW BUTTON INITIALLY
  if (replies.length > 0) {

    const viewBtn = document.createElement("button");
    viewBtn.className = "view-replies-btn";
    viewBtn.innerText = `View replies (${replies.length})`;
    viewBtn.dataset.expanded = "false";

    replyContainer.appendChild(viewBtn);

    viewBtn.addEventListener("click", () => {

      const expanded = viewBtn.dataset.expanded === "true";

      if (!expanded) {

        // SHOW replies
        replies.forEach(reply => {
          renderComment(reply, replyContainer);
        });

        viewBtn.innerText = "Hide replies";
        viewBtn.dataset.expanded = "true";

      } else {

        // HIDE replies
        replyContainer.querySelectorAll(".reply-item")
          .forEach(el => el.remove());

        viewBtn.innerText = `View replies (${replies.length})`;
        viewBtn.dataset.expanded = "false";
      }

    });
  }
}

/*function renderComment(comment) {
  
  container = document.getElementById("commentList")
  if (!container) return;

  const div = document.createElement("div");
  div.className = "comment-item";
  div.dataset.id = comment.id;
  div.dataset.userId = comment.user_id;
  
  //id-stored
  const isOwner = comment.user_id === Id.CURRENT_USER_ID;

  div.innerHTML = `
    <img class="comment-avatar"
    src="${comment.profiles?.avatar_url || "default.png"}">

    <div class="comment-body">

      <span class="comment-username">
        ${comment.profiles?.username || "user"}
      </span>

      <p class="comment-text">${comment.content}</p>

      <div class="comment-actions">

        <button class="reply-btn"
          data-id="${comment.id}">
          reply
        </button>

        <button class="comment-like-btn"
          data-id="${comment.id}">
          ❤️ <span class="comment-like-count">
            ${comment.likeCount || 0}
          </span>
        </button>
          ${isOwner ? `
  <button class="delete-btn" data-id="${comment.id}">
    <i class="ri-delete-bin-line"></i>
  </button>
  ` : ""}

        
        
      </div>

      <div class="reply-container">
      
      
      
      
      
      </div>

    </div>
  `;

  const likeBtn = div.querySelector(".comment-like-btn");

  if (comment.isLiked) {
    likeBtn.classList.add("liked");
  }

  const replyContainer = div.querySelector(".reply-container");
    // 🔥 RECURSION
  comment.replies?.forEach(reply => {
    renderComment(reply, replyContainer);
  })
  
  const replies = comment.replies || [];

  // 🔥 ONLY show button initially
  if (replies.length > 0) {

    const viewBtn = document.createElement("button");
    viewBtn.className = "view-replies-btn";

    viewBtn.innerText = `View replies (${replies.length})`;

    viewBtn.dataset.commentId = comment.id;
    viewBtn.dataset.expanded = "false";

    replyContainer.appendChild(viewBtn);
  }

  container.appendChild(div);
}*/






/****************************
     TOGGLE COMMENTS
****************************/

 
 //reply-to-reply-tree
 function buildTree(comments) {

  const map = {};

  comments.forEach(c => {
    c.replies = [];
    map[c.id] = c;
  });

  const tree = [];

  comments.forEach(c => {

    if (c.parent_id) {
      map[c.parent_id]?.replies.push(c);
    } else {
      tree.push(c);
    }

  });

  return tree;
}
 
 
 
 //Hide & View replies
 document.addEventListener("click", (e) => {

  const btn = e.target.closest(".view-replies-btn");
  if (!btn) return;

  const commentId = btn.dataset.commentId;
  const isExpanded = btn.dataset.expanded === "true";

  const comment = window.currentComments?.find(
    c => String(c.id) === String(commentId)
  );

  if (!comment) return;

  const commentEl = document.querySelector(
    `.comment-item[data-id="${commentId}"]`
  );

  if (!commentEl) return;

  const replyContainer = commentEl.querySelector(".reply-container");

  //  TOGGLE
  if (!isExpanded) {

    // SHOW replies
  comment.replies.forEach(reply => {

   const div = document.createElement("div");
   div.className = "reply-item";

   div.innerHTML = `
     <img class="reply-avatar"
     src="${reply.profiles?.avatar_url || "default.png"}">

     <div class="reply-body">
       <span class="reply-username reply-user-click"
        data-id="${reply.id}"
        data-username="${reply.profiles?.username || "user"}">
        ${reply.profiles?.username || "user"}
         </span>
       <p>${reply.content}</p>
     </div>
    
     <button class="comment-like-btn" data-id="${reply.id}">
      ❤️ <span class="comment-like-count">
        ${reply.likeCount || 0}
       </span>
     </button>
  `;

  // 🔥 liked state
  const likeBtn = div.querySelector(".comment-like-btn");

  if (reply.isLiked) {
    likeBtn.classList.add("liked");
  }

  replyContainer.insertBefore(div, btn);
});

    btn.innerText = "Hide replies";
    btn.dataset.expanded = "true";

  } else {

    // HIDE replies
    replyContainer.querySelectorAll(".reply-item")
      .forEach(el => el.remove());

    btn.innerText = `View replies (${comment.replies.length})`;
    btn.dataset.expanded = "false";
  }

});



 //comments like & unlike.
 document.addEventListener("click", async (e) => {

  const btn = e.target.closest(".comment-like-btn");
  if (!btn) return;

  const commentId = btn.dataset.id;

  const countSpan = btn.querySelector(".comment-like-count");

  let count = parseInt(countSpan.innerText) || 0;

  // prevent spam click
  btn.style.pointerEvents = "none";

  try {

    const isLiked = btn.classList.contains("liked");

    if (!isLiked) {

      // LIKE
      await supabaseClient
        .from("comment_likes")
        .insert({
          comment_id: commentId,
          user_id: Id.CURRENT_USER_ID
        });

      btn.classList.add("liked");
      countSpan.innerText = count + 1;

    } else {

      // UNLIKE
      await supabaseClient
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", Id.CURRENT_USER_ID);

      btn.classList.remove("liked");
      countSpan.innerText = Math.max(0, count - 1);

    }

  } catch (err) {

    console.error("Toggle comment like error:", err);

  }

  btn.style.pointerEvents = "auto";

});


 
  
  //comments-delete-handler.
  document.addEventListener("click", async (e) => {

  const btn = e.target.closest(".delete-btn");
  if (!btn) return;

  const commentId = btn.dataset.id;

  const commentEl = document.querySelector(
    `.comment-item[data-id="${commentId}"]`
  );

  if (!commentEl) return;

  const ownerId = commentEl.dataset.userId;

  // 🔥 PERMISSION CHECK
  if (ownerId !== Id.CURRENT_USER_ID) {
    alert("You can only delete your own comment");
    return;
  }

  const confirmDelete = confirm("Delete this comment?");
  if (!confirmDelete) return;

  
    
  const { data, error } = await supabaseClient
  .from("comments")
  .delete()
  .eq("id", commentId);
    
   console.log("DELETE RESULT:", data, error);
   
  
  
  

});


  
  //replies--to--replies.
  document.addEventListener("click", (e) => {

  const userEl = e.target.closest(".reply-user-click");
  if (!userEl) return;

  const commentId = userEl.dataset.id;
  const username = userEl.dataset.username;

  // 🔥 set reply target
  replyingTo = commentId;

  const input = document.getElementById("commentInput");

  if (input) {
    input.value = `@${username}`;
    input.focus();
  }

});

  //helpers
function formatCommentText(text){
    return text.replace(
      /@(\w+)/g,
      `<span class="mention">@$1</span>`
    )
  };
  
  


let currentCommentPostId = null;









 //open-comments
document.addEventListener("click", (e) => {

  const btn = e.target.closest(".comment-btn");
  if (!btn) return;

  const postId = btn.dataset.id;

  currentCommentPostId = postId;

  openComments(postId);
});


async function openComments(postId) {

  const modal = document.getElementById("commentModal");

  modal.classList.remove("hidden");

  setTimeout(() => {
    modal.classList.add("active");
  }, 10);

  loadComments(postId);
}



    //close-comment.
document.getElementById("closeComment")
  ?.addEventListener("click", closeComments);

document.querySelector(".comment-backdrop")
  ?.addEventListener("click", closeComments);
  

function closeComments() {

  const modal = document.getElementById("commentModal");
  
  const list = document.getElementById("commentList");
  list.innerHTML = "";
  modal.classList.remove("active");

  setTimeout(() => {
    modal.classList.add("hidden");
  }, 300);
}







 




   /*Replies-comments*/
   
    



 //comments-reply-Logic.
 let replyingTo ;
 document.addEventListener("click",(e)=>{

  const btn = e.target.closest(".reply-btn");
  if(!btn) return;

  replyingTo = btn.dataset.id;

  const input = document.getElementById("commentInput");

  input.placeholder="Reply to comment...";
  input.focus();

});


 



//write-comments

  document.getElementById("sendComment")
 ?.addEventListener("click", async () => {
  
  
  //  BLOCK IF NOT LOGGED IN
  if (!requireAuth()) return;

  const input = document.getElementById("commentInput");
  const text = input.value.trim();

  if (!text || !currentCommentPostId) return;

  const parentId = replyingTo;
  //const avatar_url = ;

  try {

    await supabaseClient
      .from("comments")
      .insert({
        post_id: currentCommentPostId,
        user_id: Id.CURRENT_USER_ID,
        content: text,
        parent_id: parentId
      });

    //  HANDLE UI PROPERLY
    if (!parentId) {

      //  NORMAL COMMENT
      const fakeComment = {
        id: Date.now(),
        content: text,
        parent_id: null,
        profiles: {
          username: 
          Id.CURRENT_USER?.username || "you",
          
          avatar_url: 
          Id.CURRENT_USER?.avatar_url || "deafult.png"
        },
        replies: [],
        likeCount: 0,
        isLiked: false
      };

      renderComment(fakeComment);

    } else {

      //  REPLY
      const parentEl = document.querySelector(
        `.comment-item[data-id="${parentId}"]`
      );

      if (parentEl) {

      const replyContainer = parentEl.querySelector(".reply-container");

      const replyDiv = document.createElement("div");
      replyDiv.className = "reply-item";
      const avatar = Id.CURRENT_USER?.avatar_url
      
      const name = Id.CURRENT_USER?.username
      

      replyDiv.innerHTML = `
       <img class="reply-avatar"
       src="${avatar || "default.png"}">

       <div class="reply-body">
       <span class="reply-username">
        ${name || "You"}
       </span>
       <p>${text}</p>
       </div>
    
     `;

      replyContainer.appendChild(replyDiv);
      }
    }

    input.value = "";

  } catch (err) {
    console.error(err);
  }
 
  replyingTo = null;
  input.placeholder = "reply to a comment...";
  input.dataset.replyingTo = replyingTo;

}); 






/*

         UPLOAD-LOGIC.

*/




   //Upload-open-Logic

const uploadSection = document.getElementById("upload-section");
const floatingUploadBtn = document.getElementById("template");
const closeUploadBtn = document.getElementById("closeUploadBtn");

floatingUploadBtn?.addEventListener("click", () => {
  uploadSection.classList.add("active");
});

closeUploadBtn?.addEventListener("click", () => {
  uploadSection.classList.remove("active");
  resetUploadUI();
});



   //Upload-container.
const videoInput = document.getElementById("videoInput");
const selectVideoBtn = document.getElementById("selectVideoBtn");
const previewVideo = document.getElementById("previewVideo");
const confirmUploadBtn = document.getElementById("confirmUploadBtn");
const captionInput = document.getElementById("captionInput");
let selectedFile = null; 




//select-video.
selectVideoBtn?.addEventListener("click", () => {
  videoInput.click();
});

//video-file
let previewURL = null;

videoInput.addEventListener("change", (e) => {

  selectedFile = e.target.files[0];

  if (!selectedFile) return;

  if (previewURL) URL.revokeObjectURL(previewURL);

  previewURL = URL.createObjectURL(selectedFile);

  previewVideo.src = previewURL;
  previewVideo.style.display = "block";
  previewVideo.muted = true;
  previewVideo.play().catch(()=>{});

});

//confirm-upload

confirmUploadBtn?.addEventListener("click", async () => {

  if (!selectedFile) {
    alert("Select video first");
    return;
  }

  if (!Id.CURRENT_USER_ID) {
    alert("Login required");
    return;
  }

  if (!selectedFile.type.startsWith("video/")) {
    alert("Only video allowed");
    return;
  }

  confirmUploadBtn.textContent = "Sharing...";
  confirmUploadBtn.disabled = true;

  try {

    const fileName = `${Id.CURRENT_USER_ID}/${Date.now()}_${selectedFile.name}`;

    // upload
    const { error: uploadError } = await supabaseClient.storage
      .from("Video") // ⚠️ check lowercase
      .upload(fileName, selectedFile);

    if (uploadError) throw uploadError;

    // get url
    const { data } = supabaseClient.storage
      .from("Video")
      .getPublicUrl(fileName);

    const videoUrl = data.publicUrl;

    console.log("USER:", Id.CURRENT_USER_ID); // debug

    // insert
    const { error: insertError } = await supabaseClient
      .from("video_posts")
      .insert({
        user_id: Id.CURRENT_USER_ID,
        video_url: videoUrl,
        caption: captionInput.value || ""
      });

    if (insertError) {
  console.error("INSERT ERROR FULL:", insertError);
  alert(JSON.stringify(insertError, null, 2));
  return;
}

    alert("Posted 🎉");

    uploadSection.classList.remove("active");
    resetUploadUI();
    reloadFeed();

  } catch (err) {
    console.error("Upload error:", err);
    alert("Upload failed");
  }

  confirmUploadBtn.textContent = "Share";
  confirmUploadBtn.disabled = false;

});



//reset-Upload-UI.
function resetUploadUI() {

  previewVideo.pause();

  previewVideo.src = "";
  previewVideo.style.display = "none";

  captionInput.value = "";
  videoInput.value = "";

  selectedFile = null;

}

//ReloadFeed
function reloadFeed() {
  page = 0;
  hasMore = true;
  loadVideoFeed();
  console.log("video-realoded")
}

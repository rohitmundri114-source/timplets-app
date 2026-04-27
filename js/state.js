export const AppState = {
user:null,
currentPage:null,
videos:[],
voiceRoom:null,
profile:null
};

export const Id = {
  CURRENT_USER_ID: null,
  CURRENT_USER: {
    username: null,
    avatar_url: null
  }
};

export const Cache = {
  feedCache: [],          // video feed data
  feedLoaded: false,      // initial load flag
  profileCache: {},       // user profiles
  profilePostsCache: {},  // posts per user
  followCache: {},        // follow state
};

export const Voice = {
currentRoomId:null,
unsubscribeRoom:null,
roomDeleteUnsub:null,
user:null,
isRoomAdmin:false,
initialLoad:true,
isReady: null,
isMuted: false


};



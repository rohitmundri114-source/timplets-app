import { supabaseClient} from "../services/supabase.js"
import { auth,signOut } from "../services/firebase.js";
import { navigate } from "../js/router.js";
import { Id } from "../js/state.js";




export async function syncUserProfile(user) {
  try {
    console.log("Sync check for:", user.uid);

    const { data: existing, error } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("id", user.uid)
      .maybeSingle();

    if (error) {
      console.error("Profile check error:", error);
      return;
    }

    if (!existing) {
      console.log("No profile → go to setup");

      setTimeout(() => {
        navigate("setupProfile");
      }, 50);

      return;
    }

    //  FETCH FULL PROFILE (THIS WAS MISSING)
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.uid)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return;
    }

    //  STORE IN STATE
    Id.CURRENT_USER = profile;

    console.log("User loaded:", profile);

  } catch (err) {
    console.error("Sync error:", err);
  }
}



export function initSetupProfile() {

  console.log("SetupProfile init");

  // ================= PREVIEW LOGIC =================

  const input = document.getElementById("avatarInput");
  const preview = document.getElementById("avatarPreview");

  if (input && preview) {

    input.addEventListener("change", () => {

      const file = input.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Upload valid image ");
        input.value = "";
        return;
      }

      const url = URL.createObjectURL(file);
      preview.src = url;
      
      console.log(file);

      console.log("Avatar preview updated");
    });

  }

  // ================= SAVE PROFILE =================

  document.addEventListener("click", async (e) => {

    if (e.target.id === "saveProfileBtn") {

      console.log("Button clicked ");

      const username = document.getElementById("usernameInput")?.value?.trim();
      const file = document.getElementById("avatarInput")?.files[0];

      if (!username) {
        alert("Enter username");
        return;
      }

      const userId = Id.CURRENT_USER_ID;

      if (!userId) {
        console.error("User not logged in ");
        return;
      }

      let avatarUrl = "./Assets/user-fill.svg";

      try {

        //  UPLOAD AVATAR
        if (file) {

          if (!file.type.startsWith("image/")) {
            alert("Upload valid image");
            return;
          }

          const fileName = `${userId}_${Date.now()}`;

          const { error: uploadError } = await supabaseClient
            .storage
            .from("avatars")
            .upload(fileName, file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            return;
          }

          const { data } = supabaseClient
            .storage
            .from("avatars")
            .getPublicUrl(fileName);

          avatarUrl = data.publicUrl;
        }

        //  SAVE PROFILE
        const { error } = await supabaseClient
          .from("profiles")
          .upsert({
            id: userId,
            username,
            avatar_url: avatarUrl
          }, {
            onConflict: "id"
          });

        if (error) {
          console.error("Insert error:", error);
          return;
        }

        console.log("Profile saved ");

        navigate("flashcards");

      } catch (err) {
        console.error("Setup error :", err);
      }
    }

  });

  // ================= CANCEL =================

  document.getElementById("cancelSetupBtn")
  ?.addEventListener("click", async () => {

    console.log("Cancel setup → logout");

    try {

      await signOut(auth);

      Id.CURRENT_USER_ID = null;
      Id.CURRENT_USER = null;

      navigate("login");

    } catch (err) {
      console.error(err);
    }

  });

}



export function requireAuth() {
  if (!Id.CURRENT_USER_ID) {
    alert("Please login first");
    navigate("login");
    return false;
  }
  return true;
}


export function stopAllVideos(){

  const videos = document.querySelectorAll("video");

  videos.forEach(video => {
    video.pause();
    video.muted = true;
  });

  console.log("All videos stopped 🛑");
}

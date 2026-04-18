/*
import { supabaseClient } from "../services/supabase.js";
import { Id } from "../state.js";
import { navigate } from "../router.js";

export function initSetupProfile() {

  const btn = document.getElementById("saveProfileBtn");
  const avatarInput = document.getElementById("avatarInput");

  if (!btn) return;

  btn.onclick = async () => {

    const username = document.getElementById("usernameInput").value.trim();
    const file = avatarInput?.files[0];

    if (!username) {
      alert("Enter username");
      return;
    }

    let avatarUrl = "default.png";

    try {

      // 🔥 UPLOAD AVATAR (if selected)
      if (file) {

        if (!file.type.startsWith("image/")) {
          alert("Please upload a valid image");
          return;
        }

        const fileName = `${Id.CURRENT_USER_ID}_${Date.now()}`;

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

      // 🔥 INSERT PROFILE
      const { error } = await supabaseClient
        .from("profiles")
        .insert({
          id: Id.CURRENT_USER_ID,
          username,
          avatar_url: avatarUrl
        });

      if (error) {
        console.error("Insert error:", error);
        return;
      }

      console.log("Profile created");

      navigate("flashcards");

    } catch (err) {
      console.error("Setup error:", err);
    }
  };
}

*/
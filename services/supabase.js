// Supabase client
console.log("Supabase loaded");

const SUPABASE_URL = 
  "https://lurvcfybamkaldegjvda.supabase.co";
const SUPABASE_ANON_KEY =
  "sb_publishable_6wQXc0V5FBsypT8f1MNGyQ_HKEUSv3Y";

export const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);




/* Extra-safe-key
/*
const supabaseClient = 
  supabase.createClient(
  "https://lurvcfybamkaldegjvda.supabase.co",
  "sb_publishable_6wQXc0V5FBsypT8f1MNGyQ_HKEUSv3Y"
);
 */




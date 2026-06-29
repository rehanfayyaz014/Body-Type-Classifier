(function () {
  var SUPABASE_URL = "https://ewkjxelkkkoiewvbzphg.supabase.co";
  var SUPABASE_KEY = "sb_publishable_SkQVdoKTT8m-xKYJpl9VbA_gqkbGb-r";

  if (typeof window.supabase === "undefined") {
    console.error("Supabase library not loaded. Check the CDN script tag in index.html.");
    return;
  }

  window.FitAISupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
})();
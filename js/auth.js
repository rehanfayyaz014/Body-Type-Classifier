(function () {
  if (!window.FitAISupabase) {
    console.error("Supabase client not found. Make sure supabase-client.js loads before auth.js.");
    return;
  }

  var sb = window.FitAISupabase;

  // ---- Core Auth Actions ----

  async function signUp(email, password, name) {
    var result = await sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { name: name },
      },
    });
    if (result.error) throw result.error;

    if (result.data && result.data.user) {
      await migrateGuestDataToSupabase(result.data.user.id);
    }
    return result.data;
  }

  async function signIn(email, password) {
    var result = await sb.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signOut() {
    await sb.auth.signOut();
  }

  async function getCurrentUser() {
    var result = await sb.auth.getUser();
    return result.data ? result.data.user : null;
  }

  async function getProfile(userId) {
    var result = await sb.from("profiles").select("*").eq("id", userId).single();
    if (result.error) return null;
    return result.data;
  }

  // ---- Guest -> Supabase Migration (runs once, right after signup) ----

  async function migrateGuestDataToSupabase(userId) {
    try {
      // 1. Migrate body type / profile info
      var profileRaw = localStorage.getItem("fitai-profile");
      if (profileRaw) {
        var p = JSON.parse(profileRaw);

        if (p.bodyTypeKey) {
          await sb.from("body_type_history").insert({
            user_id: userId,
            body_type: p.bodyTypeKey,
            bmi: p.bmi || 0,
            height_cm: p.height_cm || 0,
            weight_kg: p.weight_kg || 0,
            goal: p.goal || null,
            activity_level: p.activityLevel || null,
            workout_preference: p.workoutPreference || null,
          });
        }

        await sb
          .from("profiles")
          .update({
            gender: p.gender || null,
            height_cm: p.height_cm || null,
            weight_kg: p.weight_kg || null,
          })
          .eq("id", userId);
      }

      // 2. Migrate food tracking history
      var historyRaw = localStorage.getItem("fitai-tracking-history");
      if (historyRaw) {
        var history = JSON.parse(historyRaw);
        if (Array.isArray(history) && history.length) {
          var rows = history.map(function (entry) {
            return {
              user_id: userId,
              log_date: entry.date || new Date().toISOString().slice(0, 10),
              items: entry.items || null,
              summary: entry.summary || null,
            };
          });
          await sb.from("food_tracking_history").insert(rows);
        }
      }
    } catch (e) {
      console.error("Guest data migration failed:", e);
    }
  }

  // ---- Session helper: keep app aware of login state ----

  function onAuthChange(callback) {
    sb.auth.onAuthStateChange(function (event, session) {
      callback(session ? session.user : null);
    });
  }

  window.FitAIAuth = {
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    getCurrentUser: getCurrentUser,
    getProfile: getProfile,
    onAuthChange: onAuthChange,
  };
})();
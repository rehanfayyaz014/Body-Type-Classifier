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
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (result.error) throw result.error;

    // If email confirmation is required, Supabase returns a user but NO session.
    // In that case we must NOT treat the person as logged in yet, and we can't
    // migrate guest data yet either (there is no authenticated session for RLS).
    var pendingConfirmation = !!(result.data && result.data.user && !result.data.session);

    if (!pendingConfirmation && result.data && result.data.user) {
      await maybeMigrateGuestData(result.data.user.id);
    }

    return {
      user: result.data ? result.data.user : null,
      session: result.data ? result.data.session : null,
      pendingConfirmation: pendingConfirmation,
    };
  }

  async function resendConfirmation(email) {
    var result = await sb.auth.resend({
      type: "signup",
      email: email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (result.error) throw result.error;
    return true;
  }

  async function signIn(email, password) {
    var result = await sb.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
    if (result.data && result.data.user) {
      await maybeMigrateGuestData(result.data.user.id);
    }
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

  // ---- Guest -> Supabase Migration (runs once, on the user's first real login) ----

  async function maybeMigrateGuestData(userId) {
    var flagKey = "fitai-migrated-" + userId;
    if (localStorage.getItem(flagKey)) return; // already migrated for this account
    await migrateGuestDataToSupabase(userId);
    localStorage.setItem(flagKey, "1");
  }

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
      if (session && session.user && event === "SIGNED_IN") {
        // Covers the case where the user clicks the email confirmation link
        // and Supabase auto-establishes a session on redirect back to the app.
        maybeMigrateGuestData(session.user.id);
      }
      callback(session ? session.user : null);
    });
  }

  window.FitAIAuth = {
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    resendConfirmation: resendConfirmation,
    getCurrentUser: getCurrentUser,
    getProfile: getProfile,
    onAuthChange: onAuthChange,
  };
})();
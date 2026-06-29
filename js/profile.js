(function () {
  function $(id) { return document.getElementById(id); }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (e) {
      return iso || "";
    }
  }

  function renderBodyTypeHistory(rows) {
    var container = $("profile-bodytype-history");
    container.innerHTML = "";
    if (!rows || !rows.length) {
      container.innerHTML = '<p class="profile-empty">No assessments yet.</p>';
      return;
    }
    rows.forEach(function (row) {
      var div = document.createElement("div");
      div.className = "glass-card profile-history-item";
      div.innerHTML =
        '<div class="profile-history-item__top">' +
          '<span class="profile-history-item__type">' + capitalize(row.body_type) + "</span>" +
          '<span class="profile-history-item__date">' + formatDate(row.created_at) + "</span>" +
        "</div>" +
        '<div class="profile-history-item__meta">BMI ' + row.bmi + " · " + row.height_cm + " cm · " + row.weight_kg + " kg</div>";
      container.appendChild(div);
    });
  }

  function renderFoodHistory(rows) {
    var container = $("profile-food-history");
    container.innerHTML = "";
    if (!rows || !rows.length) {
      container.innerHTML = '<p class="profile-empty">No food logs yet.</p>';
      return;
    }
    rows.forEach(function (row) {
      var summary = row.summary || {};
      var div = document.createElement("div");
      div.className = "glass-card profile-history-item";
      div.innerHTML =
        '<div class="profile-history-item__top">' +
          '<span class="profile-history-item__type">' + (row.log_date || row.date || "") + "</span>" +
        "</div>" +
        '<div class="profile-history-item__meta">' +
          (summary.calories || 0) + " kcal · " + (summary.protein || 0) + "g protein · " +
          (summary.carbs || 0) + "g carbs · " + (summary.fat || 0) + "g fat" +
        "</div>";
      container.appendChild(div);
    });
  }

  function renderGuestView() {
    $("profile-name").textContent = "Guest";
    $("profile-email").textContent = "Not signed in — sign up to save history across devices.";
    $("profile-avatar-letter").textContent = "G";

    var profileRaw = localStorage.getItem("fitai-profile");
    var profile = profileRaw ? JSON.parse(profileRaw) : null;

    if (profile && profile.bodyTypeKey) {
      $("profile-current-type").textContent = capitalize(profile.bodyTypeKey);
      $("profile-current-bmi").textContent = profile.bmi != null ? profile.bmi : "--";
      $("profile-current-meta").textContent = (profile.height_cm || "--") + " cm · " + (profile.weight_kg || "--") + " kg";
      renderBodyTypeHistory([{
        created_at: new Date().toISOString(),
        body_type: profile.bodyTypeKey,
        bmi: profile.bmi,
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
      }]);
    } else {
      $("profile-current-type").textContent = "Not assessed yet";
      renderBodyTypeHistory([]);
    }

    var historyRaw = localStorage.getItem("fitai-tracking-history");
    var history = historyRaw ? JSON.parse(historyRaw) : [];
    renderFoodHistory(history);
  }

  async function renderLoggedInView(user) {
    var sb = window.FitAISupabase;
    var profile = await window.FitAIAuth.getProfile(user.id);

    var displayName = (profile && profile.name) || user.email;
    $("profile-name").textContent = displayName;
    $("profile-email").textContent = user.email;
    $("profile-avatar-letter").textContent = displayName.charAt(0).toUpperCase();

    var bodyRes = await sb
      .from("body_type_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    var bodyHistory = bodyRes.data || [];
    renderBodyTypeHistory(bodyHistory);

    if (bodyHistory.length) {
      var latest = bodyHistory[0];
      $("profile-current-type").textContent = capitalize(latest.body_type);
      $("profile-current-bmi").textContent = latest.bmi;
      $("profile-current-meta").textContent = latest.height_cm + " cm · " + latest.weight_kg + " kg";
    } else {
      $("profile-current-type").textContent = "Not assessed yet";
    }

    var foodRes = await sb
      .from("food_tracking_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    renderFoodHistory(foodRes.data || []);
  }

  async function init() {
    $("btn-home")?.addEventListener("click", function () {
      window.location.href = "/dashboard";
    });

    if (!window.FitAIAuth) {
      renderGuestView();
      return;
    }

    var user = await window.FitAIAuth.getCurrentUser();
    if (user) {
      renderLoggedInView(user);
    } else {
      renderGuestView();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
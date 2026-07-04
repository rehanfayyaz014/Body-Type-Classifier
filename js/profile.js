(function () {
  function $(id) { return document.getElementById(id); }

  var state = {
    pendingDeleteId: null
  };

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

  function openDeleteModal(logId) {
    state.pendingDeleteId = logId;
    $("delete-modal-overlay").classList.remove("hidden");
  }

  function closeDeleteModal() {
    state.pendingDeleteId = null;
    $("delete-modal-overlay").classList.add("hidden");
  }

  async function confirmDelete() {
    if (!state.pendingDeleteId) return;
    
    var user = await window.FitAIAuth.getCurrentUser();
    if (!user) return;

    var sb = window.FitAISupabase;
    var btn = $("btn-delete-confirm");
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Deleting...";

    const { error } = await sb
      .from("food_tracking_history")
      .delete()
      .eq("id", state.pendingDeleteId)
      .eq("user_id", user.id);

    btn.disabled = false;
    btn.textContent = originalText;

    if (error) {
      alert("Failed to delete log: " + error.message);
    } else {
      closeDeleteModal();
      renderLoggedInView(user);
    }
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
      var items = row.items || [];
      
      var mealType = "General";
      if (items.length && items[0].meal) {
        mealType = items[0].meal;
      }

      var foodList = items.map(function(i) { 
        return (i.matched_food || i.raw_input || "Unknown item") + (i.portion ? " (" + i.portion + ")" : "");
      }).join(", ");

      var div = document.createElement("div");
      div.className = "glass-card profile-history-item profile-history-item--detailed";
      div.innerHTML = `
        <div class="food-history-header">
          <div class="food-history-date-wrap">
            <span class="food-history-date">${row.log_date || formatDate(row.created_at)}</span>
            <span class="food-history-meal">${mealType}</span>
          </div>
          <button type="button" class="btn-delete-log" data-id="${row.id}" title="Delete Log">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
        <div class="food-history-items-list">${foodList || "No items recorded"}</div>
        <div class="food-history-macros">
          <span class="macro-badge macro-badge--cal">${Math.round(summary.calories || 0)} kcal</span>
          <span class="macro-badge macro-badge--p">${Math.round(summary.protein_g || summary.protein || 0)}g P</span>
          <span class="macro-badge macro-badge--c">${Math.round(summary.carbs_g || summary.carbs || 0)}g C</span>
          <span class="macro-badge macro-badge--f">${Math.round(summary.fat_g || summary.fat || 0)}g F</span>
        </div>
      `;
      
      div.querySelector(".btn-delete-log").addEventListener("click", function() {
        openDeleteModal(row.id);
      });
      
      container.appendChild(div);
    });
  }

  function renderGuestView() {
    $("profile-name").textContent = "Guest";
    $("profile-email").textContent = "Not signed in";
    $("profile-avatar-letter").textContent = "G";

    var profileRaw = localStorage.getItem("fitai-profile");
    var profile = profileRaw ? JSON.parse(profileRaw) : null;

    if (profile && profile.bodyTypeKey) {
      $("profile-current-type").textContent = capitalize(profile.bodyTypeKey);
      $("profile-height").textContent = (profile.height_cm && profile.height_cm > 0) ? profile.height_cm : "--";
      $("profile-weight").textContent = (profile.weight_kg && profile.weight_kg > 0) ? profile.weight_kg : "--";
      $("profile-current-bmi").textContent = (profile.bmi && profile.bmi > 0) ? profile.bmi : "--";
    } else {
      $("profile-current-type").textContent = "Not assessed yet";
    }

    var historyRaw = localStorage.getItem("fitai-tracking-history");
    var history = historyRaw ? JSON.parse(historyRaw) : [];
    renderFoodHistory(history);
  }

  async function updateWeight(newWeight) {
    var user = await window.FitAIAuth.getCurrentUser();
    if (!user) return;

    var sb = window.FitAISupabase;
    var saveBtn = $("weight-edit-form").querySelector('button[type="submit"]');
    var originalText = saveBtn.textContent;
    
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      const { error: profileError } = await sb
        .from("profiles")
        .update({ weight_kg: newWeight })
        .eq("id", user.id);

      if (profileError) throw profileError;

      var bodyRes = await sb
        .from("body_type_history")
        .select("id, height_cm")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (bodyRes.data && bodyRes.data.length) {
        var latestId = bodyRes.data[0].id;
        var height = bodyRes.data[0].height_cm;
        var newBmi = (newWeight / ((height / 100) ** 2)).toFixed(2);
        
        await sb.from("body_type_history").update({ 
          weight_kg: newWeight,
          bmi: newBmi
        }).eq("id", latestId);
      }

      closeWeightModal();
      await renderLoggedInView(user);
    } catch (err) {
      console.error("Update failed:", err);
      alert("Failed to update weight: " + (err.message || "Unknown error"));
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  }

  function openWeightModal() {
    var current = $("profile-weight").textContent;
    $("new-weight-input").value = current !== "--" ? current : "";
    $("weight-modal-overlay").classList.remove("hidden");
  }

  function closeWeightModal() {
    $("weight-modal-overlay").classList.add("hidden");
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
      .order("created_at", { ascending: false })
      .limit(1);

    if (bodyRes.data && bodyRes.data.length) {
      var latest = bodyRes.data[0];
      $("profile-current-type").textContent = capitalize(latest.body_type);
      
      var latestHeight = latest.height_cm;
      var latestWeight = latest.weight_kg;
      var h = (latestHeight != null && latestHeight > 0) ? latestHeight : null;
      var w = (latestWeight != null && latestWeight > 0) ? latestWeight : null;
      
      $("profile-height").textContent = (h && h > 0) ? h : "--";
      $("profile-weight").textContent = (w && w > 0) ? w : "--";
      
      if (h > 0 && w > 0) {
        $("profile-current-bmi").textContent = (w / ((h / 100) ** 2)).toFixed(2);
      } else {
        $("profile-current-bmi").textContent = "--";
      }
    } else {
      $("profile-current-type").textContent = "Not assessed yet";
      if (profile && profile.weight_kg) {
          $("profile-weight").textContent = profile.weight_kg;
          $("profile-height").textContent = profile.height_cm || "--";
      }
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

    // Weight Modal
    $("btn-edit-weight")?.addEventListener("click", openWeightModal);
    $("weight-modal-close")?.addEventListener("click", closeWeightModal);
    $("weight-modal-overlay")?.addEventListener("click", function(e) {
      if (e.target === $("weight-modal-overlay")) closeWeightModal();
    });

    $("weight-edit-form")?.addEventListener("submit", function(e) {
      e.preventDefault();
      var val = $("new-weight-input").value;
      if (val && !isNaN(val)) {
        updateWeight(parseFloat(val));
      }
    });

    // Delete Modal
    $("btn-delete-cancel")?.addEventListener("click", closeDeleteModal);
    $("btn-delete-confirm")?.addEventListener("click", confirmDelete);
    $("delete-modal-overlay")?.addEventListener("click", function(e) {
      if (e.target === $("delete-modal-overlay")) closeDeleteModal();
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

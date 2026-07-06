(function () {
  function $(id) { return document.getElementById(id); }

  var I18N = window.FitAIStrings;
  var STORAGE_LANG = "fitai-lang";
  var STORAGE_THEME = "fitai-theme";
  var STORAGE_TRACKING_HISTORY = "fitai-tracking-history";
  var STORAGE_TRACKING_NUTRITION = "fitai-tracking-nutrition";
  var STORAGE_TRACKING_SUMMARY = "fitai-daily-summary";
  var state = {
    pendingDeleteId: null,
    pendingDeleteEntry: null,
    lang: "en",
    theme: "dark"
  };

  function getStrings() {
    return (I18N && I18N[state.lang]) || I18N.en || {};
  }

  function applyI18n() {
    var s = getStrings();
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (!key || !s[key]) return;
      node.textContent = s[key];
    });
    var brand = $("brand-title");
    if (brand && s.brand) brand.textContent = s.brand;
    document.title = (s.brand || "FitForge") + " — " + (s.profilePageTitle || "Profile");
  }

  function setLang(lang) {
    if (!I18N || !I18N[lang]) lang = "en";
    state.lang = lang;
    localStorage.setItem(STORAGE_LANG, lang);
    document.documentElement.lang = lang === "ur" ? "ur" : "en";
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
    document.body.dir = document.documentElement.dir;
    applyI18n();
  }

  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem(STORAGE_THEME, theme);
    document.body.classList.toggle("theme-light", theme === "light");
    document.body.classList.toggle("theme-dark", theme === "dark");
    var sun = $("btn-theme")?.querySelector(".icon-sun");
    var moon = $("btn-theme")?.querySelector(".icon-moon");
    if (sun && moon) {
      sun.classList.toggle("hidden", theme === "light");
      moon.classList.toggle("hidden", theme === "dark");
    }
  }

  function updateHeaderWelcome() {
    var welcome = $("header-user-welcome");
    if (!welcome) return;
    welcome.textContent = "";
    welcome.classList.add("hidden");
    var center = welcome.closest(".top-bar__center");
    if (center) center.classList.add("top-bar__center--empty");
  }

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

  function formatDateTime(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return iso || "";
    }
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function summarizeEntryItems(entry) {
    var summary = entry && entry.summary ? entry.summary : {};
    return {
      calories: Number(summary.calories || 0),
      protein_g: Number(summary.protein_g || summary.protein || 0),
      carbs_g: Number(summary.carbs_g || summary.carbs || 0),
      fat_g: Number(summary.fat_g || summary.fat || 0),
      fiber_g: Number(summary.fiber_g || summary.fiber || 0),
      item_count: Number(summary.item_count || 0),
    };
  }

  function rebuildCachedNutrition(history) {
    var today = new Date().toISOString().slice(0, 10);
    var source = (history || readJson(STORAGE_TRACKING_HISTORY, [])).filter(function (entry) {
      return entry && entry.date === today;
    });
    var combinedItems = [];
    var combinedSummary = {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      item_count: 0,
    };

    source.forEach(function (entry) {
      combinedItems = combinedItems.concat(entry.items || []);
      var summary = summarizeEntryItems(entry);
      combinedSummary.calories += summary.calories;
      combinedSummary.protein_g += summary.protein_g;
      combinedSummary.carbs_g += summary.carbs_g;
      combinedSummary.fat_g += summary.fat_g;
      combinedSummary.fiber_g += summary.fiber_g;
      combinedSummary.item_count += summary.item_count;
    });

    writeJson(STORAGE_TRACKING_NUTRITION, { date: today, items: combinedItems, summary: combinedSummary });
    writeJson(STORAGE_TRACKING_SUMMARY, { date: today, totals: combinedSummary, targets: null });
  }

  function localEntrySignature(entry) {
    var items = (entry && entry.items) || [];
    var summary = summarizeEntryItems(entry);
    return [
      entry && (entry.date || entry.log_date || ""),
      summary.calories,
      summary.protein_g,
      summary.carbs_g,
      summary.fat_g,
      summary.fiber_g,
      summary.item_count,
      items.map(function (item) {
        return [item && (item.matched_food || item.raw_input || ""), item && item.portion || ""].join("|");
      }).join(";")
    ].join("::");
  }

  function removeLocalHistoryEntry(entry) {
    var history = readJson(STORAGE_TRACKING_HISTORY, []);
    var entryId = entry && entry.id;
    var signature = localEntrySignature(entry);
    var next = history.filter(function (row) {
      if (!row) return false;
      if (entryId && row.id === entryId) return false;
      return localEntrySignature(row) !== signature;
    });
    writeJson(STORAGE_TRACKING_HISTORY, next);
    rebuildCachedNutrition(next);
  }

  function openDeleteModal(logId) {
    state.pendingDeleteId = logId && logId.id ? logId.id : logId;
    state.pendingDeleteEntry = typeof logId === "object" ? logId : null;
    $("delete-modal-overlay").classList.remove("hidden");
  }

  function closeDeleteModal() {
    state.pendingDeleteId = null;
    state.pendingDeleteEntry = null;
    $("delete-modal-overlay").classList.add("hidden");
  }

  async function confirmDelete() {
    if (!state.pendingDeleteId) return;
    
    var user = await window.FitAIAuth.getCurrentUser();
    var sb = window.FitAISupabase;
    var btn = $("btn-delete-confirm");
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Deleting...";

    try {
      if (user && sb) {
        const { error } = await sb
          .from("food_tracking_history")
          .delete()
          .eq("id", state.pendingDeleteId)
          .eq("user_id", user.id);

        if (error) throw error;
      }

      if (state.pendingDeleteEntry) {
        removeLocalHistoryEntry(state.pendingDeleteEntry);
      } else {
        var history = readJson(STORAGE_TRACKING_HISTORY, []);
        var nextHistory = history.filter(function (row) {
          return row && row.id !== state.pendingDeleteId;
        });
        writeJson(STORAGE_TRACKING_HISTORY, nextHistory);
        rebuildCachedNutrition(nextHistory);
      }

      closeDeleteModal();
      if (user) await renderLoggedInView(user);
      else renderGuestView();
    } catch (err) {
      alert("Failed to delete log: " + (err && err.message ? err.message : "Unknown error"));
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  function toggleHistoryPanel(force) {
    var panel = $("profile-history-panel");
    var toggle = $("profile-history-toggle");
    if (!panel || !toggle) return;
    var shouldOpen = typeof force === "boolean" ? force : panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !shouldOpen);
    toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }

  function renderFoodHistory(rows) {
    var container = $("profile-food-history");
    var s = getStrings();
    container.innerHTML = "";
    if (!rows || !rows.length) {
      container.innerHTML = '<p class="profile-empty">' + (s.profileNoLogs || "No food logs yet") + '</p>';
      return;
    }
    
    rows.forEach(function (row) {
      var summary = row.summary || {};
      var items = row.items || [];
      var rawDate = row.log_date || row.date || row.created_at || row.createdAt;
      
      var mealType = s.profileMealGeneral || "General";
      if (items.length && items[0].meal) {
        mealType = items[0].meal;
      }

      var foodList = items.map(function(i) { 
        return (i.matched_food || i.raw_input || (s.profileUnknownItem || "Unknown item")) + (i.portion ? " (" + i.portion + ")" : "");
      }).join(", ");

      var div = document.createElement("div");
      div.className = "glass-card profile-history-item profile-history-item--detailed";
      div.innerHTML = `
        <div class="food-history-header">
          <div class="food-history-date-wrap">
            <span class="food-history-date">${rawDate ? formatDateTime(rawDate) : formatDate(row.created_at)}</span>
            <span class="food-history-meal">${mealType}</span>
          </div>
          <button type="button" class="btn-delete-log" data-id="${row.id}" title="Delete Log">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
        <div class="food-history-items-list">${foodList || (s.profileNoItemsRecorded || "No items recorded")}</div>
        <div class="food-history-macros">
          <span class="macro-badge macro-badge--cal">${Math.round(summary.calories || 0)} kcal</span>
          <span class="macro-badge macro-badge--p">${Math.round(summary.protein_g || summary.protein || 0)}g P</span>
          <span class="macro-badge macro-badge--c">${Math.round(summary.carbs_g || summary.carbs || 0)}g C</span>
          <span class="macro-badge macro-badge--f">${Math.round(summary.fat_g || summary.fat || 0)}g F</span>
        </div>
      `;
      
      div.querySelector(".btn-delete-log").addEventListener("click", function() {
        openDeleteModal(row);
      });
      
      container.appendChild(div);
    });
  }

  function renderGuestView() {
    var s = getStrings();
    $("profile-name").textContent = s.profileGuestName || "Guest";
    $("profile-email").textContent = s.profileGuestEmail || "Not signed in";
    $("profile-avatar-letter").textContent = "G";

    var profileRaw = localStorage.getItem("fitai-profile");
    var profile = profileRaw ? JSON.parse(profileRaw) : null;

    if (profile && profile.bodyTypeKey) {
      $("profile-current-type").textContent = capitalize(profile.bodyTypeKey);
      $("profile-height").textContent = (profile.height_cm && profile.height_cm > 0) ? profile.height_cm : "--";
      $("profile-weight").textContent = (profile.weight_kg && profile.weight_kg > 0) ? profile.weight_kg : "--";
      $("profile-current-bmi").textContent = (profile.bmi && profile.bmi > 0) ? profile.bmi : "--";
    } else {
      $("profile-current-type").textContent = s.profileNotAssessed || "Not assessed yet";
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
    var s = getStrings();

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
      $("profile-current-type").textContent = s.profileNotAssessed || "Not assessed yet";
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
    state.lang = localStorage.getItem(STORAGE_LANG) || "en";
    state.theme = localStorage.getItem(STORAGE_THEME) || "dark";
    setLang(state.lang);
    setTheme(state.theme);

    $("btn-home")?.addEventListener("click", function () {
      window.location.href = "/dashboard";
    });

    $("btn-theme")?.addEventListener("click", function () {
      setTheme(state.theme === "dark" ? "light" : "dark");
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

    $("profile-history-toggle")?.addEventListener("click", function () {
      toggleHistoryPanel();
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
      updateHeaderWelcome();
      renderLoggedInView(user);
    } else {
      updateHeaderWelcome();
      renderGuestView();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

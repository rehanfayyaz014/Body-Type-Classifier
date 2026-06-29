(function (global) {
  var suggestTimer = null;
  var suggestIndex = -1;
  var currentSuggestions = [];
  var trackingBooted = false;
  var suggestDocClickBound = false;

  var VIEWS = ["view-landing", "view-quiz", "view-plan", "view-result", "view-detail"];
  var TRACK_VIEWS = ["view-tracking-hub", "view-tracking-nutrition", "view-tracking-reminders"];

  function $(id) {
    return document.getElementById(id);
  }

  function whenReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function isTrackingModule() {
    return new URLSearchParams(window.location.search).get("module") === "tracking";
  }

  function getUI()       { return global.FitAITrackingUI; }
  function getFoods()    { return global.FitAITrackingFoods; }
  function getState()    { return global.FitAITrackingState; }
  function getReminders(){ return global.FitAITrackingReminders; }

  function hasMatchedFoods(result) {
    if (!result) return false;
    if ((result.items || []).some(function(item) {
      return item && (item.status === "matched" || item.matched_food);
    })) return true;
    if (result.success === false) return false;
    var summary = result.summary || {};
    var count = Number(summary.item_count || result.matched_count || 0);
    if (count > 0) return true;
    if (Number(summary.calories || 0) > 0) return true;
    var nutrition = result.nutrition || {};
    if (Number(nutrition.calories || 0) > 0) return true;
    return false;
  }

  function hideAppViews() {
    VIEWS.forEach(function(id) {
      var el = $(id);
      if (el) el.classList.add("hidden");
    });
  }

  function showTrackView(id, opts) {
    opts = opts || {};
    hideAppViews();

    var fromEl = null;
    TRACK_VIEWS.forEach(function (vid) {
      var el = $(vid);
      if (el && !el.classList.contains("hidden")) fromEl = el;
    });
    var toEl = $(id);

    function finalize() {
      updateHeader(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (!toEl) {
      finalize();
      return;
    }

    if (opts.boot) {
      TRACK_VIEWS.forEach(function (vid) {
        var el = $(vid);
        if (el) el.classList.toggle("hidden", vid !== id);
      });
      document.documentElement.classList.remove("fitai-booting");
      if (global.AnimationManager && toEl) {
        global.AnimationManager.enterView(toEl).then(finalize);
      } else {
        finalize();
      }
      return;
    }

    if (global.AnimationManager && fromEl && fromEl !== toEl) {
      global.AnimationManager.swapViews(fromEl, toEl).then(finalize);
      return;
    }

    TRACK_VIEWS.forEach(function (vid) {
      var el = $(vid);
      if (el) el.classList.toggle("hidden", vid !== id);
    });

    if (global.AnimationManager && toEl && !fromEl) {
      global.AnimationManager.enterView(toEl).then(finalize);
      return;
    }

    finalize();
  }

  function updateHeader(inModule) {
    var back = $("btn-back");
    var dash = $("btn-dashboard");
    if (back) back.classList.toggle("hidden", !inModule);
    if (dash) dash.classList.toggle("hidden", !inModule);
  }

  function goHub(isBoot) {
    showTrackView("view-tracking-hub", isBoot ? { boot: true } : undefined);
  }
  function goDashboard() {
    if (global.AnimationManager) {
      global.AnimationManager.navigateTo("/dashboard");
    } else {
      window.location.href = "/dashboard";
    }
  }

  function goNutrition() {
    showTrackView("view-tracking-nutrition");
    bindNutritionView();
  }

  function goReminders() {
    showTrackView("view-tracking-reminders");
    refreshReminderUI();
  }

  function onBack() {
    var hub = $("view-tracking-hub");
    if (hub && !hub.classList.contains("hidden")) { goDashboard(); return; }
    goHub();
  }

  function bindHeader() {
    var back = $("btn-back");
    var dash = $("btn-dashboard");
    if (back && back.getAttribute("data-track-bound") !== "1") {
      back.setAttribute("data-track-bound", "1");
      back.addEventListener("click", onBack);
    }
    if (dash && dash.getAttribute("data-track-bound") !== "1") {
      dash.setAttribute("data-track-bound", "1");
      dash.addEventListener("click", goDashboard);
    }
  }

  function bindHub() {
    var nutritionCard = $("track-card-nutrition");
    var remindersCard = $("track-card-reminders");
    if (nutritionCard && nutritionCard.getAttribute("data-track-bound") !== "1") {
      nutritionCard.setAttribute("data-track-bound", "1");
      nutritionCard.addEventListener("click", goNutrition);
    }
    if (remindersCard && remindersCard.getAttribute("data-track-bound") !== "1") {
      remindersCard.setAttribute("data-track-bound", "1");
      remindersCard.addEventListener("click", goReminders);
    }
  }

  function setSuggestOpen(open) {
    var card = document.querySelector(".tracking-input-card");
    if (card) card.classList.toggle("is-suggest-open", !!open);
  }

  function hideSuggest() {
    var box = $("track-suggest");
    if (box) box.classList.add("hidden");
    suggestIndex = -1;
    currentSuggestions = [];
    setSuggestOpen(false);
  }

  // ── FIX #3: applySuggestion — only replace the last typed fragment ────────
  // e.g.  "Breakfast: 1 egg, 1 par"  →  "Breakfast: 1 egg, 1 paratha (medium)"
  //        colon-prefix is kept, comma-separated items before last are kept
  function applySuggestion(item) {
    var ta = $("track-food-input");
    if (!ta || !item) return;
    var val = ta.value;
    var lines = val.split("\n");
    var last = lines[lines.length - 1];

    var colonIdx = last.indexOf(":");
    var prefix = "";      // e.g. "Breakfast: "
    var afterColon = last; // everything after colon

    if (colonIdx >= 0) {
      prefix     = last.slice(0, colonIdx + 1) + " ";
      afterColon = last.slice(colonIdx + 1).replace(/^\s+/, "");
    }

    // Split afterColon by comma or +, keep all but last fragment
    var separatorMatch = afterColon.match(/^(.*?)([,+]\s*)([^,+]*)$/);
    var kept      = "";  // "1 egg, "
    // var fragment = ""; // "1 par"  ← what user typed last (replaced by suggestion)

    if (separatorMatch) {
      kept = separatorMatch[1] + separatorMatch[2]; // "1 egg, "
    } else if (colonIdx >= 0) {
      kept = ""; // first item after colon, nothing to keep
    } else {
      // No colon at all — full line is just the fragment
      kept = "";
      prefix = "";
    }

    lines[lines.length - 1] = prefix + kept + item.insert_text;
    ta.value = lines.join("\n");
    ta.focus();
    hideSuggest();
  }

  function renderSuggest(list) {
    var box = $("track-suggest");
    if (!box) return;
    currentSuggestions = list || [];
    if (!currentSuggestions.length) { hideSuggest(); return; }
    box.innerHTML = "";
    currentSuggestions.forEach(function(item, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tracking-suggest__item" + (idx === suggestIndex ? " is-active" : "");
      btn.textContent = item.label;
      btn.addEventListener("click", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        applySuggestion(item);
      });
      box.appendChild(btn);
    });
    box.classList.remove("hidden");
    setSuggestOpen(true);
  }

  // ── FIX #4: Scroll-down arrow — shows after analyze, hides on arrival ────
  function showScrollArrow() {
    var arrow = $("track-scroll-arrow");
    if (!arrow) return;
    arrow.classList.remove("hidden");
    arrow.classList.add("track-scroll-arrow--visible");
  }

  function hideScrollArrow() {
    var arrow = $("track-scroll-arrow");
    if (!arrow) return;
    arrow.classList.remove("track-scroll-arrow--visible");
    arrow.classList.add("hidden");
  }

  function injectScrollArrow() {
    if ($("track-scroll-arrow")) return;
    var btn = document.createElement("button");
    btn.id = "track-scroll-arrow";
    btn.type = "button";
    btn.className = "track-scroll-arrow hidden";
    btn.setAttribute("aria-label", "Scroll to results");
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" width="22" height="22" aria-hidden="true">' +
      '<polyline points="6 9 12 15 18 9"></polyline></svg>';
    btn.addEventListener("click", function() {
      var results = $("track-results");
      if (results) results.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(hideScrollArrow, 800);
    });
    document.body.appendChild(btn);
  }

  function runAnalyze() {
    var ui = getUI();
    var foods = getFoods();
    var stateApi = getState();
    if (!ui) return;

    var input = $("track-food-input");
    var text = (input && input.value ? input.value : "").trim();
    ui.showAnalyzeError("");

    if (!text) {
      ui.showAnalyzeError("Please enter food items");
      ui.showResults(false);
      return;
    }

    if (!foods || !foods.analyzeFoodText) {
      ui.showAnalyzeError("Unable to analyze food right now");
      return;
    }

    ui.setAnalyzeLoading(true);
    ui.showResults(false);
    hideScrollArrow();
    var reco = $("track-recommendations");
    if (reco) reco.classList.add("hidden");

    foods
      .analyzeFoodText(text)
      .then(function(result) {
        ui.setAnalyzeLoading(false);
        if (!hasMatchedFoods(result)) {
          ui.showAnalyzeError("No foods recognized. Try names like 'paratha', 'chai', 'chicken karahi'.");
          ui.showResults(false);
          return;
        }
        try {
          var session = null;
          if (stateApi && stateApi.saveAnalysisSession) {
            session = stateApi.saveAnalysisSession(text, result);
          } else {
            session = {
              targets: (stateApi && stateApi.calculateTargets)
                ? stateApi.calculateTargets(stateApi.loadProfile ? stateApi.loadProfile() : {})
                : {},
              recommendations: null,
            };
          }
          ui.renderResults(result, session);
          // Show scroll arrow after results rendered
          showScrollArrow();
        } catch (err) {
          ui.showAnalyzeError("Unable to analyze food right now");
          ui.showResults(false);
        }
      })
      .catch(function() {
        ui.setAnalyzeLoading(false);
        ui.showResults(false);
        ui.showAnalyzeError("Unable to analyze food right now");
      });
  }

  function onNutritionClick(e) {
    var analyzeBtn = e.target.closest("#track-analyze-btn");
    if (!analyzeBtn) return;
    e.preventDefault();
    e.stopPropagation();
    runAnalyze();
  }

  function onNutritionInput(e) {
    if (!e.target || e.target.id !== "track-food-input") return;
    var foods = getFoods();
    clearTimeout(suggestTimer);
    var text = e.target.value;
    var fragment = text.split("\n").pop() || "";
    var query = fragment.split(/[,+]/).pop().trim();
    // Strip the part before colon if query still has it
    if (query.indexOf(":") >= 0) {
      query = query.slice(query.indexOf(":") + 1).trim();
    }
    if (query.length < 2) { hideSuggest(); return; }
    suggestTimer = setTimeout(function() {
      if (!foods || !foods.fetchSuggestions) return;
      foods.fetchSuggestions(query).then(renderSuggest).catch(hideSuggest);
    }, 220);
  }

  function onNutritionKeydown(e) {
    if (!e.target || e.target.id !== "track-food-input") return;
    var suggestBox = $("track-suggest");
    if (!suggestBox || suggestBox.classList.contains("hidden")) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      suggestIndex = Math.min(currentSuggestions.length - 1, suggestIndex + 1);
      renderSuggest(currentSuggestions);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      suggestIndex = Math.max(0, suggestIndex - 1);
      renderSuggest(currentSuggestions);
    } else if (e.key === "Enter" && suggestIndex >= 0) {
      e.preventDefault();
      applySuggestion(currentSuggestions[suggestIndex]);
    } else if (e.key === "Escape") {
      hideSuggest();
    }
  }

  function bindNutritionView() {
    var section = $("view-tracking-nutrition");
    if (!section) return;
    if (section.getAttribute("data-events-bound") !== "1") {
      section.setAttribute("data-events-bound", "1");
      section.addEventListener("click", onNutritionClick);
      section.addEventListener("input", onNutritionInput);
      section.addEventListener("keydown", onNutritionKeydown);
    }
    if (!suggestDocClickBound) {
      suggestDocClickBound = true;
      document.addEventListener("click", onDocumentClickSuggest);
    }
  }

  function onDocumentClickSuggest(e) {
    if (!e.target.closest(".tracking-input-wrap")) hideSuggest();
  }

  // ── FIX #5: Custom reminder — show/hide textarea + sound toggle ──────────
  function refreshReminderUI() {
    var ui = getUI();
    var Reminders = getReminders();
    if (!ui || !Reminders) return;

    ui.renderReminderList(Reminders.getReminders(), function(id) {
      Reminders.removeReminder(id);
      refreshReminderUI();
    });

    // Show custom message textarea when "Custom" is selected
    var customWrap = $("track-custom-msg-wrap");
    var typeSel    = $("track-reminder-type");
    if (customWrap && typeSel) {
      var isCustom = typeSel.value === "Custom";
      customWrap.classList.toggle("hidden", !isCustom);
      var msgArea = $("track-reminder-message");
      if (msgArea) {
        msgArea.disabled = !isCustom;
        if (isCustom) msgArea.focus();
      }
    }

    // Sync sound toggle UI
    var soundToggle = $("track-sound-toggle");
    if (soundToggle && Reminders.isSoundEnabled) {
      soundToggle.checked = Reminders.isSoundEnabled();
    }
  }

  // ── FIX #1 & #5: bindReminders with improved notification UX ─────────────
  function bindReminders() {
    var typeSel   = $("track-reminder-type");
    var enableBtn = $("track-enable-notify");
    var addBtn    = $("track-add-reminder");
    var soundToggle = $("track-sound-toggle");
    var Reminders = getReminders();

    if (typeSel && typeSel.getAttribute("data-track-bound") !== "1") {
      typeSel.setAttribute("data-track-bound", "1");
      typeSel.addEventListener("change", refreshReminderUI);
    }

    // Sound toggle
    if (soundToggle && soundToggle.getAttribute("data-track-bound") !== "1") {
      soundToggle.setAttribute("data-track-bound", "1");
      if (Reminders && Reminders.isSoundEnabled) {
        soundToggle.checked = Reminders.isSoundEnabled();
      }
      soundToggle.addEventListener("change", function() {
        if (Reminders && Reminders.setSoundEnabled) {
          Reminders.setSoundEnabled(soundToggle.checked);
        }
      });
    }

    // FIX #1: Enable notifications with clear feedback messages
    if (enableBtn && enableBtn.getAttribute("data-track-bound") !== "1") {
      enableBtn.setAttribute("data-track-bound", "1");
      enableBtn.addEventListener("click", function() {
        if (!Reminders) return;
        // Register Service Worker when user enables notifications
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.register("/sw.js").catch(function() {});
        }
        Reminders.requestNotificationPermission(function(ok, reason) {
          var banner = $("track-notify-banner");
          if (!banner) return;
          if (ok) {
            banner.textContent = "✅ Notifications enabled! You will receive alerts at your set times.";
            banner.style.color = "#2dd4bf";
          } else if (reason === "denied") {
            banner.textContent = "🚫 Notifications blocked. Go to browser Settings → Site Settings → Notifications and allow this site.";
            banner.style.color = "#f87171";
          } else if (reason === "not_supported") {
            banner.textContent = "⚠️ Your browser does not support notifications. Try Chrome or Firefox.";
            banner.style.color = "#fbbf24";
          } else {
            banner.textContent = "⚠️ Notification permission was dismissed. Click again to allow.";
            banner.style.color = "#fbbf24";
          }
        });
      });
    }

    // Add reminder button
    if (addBtn && addBtn.getAttribute("data-track-bound") !== "1") {
      addBtn.setAttribute("data-track-bound", "1");
      addBtn.addEventListener("click", function() {
        if (!Reminders) return;
        var time    = $("track-reminder-time");
        var type    = $("track-reminder-type");
        var msg     = $("track-reminder-message");
        var timeVal = (time && time.value) || "08:00";
        var typeVal = (type && type.value) || "Breakfast";
        var msgVal  = (msg && msg.value) || "";
        if (typeVal === "Custom" && !msgVal.trim()) {
          var msgArea = $("track-reminder-message");
          if (msgArea) {
            msgArea.focus();
            msgArea.style.borderColor = "#f87171";
            setTimeout(function() { msgArea.style.borderColor = ""; }, 1500);
          }
          return;
        }
        Reminders.addReminder({ time: timeVal, type: typeVal, message: msgVal.trim() });
        refreshReminderUI();
        if (msg) msg.value = "";
      });
    }
  }

  // ── Service Worker registration on boot ──────────────────────────────────
  function registerSW() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(function() {});
    }
  }

  function bootTrackingOnce() {
    if (trackingBooted) return;
    trackingBooted = true;
    registerSW();
    injectScrollArrow();
    bindHeader();
    bindHub();
    bindNutritionView();
    bindReminders();
    var Reminders = getReminders();
    if (Reminders && Reminders.initReminders) Reminders.initReminders();
    goHub(true);
  }

  function init() {
    whenReady(bootTrackingOnce);
  }

  global.FitAITracking = {
    init: init,
    goHub: goHub,
    goNutrition: goNutrition,
    goReminders: goReminders,
    bindNutritionView: bindNutritionView,
  };

  whenReady(function() {
    if (isTrackingModule()) bootTrackingOnce();
  });
})(typeof window !== "undefined" ? window : globalThis);

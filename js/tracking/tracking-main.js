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

  async function goNutrition() {
    var stateApi = getState();
    var ui = getUI();
    if (!stateApi || !ui) return;

    // Check body type gate before showing nutrition tracker
    var profile = stateApi.loadProfile();
    var hasBodyType = profile && profile.bodyTypeKey;

    // If logged in, check database as well
    if (!hasBodyType && window.FitAIAuth) {
      var user = await window.FitAIAuth.getCurrentUser();
      if (user) {
        var dbProfile = await window.FitAIAuth.getProfile(user.id);
        if (dbProfile && dbProfile.body_type) {
          profile = profile || {};
          profile.bodyTypeKey = dbProfile.body_type;
          localStorage.setItem("fitai-profile", JSON.stringify(profile));
          hasBodyType = true;
        }
      }
    }

    if (!hasBodyType) {
      ui.renderBodyTypeGate(
        function(selectedType) {
          profile = profile || {};
          profile.bodyTypeKey = selectedType;
          localStorage.setItem("fitai-profile", JSON.stringify(profile));
          stateApi.calculateTargets(profile);
          // After selection, proceed to nutrition
          goNutrition();
        },
        function() {
          sessionStorage.setItem("fitai-prefill-plan", "tracking-redirect");
          if (global.AnimationManager) {
            global.AnimationManager.navigateTo("/?module=classifier");
          } else {
            window.location.href = "/?module=classifier";
          }
        }
      );
      return;
    }

    showTrackView("view-tracking-nutrition");
    bindNutritionView();
    
    // Load existing cumulative results for today if they exist
    var date = stateApi.todayKey();
    var currentNutrition = stateApi.readJson("fitai-tracking-nutrition", null);
    if (currentNutrition && currentNutrition.date === date && currentNutrition.items.length > 0) {
      ui.renderResults({ items: currentNutrition.items, summary: currentNutrition.summary }, { cumulativeSummary: currentNutrition.summary, cumulativeItems: currentNutrition.items });
    }
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

  function applySuggestion(item) {
    var ta = $("track-food-input");
    if (!ta || !item) return;
    var val = ta.value;
    var lines = val.split("\n");
    var last = lines[lines.length - 1];

    var colonIdx = last.indexOf(":");
    var prefix = "";
    var afterColon = last;

    if (colonIdx >= 0) {
      prefix     = last.slice(0, colonIdx + 1) + " ";
      afterColon = last.slice(colonIdx + 1).replace(/^\s+/, "");
    }

    var separatorMatch = afterColon.match(/^(.*?)([,+]\s*)([^,+]*)$/);
    var kept      = "";

    if (separatorMatch) {
      kept = separatorMatch[1] + separatorMatch[2];
    } else if (colonIdx >= 0) {
      kept = "";
    } else {
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
          // Clear input after successful analyze to encourage next entry
          if (input) input.value = "";
          ui.renderResults(result, session);
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

  function refreshReminderUI() {
    var ui = getUI();
    var Reminders = getReminders();
    if (!ui || !Reminders) return;

    ui.renderReminderList(Reminders.getReminders(), function(id) {
      Reminders.removeReminder(id);
      refreshReminderUI();
    });

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

    var soundToggle = $("track-sound-toggle");
    if (soundToggle && Reminders.isSoundEnabled) {
      soundToggle.checked = Reminders.isSoundEnabled();
    }
  }

  function bindReminders() {
    var typeSel   = $("track-reminder-type");
    var enableBtn = $("track-enable-notify");
    var addBtn    = $("track-add-reminder");
    var Reminders = getReminders();
    var ui        = getUI();

    if (typeSel && typeSel.getAttribute("data-bound") !== "1") {
      typeSel.setAttribute("data-bound", "1");
      typeSel.addEventListener("change", refreshReminderUI);
    }
    if (enableBtn && enableBtn.getAttribute("data-bound") !== "1") {
      enableBtn.setAttribute("data-bound", "1");
      enableBtn.addEventListener("click", function() {
        if (Reminders) Reminders.requestPermission();
      });
    }
    if (addBtn && addBtn.getAttribute("data-bound") !== "1") {
      addBtn.setAttribute("data-bound", "1");
      addBtn.addEventListener("click", function() {
        var time = $("track-reminder-time").value;
        var type = $("track-reminder-type").value;
        var msg  = $("track-reminder-message").value;
        if (!time) return;
        if (Reminders) {
          Reminders.addReminder(time, type, msg);
          refreshReminderUI();
        }
      });
    }
    var soundToggle = $("track-sound-toggle");
    if (soundToggle && soundToggle.getAttribute("data-bound") !== "1") {
      soundToggle.setAttribute("data-bound", "1");
      soundToggle.addEventListener("change", function(e) {
        if (Reminders) Reminders.setSoundEnabled(e.target.checked);
      });
    }
  }

  function boot() {
    if (trackingBooted) return;
    trackingBooted = true;
    bindHeader();
    bindHub();
    bindReminders();
    injectScrollArrow();
    
    var ui = getUI();
    if (ui) ui.applyTrackingI18n();

    var params = new URLSearchParams(window.location.search);
    var sub = params.get("sub");
    if (sub === "nutrition") goNutrition();
    else if (sub === "reminders") goReminders();
    else goHub(true);

    // Step E: Handle redirect back from classifier
    var handoff = sessionStorage.getItem("fitai-prefill-plan");
    if (handoff === "tracking-redirect") {
        sessionStorage.removeItem("fitai-prefill-plan");
        // Body type should now be saved in localStorage by app.js after assessment
        goNutrition();
    }
  }

  whenReady(function() {
    if (isTrackingModule()) boot();
  });

  global.FitAITrackingMain = {
    boot: boot,
    goHub: goHub,
    goNutrition: goNutrition,
    goReminders: goReminders,
    onBack: onBack
  };
})(typeof window !== "undefined" ? window : globalThis);

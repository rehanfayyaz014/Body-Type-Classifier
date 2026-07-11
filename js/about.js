(function (global) {
  var ALL_VIEW_IDS = [
    "view-landing",
    "view-quiz",
    "view-plan",
    "view-result",
    "view-detail",
    "view-recommendation",
    "view-tracking-hub",
    "view-tracking-nutrition",
    "view-tracking-reminders",
  ];

  var aboutBooted = false;

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

  function isAboutModule() {
    return new URLSearchParams(window.location.search).get("module") === "about";
  }

  function goDashboard() {
    if (global.AnimationManager) {
      global.AnimationManager.navigateTo("/dashboard");
    } else {
      window.location.href = "/dashboard";
    }
  }

  function updateHeader() {
    var back = $("btn-back");
    var dash = $("btn-dashboard");
    if (back) back.classList.remove("hidden");
    if (dash) dash.classList.remove("hidden");
  }

  function applyAboutI18n() {
    // Reuse the app's own translation strings/mechanism (I18N + STORAGE_LANG),
    // no new language system is introduced.
    if (!global.I18N) return;
    var lang = "en";
    try {
      lang = localStorage.getItem("fitai-lang") || "en";
    } catch (err) {}
    var strings = global.I18N[lang] || global.I18N.en;
    document.querySelectorAll("#view-about [data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (!key || !strings[key]) return;
      node.textContent = strings[key];
    });
  }

  function showAbout(isBoot) {
    ALL_VIEW_IDS.forEach(function (id) {
      var el = $(id);
      if (el) el.classList.add("hidden");
    });
    var aboutEl = $("view-about");
    if (aboutEl) aboutEl.classList.remove("hidden");

    applyAboutI18n();
    updateHeader();

    if (isBoot) {
      document.documentElement.classList.remove("fitai-booting");
      if (global.AnimationManager && aboutEl) {
        global.AnimationManager.enterView(aboutEl);
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindHeader() {
    var back = $("btn-back");
    var dash = $("btn-dashboard");
    if (back && back.getAttribute("data-about-bound") !== "1") {
      back.setAttribute("data-about-bound", "1");
      back.addEventListener("click", goDashboard);
    }
    if (dash && dash.getAttribute("data-about-bound") !== "1") {
      dash.setAttribute("data-about-bound", "1");
      dash.addEventListener("click", goDashboard);
    }
  }

  function boot() {
    if (aboutBooted) return;
    aboutBooted = true;
    bindHeader();
    showAbout(true);
  }

  whenReady(function () {
    if (isAboutModule()) boot();
  });

  global.FitAIAbout = { boot: boot, goDashboard: goDashboard };
})(typeof window !== "undefined" ? window : globalThis);

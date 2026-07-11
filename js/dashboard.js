(function () {
  var I18N = window.FitAIStrings;
  if (!I18N) return;

  var STORAGE_LANG = "fitai-lang";
  var STORAGE_THEME = "fitai-theme";
  var state = { lang: "en", theme: "dark" };

  function $(id) {
    return document.getElementById(id);
  }

  function getStrings() {
    return I18N[state.lang] || I18N.en;
  }

  function applyI18n() {
    var s = getStrings();
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (!key || !s[key]) return;
      if (/<\s*br/i.test(s[key])) node.innerHTML = s[key];
      else node.textContent = s[key];
    });
    var brand = $("brand-title");
    if (brand && s.brand) brand.textContent = s.brand;
    document.title = (s.brand || "FitAI") + " — " + (s.dashPageTitle || "Dashboard");
  }

  function setLang(lang) {
    if (!I18N[lang]) lang = "en";
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
    document.documentElement.classList.toggle("theme-light", theme === "light");
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    document.body.classList.toggle("theme-light", theme === "light");
    document.body.classList.toggle("theme-dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    var sun = $("btn-theme")?.querySelector(".icon-sun");
    var moon = $("btn-theme")?.querySelector(".icon-moon");
    if (sun && moon) {
      sun.classList.toggle("hidden", theme === "light");
      moon.classList.toggle("hidden", theme === "dark");
    }
    var metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", theme === "light" ? "#e8eef7" : "#0f1729");
    }
  }

  function closeLangMenu() {
    var menu = $("lang-menu");
    var btn = $("btn-lang");
    if (menu) menu.classList.add("hidden");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function openFoodPreview() {
    var overlay = $("food-preview-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closeFoodPreview() {
    var overlay = $("food-preview-overlay");
    if (!overlay) return;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  function bindModuleLinks() {
    document.querySelectorAll("a.feature-hub-card[href]").forEach(function (link) {
      if (link.getAttribute("data-nav-bound") === "1") return;
      link.setAttribute("data-nav-bound", "1");
      link.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        var href = link.getAttribute("href");
        if (window.AnimationManager) {
          window.AnimationManager.navigateTo(href);
        } else {
          window.location.href = href;
        }
      });
    });
  }

  async function init() {
    state.lang = localStorage.getItem(STORAGE_LANG) || "en";
    state.theme = localStorage.getItem(STORAGE_THEME) || "dark";
    setLang(state.lang);
    setTheme(state.theme);

    if (window.FitAIAuth) {
      var user = await window.FitAIAuth.getCurrentUser();
      if (!user) {
        window.location.href = "/";
        return;
      }
      if (window.FitAIHeaderUI) {
        window.FitAIHeaderUI.sync(user);
      }
    }
    
    $("btn-theme")?.addEventListener("click", function () {
      setTheme(state.theme === "dark" ? "light" : "dark");
    });

    $("btn-home")?.addEventListener("click", function () {
      if (window.AnimationManager) {
        window.AnimationManager.navigateTo("/");
      } else {
        window.location.href = "/";
      }
    });

    $("btn-lang")?.addEventListener("click", function (e) {
      e.stopPropagation();
      var menu = $("lang-menu");
      var open = menu && menu.classList.contains("hidden");
      if (open) {
        menu.classList.remove("hidden");
        $("btn-lang").setAttribute("aria-expanded", "true");
      } else closeLangMenu();
    });

    document.querySelectorAll(".dropdown__opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLang(btn.getAttribute("data-lang"));
        closeLangMenu();
      });
    });

    document.addEventListener("click", closeLangMenu);
    $("lang-wrap")?.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    $("lang-menu")?.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    $("card-food")?.addEventListener("click", function (e) {
      e.preventDefault();
      openFoodPreview();
    });
    $("food-preview-close")?.addEventListener("click", closeFoodPreview);
    $("food-preview-continue")?.addEventListener("click", closeFoodPreview);
    $("food-preview-overlay")?.addEventListener("click", function (e) {
      if (e.target === $("food-preview-overlay")) closeFoodPreview();
    });
    bindModuleLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

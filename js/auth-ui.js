(function () {
  function $(id) { return document.getElementById(id); }

  function showModal() {
    $("auth-overlay")?.classList.remove("hidden");
  }
  function hideModal() {
    $("auth-overlay")?.classList.add("hidden");
    $("login-error")?.classList.add("hidden");
    $("signup-error")?.classList.add("hidden");
  }

  function switchTab(tab) {
    var isLogin = tab === "login";
    $("auth-tab-login")?.classList.toggle("is-active", isLogin);
    $("auth-tab-signup")?.classList.toggle("is-active", !isLogin);
    $("auth-form-login")?.classList.toggle("hidden", !isLogin);
    $("auth-form-signup")?.classList.toggle("hidden", isLogin);
  }

  function getStrings() {
    var lang = localStorage.getItem("fitai-lang") || "en";
    return (window.FitAIStrings && window.FitAIStrings[lang]) || (window.FitAIStrings && window.FitAIStrings.en) || {};
  }

  function applyI18n() {
    var strings = getStrings();
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (!key || !strings[key]) return;
      node.textContent = strings[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (node) {
      var key = node.getAttribute("data-i18n-placeholder");
      if (!key || !strings[key]) return;
      node.setAttribute("placeholder", strings[key]);
    });
  }

  function showError(id, message) {
    var el = $(id);
    if (!el) return;
    el.textContent = message;
    el.classList.remove("hidden");
  }

  function showNotification(title, message, icon) {
    var overlay = $("notify-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "notify-overlay";
      overlay.className = "auth-overlay animate-fadeIn";
      overlay.innerHTML =
        '<div class="auth-modal glass-card notify-card animate-slideUp">' +
          '<div class="notify-card__icon" id="notify-icon">🎉</div>' +
          '<h2 class="notify-card__title" id="notify-title">Success</h2>' +
          '<p class="notify-card__body" id="notify-body">Action completed successfully.</p>' +
          '<button type="button" class="btn btn--primary" id="notify-close" style="width:100%; margin-top:0.5rem;">Continue</button>' +
        '</div>';
      document.body.appendChild(overlay);
      $("notify-close")?.addEventListener("click", function () {
        overlay.classList.add("hidden");
      });
    }
    $("notify-title").textContent = title;
    $("notify-body").textContent = message;
    $("notify-icon").textContent = icon || "🎉";
    overlay.classList.remove("hidden");
  }

  function getHeaderPageKind() {
    var page = document.body.getAttribute("data-header-page");
    if (page === "dashboard") return "dashboard";
    if (page === "profile") return "module";

    var module = new URLSearchParams(window.location.search).get("module");
    if (module) return "module";

    var landing = document.getElementById("view-landing");
    if (landing && !landing.classList.contains("hidden")) return "landing";
    return "module";
  }

  function shouldShowWelcome(kind) {
    return kind === "landing" || kind === "dashboard";
  }

  function shouldShowProfileBtn(kind) {
    return kind === "landing";
  }

  function setWelcomeCenterEmpty(empty) {
    var welcome = $("header-user-welcome");
    var center = welcome && welcome.closest(".top-bar__center");
    if (center) center.classList.toggle("top-bar__center--empty", !!empty);
  }

  function displayWelcomeText(text) {
    var welcome = $("header-user-welcome");
    if (!welcome) return;
    welcome.textContent = text;
    welcome.classList.remove("hidden");
    welcome.style.animation = "none";
    void welcome.offsetWidth;
    welcome.style.animation = "";
    setWelcomeCenterEmpty(false);
  }

  function hideWelcomeText() {
    var welcome = $("header-user-welcome");
    if (!welcome) return;
    welcome.textContent = "";
    welcome.classList.add("hidden");
    setWelcomeCenterEmpty(true);
  }

  function syncProfileButton() {
    var btn = $("btn-account");
    if (!btn) return;
    btn.classList.toggle("hidden", !shouldShowProfileBtn(getHeaderPageKind()));
  }

  function updateAccountUI() {
    var badge = $("account-name-badge");
    if (badge) {
      badge.textContent = "";
      badge.classList.add("hidden");
    }
    syncProfileButton();
  }

  function updateHeaderWelcome(user) {
    var kind = getHeaderPageKind();
    syncProfileButton();

    if (!shouldShowWelcome(kind) || !user) {
      hideWelcomeText();
      return;
    }

    var strings = getStrings();
    var prefix = strings.headerWelcome || "Welcome";
    var name = (user.user_metadata && user.user_metadata.name) || (user.email && user.email.split("@")[0]) || "there";
    displayWelcomeText(prefix + ", " + name);
  }

  function syncHeaderChrome(user) {
    updateAccountUI();
    updateHeaderWelcome(user);
  }

  window.FitAIHeaderUI = {
    sync: syncHeaderChrome,
    refresh: function () {
      if (!window.FitAIAuth) return Promise.resolve();
      return window.FitAIAuth.getCurrentUser().then(syncHeaderChrome);
    },
  };

  function init() {
    if (!window.FitAIAuth) {
      console.error("FitAIAuth not found. Check script order.");
      return;
    }

    $("btn-account")?.addEventListener("click", async function () {
      var user = await window.FitAIAuth.getCurrentUser();
      if (user) {
        if ($("logout-confirm-text")) $("logout-confirm-text").textContent = "Logout from " + user.email + "?";
        $("logout-overlay")?.classList.remove("hidden");
      } else {
        showModal();
      }
    });

    $("logout-cancel")?.addEventListener("click", function () {
      $("logout-overlay")?.classList.add("hidden");
    });

    $("logout-confirm")?.addEventListener("click", async function () {
      await window.FitAIAuth.signOut();
      syncHeaderChrome(null);
      $("logout-overlay")?.classList.add("hidden");
    });

    $("auth-close")?.addEventListener("click", hideModal);
    $("auth-tab-login")?.addEventListener("click", function () { switchTab("login"); });
    $("auth-tab-signup")?.addEventListener("click", function () { switchTab("signup"); });
    applyI18n();

    $("auth-form-login")?.addEventListener("submit", async function (e) {
      e.preventDefault();
      $("login-error")?.classList.add("hidden");
      try {
        await window.FitAIAuth.signIn($("login-email").value, $("login-password").value);
        var user = await window.FitAIAuth.getCurrentUser();
        syncHeaderChrome(user);
        hideModal();
      } catch (err) {
        var message = err.message || getStrings().authLoginErrorDefault || "Login failed";
        showError("login-error", message);
      }
    });

    $("auth-form-signup")?.addEventListener("submit", async function (e) {
      e.preventDefault();
      $("signup-error")?.classList.add("hidden");
      try {
        var signupEmail = $("signup-email").value;
        var outcome = await window.FitAIAuth.signUp(
          signupEmail,
          $("signup-password").value,
          $("signup-name").value
        );

        hideModal();

        if (outcome.pendingConfirmation) {
          // No active session yet — Supabase sent a confirmation email/link.
          // Do NOT treat the user as logged in.
          syncHeaderChrome(null);
          showNotification(
            getStrings().authConfirmPendingTitle || "Confirm your email",
            (getStrings().authConfirmPendingMessage ||
              "We've sent a confirmation link to {email}. Please verify it to activate your account.").replace(
              "{email}",
              signupEmail
            ),
            "📩"
          );
        } else {
          var user = await window.FitAIAuth.getCurrentUser();
          syncHeaderChrome(user);
          showNotification(
            getStrings().authSignupSuccessTitle || "Account Created!",
            getStrings().authSignupSuccessMessage || "Your account is ready and your data has been synced. Welcome to FitForge!",
            "🚀"
          );
        }
      } catch (err) {
        var message = err.message || getStrings().authSignupErrorDefault || "Signup failed";
        showError("signup-error", message);
      }
    });

    window.FitAIAuth.getCurrentUser().then(syncHeaderChrome);
    document.addEventListener("fitai-language-change", function () {
      applyI18n();
      window.FitAIAuth.getCurrentUser().then(syncHeaderChrome);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
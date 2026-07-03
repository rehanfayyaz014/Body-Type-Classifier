(function () {
  function $(id) { return document.getElementById(id); }

  function showModal() {
    $("auth-overlay").classList.remove("hidden");
  }
  function hideModal() {
    $("auth-overlay").classList.add("hidden");
    $("login-error").classList.add("hidden");
    $("signup-error").classList.add("hidden");
  }

  function switchTab(tab) {
    var isLogin = tab === "login";
    $("auth-tab-login").classList.toggle("is-active", isLogin);
    $("auth-tab-signup").classList.toggle("is-active", !isLogin);
    $("auth-form-login").classList.toggle("hidden", !isLogin);
    $("auth-form-signup").classList.toggle("hidden", isLogin);
  }

  function showError(id, message) {
    var el = $(id);
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
      $("notify-close").addEventListener("click", function() {
        overlay.classList.add("hidden");
      });
    }
    $("notify-title").textContent = title;
    $("notify-body").textContent = message;
    $("notify-icon").textContent = icon || "🎉";
    overlay.classList.remove("hidden");
  }

  function updateAccountUI(user) {
    var badge = $("account-name-badge");
    if (user) {
      var name = (user.user_metadata && user.user_metadata.name) || user.email;
      badge.textContent = name;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
      badge.textContent = "";
    }
  }

  function init() {
    if (!window.FitAIAuth) {
      console.error("FitAIAuth not found. Check script order.");
      return;
    }

    $("btn-account").addEventListener("click", async function () {
      var user = await window.FitAIAuth.getCurrentUser();
      if (user) {
        $("logout-confirm-text").textContent = "Logout from " + user.email + "?";
        $("logout-overlay").classList.remove("hidden");
      } else {
        showModal();
      }
    });

    $("logout-cancel").addEventListener("click", function () {
      $("logout-overlay").classList.add("hidden");
    });

    $("logout-confirm").addEventListener("click", async function () {
      await window.FitAIAuth.signOut();
      updateAccountUI(null);
      $("logout-overlay").classList.add("hidden");
    });

    $("auth-close").addEventListener("click", hideModal);
    $("auth-tab-login").addEventListener("click", function () { switchTab("login"); });
    $("auth-tab-signup").addEventListener("click", function () { switchTab("signup"); });

    $("auth-form-login").addEventListener("submit", async function (e) {
      e.preventDefault();
      $("login-error").classList.add("hidden");
      try {
        await window.FitAIAuth.signIn($("login-email").value, $("login-password").value);
        var user = await window.FitAIAuth.getCurrentUser();
        updateAccountUI(user);
        hideModal();
      } catch (err) {
        showError("login-error", err.message || "Login failed");
      }
    });

    $("auth-form-signup").addEventListener("submit", async function (e) {
      e.preventDefault();
      $("signup-error").classList.add("hidden");
      try {
        await window.FitAIAuth.signUp(
          $("signup-email").value,
          $("signup-password").value,
          $("signup-name").value
        );
        var user = await window.FitAIAuth.getCurrentUser();
        updateAccountUI(user);
        hideModal();
        showNotification("Account Created!", "Your account is ready and your data has been synced. Welcome to FitAI!", "🚀");
      } catch (err) {
        showError("signup-error", err.message || "Signup failed");
      }
    });

    // On load, check if already logged in (session persisted)
    window.FitAIAuth.getCurrentUser().then(updateAccountUI);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
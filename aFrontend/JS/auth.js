// ./JS/auth.js

/* ✅ Custom Alert Override (Removes "127.0.0.1:5500 says") */
(function () {
  // Avoid double-inject if script loaded multiple times
  if (window.__DFH_ALERT_PATCHED__) return;
  window.__DFH_ALERT_PATCHED__ = true;

  // 1) CSS
  const css = `
    .dfh-alert-backdrop{
      position:fixed; inset:0; background:rgba(0,0,0,.35);
      display:none; align-items:center; justify-content:center; z-index:99999;
    }
    .dfh-alert-box{
      width:min(420px,92%); background:#fff; border-radius:12px;
      box-shadow:0 10px 30px rgba(0,0,0,.2); padding:18px 20px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
    }
    .dfh-alert-box h3{ margin:0 0 8px; font-size:18px; }
    .dfh-alert-box p{ margin:0 0 14px; font-size:15px; color:#334155; }
    .dfh-alert-actions{ display:flex; justify-content:flex-end; gap:10px; }
    .dfh-alert-actions button{
      padding:8px 16px; border:none; border-radius:10px; cursor:pointer;
      background:#2563eb; color:#fff; font-weight:600;
    }

    /* ✅ Profile Modal (shared for all pages) */
    .dfh-modal{
      position:fixed; inset:0; background:rgba(0,0,0,.35);
      display:none; align-items:center; justify-content:center; z-index:99998;
      padding:16px;
    }
    .dfh-modal-card{
      width:min(520px,92%); background:#fff; border-radius:14px;
      box-shadow:0 10px 30px rgba(0,0,0,.22);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
      overflow:hidden;
    }
    .dfh-modal-head{
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 16px; border-bottom:1px solid #e2e8f0;
    }
    .dfh-modal-head h3{ margin:0; font-size:18px; }
    .dfh-modal-head button{
      border:none; background:transparent; cursor:pointer; font-size:16px;
    }
    .dfh-modal-body{
      padding:16px;
      display:grid;
      gap:10px;
    }
    .dfh-modal-body label{ font-size:13px; color:#64748b; }
    .dfh-modal-body input{
      width:100%; padding:10px 12px; border:1px solid #e2e8f0;
      border-radius:10px; outline:none;
    }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // 2) HTML Alert
  const wrap = document.createElement("div");
  wrap.id = "dfhCustomAlert";
  wrap.className = "dfh-alert-backdrop";
  wrap.innerHTML = `
    <div class="dfh-alert-box">
      <h3>Message</h3>
      <p id="dfhAlertMsg">-</p>
      <div class="dfh-alert-actions">
        <button type="button" id="dfhAlertOk">OK</button>
      </div>
    </div>
  `;

  function mountAlert() {
    if (document.getElementById("dfhCustomAlert")) return;
    document.body.appendChild(wrap);

    const okBtn = document.getElementById("dfhAlertOk");
    okBtn.addEventListener("click", () => {
      wrap.style.display = "none";
      if (typeof wrap.__resolve === "function") {
        const r = wrap.__resolve;
        wrap.__resolve = null;
        r(true);
      }
    });

    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) okBtn.click();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAlert);
  } else {
    mountAlert();
  }

  // ✅ FIX: make alert return Promise so logout waits
  window.alert = function (msg) {
    const show = () =>
      new Promise((resolve) => {
        const el = document.getElementById("dfhCustomAlert");
        const m = document.getElementById("dfhAlertMsg");
        if (!el || !m) return resolve(true);

        m.innerText = String(msg ?? "");
        el.__resolve = resolve;
        el.style.display = "flex";
      });

    if (document.readyState === "loading") {
      return new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", () => {
          show().then(resolve);
        });
      });
    }
    return show();
  };
})();

/* ================= COMMON AUTH HELPERS ================= */

function isLoggedIn() {
  return (
    localStorage.getItem("dfh_isLoggedIn") === "true" ||
    localStorage.getItem("isLoggedIn") === "true"
  );
}

function getUserKey() {
  return localStorage.getItem("dfh_userKey") || "";
}

function userHeaders() {
  return {
    "Content-Type": "application/json",
    "x-user-id": getUserKey(),
  };
}

function getUserName() {
  const name = localStorage.getItem("dfh_userName");
  if (name) return name;

  const u = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  return u?.name || u?.email || u?.userId || "User";
}

function getRole() {
  return localStorage.getItem("dfh_role") || "user";
}

function logout(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();

  // ✅ Clear NEW system
  localStorage.removeItem("dfh_isLoggedIn");
  localStorage.removeItem("dfh_userKey");
  localStorage.removeItem("dfh_userName");
  localStorage.removeItem("dfh_role");

  // ✅ Clear OLD system
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("loggedInUser");

  const p = alert("Logged out successfully!");
  if (p && typeof p.then === "function") {
    p.then(() => (window.location.href = "login.html"));
  } else {
    window.location.href = "login.html";
  }
}

function protectPage() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

function showTopUser() {
  const name = getUserName();
  const topUser = document.getElementById("topUser");
  if (topUser) topUser.textContent = `👤 ${name}`;
}

function protectAdminPage() {
  const isAdmin = getRole() === "admin";
  const isAdminPage = window.location.pathname.toLowerCase().includes("admin.html");

  if (isAdminPage && !isAdmin) {
    alert("Access Denied! Admin only.");
    window.location.href = "dashboard.html";
    return false;
  }
  return true;
}

/* ================= PROFILE (WORKS ON ALL PAGES) ================= */

function ensureProfileModal() {
  if (document.getElementById("profileModal")) return;

  const modal = document.createElement("div");
  modal.id = "profileModal";
  modal.className = "dfh-modal";
  modal.innerHTML = `
    <div class="dfh-modal-card">
      <div class="dfh-modal-head">
        <h3>My Profile</h3>
        <button id="btnCloseProfile" type="button">✖</button>
      </div>

      <div class="dfh-modal-body">
        <label>User ID</label>
        <input id="pUserId" type="text" readonly />

        <label>Name</label>
        <input id="pName" type="text" readonly />

        <label>Email</label>
        <input id="pEmail" type="text" readonly />
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openProfileModal() {
  const m = document.getElementById("profileModal");
  if (m) m.style.display = "flex";
}

function closeProfileModal() {
  const m = document.getElementById("profileModal");
  if (m) m.style.display = "none";
}

async function loadMyProfile() {
  const res = await fetch("http://localhost:5000/api/profile", {
    headers: userHeaders(),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.msg || "Profile load failed");

  const u = data.user || {};
  const elId = document.getElementById("pUserId");
  const elName = document.getElementById("pName");
  const elEmail = document.getElementById("pEmail");

  if (elId) elId.value = u.user_id || "";
  if (elName) elName.value = u.name || "";
  if (elEmail) elEmail.value = u.email || "";
}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
  if (!protectPage()) return;
  if (!protectAdminPage()) return;

  showTopUser();

  // ✅ Logout attach (same)
  document.querySelectorAll(".logout, .logout-btn").forEach((btn) => {
    btn.addEventListener("click", logout);
  });

  // ✅ Profile: make it work on ALL pages
  ensureProfileModal();

  const topUser = document.getElementById("topUser");
  if (topUser) {
    topUser.style.cursor = "pointer";
    topUser.addEventListener("click", async () => {
      try {
        await loadMyProfile();
        openProfileModal();
      } catch (e) {
        alert(e.message || "Profile error");
      }
    });
  }

  const closeBtn = document.getElementById("btnCloseProfile");
  if (closeBtn) closeBtn.addEventListener("click", closeProfileModal);

  const pm = document.getElementById("profileModal");
  if (pm) {
    pm.addEventListener("click", (e) => {
      if (e.target === pm) closeProfileModal();
    });
  }
});
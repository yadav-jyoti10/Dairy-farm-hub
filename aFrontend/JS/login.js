console.log("LOGIN JS CONNECTED");

// ✅ Password eye toggle
document.getElementById("togglePassword").addEventListener("click", () => {
  const pass = document.getElementById("password");
  pass.type = pass.type === "password" ? "text" : "password";
});

// ✅ Per-user fresh data (new user => fresh dashboard)
function ensureFreshUserData(userKey) {
  const keys = [
    `dfh_animals_${userKey}`,
    `dfh_milk_${userKey}`,
    `dfh_feed_${userKey}`,
    `dfh_sales_${userKey}`,
  ];
  keys.forEach((k) => {
    if (!localStorage.getItem(k)) localStorage.setItem(k, "[]");
  });
}

// ✅ Error helpers
function clearErrors() {
  const e1 = document.getElementById("emailError");
  const e2 = document.getElementById("passwordError");
  const e3 = document.getElementById("errorMsg");
  if (e1) e1.innerText = "";
  if (e2) e2.innerText = "";
  if (e3) e3.innerText = "";
}

function showEmailError(msg) {
  const el = document.getElementById("emailError");
  if (el) el.innerText = msg || "";
}

function showPasswordError(msg) {
  const el = document.getElementById("passwordError");
  if (el) el.innerText = msg || "";
}

function showGeneralError(msg) {
  const el = document.getElementById("errorMsg");
  if (el) el.innerText = msg || "";
}

// ✅ safe json read (kabhi server HTML bhej de to crash na ho)
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.log("RAW RESPONSE:", text);
    return { ok: false, msg: "INVALID_RESPONSE" };
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();

  const input = document.getElementById("email").value.trim(); // email OR user_id
  const password = document.getElementById("password").value.trim();

  // ✅ Inline validation
  if (!input) return showEmailError("Enter email or user id");
  if (!password) return showPasswordError("Enter password");
  if (password.length < 8) return showPasswordError("Minimum 8 characters");

  let res, data;

  try {
    res = await fetch("http://127.0.0.1:5000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, password }),
    });
  } catch (err) {
    showGeneralError("Server not running / Network error (start backend)");
    return;
  }

  data = await safeJson(res);

  // ✅ handle errors
  if (!res.ok || !data.ok) {
    const rawMsg = (data && data.msg) ? String(data.msg).trim() : "Login failed";
    const msgUpper = rawMsg.toUpperCase();

    // ✅ 403: blocked / forbidden (ALWAYS show)
    if (res.status === 403) {
      // blocked user case
      if (msgUpper.includes("BLOCKED")) {
        showEmailError("Account blocked");
        showGeneralError("Your account is blocked by Admin. Contact support.");
        return;
      }
      // other forbidden cases
      showGeneralError(rawMsg || "Access forbidden");
      return;
    }

    // ✅ 401: wrong creds
    if (res.status === 401) {
      if (msgUpper === "USER_NOT_FOUND") return showEmailError("Invalid email/user id");
      if (msgUpper === "WRONG_PASSWORD") return showPasswordError("Invalid password");

      // fallback
      showGeneralError("Invalid credentials");
      return;
    }

    // ✅ 400
    if (res.status === 400) {
      showGeneralError(rawMsg || "All fields required");
      return;
    }

    // ✅ anything else
    if (rawMsg === "INVALID_RESPONSE") {
      showGeneralError("Server returned invalid response. Restart backend.");
      return;
    }

    showGeneralError(rawMsg || "Login failed");
    return;
  }

  // ✅ success
  const user = data.user;
  const displayName = user.name || user.email || user.user_id;

  localStorage.setItem("dfh_isLoggedIn", "true");
  localStorage.setItem("dfh_userKey", user.user_id);
  localStorage.setItem("dfh_userName", displayName);
  localStorage.setItem("dfh_role", user.role || "user");

  ensureFreshUserData(user.user_id);

  document.getElementById("successPopup").style.display = "flex";
});

// ✅ OK redirect
document.getElementById("okBtn").addEventListener("click", () => {
  const role = localStorage.getItem("dfh_role") || "user";
  window.location.href = role === "admin" ? "admin.html" : "dashboard.html";
});
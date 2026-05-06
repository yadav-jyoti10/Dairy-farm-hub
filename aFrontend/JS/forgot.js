let verifiedUserId = "";
let verifiedOtp = "";
let otpExpireSeconds = 300; // 5 min
let timerInterval = null;

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerText = msg || "";
  el.style.display = msg ? "block" : "none";
}

function togglePassword(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    if (iconEl) iconEl.innerText = "🙈";
  } else {
    input.type = "password";
    if (iconEl) iconEl.innerText = "👁";
  }
}
window.togglePassword = togglePassword;

function hideAllSteps() {
  document.getElementById("resetSection").style.display = "none";
  document.getElementById("newPassSection").style.display = "none";
  verifiedUserId = "";
  verifiedOtp = "";
  stopTimer();
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function startTimer() {
  stopTimer();
  let left = otpExpireSeconds;

  const timerText = document.getElementById("timerText");
  const resendBtn = document.getElementById("resendBtn");

  resendBtn.disabled = true;
  resendBtn.style.opacity = "0.6";

  const tick = () => {
    const mm = String(Math.floor(left / 60)).padStart(2, "0");
    const ss = String(left % 60).padStart(2, "0");
    timerText.innerText = `${mm}:${ss}`;

    if (left <= 0) {
      stopTimer();
      timerText.innerText = "00:00";
      resendBtn.disabled = false;
      resendBtn.style.opacity = "1";
      showError("otpError", "OTP expired. Click Resend OTP.");
      return;
    }
    left--;
  };

  tick();
  timerInterval = setInterval(tick, 1000);
}

// ✅ Password Strength Meter
function strengthScore(p) {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[a-z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[@$!%*?&]/.test(p)) score++;
  return score; // 0..5
}

function updateStrengthUI(p) {
  const bar = document.getElementById("strengthBar");
  const text = document.getElementById("strengthText");
  if (!bar || !text) return;

  const s = strengthScore(p);
  const pct = (s / 5) * 100;
  bar.style.width = pct + "%";

  if (s <= 2) {
    bar.style.background = "#ef4444";
    text.innerText = "Weak password";
  } else if (s === 3) {
    bar.style.background = "#f59e0b";
    text.innerText = "Medium password";
  } else {
    bar.style.background = "#22c55e";
    text.innerText = "Strong password ✅";
  }
}

// ✅ SEND OTP
async function sendOtp() {
  const input = (document.getElementById("userId")?.value || "").trim();

  showError("userIdError", "");
  showError("otpError", "");
  showError("passwordError", "");

  if (!input) {
    showError("userIdError", "Please enter User ID / Email / Mobile");
    hideAllSteps();
    return;
  }

  try {
    const res = await fetch("http://127.0.0.1:5000/api/forgot/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      if (data.msg === "USER_NOT_FOUND") showError("userIdError", "User not found!");
      else showError("userIdError", data.msg || "OTP send failed");
      hideAllSteps();
      return;
    }

    verifiedUserId = data.user_id;

    alert("OTP sent successfully. Check email/SMS (demo: terminal).");

    document.getElementById("resetSection").style.display = "block";
    document.getElementById("newPassSection").style.display = "none";

    startTimer();
  } catch (err) {
    showError("userIdError", "Network error: backend not running");
    hideAllSteps();
  }
}

document.getElementById("verifyBtn").addEventListener("click", sendOtp);

// ✅ RESEND OTP
document.getElementById("resendBtn").addEventListener("click", async () => {
  await sendOtp();
});

// ✅ VERIFY OTP
document.getElementById("otpVerifyBtn").addEventListener("click", async () => {
  showError("otpError", "");
  showError("passwordError", "");

  const otp = (document.getElementById("otp")?.value || "").trim();

  if (!verifiedUserId) {
    showError("userIdError", "Please send OTP first!");
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    showError("otpError", "Enter valid 6-digit OTP");
    return;
  }

  try {
    const res = await fetch("http://127.0.0.1:5000/api/forgot/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: verifiedUserId, otp }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      if (data.msg === "OTP_EXPIRED") showError("otpError", "OTP expired. Click Resend OTP.");
      else if (data.msg === "OTP_USED") showError("otpError", "OTP already used. Send again.");
      else showError("otpError", "Invalid OTP");
      document.getElementById("newPassSection").style.display = "none";
      verifiedOtp = "";
      return;
    }

    verifiedOtp = otp;
    alert("OTP verified! Now set new password.");
    document.getElementById("newPassSection").style.display = "block";
  } catch (err) {
    showError("otpError", "Network error");
  }
});

// ✅ Strength meter live update
document.getElementById("newPassword")?.addEventListener("input", (e) => {
  updateStrengthUI(e.target.value || "");
});

// ✅ RESET PASSWORD WITH OTP
document.getElementById("forgotForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  showError("passwordError", "");

  const newPass = (document.getElementById("newPassword")?.value || "").trim();

  if (!verifiedUserId || !verifiedOtp) {
    showError("passwordError", "Verify OTP first!");
    return;
  }

  const strongPass = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
  if (!strongPass.test(newPass)) {
    showError(
      "passwordError",
      "Use 8+ chars with uppercase, lowercase, number, special (@$!%*?&)"
    );
    return;
  }

  try {
    const res = await fetch("http://127.0.0.1:5000/api/forgot/reset-with-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: verifiedUserId,
        otp: verifiedOtp,
        newPassword: newPass,
      }),
    });

    const data = await res.json();

    // ✅ IMPORTANT: THIS is where we add "Password not available"
    if (!res.ok || !data.ok) {
      if (data.msg === "PASSWORD_NOT_AVAILABLE") {
        showError("passwordError", "Password not available. Choose another one.");
        return;
      }

      if (data.msg === "SAME_PASSWORD_NOT_ALLOWED") {
        showError("passwordError", "New password must be different from old password.");
        return;
      }

      if (data.msg === "OTP_EXPIRED") {
        showError("passwordError", "OTP expired. Click Resend OTP.");
        return;
      }

      if (data.msg === "OTP_USED") {
        showError("passwordError", "OTP already used. Click Resend OTP.");
        return;
      }

      if (data.msg === "WEAK_PASSWORD") {
        showError("passwordError", "Choose a stronger password.");
        return;
      }

      showError("passwordError", data.msg || "Reset failed");
      return;
    }

    alert("Password reset successfully! Please login.");
    window.location.href = "login.html";
  } catch (err) {
    showError("passwordError", "Network error");
  }
});
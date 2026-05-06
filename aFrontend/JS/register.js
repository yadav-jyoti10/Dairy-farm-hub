console.log("REGISTER JS CONNECTED");

// eye toggle
function togglePassword(id, icon) {
  const input = document.getElementById(id);
  if (input.type === "password") {
    input.type = "text";
    icon.innerText = "🙈";
  } else {
    input.type = "password";
    icon.innerText = "👁";
  }
}

/* ✅ LIMIT / INPUT CONTROL (logic same, only typing restriction) */
(function () {
  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const mobileEl = document.getElementById("mobile");

  // Name max length (you can keep 30)
  if (nameEl) nameEl.setAttribute("maxlength", "30");

  // Email max length (typical safe limit)
  if (emailEl) emailEl.setAttribute("maxlength", "100");

  // Mobile: max 10 digits
  if (mobileEl) {
    mobileEl.setAttribute("maxlength", "10");
    mobileEl.setAttribute("inputmode", "numeric");

    // only digits allow, and never more than 10
    mobileEl.addEventListener("input", () => {
      mobileEl.value = mobileEl.value.replace(/\D/g, "").slice(0, 10);
    });
  }

  // Name: only letters + spaces allowed (optional but helps)
  if (nameEl) {
    nameEl.addEventListener("input", () => {
      // allow alphabets + spaces only
      nameEl.value = nameEl.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 30);
    });
  }
})();

document.getElementById("registerForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const mobile = document.getElementById("mobile").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // errors
  document.getElementById("nameError").innerText = "";
  document.getElementById("emailError").innerText = "";
  document.getElementById("mobileError").innerText = "";
  document.getElementById("passwordError").innerText = "";
  document.getElementById("confirmError").innerText = "";

  let valid = true;

  // ✅ Name validation: 3-30 chars, letters + spaces only
  const namePattern = /^[A-Za-z ]+$/;
  if (name.length < 3) {
    document.getElementById("nameError").innerText = "Enter at least 3 characters";
    valid = false;
  } else if (name.length > 30) {
    document.getElementById("nameError").innerText = "Name must be max 30 characters";
    valid = false;
  } else if (!namePattern.test(name)) {
    document.getElementById("nameError").innerText = "Name should contain only letters";
    valid = false;
  }

  // ✅ Email validation + max length
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email.length > 100) {
    document.getElementById("emailError").innerText = "Email too long";
    valid = false;
  } else if (!emailPattern.test(email)) {
    document.getElementById("emailError").innerText = "Enter valid email address";
    valid = false;
  }

  // ✅ India mobile: exactly 10 digits + starts with 6/7/8/9
  const indiaMobilePattern = /^[6-9]\d{9}$/;
  if (!indiaMobilePattern.test(mobile)) {
    document.getElementById("mobileError").innerText =
      "Enter valid  10 digit mobile Number ";
    valid = false;
  }

  // ✅ STRONG PASSWORD RULE:
  // 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special
  const strongPass =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  // ✅ Common weak passwords block
  const weakList = ["12345678", "password", "password123", "123456789", "qwerty123"];

  if (!strongPass.test(password)) {
    document.getElementById("passwordError").innerText =
      "Password must have 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special (@$!%*?&)";
    valid = false;
  } else if (weakList.includes(password.toLowerCase())) {
    document.getElementById("passwordError").innerText =
      "Choose a stronger password (too common)";
    valid = false;
  }

  if (password !== confirmPassword) {
    document.getElementById("confirmError").innerText = "Passwords do not match";
    valid = false;
  }

  if (!valid) return;

  try {
    const res = await fetch("http://127.0.0.1:5000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, mobile, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      document.getElementById("emailError").innerText = data.msg || "Register failed";
      return;
    }

    document.getElementById("showUserId").innerText = data.user_id;
    document.getElementById("successPopup").style.display = "flex";
  } catch (err) {
    document.getElementById("emailError").innerText = "Network error: " + err.message;
  }
});

document.getElementById("okBtn").addEventListener("click", function () {
  window.location.href = "login.html";
});
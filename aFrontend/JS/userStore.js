// ./JS/userStore.js (UPDATED)

// ---------------------------
// ✅ LOGIN / USER HELPERS
// ---------------------------
export function getUserKey() {
  return localStorage.getItem("dfh_userKey") || "guest";
}

export function isLoggedIn() {
  return localStorage.getItem("dfh_isLoggedIn") === "true";
}

export function getUserName() {
  return (
    localStorage.getItem("dfh_userName") ||
    localStorage.getItem("dfh_loggedInUser") ||
    "User"
  );
}

export function getUserRole() {
  return localStorage.getItem("dfh_role") || "user";
}

// ---------------------------
// ✅ SAFE JSON HELPERS
// ---------------------------
function safeParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch (e) {
    return fallback;
  }
}

// ---------------------------
// ✅ KEY SYSTEM (COMPATIBLE)
// ---------------------------
// You already use keys like: dfh_animals_<userKey>
// So we keep that system as PRIMARY for best compatibility.
export function dfhKey(base) {
  return `dfh_${base}_${getUserKey()}`; // ex: dfh_animals_admin
}

// Optional alternative: <userKey>_<base>
export function userStorageKey(baseKey) {
  return `${getUserKey()}_${baseKey}`; // ex: admin_animals
}

// ---------------------------
// ✅ GET / SET (DFH KEYS)
// ---------------------------
export function getUserData(baseKey, defaultValue = []) {
  const key = dfhKey(baseKey); // dfh_animals_<userKey>
  return safeParse(localStorage.getItem(key), defaultValue);
}

export function setUserData(baseKey, value) {
  const key = dfhKey(baseKey);
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------
// ✅ ENSURE FRESH USER DATA
// (call this on login one time)
// ---------------------------
export function ensureFreshUserData(userKey = getUserKey()) {
  const required = [
    `dfh_animals_${userKey}`,
    `dfh_milk_${userKey}`,
    `dfh_feed_${userKey}`,
    `dfh_sales_${userKey}`,
  ];

  required.forEach((k) => {
    if (localStorage.getItem(k) === null) {
      localStorage.setItem(k, JSON.stringify([]));
    }
  });
}

// ---------------------------
// ✅ DATE HELPERS
// ---------------------------
export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ---------------------------
// ✅ DASHBOARD CALCULATIONS
// ---------------------------
export function totalAnimals() {
  const animals = getUserData("animals", []);
  return animals.length;
}

export function todayMilkTotal() {
  const milk = getUserData("milk", []);
  const today = todayISO();

  return milk
    .filter((r) => r.date === today)
    .reduce((sum, r) => sum + Number(r.total || 0), 0);
}

export function monthlyMilkTotal() {
  const milk = getUserData("milk", []);
  const mk = monthNow();

  return milk
    .filter((r) => String(r.date || "").slice(0, 7) === mk)
    .reduce((sum, r) => sum + Number(r.total || 0), 0);
}

export function dailySalesTotal(date = todayISO()) {
  const sales = getUserData("sales", []);

  return sales
    .filter((s) => s.date === date)
    .reduce((sum, s) => sum + Number(s.total || 0), 0);
}

export function monthlySalesTotal(month = monthNow()) {
  const sales = getUserData("sales", []);

  return sales
    .filter((s) => String(s.date || "").slice(0, 7) === month)
    .reduce((sum, s) => sum + Number(s.total || 0), 0);
}

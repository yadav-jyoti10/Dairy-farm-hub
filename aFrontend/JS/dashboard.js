// ./JS/dashboard.js (DB + per-user via x-user-id + Insights + Charts + PDF + Prediction + Smart Alerts + Profile Modal)

function getUserKey() {
  return localStorage.getItem("dfh_userKey") || "";
}

function userHeaders() {
  return {
    "Content-Type": "application/json",
    "x-user-id": getUserKey(),
  };
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKeyNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // YYYY-MM
}

// Screen pe ₹
function money(n) {
  const num = Number(n || 0);
  return `₹ ${num.toLocaleString("en-IN")}`;
}

// PDF me Rs. (₹ symbol jsPDF me garbage banata hai)
function moneyPDF(n) {
  const num = Number(n || 0);
  return `Rs. ${num.toLocaleString("en-IN")}`;
}

/* -------------------- Helpers for Graph Labels -------------------- */
// Chart ke niche date string ko clean banayega: "2026-02-25"
function cleanDateLabel(v) {
  if (!v) return "";
  const s = String(v);

  // agar already YYYY-MM-DD hai, same return
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // agar Date object aa gaya by mistake (rare)
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  } catch {}

  return s;
}

/* -------------------- NEW Helpers (Prediction) -------------------- */
function prevMonthKey(yyyyMM, back = 1) {
  const [y, m] = String(yyyyMM || "")
    .split("-")
    .map((x) => Number(x));
  if (!y || !m) return monthKeyNow();

  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - back);

  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

async function fetchInsights(month) {
  const res = await fetch(
    `http://localhost:5000/api/dashboard/insights?month=${encodeURIComponent(
      month
    )}`,
    { headers: userHeaders() }
  );
  const data = await res.json();
  if (!data.ok) throw new Error(data.msg || "Insights error");
  return data;
}

/* -------------------- NEW Helpers (Alerts UI) -------------------- */
function renderAlerts(alerts) {
  const box = document.getElementById("alertBox");
  if (!box) return;

  if (!alerts || alerts.length === 0) {
    box.innerHTML = `<div class="alert-item alert-ok">✅ All good! No alerts for this month.</div>`;
    return;
  }

  box.innerHTML = alerts
    .map((a) => `<div class="alert-item ${a.cls}">${a.text}</div>`)
    .join("");
}

/* -------------------- NEW: Prediction + Smart Alerts -------------------- */
/* ✅ Logic same DB insights use ho raha hai, bas UI me show kar rahe */
async function updatePredictionAndAlerts(selectedMonth, currentInsights) {
  const predValue = document.getElementById("predValue");
  const predConf = document.getElementById("predConf");

  // last 3 months
  const m1 = prevMonthKey(selectedMonth, 1);
  const m2 = prevMonthKey(selectedMonth, 2);
  const m3 = prevMonthKey(selectedMonth, 3);

  let i1 = null,
    i2 = null,
    i3 = null;
  try {
    i1 = await fetchInsights(m1);
  } catch {}
  try {
    i2 = await fetchInsights(m2);
  } catch {}
  try {
    i3 = await fetchInsights(m3);
  } catch {}

  const arr = [i1, i2, i3]
    .filter(Boolean)
    .map((x) => Number(x.monthlyMilk || 0));
  const predicted = arr.length
    ? arr.reduce((s, v) => s + v, 0) / arr.length
    : 0;

  if (predValue) predValue.innerText = predicted.toFixed(0);

  const conf =
    arr.length === 3
      ? "High"
      : arr.length === 2
      ? "Medium"
      : arr.length === 1
      ? "Low"
      : "No Data";

  if (predConf) predConf.innerText = conf;

  // --- Alerts (simple smart alerts) ---
  const alerts = [];

  const ratio = Number(currentInsights?.milkFeedRatio || 0);
  if (ratio > 0 && ratio < 0.2) {
    alerts.push({
      cls: "alert-danger",
      text: `⚠️ Low Milk/Feed Ratio (${ratio.toFixed(
        2
      )}). Feed efficiency is low.`,
    });
  }

  // Compare sales drop vs last month
  let prev = null;
  try {
    prev = await fetchInsights(m1);
  } catch {}

  const curSales = Number(currentInsights?.monthlySales || 0);
  const prevSales = Number(prev?.monthlySales || 0);

  if (prev && prevSales > 0) {
    const drop = ((prevSales - curSales) / prevSales) * 100;
    if (drop >= 30) {
      alerts.push({
        cls: "alert-warn",
        text: `📉 Sales dropped by ${drop.toFixed(0)}% vs last month (${m1}).`,
      });
    }
  }

  const monthMilk = Number(currentInsights?.monthlyMilk || 0);
  if (monthMilk === 0) {
    alerts.push({
      cls: "alert-warn",
      text: `🧾 No milk data for ${selectedMonth}. Add milk records for insights.`,
    });
  }

  renderAlerts(alerts);
}

/* -------------------- NEW: Profile Modal (UI only) -------------------- */
function openProfileModal() {
  const m = document.getElementById("profileModal");
  if (m) m.style.display = "flex";
}
function closeProfileModal() {
  const m = document.getElementById("profileModal");
  if (m) m.style.display = "none";
}

async function loadMyProfile() {
  // ✅ NOTE: iske liye server.js me /api/profile route hona chahiye
  const res = await fetch("http://localhost:5000/api/profile", {
    headers: userHeaders(),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.msg || "Profile load failed");

  // fields must exist in your dashboard.html modal
  const u = data.user || {};
  const elId = document.getElementById("pUserId");
  const elName = document.getElementById("pName");
  const elEmail = document.getElementById("pEmail");

  if (elId) elId.value = u.user_id || "";
  if (elName) elName.value = u.name || "";
  if (elEmail) elEmail.value = u.email || "";
}

/* -------------------- Charts -------------------- */
let chartMilkDaily = null;
let chartSalesDaily = null;
let chartMilkByAnimal = null;
let chartFeedByType = null;

function destroyChart(c) {
  try {
    if (c) c.destroy();
  } catch {}
  return null;
}

function makeLineChart(canvasId, labels, data, labelText) {
  const el = document.getElementById(canvasId);
  if (!el || !window.Chart) return null;

  return new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: [{ label: labelText, data, tension: 0.25 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function makeBarChart(canvasId, labels, data, labelText) {
  const el = document.getElementById(canvasId);
  if (!el || !window.Chart) return null;

  return new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: labelText, data }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function makePieChart(canvasId, labels, data, labelText) {
  const el = document.getElementById(canvasId);
  if (!el || !window.Chart) return null;

  return new Chart(el, {
    type: "pie",
    data: {
      labels,
      datasets: [{ label: labelText, data }],
    },
    options: { responsive: true },
  });
}

/* -------------------- Cards (old summary) -------------------- */
async function updateDashboardCards() {
  const res = await fetch("http://localhost:5000/api/dashboard/summary", {
    headers: userHeaders(),
  });
  const data = await res.json();

  if (!data.ok) throw new Error(data.msg || "Dashboard summary error");

  const elA = document.getElementById("cardAnimals");
  const elT = document.getElementById("cardTodayMilk");
  const elM = document.getElementById("cardMonthMilk");

  // NOTE: server.js me jo field name hai wahi use karo (data.totalAnimals)
  if (elA) elA.innerText = data.totalAnimals ?? 0;
  if (elT) elT.innerText = data.todayMilk ?? 0;
  if (elM) elM.innerText = data.monthlyMilk ?? 0;
}

/* -------------------- Daily Sales -------------------- */
async function showDailySales() {
  const dateInput = document.getElementById("dailyDate");
  const date = (dateInput?.value || "").trim();
  if (!date) return alert("Please select a date");

  const res = await fetch(
    `http://localhost:5000/api/dashboard/sales/daily?date=${encodeURIComponent(
      date
    )}`,
    { headers: userHeaders() }
  );
  const data = await res.json();

  if (!data.ok) return alert(data.msg || "Daily sales error");

  document.getElementById("dailyDateText").innerText = date;
  document.getElementById("dailyTotalText").innerText = money(data.totalSales);
}

/* -------------------- Monthly Sales -------------------- */
async function showMonthlySales() {
  const monthInput = document.getElementById("monthlyMonth");
  const month = (monthInput?.value || "").trim();
  if (!month) return alert("Please select a month");

  const res = await fetch(
    `http://localhost:5000/api/dashboard/sales/monthly?month=${encodeURIComponent(
      month
    )}`,
    { headers: userHeaders() }
  );
  const data = await res.json();

  if (!data.ok) return alert(data.msg || "Monthly sales error");

  document.getElementById("monthlyMonthText").innerText = month;
  document.getElementById("monthlyTotalText").innerText = money(data.totalSales);
}

/* -------------------- NEW: Insights -------------------- */
let lastInsights = null;

async function loadInsightsForMonth(month) {
  const res = await fetch(
    `http://localhost:5000/api/dashboard/insights?month=${encodeURIComponent(
      month
    )}`,
    { headers: userHeaders() }
  );
  const data = await res.json();
  if (!data.ok) throw new Error(data.msg || "Insights error");

  lastInsights = data;

  // ✅ new cards
  const topEl = document.getElementById("cardTopAnimal");
  const ratioEl = document.getElementById("cardMilkFeedRatio");
  const profitEl = document.getElementById("cardMonthlyProfit");

  if (topEl) {
    topEl.innerText = data.topAnimal?.name
      ? `${data.topAnimal.animal_id} - ${data.topAnimal.name} (${data.topAnimal.milk_total} L)`
      : "No data";
  }

  if (ratioEl) {
    ratioEl.innerText = Number(data.milkFeedRatio || 0).toFixed(2);
  }

  if (profitEl) {
    profitEl.innerText = money(data.monthlyProfit);
  }

  // ✅ Prediction + Alerts (UI only)
  try {
    await updatePredictionAndAlerts(month, data);
  } catch (e) {
    console.log("Prediction/Alerts error:", e);
  }

  // ✅ charts redraw
  chartMilkDaily = destroyChart(chartMilkDaily);
  chartSalesDaily = destroyChart(chartSalesDaily);
  chartMilkByAnimal = destroyChart(chartMilkByAnimal);
  chartFeedByType = destroyChart(chartFeedByType);

  // Milk daily line (CLEAN LABELS)
  {
    const labels = (data.dailyMilk || []).map((x) => cleanDateLabel(x.date));
    const values = (data.dailyMilk || []).map((x) => Number(x.total || 0));
    chartMilkDaily = makeLineChart("chartMilkDaily", labels, values, "Milk (L)");
  }

  // Sales daily line (CLEAN LABELS)
  {
    const labels = (data.dailySales || []).map((x) => cleanDateLabel(x.date));
    const values = (data.dailySales || []).map((x) => Number(x.total || 0));
    chartSalesDaily = makeLineChart(
      "chartSalesDaily",
      labels,
      values,
      "Sales (Rs.)"
    );
  }

  // Milk by animal bar
  {
    const labels = (data.milkByAnimal || []).map(
      (x) => `${x.animal_id}-${x.name}`
    );
    const values = (data.milkByAnimal || []).map((x) => Number(x.total || 0));
    chartMilkByAnimal = makeBarChart(
      "chartMilkByAnimal",
      labels,
      values,
      "Milk (L)"
    );
  }

  // Feed by type pie
  {
    const labels = (data.feedByType || []).map((x) => x.feed_type);
    const values = (data.feedByType || []).map((x) => Number(x.kg || 0));
    chartFeedByType = makePieChart(
      "chartFeedByType",
      labels,
      values,
      "Feed (kg)"
    );
  }
}

/* -------------------- NEW: PDF Export -------------------- */
async function exportMonthlyPDF() {
  const month = (document.getElementById("monthlyMonth")?.value || "").trim();
  if (!month) return alert("Please select a month");

  // ensure insights loaded for current month
  if (!lastInsights || lastInsights.month !== month) {
    await loadInsightsForMonth(month);
  }

  const data = lastInsights;

  if (!window.jspdf) {
    alert("PDF library not loaded. Check CDN in dashboard.html");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Dairy Farm Hub - Monthly Report", 14, 16);

  doc.setFontSize(11);

  // ✅ clean English report (no ₹ symbol)
  doc.text(`Month: ${month}`, 14, 28);
  doc.text(`Monthly Sales: ${moneyPDF(data.monthlySales)}`, 14, 36);
  doc.text(`Estimated Feed Cost: ${moneyPDF(data.estimatedFeedCost)}`, 14, 44);
  doc.text(`Monthly Profit (Est.): ${moneyPDF(data.monthlyProfit)}`, 14, 52);

  doc.text(`Milk Total: ${Number(data.monthlyMilk || 0)} L`, 14, 60);
  doc.text(`Feed Total: ${Number(data.monthlyFeedKg || 0)} kg`, 14, 68);
  doc.text(
    `Milk/Feed Ratio: ${Number(data.milkFeedRatio || 0).toFixed(2)}`,
    14,
    76
  );

  const topAnimalText = data.topAnimal?.name
    ? `${data.topAnimal.animal_id} - ${data.topAnimal.name} (${Number(
        data.topAnimal.milk_total || 0
      )} L)`
    : "No data";

  doc.text(`Top Animal: ${topAnimalText}`, 14, 84);

  // Table: milk by animal
  doc.autoTable({
    startY: 92,
    head: [["Animal ID", "Name", "Milk (L)"]],
    body: (data.milkByAnimal || []).map((x) => [
      String(x.animal_id),
      String(x.name || ""),
      String(Number(x.total || 0)),
    ]),
  });

  // Table: feed by type
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8,
    head: [["Feed Type", "KG"]],
    body: (data.feedByType || []).map((x) => [
      String(x.feed_type || ""),
      String(Number(x.kg || 0)),
    ]),
  });

  doc.save(`Monthly_Report_${month}.pdf`);
}

/* -------------------- Boot -------------------- */
async function boot() {
  // protect dashboard
  if (localStorage.getItem("dfh_isLoggedIn") !== "true") {
    window.location.href = "login.html";
    return;
  }

  if (!getUserKey()) {
    localStorage.removeItem("dfh_isLoggedIn");
    window.location.href = "login.html";
    return;
  }

  // (optional) show top right label if exists
  try {
    const topUser = document.getElementById("topUser");
    if (topUser && !topUser.innerText.trim()) {
      topUser.innerHTML = `<span>👤 Profile</span>`;
    }
  } catch {}

  document.getElementById("dailyDate").value = todayISO();
  document.getElementById("monthlyMonth").value = monthKeyNow();

  document
    .getElementById("btnDailySales")
    .addEventListener("click", showDailySales);

  document
    .getElementById("btnMonthlySales")
    .addEventListener("click", async () => {
      await showMonthlySales();
      const month = (document.getElementById("monthlyMonth")?.value || "").trim();
      await loadInsightsForMonth(month);
    });

  const exportBtn = document.getElementById("btnExportPDF");
  if (exportBtn) exportBtn.addEventListener("click", exportMonthlyPDF);

  // ✅ Profile click events (needs modal in HTML)
  const topUser = document.getElementById("topUser");
  if (topUser) {
    topUser.style.cursor = "pointer";
    topUser.addEventListener("click", async () => {
      try {
        await loadMyProfile();
        openProfileModal();
      } catch (e) {
        alert(e.message);
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

  try {
    await updateDashboardCards();
    await showDailySales();
    await showMonthlySales();

    // default insights for current month
    await loadInsightsForMonth(monthKeyNow());
  } catch (e) {
    alert("Server/DB error (dashboard)");
    console.log(e);
  }
}

window.addEventListener("DOMContentLoaded", boot);
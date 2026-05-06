// ./JS/Feed.js (Per-user + DB + Same Logic + Clear + Date Fix)

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

let feedRecords = [];
let selectedFeedId = null;

// ---------- Helpers ----------
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ✅ Fix ISO date like 2026-02-24T18:30:00.000Z => 2026-02-24
function cleanDate(d) {
  return String(d || "").split("T")[0];
}

function getFeedFormEls() {
  const formBox = document.querySelector(".form-box");
  const inputs = formBox.querySelectorAll("input");
  const select = formBox.querySelector("select");

  return {
    // HTML order: AnimalID input, Qty input, Date input
    animalIdInput: inputs[0],
    qtyInput: inputs[1],
    dateInput: inputs[2],
    feedTypeSelect: select,
    addBtn: formBox.querySelector(".btn-add"),
    updBtn: formBox.querySelector(".btn-update"),
    delBtn: formBox.querySelector(".btn-delete"),
    clearBtn: formBox.querySelector(".btn-clear"),
  };
}

function clearFeedForm() {
  selectedFeedId = null;
  const { animalIdInput, qtyInput, dateInput, feedTypeSelect } = getFeedFormEls();

  animalIdInput.value = "";
  qtyInput.value = "";
  dateInput.value = todayISO();
  feedTypeSelect.value = feedTypeSelect.options[0]?.value || "Dry Feed";
}

// ---------- Sorting + Table ----------
function sortedList(list) {
  return [...list].sort((a, b) => {
    const d1 = String(a.date || "");
    const d2 = String(b.date || "");
    if (d1 !== d2) return d2.localeCompare(d1);
    return Number(b.id) - Number(a.id);
  });
}

function renderFeed() {
  const tbody = document.getElementById("feedTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const view = sortedList(feedRecords);

  if (view.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding:15px; color:#64748b;">
          No feed records yet.
        </td>
      </tr>
    `;
    return;
  }

  view.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.animalId}</td>
      <td>${r.feedType}</td>
      <td>${r.qty}</td>
      <td>${r.date}</td>
    `;
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => selectFeedRow(r.id)); // ✅ record id same
    tbody.appendChild(tr);
  });
}

function selectFeedRow(id) {
  const r = feedRecords.find((x) => Number(x.id) === Number(id));
  if (!r) return;

  selectedFeedId = r.id;

  const { animalIdInput, qtyInput, dateInput, feedTypeSelect } = getFeedFormEls();
  animalIdInput.value = r.animalId;
  feedTypeSelect.value = r.feedType;
  qtyInput.value = r.qty;
  dateInput.value = r.date;
}

// ================= LOAD FROM DB =================
async function loadFeed() {
  const res = await fetch("http://localhost:5000/api/feed", {
    headers: userHeaders(),
  });
  const data = await res.json();

  if (!data.ok) {
    alert(data.msg || "Error loading feed");
    return;
  }

  // server returns: { ok:true, records:[{id, animal_id, feed_type, qty, date}] }
  feedRecords = (data.records || []).map((r) => ({
    id: r.id, // record id (hidden in UI)
    animalId: r.animal_id, // ✅ animal identity id
    feedType: r.feed_type,
    qty: Number(r.qty || 0),
    date: cleanDate(r.date), // ✅ here fixed
  }));

  renderFeed();
}

// ---------- CRUD (DB) ----------
async function addFeed() {
  const { animalIdInput, qtyInput, dateInput, feedTypeSelect } = getFeedFormEls();

  const animalId = Number(animalIdInput.value || 0);
  const qty = Number(qtyInput.value || 0);
  const date = dateInput.value;
  const feedType = feedTypeSelect.value;

  if (!animalId || !date) return alert("Enter Animal ID and Date");
  if (qty <= 0) return alert("Quantity must be greater than 0");

  const res = await fetch("http://localhost:5000/api/feed", {
    method: "POST",
    headers: userHeaders(),
    body: JSON.stringify({ animalId, feedType, qty, date }),
  });

  const data = await res.json();

  if (!data.ok) {
    if (data.msg === "DUPLICATE_FEED") {
      alert("Same Feed record already exists (Animal + Date + Feed Type). Use Update.");
      return;
    }
    if (data.msg === "INVALID_ANIMAL") {
      alert("Invalid Animal ID (this animal is not in your Animals list).");
      return;
    }
    alert(data.msg || "Error adding feed");
    return;
  }

  alert("Feed Added!");
  clearFeedForm();
  loadFeed();
}

async function updateFeed() {
  if (!selectedFeedId) return alert("Select a feed row first!");

  const { animalIdInput, qtyInput, dateInput, feedTypeSelect } = getFeedFormEls();

  const animalId = Number(animalIdInput.value || 0);
  const qty = Number(qtyInput.value || 0);
  const date = dateInput.value;
  const feedType = feedTypeSelect.value;

  if (!animalId || !date) return alert("Enter Animal ID and Date");
  if (qty <= 0) return alert("Quantity must be greater than 0");

  const res = await fetch(`http://localhost:5000/api/feed/${selectedFeedId}`, {
    method: "PUT",
    headers: userHeaders(),
    body: JSON.stringify({ animalId, feedType, qty, date }),
  });

  const data = await res.json();

  if (!data.ok) {
    if (data.msg === "DUPLICATE_FEED") {
      alert("Another record already exists (same Animal + Date + Feed Type).");
      return;
    }
    if (data.msg === "INVALID_ANIMAL") {
      alert("Invalid Animal ID (this animal is not in your Animals list).");
      return;
    }
    alert(data.msg || "Error updating feed");
    return;
  }

  alert("Feed Updated!");
  loadFeed();
}

async function deleteFeed() {
  if (!selectedFeedId) return alert("Select a feed row first!");

  const ok = confirm(`Delete feed record ID ${selectedFeedId}?`);
  if (!ok) return;

  const res = await fetch(`http://localhost:5000/api/feed/${selectedFeedId}`, {
    method: "DELETE",
    headers: userHeaders(),
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.msg || "Error deleting feed");
    return;
  }

  alert("Feed Deleted!");
  clearFeedForm();
  loadFeed();
}

// ---------- Start ----------
window.addEventListener("DOMContentLoaded", () => {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  if (!getUserKey()) {
    localStorage.removeItem("dfh_isLoggedIn");
    window.location.href = "login.html";
    return;
  }

  const { addBtn, updBtn, delBtn, clearBtn, dateInput } = getFeedFormEls();
  if (!dateInput.value) dateInput.value = todayISO();

  addBtn.addEventListener("click", addFeed);
  updBtn.addEventListener("click", updateFeed);
  delBtn.addEventListener("click", deleteFeed);
  if (clearBtn) clearBtn.addEventListener("click", clearFeedForm);

  loadFeed();
});
// ================= LOGIN CHECK =================
function isLoggedIn() {
  return localStorage.getItem("dfh_isLoggedIn") === "true";
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

let milkRecords = [];
let animals = [];
let selectedRecordId = null;

// ---------- Helpers ----------
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ✅ Fix ISO date: 2026-02-24T18:30:00.000Z => 2026-02-24
function cleanDate(d) {
  return String(d || "").split("T")[0];
}

function els() {
  return {
    animalSel: document.getElementById("milkAnimalId"),
    date: document.getElementById("milkDate"),
    morning: document.getElementById("milkMorning"),
    evening: document.getElementById("milkEvening"),
    total: document.getElementById("milkTotal"),
    add: document.getElementById("btnMilkAdd"),
    upd: document.getElementById("btnMilkUpdate"),
    del: document.getElementById("btnMilkDelete"),
    clr: document.getElementById("btnMilkClear"),
  };
}

function calcTotal() {
  const { morning, evening, total } = els();
  total.value = Number(morning.value || 0) + Number(evening.value || 0);
}

function clearMilkForm() {
  selectedRecordId = null;
  const { animalSel, date, morning, evening, total } = els();
  animalSel.value = "";
  date.value = todayISO();
  morning.value = "";
  evening.value = "";
  total.value = "";
}

function animalNameById(animalId) {
  const a = animals.find((x) => Number(x.animal_id) === Number(animalId));
  return a ? a.name : `Animal ${animalId}`;
}

// ================= LOAD ANIMALS FROM DB (dropdown + datalist) =================
async function loadAnimals() {
  const res = await fetch("http://localhost:5000/api/animals", {
    headers: userHeaders(),
  });
  const data = await res.json();

  if (!data.ok) throw new Error(data.msg || "Animals load failed");
  animals = data.animals || [];
}

function populateAnimalsDropdown() {
  const { animalSel } = els();
  animalSel.innerHTML = `<option value="">Select Animal</option>`;

  animals.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.animal_id;
    opt.textContent = `${a.animal_id} - ${a.name} (${a.type || "type"})`;
    animalSel.appendChild(opt);
  });
}

function populateAnimalDatalist() {
  const dl = document.getElementById("animalList");
  if (!dl) return;

  dl.innerHTML = "";
  const names = [...new Set(animals.map((a) => String(a.name || "").trim()))].filter(Boolean);

  names.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    dl.appendChild(opt);
  });
}

// ================= LOAD MILK FROM DB =================
async function loadMilk() {
  const res = await fetch("http://localhost:5000/api/milk", {
    headers: userHeaders(),
  });
  const data = await res.json();

  if (!data.ok) {
    alert(data.msg || "Error loading milk");
    return;
  }

  milkRecords = (data.records || []).map((r) => ({
    id: r.record_id,                // server alias (record id)
    animalId: r.animal_id,          // ✅ animal identity id
    animalName: animalNameById(r.animal_id),
    date: cleanDate(r.date),        // ✅ clean date
    morning: Number(r.morning || 0),
    evening: Number(r.evening || 0),
    total: Number(r.total || 0),
  }));

  renderMilkTable(milkRecords);
}

// ================= TABLE =================
function renderMilkTable(list = milkRecords) {
  const tbody = document.getElementById("milkTable");
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:15px; color:#64748b;">
          No milk records yet.
        </td>
      </tr>
    `;
    return;
  }

  list.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.animalId}</td>
      <td>${r.animalName}</td>
      <td>${r.date}</td>
      <td>${r.morning}</td>
      <td>${r.evening}</td>
      <td>${r.total}</td>
    `;
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => selectMilkRow(r.id)); // ✅ record id same
    tbody.appendChild(tr);
  });
}

function selectMilkRow(id) {
  const r = milkRecords.find((x) => Number(x.id) === Number(id));
  if (!r) return;

  selectedRecordId = r.id;

  const { animalSel, date, morning, evening, total } = els();
  animalSel.value = String(r.animalId);
  date.value = cleanDate(r.date); // ✅ safe
  morning.value = r.morning;
  evening.value = r.evening;
  total.value = r.total;
}

// ================= CRUD =================
async function addMilk() {
  const { animalSel, date, morning, evening } = els();

  const animalId = Number(animalSel.value || 0);
  const d = date.value; // should be YYYY-MM-DD
  const m = Number(morning.value || 0);
  const e = Number(evening.value || 0);

  if (!animalId || !d) return alert("Select Animal and Date");

  const res = await fetch("http://localhost:5000/api/milk", {
    method: "POST",
    headers: userHeaders(),
    body: JSON.stringify({ animalId, date: d, morning: m, evening: e }),
  });

  const data = await res.json();

  if (!data.ok) {
    if (data.msg === "DUPLICATE_ANIMAL_DATE") {
      alert("This animal already has a record for this date. Use Update.");
      return;
    }
    if (data.msg === "INVALID_ANIMAL") {
      alert("Invalid Animal ID (not in your animals list).");
      return;
    }
    alert(data.msg || "Error adding milk");
    return;
  }

  alert("Milk Record Added!");
  clearMilkForm();
  await loadMilk(); // ✅ await so table refresh definitely
}

async function updateMilk() {
  if (!selectedRecordId) return alert("Select a record row first!");

  const { animalSel, date, morning, evening } = els();
  const animalId = Number(animalSel.value || 0);
  const d = date.value;
  const m = Number(morning.value || 0);
  const e = Number(evening.value || 0);

  if (!animalId || !d) return alert("Select Animal and Date");

  const res = await fetch(`http://localhost:5000/api/milk/${selectedRecordId}`, {
    method: "PUT",
    headers: userHeaders(),
    body: JSON.stringify({ animalId, date: d, morning: m, evening: e }),
  });

  const data = await res.json();

  if (!data.ok) {
    if (data.msg === "DUPLICATE_ANIMAL_DATE") {
      alert("Another record already exists for same animal & date.");
      return;
    }
    if (data.msg === "INVALID_ANIMAL") {
      alert("Invalid Animal ID (not in your animals list).");
      return;
    }
    alert(data.msg || "Error updating milk");
    return;
  }

  alert("Milk Record Updated!");
  await loadMilk();
}

async function deleteMilk() {
  if (!selectedRecordId) return alert("Select a record row first!");

  const ok = confirm(`Delete record ID ${selectedRecordId}?`);
  if (!ok) return;

  const res = await fetch(`http://localhost:5000/api/milk/${selectedRecordId}`, {
    method: "DELETE",
    headers: userHeaders(),
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.msg || "Error deleting milk");
    return;
  }

  alert("Milk Record Deleted!");
  clearMilkForm();
  await loadMilk();
}

// ================= SEARCH =================
window.filterMilk = function () {
  const q = (document.getElementById("animalSearch")?.value || "").trim().toLowerCase();
  if (!q) return renderMilkTable(milkRecords);

  const filtered = milkRecords.filter((r) =>
    String(r.animalName || "").toLowerCase().includes(q)
  );
  renderMilkTable(filtered);
};

// ================= START =================
window.addEventListener("DOMContentLoaded", async () => {
  if (!isLoggedIn() || !getUserKey()) {
    window.location.href = "login.html";
    return;
  }

  const { date, morning, evening, add, upd, del, clr } = els();

  if (!date.value) date.value = todayISO();
  morning.addEventListener("input", calcTotal);
  evening.addEventListener("input", calcTotal);

  add.addEventListener("click", addMilk);
  upd.addEventListener("click", updateMilk);
  del.addEventListener("click", deleteMilk);
  clr.addEventListener("click", clearMilkForm);

  try {
    await loadAnimals();
    populateAnimalsDropdown();
    populateAnimalDatalist();
    await loadMilk();
    calcTotal();
  } catch (e) {
    alert("Server/DB error");
    console.log(e);
  }
});
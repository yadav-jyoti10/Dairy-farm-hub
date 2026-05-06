// ./JS/Sales.js (DB + per-user + Animal dropdown + Time + Clear)

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

let sales = [];
let animals = [];
let selectedSaleId = null;

// ---------- Helpers ----------
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowTimeHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`; // "20:19"
}

function calcTotal(qty, rate) {
  return Number(qty || 0) * Number(rate || 0);
}

function els() {
  return {
    date: document.getElementById("saleDate"),
    time: document.getElementById("saleTime"),
    animalSel: document.getElementById("saleAnimalId"),
    milkType: document.getElementById("saleMilkType"),
    qty: document.getElementById("saleQty"),
    rate: document.getElementById("saleRate"),
    add: document.getElementById("btnSaleAdd"),
    upd: document.getElementById("btnSaleUpdate"),
    del: document.getElementById("btnSaleDelete"),
    clr: document.getElementById("btnSaleClear"),
  };
}

function animalNameById(animalId) {
  const a = animals.find((x) => Number(x.animal_id) === Number(animalId));
  return a ? a.name : `Animal ${animalId}`;
}

function clearSaleForm() {
  selectedSaleId = null;
  const { date, time, animalSel, milkType, qty, rate } = els();

  date.value = todayISO();
  time.value = nowTimeHHMM();
  animalSel.value = "";
  milkType.value = "Cow";
  qty.value = "";
  rate.value = "";
}

// ================= LOAD ANIMALS (for dropdown) =================
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

// ================= LOAD SALES FROM DB =================
async function loadSales() {
  const res = await fetch("http://localhost:5000/api/sales", {
    headers: userHeaders(),
  });
  const data = await res.json();

  if (!data.ok) {
    alert(data.msg || "Error loading sales");
    return;
  }

  // server returns: records:[{id, date, time, animal_id, animal_name, milk_type, qty, rate, total}]
  sales = (data.records || []).map((r) => ({
    id: r.id, // record id
    date: r.date,
    time: r.time || "00:00",
    animalId: r.animal_id, // ✅ animal identity id
    animalName: r.animal_name || animalNameById(r.animal_id),
    milkType: r.milk_type,
    qty: Number(r.qty || 0),
    rate: Number(r.rate || 0),
    total: Number(r.total || 0),
  }));

  renderSales();
}

// ================= TABLE =================
function renderSales() {
  const tbody = document.getElementById("salesTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (sales.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:15px; color:#64748b;">
          No sales records yet.
        </td>
      </tr>
    `;
    return;
  }

  sales.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.animalId}</td>
      <td>${s.date}</td>
      <td>${s.time}</td>
      <td>${s.animalName}</td>
      <td>${s.milkType}</td>
      <td>${s.qty}</td>
      <td>${s.rate}</td>
      <td>${s.total}</td>
    `;
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => selectSaleRow(s.id)); // ✅ record id same
    tbody.appendChild(tr);
  });
}

function selectSaleRow(id) {
  const s = sales.find((x) => Number(x.id) === Number(id));
  if (!s) return;

  selectedSaleId = s.id;

  const { date, time, animalSel, milkType, qty, rate } = els();
  date.value = s.date;
  time.value = s.time || "00:00";
  animalSel.value = String(s.animalId);
  milkType.value = s.milkType;
  qty.value = s.qty;
  rate.value = s.rate;
}

// ================= FORM DATA =================
function getSaleFromForm() {
  const { date, time, animalSel, milkType, qty, rate } = els();

  const d = (date.value || "").trim();
  const t = (time.value || "").trim() || "00:00";
  const animalId = Number(animalSel.value || 0);
  const mt = milkType.value;
  const q = Number(qty.value || 0);
  const r = Number(rate.value || 0);
  const total = calcTotal(q, r);

  return { date: d, time: t, animalId, milkType: mt, qty: q, rate: r, total };
}

// ================= CRUD =================
async function addSale() {
  const f = getSaleFromForm();

  if (!f.date) return alert("Select Date");
  if (!f.animalId) return alert("Select Animal");
  if (f.qty <= 0) return alert("Quantity must be greater than 0");
  if (f.rate <= 0) return alert("Rate must be greater than 0");

  const res = await fetch("http://localhost:5000/api/sales", {
    method: "POST",
    headers: userHeaders(),
    body: JSON.stringify({
      date: f.date,
      time: f.time, // ✅ send time
      animalId: f.animalId,
      milkType: f.milkType,
      qty: f.qty,
      rate: f.rate,
    }),
  });

  const data = await res.json();

  if (!data.ok) {
    if (data.msg === "DUPLICATE_SALE") {
      alert("Same sale already exists (Date + Animal + Milk Type). Use Update.");
      return;
    }
    if (data.msg === "INVALID_ANIMAL") {
      alert("Invalid Animal (this animal is not in your Animals list).");
      return;
    }
    alert(data.msg || "Error adding sale");
    return;
  }

  alert("Sale Added!");
  clearSaleForm();
  loadSales();
}

async function updateSale() {
  if (!selectedSaleId) return alert("Select a sale row first!");

  const f = getSaleFromForm();

  if (!f.date) return alert("Select Date");
  if (!f.animalId) return alert("Select Animal");
  if (f.qty <= 0) return alert("Quantity must be greater than 0");
  if (f.rate <= 0) return alert("Rate must be greater than 0");

  const res = await fetch(`http://localhost:5000/api/sales/${selectedSaleId}`, {
    method: "PUT",
    headers: userHeaders(),
    body: JSON.stringify({
      date: f.date,
      time: f.time,
      animalId: f.animalId,
      milkType: f.milkType,
      qty: f.qty,
      rate: f.rate,
    }),
  });

  const data = await res.json();

  if (!data.ok) {
    if (data.msg === "DUPLICATE_SALE") {
      alert("Another record already exists with same Date + Animal + Milk Type.");
      return;
    }
    if (data.msg === "INVALID_ANIMAL") {
      alert("Invalid Animal (this animal is not in your Animals list).");
      return;
    }
    alert(data.msg || "Error updating sale");
    return;
  }

  alert("Sale Updated!");
  loadSales();
}

async function deleteSale() {
  if (!selectedSaleId) return alert("Select a sale row first!");

  const ok = confirm(`Delete sale record ID ${selectedSaleId}?`);
  if (!ok) return;

  const res = await fetch(`http://localhost:5000/api/sales/${selectedSaleId}`, {
    method: "DELETE",
    headers: userHeaders(),
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.msg || "Error deleting sale");
    return;
  }

  alert("Sale Deleted!");
  clearSaleForm();
  loadSales();
}

// ================= START =================
window.addEventListener("DOMContentLoaded", async () => {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  if (!getUserKey()) {
    localStorage.removeItem("dfh_isLoggedIn");
    window.location.href = "login.html";
    return;
  }

  const { date, time, add, upd, del, clr } = els();

  if (!date.value) date.value = todayISO();
  if (!time.value) time.value = nowTimeHHMM();

  add.addEventListener("click", addSale);
  upd.addEventListener("click", updateSale);
  del.addEventListener("click", deleteSale);
  clr.addEventListener("click", clearSaleForm);

  try {
    await loadAnimals();
    populateAnimalsDropdown();
    await loadSales();
  } catch (e) {
    alert("Server/DB error (sales)");
    console.log(e);
  }
});
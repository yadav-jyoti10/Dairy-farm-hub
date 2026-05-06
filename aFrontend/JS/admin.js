// ./JS/admin.js (DB users + DB summary modal)

function money(n) {
  const num = Number(n || 0);
  return `₹ ${num.toLocaleString("en-IN")}`;
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
  return `${y}-${m}`;
}

// ✅ per-user localStorage keys (same)
function keyAnimals(userId) {
  return `dfh_animals_${userId}`;
}
function keyMilk(userId) {
  return `dfh_milk_${userId}`;
}
function keyFeed(userId) {
  return `dfh_feed_${userId}`;
}
function keySales(userId) {
  return `dfh_sales_${userId}`;
}

function ensureFreshUserData(userId) {
  [keyAnimals(userId), keyMilk(userId), keyFeed(userId), keySales(userId)].forEach(
    (k) => {
      if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify([]));
    },
  );
}

function deleteUserAllData(userId) {
  localStorage.removeItem(keyAnimals(userId));
  localStorage.removeItem(keyMilk(userId));
  localStorage.removeItem(keyFeed(userId));
  localStorage.removeItem(keySales(userId));
}

// ✅ Admin session
function getAdminId() {
  return localStorage.getItem("dfh_userKey") || "";
}

async function api(path, options = {}) {
  const adminId = getAdminId();

  const res = await fetch(`http://127.0.0.1:5000${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-id": adminId, // backend admin middleware uses this
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({ ok: false, msg: "Invalid server response" }));

  if (!res.ok || !data.ok) {
    throw new Error(data.msg || "Request failed");
  }
  return data;
}

// ✅ UI helpers
function updateTopCards(total, blocked) {
  document.getElementById("totalUsers").innerText = total;
  document.getElementById("blockedUsers").innerText = blocked;
}

let ALL_USERS = [];

function renderUsersTable(users, search = "") {
  const tbody = document.getElementById("usersTable");
  tbody.innerHTML = "";

  const q = search.trim().toLowerCase();
  const filtered = !q
    ? users
    : users.filter(
        (u) =>
          String(u.name || "").toLowerCase().includes(q) ||
          String(u.userId || "").toLowerCase().includes(q) ||
          String(u.email || "").toLowerCase().includes(q),
      );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:16px; color:#64748b;">
          No users found.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((u, idx) => {
    const tr = document.createElement("tr");
    const status = u.blocked ? "Blocked" : "Active";
    const badgeClass = u.blocked ? "blocked" : "ok";

    const blockBtn = u.blocked
      ? `<button class="btn btn-unblock" data-act="unblock" data-id="${u.userId}">Unblock</button>`
      : `<button class="btn btn-block" data-act="block" data-id="${u.userId}">Block</button>`;

    const canDelete = u.role !== "admin";

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${u.name || "-"}</td>
      <td>${u.userId || "-"}</td>
      <td>${u.email || "-"}</td>
      <td>${u.role || "user"}</td>
      <td><span class="badge ${badgeClass}">${status}</span></td>
      <td>
        <button class="btn btn-view" data-act="view" data-id="${u.userId}">View Data</button>
        ${blockBtn}
        ${canDelete ? `<button class="btn btn-delete" data-act="delete" data-id="${u.userId}">Delete</button>` : ""}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ✅ Modal (same)
function openModal() {
  document.getElementById("userModal").style.display = "flex";
}
function closeModal() {
  document.getElementById("userModal").style.display = "none";
}
window.closeModal = closeModal;

// ✅ View Data summary (DB based)
async function viewUserData(userId) {
  // (optional) keep local storage keys created - logic unchanged, harmless
  ensureFreshUserData(userId);

  const s = await api(`/api/admin/users/${encodeURIComponent(userId)}/summary`);

  document.getElementById("modalTitle").innerText = `User Summary: ${userId}`;

  document.getElementById("mAnimals").innerText = s.animals ?? 0;

  document.getElementById("mMilkRows").innerText = s.milkRows ?? 0;
  document.getElementById("mTodayMilk").innerText = `${s.todayMilk ?? 0} L`;
  document.getElementById("mMonthMilk").innerText = `${s.monthMilk ?? 0} L`;

  document.getElementById("mSalesRows").innerText = s.salesRows ?? 0;
  document.getElementById("mTodaySales").innerText = money(s.todaySales ?? 0);
  document.getElementById("mMonthSales").innerText = money(s.monthSales ?? 0);

  openModal();
}

// ✅ DB actions
async function loadUsersAndStats() {
  const stats = await api("/api/admin/stats");
  updateTopCards(stats.total, stats.blocked);

  const u = await api("/api/admin/users");
  ALL_USERS = u.users || [];

  renderUsersTable(ALL_USERS, document.getElementById("userSearch").value);
}

async function blockUser(userId, blockValue) {
  await api(`/api/admin/users/${userId}/block`, {
    method: "PATCH",
    body: JSON.stringify({ blocked: blockValue }),
  });
  await loadUsersAndStats();
}

async function deleteUser(userId) {
  const ok = confirm(`Delete user "${userId}" and all their local data?`);
  if (!ok) return;

  await api(`/api/admin/users/${userId}`, { method: "DELETE" });

  // also delete local storage data (same as your previous feature)
  deleteUserAllData(userId);

  await loadUsersAndStats();
}

window.addEventListener("DOMContentLoaded", async () => {
  // auth.js already protects admin.html for admin only

  try {
    await loadUsersAndStats();
  } catch (e) {
    alert(e.message);
  }

  document.getElementById("userSearch").addEventListener("input", () => {
    renderUsersTable(ALL_USERS, document.getElementById("userSearch").value);
  });

  document.getElementById("usersTable").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;
    if (!act || !id) return;

    try {
      if (act === "view") await viewUserData(id);   // ✅ FIX: await
      if (act === "block") await blockUser(id, true);
      if (act === "unblock") await blockUser(id, false);
      if (act === "delete") await deleteUser(id);
    } catch (err) {
      alert(err.message);
    }
  });
});
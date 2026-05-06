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

let animals = [];
let selectedId = null;

// ================= LOAD FROM DB =================
async function loadAnimals() {
  try {
    const res = await fetch("http://localhost:5000/api/animals", {
      headers: userHeaders(),
    });

    const data = await res.json();
    if (!data.ok) {
      alert(data.msg || "Error loading animals");
      return;
    }

    animals = data.animals.map(a => ({
      id: a.animal_id,
      name: a.name,
      type: a.type,
      earTag: a.ear_tag,
      dob: a.dob,
      firstBirth: a.first_birth,
      color: a.color,
      breed: a.breed,
    }));

    renderAnimals();
  } catch (err) {
    alert("Server error while loading animals");
  }
}

// ================= HELPERS =================
function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

function byId(id) {
  return animals.find(a => Number(a.id) === Number(id));
}

// ================= RENDER =================
function renderAnimals(search = "") {
  const tbody = document.getElementById("animalTableBody");
  tbody.innerHTML = "";

  const q = normalize(search);

  const filtered = !q
    ? animals
    : animals.filter(a =>
        normalize(a.name).includes(q) ||
        normalize(a.type).includes(q) ||
        normalize(a.earTag).includes(q)
      );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center;padding:15px;color:#64748b;">
          No animals found.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${a.id}</td>
      <td>${a.name}</td>
      <td>${a.type}</td>
    `;
    tr.style.cursor = "pointer";
    tr.onclick = () => selectAnimal(a.id);
    tbody.appendChild(tr);
  });
}

function selectAnimal(id) {
  const a = byId(id);
  if (!a) return;

  selectedId = a.id;

  document.getElementById("animalId").value = a.id;
  document.getElementById("animalName").value = a.name;
  document.getElementById("animalType").value = a.type;
  document.getElementById("earTag").value = a.earTag || "";
  document.getElementById("dob").value = a.dob || "";
  document.getElementById("firstBirth").value = a.firstBirth || "";
  document.getElementById("color").value = a.color || "";
  document.getElementById("breed").value = a.breed || "";
}
window.selectAnimal = selectAnimal;

function getFormAnimal() {
  return {
    id: Number(document.getElementById("animalId").value || 0),
    name: document.getElementById("animalName").value.trim(),
    type: document.getElementById("animalType").value.trim(),
    earTag: document.getElementById("earTag").value.trim(),
    dob: document.getElementById("dob").value,
    firstBirth: document.getElementById("firstBirth").value,
    color: document.getElementById("color").value.trim(),
    breed: document.getElementById("breed").value.trim(),
  };
}

function clearAnimalForm() {
  selectedId = null;
  document.getElementById("animalId").value = "";
  document.getElementById("animalName").value = "";
  document.getElementById("animalType").value = "";
  document.getElementById("earTag").value = "";
  document.getElementById("dob").value = "";
  document.getElementById("firstBirth").value = "";
  document.getElementById("color").value = "";
  document.getElementById("breed").value = "";
}
window.clearAnimalForm = clearAnimalForm;

// ================= ADD =================
window.addAnimal = async function () {
  const f = getFormAnimal();

  if (!f.name || !f.type) {
    alert("Please enter Animal Name and Type");
    return;
  }

  const newId = animals.length
    ? Math.max(...animals.map(a => Number(a.id))) + 1
    : 1;

  try {
    const res = await fetch("http://localhost:5000/api/animals", {
      method: "POST",
      headers: userHeaders(),
      body: JSON.stringify({
        animal_id: newId,
        name: f.name,
        type: f.type,
        earTag: f.earTag,
        dob: f.dob,
        firstBirth: f.firstBirth,
        color: f.color,
        breed: f.breed,
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      alert(data.msg || "Error adding animal");
      return;
    }

    alert("Animal Added!");
    clearAnimalForm();
    loadAnimals();

  } catch (err) {
    alert("Server error");
  }
};

// ================= UPDATE =================
window.updateAnimal = async function () {
  const f = getFormAnimal();

  if (!f.id) {
    alert("Select animal first");
    return;
  }

  try {
    const res = await fetch(
      `http://localhost:5000/api/animals/${f.id}`,
      {
        method: "PUT",
        headers: userHeaders(),
        body: JSON.stringify({
          name: f.name,
          type: f.type,
          earTag: f.earTag,
          dob: f.dob,
          firstBirth: f.firstBirth,
          color: f.color,
          breed: f.breed,
        }),
      }
    );

    const data = await res.json();

    if (!data.ok) {
      alert(data.msg || "Error updating");
      return;
    }

    alert("Animal Updated!");
    loadAnimals();

  } catch (err) {
    alert("Server error");
  }
};

// ================= DELETE =================
window.deleteAnimal = async function () {
  const f = getFormAnimal();

  if (!f.id) {
    alert("Select animal first");
    return;
  }

  if (!confirm(`Delete animal ID ${f.id}?`)) return;

  try {
    const res = await fetch(
      `http://localhost:5000/api/animals/${f.id}`,
      {
        method: "DELETE",
        headers: userHeaders(),
      }
    );

    const data = await res.json();

    if (!data.ok) {
      alert(data.msg || "Error deleting");
      return;
    }

    alert("Animal Deleted!");
    clearAnimalForm();
    loadAnimals();

  } catch (err) {
    alert("Server error");
  }
};

// ================= START =================
window.addEventListener("DOMContentLoaded", () => {
  if (!isLoggedIn() || !getUserKey()) {
    window.location.href = "login.html";
    return;
  }

  loadAnimals();

  const search = document.getElementById("animalSearch");
  if (search) {
    search.addEventListener("input", () => {
      renderAnimals(search.value);
    });
  }
});
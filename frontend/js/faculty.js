const facultyGrid = document.getElementById("facultyGrid");
const facultyStatus = document.getElementById("facultyStatus");
const facultySearch = document.getElementById("facultySearch");

const isLocalFrontend =
  window.location.protocol === "file:" ||
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE = isLocalFrontend ? "http://localhost:5000/api" : "/api";
const API_ORIGIN = isLocalFrontend
  ? "http://localhost:5000"
  : window.location.origin;

const fallbackFaculty = [
  {
    name: "Ayesha Siddiqui",
    qualification: "MSc Mathematics, BEd",
    experience_years: 8,
    subjects: "Mathematics, O/A Level, Entry Test",
    city: "Islamabad/Rawalpindi",
    profile_note:
      "Known for calm explanations, structured practice, and confidence-building exam preparation.",
  },
  {
    name: "Hamza Ahmed",
    qualification: "MPhil Physics",
    experience_years: 7,
    subjects: "Physics, FSc, A Level",
    city: "Lahore",
    profile_note:
      "Helps students connect formulas with real concepts through examples, diagrams, and targeted revision.",
  },
  {
    name: "Maryam Khan",
    qualification: "MA English Literature, CELTA",
    experience_years: 9,
    subjects: "English, IELTS, Grammar, Literature",
    city: "Karachi",
    profile_note:
      "Focuses on fluent communication, writing clarity, and practical language improvement.",
  },
  {
    name: "Bilal Raza",
    qualification: "BS Computer Science",
    experience_years: 6,
    subjects: "Computer Science, Programming, Web Basics",
    city: "Online",
    profile_note:
      "Teaches coding through simple projects, problem-solving habits, and step-by-step debugging.",
  },
  {
    name: "Sara Noor",
    qualification: "MSc Chemistry",
    experience_years: 10,
    subjects: "Chemistry, Biology, O Level Science",
    city: "Islamabad/Rawalpindi",
    profile_note:
      "Makes science easier with visual explanations, topic maps, and regular concept checks.",
  },
  {
    name: "Usman Tariq",
    qualification: "MBA Finance, ACCA Finalist",
    experience_years: 7,
    subjects: "Accounting, Business Studies, Economics",
    city: "Online",
    profile_note:
      "Supports commerce students with exam-focused practice and clear real-world examples.",
  },
];

let allFaculty = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name) {
  return String(name || "NT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function experienceLabel(years) {
  const count = Number(years || 0);
  return `${count}+ year${count === 1 ? "" : "s"}`;
}

function facultyImageUrl(imagePath) {
  if (!imagePath) return "";
  return new URL(imagePath, `${API_ORIGIN}/`).href;
}

function renderFaculty(faculty) {
  if (!facultyGrid || !facultyStatus) return;

  if (!faculty.length) {
    facultyGrid.innerHTML = "";
    facultyStatus.textContent = "No faculty profiles matched your search.";
    return;
  }

  facultyStatus.textContent = `Showing ${faculty.length} faculty profile${
    faculty.length === 1 ? "" : "s"
  }.`;

  facultyGrid.innerHTML = faculty
    .map(
      (member) => `
        <article class="faculty-card">
          <div class="faculty-avatar">
            <span aria-hidden="true">${escapeHtml(initials(member.name))}</span>
            ${
              member.image_path
                ? `<img src="${escapeHtml(facultyImageUrl(member.image_path))}" alt="${escapeHtml(member.name)}" loading="lazy" onerror="this.remove()">`
                : ""
            }
          </div>
          <h3>${escapeHtml(member.name)}</h3>
          <dl class="faculty-meta">
            <div>
              <dt>Qualification</dt>
              <dd>${escapeHtml(member.qualification)}</dd>
            </div>
            <div>
              <dt>Experience</dt>
              <dd>${escapeHtml(experienceLabel(member.experience_years))}</dd>
            </div>
            <div>
              <dt>Subjects</dt>
              <dd>${escapeHtml(member.subjects || "Multiple subjects")}</dd>
            </div>
          </dl>
          <p class="faculty-note">${escapeHtml(member.profile_note || "Available for focused personal tutoring.")}</p>
        </article>
      `
    )
    .join("");
}

function filterFaculty() {
  const query = facultySearch?.value.trim().toLowerCase() || "";
  if (!query) {
    renderFaculty(allFaculty);
    return;
  }

  renderFaculty(
    allFaculty.filter((member) =>
      [
        member.name,
        member.qualification,
        member.experience_years,
        member.subjects,
        member.city,
        member.profile_note,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
  );
}

async function loadFaculty() {
  try {
    const response = await fetch(`${API_BASE}/faculty`);
    if (!response.ok) throw new Error("Faculty endpoint is unavailable.");

    const data = await response.json();
    allFaculty = Array.isArray(data.faculty) && data.faculty.length
      ? data.faculty
      : fallbackFaculty;
  } catch (error) {
    allFaculty = fallbackFaculty;
    if (facultyStatus) {
      facultyStatus.textContent =
        "Showing sample faculty profiles. Start the backend and update the database to load live data.";
    }
  }

  renderFaculty(allFaculty);
}

facultySearch?.addEventListener("input", filterFaculty);
loadFaculty();

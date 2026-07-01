const facultyGrid = document.getElementById("facultyGrid");
const homeFacultyGrid = document.getElementById("homeFacultyGrid");
const facultyStatus = document.getElementById("facultyStatus");
const facultySearch = document.getElementById("facultySearch");

const isLocalFrontend =
  window.location.protocol === "file:" ||
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_ORIGIN = isLocalFrontend ? "http://localhost:5000" : window.location.origin;
/*! Production note: ensure faculty image paths are accessible from your production domain or CDN. Configure image domain in CSP. */
const isPagesSection = window.location.pathname.includes("/pages/");
const SITE_LOGO_URL = `${isPagesSection ? "../" : "./"}assets/logo.png`;
const LOCAL_API_BASE_FALLBACKS = isLocalFrontend
  ? ["http://localhost:5000/api", "http://127.0.0.1:5000/api"]
  : ["/api"];

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
  return `${count}+ Year${count === 1 ? "" : "s"}`;
}

function facultyImageUrl(imagePath) {
  if (!imagePath) return "";
  return new URL(imagePath, `${API_ORIGIN}/`).href;
}

function facultySubjectTags(subjects) {
  const values = String(subjects || "")
    .split(/[,/|•\n]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter(
      (value, index, subjectsList) =>
        subjectsList.findIndex(
          (subject) => subject.toLowerCase() === value.toLowerCase()
        ) === index
    );

  if (!values.length) {
    return '<span class="faculty-tag">Multiple subjects</span>';
  }

  const visibleLimit = 3;
  const visibleTags = values
    .slice(0, visibleLimit)
    .map((subject) => `<span class="faculty-tag">${escapeHtml(subject)}</span>`)
    .join("");

  if (values.length <= visibleLimit) {
    return visibleTags;
  }

  const hiddenValues = values.slice(visibleLimit);
  const hiddenTags = hiddenValues
    .map((subject) => `<span class="faculty-tag">${escapeHtml(subject)}</span>`)
    .join("");

  return `
    ${visibleTags}
    <div class="faculty-subjects-more">
      <div class="faculty-subjects-extra" hidden>${hiddenTags}</div>
      <button class="faculty-subjects-toggle" type="button" aria-expanded="false">
        <span class="subjects-more-label">+${hiddenValues.length} more</span>
        <span class="subjects-less-label">Show less</span>
      </button>
    </div>
  `;
}

function facultyCardMarkup(member) {
  const imageUrl = member.image_path ? escapeHtml(facultyImageUrl(member.image_path)) : "";
  const initialsMarkup = escapeHtml(initials(member.name));

  return `
    <article class="faculty-card">
      <div class="faculty-hero">
        <div class="faculty-hero-image">
          <div class="faculty-hero-brand" aria-hidden="true">
            <img src="${escapeHtml(SITE_LOGO_URL)}" alt="" loading="lazy">
          </div>
          <div class="faculty-hero-overlay"></div>
          <span class="faculty-badge">Faculty Member</span>
        </div>

        <div class="faculty-avatar">
          ${
            imageUrl
              ? `<img src="${imageUrl}" alt="${escapeHtml(member.name)}" loading="lazy">`
              : `<span aria-hidden="true">${initialsMarkup}</span>`
          }
        </div>
      </div>

      <div class="faculty-content">
        <h3>${escapeHtml(member.name)}</h3>

        <div class="faculty-divider" aria-hidden="true">
          <span></span>
          <span class="divider-icon">🎓</span>
          <span></span>
        </div>

        <div class="faculty-info">
          <div class="info-item">
            <span class="info-label">Qualification</span>
            <span class="info-separator" aria-hidden="true"></span>
            <strong>${escapeHtml(member.qualification || "—")}</strong>
          </div>

          <div class="info-item">
            <span class="info-label">Experience</span>
            <span class="info-separator" aria-hidden="true"></span>
            <strong>${escapeHtml(experienceLabel(member.experience_years))}</strong>
          </div>

          <div class="info-item subjects-item">
            <span class="info-label">Subjects</span>
            <span class="info-separator" aria-hidden="true"></span>
            <div class="faculty-subjects">
              ${facultySubjectTags(member.subjects)}
            </div>
          </div>
        </div>

        <div class="faculty-divider faculty-divider-quote" aria-hidden="true">
          <span></span>
          <span class="divider-icon">❝</span>
          <span></span>
        </div>

        <p class="faculty-description">
          ${escapeHtml(member.profile_note || "Available for focused personal tutoring.")}
        </p>
      </div>
    </article>
  `;
}

async function fetchJsonWithFallback(endpoint) {
  let lastError = null;

  for (const baseUrl of LOCAL_API_BASE_FALLBACKS) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`);
      if (!response.ok) {
        throw new Error("Faculty endpoint is unavailable.");
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Faculty endpoint is unavailable.");
}

function renderDirectoryFaculty(faculty) {
  if (!facultyGrid || !facultyStatus) return;

  if (!faculty.length) {
    facultyGrid.innerHTML = "";
    facultyStatus.textContent = "No faculty profiles are available right now.";
    return;
  }

  facultyStatus.textContent = `Showing ${faculty.length} faculty profile${
    faculty.length === 1 ? "" : "s"
  }.`;

  facultyGrid.innerHTML = faculty
    .map((member) => facultyCardMarkup(member))
    .join("");
}

function renderHomeFaculty(faculty) {
  if (!homeFacultyGrid) return;

  if (!faculty.length) {
    homeFacultyGrid.innerHTML = '<p class="notice">Faculty profiles will appear here once they are added.</p>';
    return;
  }

  homeFacultyGrid.innerHTML = faculty
    .map((member) => facultyCardMarkup(member))
    .join("");
}

function toggleFacultySubjects(event) {
  const button = event.target.closest(".faculty-subjects-toggle");
  if (!button) return;

  const wrapper = button.closest(".faculty-subjects-more");
  const extra = wrapper?.querySelector(".faculty-subjects-extra");
  if (!wrapper || !extra) return;

  const isExpanded = !extra.hidden;
  extra.hidden = isExpanded;
  wrapper.classList.toggle("is-expanded", !isExpanded);
  button.setAttribute("aria-expanded", String(!isExpanded));
}

function filterFaculty() {
  const query = facultySearch?.value.trim().toLowerCase() || "";
  if (!query) {
    renderDirectoryFaculty(allFaculty);
    return;
  }

  renderDirectoryFaculty(
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
    if (facultyGrid) {
      const directoryData = await fetchJsonWithFallback("/faculty");
      allFaculty = Array.isArray(directoryData.faculty) ? directoryData.faculty : [];
      renderDirectoryFaculty(allFaculty);
    }

    if (homeFacultyGrid) {
      const homeData = await fetchJsonWithFallback("/faculty?limit=4&random=1");
      const homeFaculty = Array.isArray(homeData.faculty) ? homeData.faculty : [];
      renderHomeFaculty(homeFaculty);
    }
  } catch (error) {
    if (facultyGrid && facultyStatus) {
      facultyStatus.textContent = "Faculty profiles are unavailable right now.";
      facultyGrid.innerHTML = "";
    }
    if (homeFacultyGrid) {
      homeFacultyGrid.innerHTML = '<p class="notice">Faculty profiles are unavailable right now.</p>';
    }
  }
}

facultySearch?.addEventListener("input", filterFaculty);
facultyGrid?.addEventListener("click", toggleFacultySubjects);
homeFacultyGrid?.addEventListener("click", toggleFacultySubjects);
loadFaculty();

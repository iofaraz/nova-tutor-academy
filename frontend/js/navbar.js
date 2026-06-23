const pageName = window.location.pathname.split("/").pop() || "index.html";

const headerMarkup = `
  <header class="site-header">
    <nav class="navbar container" aria-label="Main navigation">
      <a class="brand" href="index.html" aria-label="Nova Tutor Academy home">
        <span class="brand-mark">N</span>
        <span>Nova Tutor Academy</span>
      </a>
      <ul class="nav-links" id="navLinks">
        <li><a class="nav-link" data-page="index.html" href="index.html">Home</a></li>
        <li><a class="nav-link" data-page="home-tutor.html" href="home-tutor.html">Home Tutors</a></li>
        <li><a class="nav-link" data-page="online-tutor.html" href="online-tutor.html">Online Tutors</a></li>
        <li><a class="nav-link" data-page="international-tutor.html" href="international-tutor.html">International</a></li>
        <li><a class="nav-link" data-page="about.html" href="about.html">About</a></li>
        <li><a class="nav-link" data-page="contact.html" href="contact.html">Contact</a></li>
      </ul>
      <div class="nav-actions">
        <a class="btn btn-secondary" href="teach-with-us.html">Teach with us</a>
        <a class="btn btn-primary" href="request-tutor.html">Find a tutor</a>
        <button class="menu-toggle" id="menuToggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  </header>`;

const footerMarkup = `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="brand" href="index.html">
            <span class="brand-mark">N</span>
            <span>Nova Tutor Academy</span>
          </a>
          <p>Helping students learn with confidence through carefully matched home and online tutors.</p>
        </div>
        <div class="footer-column">
          <h3>Services</h3>
          <a href="home-tutor.html">Home tutoring</a>
          <a href="online-tutor.html">Online tutoring</a>
          <a href="international-tutor.html">International tutoring</a>
        </div>
        <div class="footer-column">
          <h3>Company</h3>
          <a href="about.html">About us</a>
          <a href="teach-with-us.html">Teach with us</a>
          <a href="contact.html">Contact</a>
        </div>
        <div class="footer-column">
          <h3>Get started</h3>
          <a href="request-tutor.html">Request a tutor</a>
          <a href="mailto:hello@novatutoracademy.com">Email support</a>
          <a href="tel:+923001234567">+92 300 1234567</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© <span id="currentYear"></span> Nova Tutor Academy. All rights reserved.</p>
        <p>Learning, made personal.</p>
      </div>
    </div>
  </footer>`;

const headerMount = document.querySelector("[data-site-header]");
const footerMount = document.querySelector("[data-site-footer]");

if (headerMount) headerMount.innerHTML = headerMarkup;
if (footerMount) footerMount.innerHTML = footerMarkup;

document.querySelectorAll(".nav-link").forEach((link) => {
  if (link.dataset.page === pageName) link.classList.add("active");
});

const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

function closeMenu() {
  if (!menuToggle || !navLinks) return;
  menuToggle.classList.remove("active");
  navLinks.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

menuToggle?.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuToggle.classList.toggle("active", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("menu-open", isOpen);
});

navLinks?.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 980) closeMenu();
});

const year = document.getElementById("currentYear");
if (year) year.textContent = new Date().getFullYear();

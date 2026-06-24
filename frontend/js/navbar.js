const HEADER_HTML = `
<header class="site-header" id="siteHeader">
  <div class="container nav-inner">
    <a class="nav-brand" href="index.html" aria-label="Nova Tutor Academy home">
      <span class="brand-mark">N</span>
      <span>Nova Tutor Academy</span>
    </a>

    <div class="nav-menu" id="navMenu">
      <ul class="nav-links">
        <li><a href="index.html">Home</a></li>
        <li class="has-dropdown">
          <a href="#">Services</a>
          <ul class="dropdown-menu">
            <li><a href="home-tutor.html">Home tutoring</a></li>
            <li><a href="online-tutor.html">Online tutoring</a></li>
            <li><a href="international-tutor.html">International tutoring</a></li>
          </ul>
        </li>
        <li><a href="our-faculty.html">Faculty</a></li>
        <li><a href="request-tutor.html">Search Tutors</a></li>
        <li><a href="about.html">About</a></li>
        <li><a href="contact.html">Contact</a></li>
      </ul>
      <div class="nav-actions">
        <a class="btn btn-secondary" href="teach-with-us.html">Register as Tutor</a>
        <a class="btn btn-primary" href="request-tutor.html">Book Free Consultation</a>
      </div>
    </div>

    <button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="navMenu">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>`;

const FOOTER_HTML = `
<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="index.html">
          <span class="brand-mark">N</span>
          <span>Nova Tutor Academy</span>
        </a>
        <p>Connecting students with trusted tutors across Islamabad, Rawalpindi, Lahore, and Karachi — and online worldwide.</p>
      </div>
      <div class="footer-col">
        <h4>Subjects</h4>
        <ul>
          <li><a href="request-tutor.html">Mathematics</a></li>
          <li><a href="request-tutor.html">Physics</a></li>
          <li><a href="request-tutor.html">Chemistry</a></li>
          <li><a href="request-tutor.html">Computer Science</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>For Students</h4>
        <ul>
          <li><a href="request-tutor.html">Search Tutors</a></li>
          <li><a href="request-tutor.html">Book Free Consultation</a></li>
          <li><a href="our-faculty.html">Our Faculty</a></li>
          <li><a href="online-tutor.html">Online Tutoring</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About Us</a></li>
          <li><a href="teach-with-us.html">Register as Tutor</a></li>
          <li><a href="contact.html">Contact Us</a></li>
          <li><a href="tel:+923001234567">+92 300 1234567</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} Nova Tutor Academy. All rights reserved.</span>
      <span>Islamabad · Rawalpindi · Lahore · Karachi</span>
    </div>
  </div>
</footer>`;

document.querySelectorAll("[data-site-header]").forEach((element) => {
  element.outerHTML = HEADER_HTML;
});

document.querySelectorAll("[data-site-footer]").forEach((element) => {
  element.outerHTML = FOOTER_HTML;
});

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("navMenu");

  function closeMenu() {
    if (!toggle || !menu) return;
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    document.addEventListener("click", (event) => {
      if (!toggle.contains(event.target) && !menu.contains(event.target)) {
        closeMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 980) closeMenu();
    });
  }

  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href !== "#" && current === href) {
      link.classList.add("active");
    }
  });
});

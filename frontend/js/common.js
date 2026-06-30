let isPagesSection = window.location.pathname.includes("/pages/");
const siteRoot = isPagesSection ? "../" : "./";
const basePath = `${siteRoot}pages/`;
const homePath = `${siteRoot}index.html`;
const assetPath = `${siteRoot}assets/`;

const HEADER_HTML = `
<header class="site-header" id="siteHeader">
  <div class="container nav-inner">
    <a class="nav-brand" href="${homePath}" aria-label="Nova Tutor Academy home">
      <img src="${assetPath}brand identity.png" alt="Nova Tutor Academy">
    </a>

    <div class="nav-menu" id="navMenu">
      <ul class="nav-links">
        <li><a href="${homePath}">Home</a></li>
        <li class="has-dropdown">
          <a class="dropdown-trigger" href="#" aria-expanded="false" aria-controls="servicesMenu">
            Services
            <i class="fa-solid fa-angle-down" aria-hidden="true" style="margin-left:4px"></i>
          </a>
          <ul class="dropdown-menu" id="servicesMenu">
            <li><a href="${basePath}home-tutor.html">Home Tutoring</a></li>
            <li><a href="${basePath}online-tutor.html">Online Tutoring</a></li>
            <li><a href="${basePath}international-tutor.html">International Tutoring</a></li>
          </ul>
        </li>
        <li><a href="${basePath}our-faculty.html">Faculty</a></li>
        <li><a href="${basePath}about.html">About</a></li>
        <li><a href="${basePath}contact.html">Contact</a></li>
        <li><a href="${basePath}admin-signin.html">Admin</a></li>
      </ul>
      <div class="nav-mobile-actions">
        <a class="btn btn-secondary" href="${basePath}teach-with-us.html">Register as Tutor</a>
        <a class="btn btn-primary" href="${basePath}request-tutor.html">Find a Tutor</a>
      </div>
    </div>
    <div class="nav-actions">
      <a class="btn btn-secondary" href="${basePath}teach-with-us.html">Register as Tutor</a>
      <a class="btn btn-primary" href="${basePath}request-tutor.html">Find a Tutor</a>
    </div>

    <button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="navMenu">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </div>
</header>`;

const FOOTER_HTML = `
<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="nav-brand" href="${homePath}" aria-label="Nova Tutor Academy home">
          <img src="${assetPath}brand identity.png" alt="Nova Tutor Academy">
        </a>
        <p>Connecting students with trusted tutors across Islamabad, Rawalpindi, Lahore, and Karachi - and online worldwide.</p>
      </div>
      <div class="footer-col">
        <h4>Subjects</h4>
        <ul>
          <li><a href="${basePath}request-tutor.html">Mathematics</a></li>
          <li><a href="${basePath}request-tutor.html">Physics</a></li>
          <li><a href="${basePath}request-tutor.html">Chemistry</a></li>
          <li><a href="${basePath}request-tutor.html">Computer Science</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>For Students</h4>
        <ul>
          <li><a href="${basePath}request-tutor.html">Search Tutors</a></li>
          <li><a href="${basePath}contact.html">Contact Us</a></li>
          <li><a href="${basePath}our-faculty.html">Our Faculty</a></li>
          <li><a href="${basePath}online-tutor.html">Online Tutoring</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <ul>
          <li><a href="${basePath}about.html">About Us</a></li>
          <li><a href="${basePath}teach-with-us.html">Register as Tutor</a></li>
          <li><a href="${basePath}contact.html">Contact Us</a></li>
          <li><a href="tel:+923001234567">+92 334 0067834</a></li>
        </ul>
        <div class="social-links">
              <a class="social-link instagram" href="https://www.instagram.com" target="_blank"
                ><i class="fa-brands fa-instagram"></i
              ></a>
              <a class="social-link whatsapp" href="https://wa.me/923165728575" target="_blank"
                ><i class="fa-brands fa-whatsapp"></i
              ></a>
              <a class="social-link facebook" href="https://www.facebook.com" target="_blank"
                ><i class="fa-brands fa-facebook-f"></i></a>
        </div>
      </div>
      
    </div>
    <div class="footer-bottom">
      <span>&copy; ${new Date().getFullYear()} Nova Tutor Academy. All rights reserved.</span>
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
  const whatsappLink = document.createElement("a");
  whatsappLink.className = "whatsapp-float";
  whatsappLink.href = "https://wa.me/923165728575";
  whatsappLink.target = "_blank";
  whatsappLink.rel = "noopener noreferrer";
  whatsappLink.setAttribute("aria-label", "Chat with Nova Tutor Academy on WhatsApp");
  whatsappLink.title = "Chat with us on WhatsApp";
  whatsappLink.innerHTML = '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i>';
  document.body.appendChild(whatsappLink);

  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("navMenu");
  const dropdownTriggers = document.querySelectorAll(".dropdown-trigger");

  function closeMenu() {
    if (!toggle || !menu) return;
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    document.body.style.overflow = "";
    dropdownTriggers.forEach((trigger) => {
      trigger.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".has-dropdown.open").forEach((item) => {
      item.classList.remove("open");
    });
  }

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
      document.body.style.overflow = isOpen ? "hidden" : "";
      if (!isOpen) {
        dropdownTriggers.forEach((trigger) => {
          trigger.setAttribute("aria-expanded", "false");
        });
        document.querySelectorAll(".has-dropdown.open").forEach((item) => {
          item.classList.remove("open");
        });
      }
    });

    document.addEventListener("click", (event) => {
      const dropdownTrigger = event.target.closest(".dropdown-trigger");
      if (dropdownTrigger) {
        event.preventDefault();
        const dropdown = dropdownTrigger.closest(".has-dropdown");
        const isMobile = window.innerWidth <= 980;
        if (isMobile && dropdown) {
          const isExpanded = dropdown.classList.toggle("open");
          dropdownTrigger.setAttribute("aria-expanded", String(isExpanded));
        }
        return;
      }

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
    let href = link.getAttribute("href");
    if (!href || href === "#") return;

    if (href.startsWith(basePath)) {
      href = href.slice(basePath.length);
    }

    if (current === href) {
      link.classList.add("active");
    }
  });

  const backToTop = document.createElement("button");
  backToTop.type = "button";
  backToTop.className = "back-to-top";
  backToTop.setAttribute("aria-label", "Scroll back to top");
  backToTop.innerHTML = "↑";
  document.body.appendChild(backToTop);

  const updateBackToTop = () => {
    if (window.scrollY > 360) {
      backToTop.classList.add("show");
    } else {
      backToTop.classList.remove("show");
    }
  };

  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", updateBackToTop, { passive: true });
  updateBackToTop();
});

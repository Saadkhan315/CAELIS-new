
/* =========================================
   CAELIS — WEBSITE INTERACTIONS
   Frontend foundation; database comes next.
========================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const navigation = document.getElementById("navigation");
  const cartCount = document.getElementById("cartCount");
  const currentYear = document.getElementById("currentYear");
  const newsletterForm = document.getElementById("newsletterForm");
  const newsletterEmail = document.getElementById("newsletterEmail");
  const newsletterMessage = document.getElementById("newsletterMessage");
  const toast = document.getElementById("toast");

  // Footer year
  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  // Mobile navigation
  if (menuToggle && navigation) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navigation.classList.toggle("open");

      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Close navigation" : "Open navigation"
      );
      menuToggle.textContent = isOpen ? "✕" : "☰";
    });

    navigation.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigation.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation");
        menuToggle.textContent = "☰";
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        navigation.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation");
        menuToggle.textContent = "☰";
      }
    });
  }

  // Small notification message
  let toastTimeout;

  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  // Cart count foundation.
  // This is only a visual placeholder until the real cart
  // and inventory are connected to the backend.
  if (cartCount) {
    cartCount.textContent = "0";
  }

  // Newsletter: validate the email, but do not pretend
  // to save it to a database before backend integration.
  if (newsletterForm && newsletterEmail && newsletterMessage) {
    newsletterForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!newsletterEmail.checkValidity()) {
        newsletterEmail.reportValidity();
        return;
      }

      newsletterMessage.textContent =
        "The newsletter service is not connected yet. Please check back soon.";

      showToast("Newsletter signup will be available soon.");
    });
  }

  // Collection links currently lead to the store section.
  // Real collection filtering will be added with the catalogue.
  document.querySelectorAll(".collection-card").forEach((card) => {
    card.addEventListener("click", () => {
      const label = card.querySelector("h3");

      if (label) {
        // The store will become filterable when products
        // and collection data are connected.
      }
    });
  });

  // Respect reduced-motion preferences and leave browser
  // scrolling behavior accessible.
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  if (reduceMotion.matches) {
    document.documentElement.style.scrollBehavior = "auto";
  }

  console.info("CAELIS website loaded successfully.");
});

(function initGlobalCta() {
  try {
    if (document.body.classList.contains("admin-page")) {
      return;
    }

    const config = window.APP_CONFIG || {};
    const email = config.CONTACT_EMAIL || "hello@deusflow.com";
    const handle = config.INSTAGRAM_HANDLE || "@deusflow";
    const ctaLabel = config.CTA_LABEL || "Check availability";
    const availabilityNote = config.AVAILABILITY_NOTE || "Calendar open for 2026-2027 weddings";
    const query = encodeURIComponent("Wedding inquiry");

    const wrap = document.createElement("div");
    wrap.className = "floating-cta";
    wrap.innerHTML = `
      <a class="floating-cta-button" href="mailto:${email}?subject=${query}">${ctaLabel}</a>
      <p class="floating-cta-note">${availabilityNote} · ${handle}</p>
    `;

    document.body.appendChild(wrap);
  } catch (error) {
    console.warn("Global CTA init failed", error);
  }
})();


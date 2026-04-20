(function initGlobalCta() {
  try {
    if (document.body.classList.contains("admin-page")) {
      return;
    }

    const config = window.APP_CONFIG || {};
    const handle = config.INSTAGRAM_HANDLE || "@deusflow";
    const username = String(handle).replace(/^@/, "") || "deusflow";
    const ctaLabel = config.CTA_LABEL || "Check availability";
    const availabilityNote = config.AVAILABILITY_NOTE || "Calendar open for 2026-2027 weddings";
    const instagramDmUrl = config.INSTAGRAM_DM_URL || `https://ig.me/m/${username}`;
    const whatsappUrl = config.WHATSAPP_URL || "";

    const wrap = document.createElement("div");
    wrap.className = "floating-cta";
    wrap.innerHTML = `
      <a class="floating-cta-button" href="${instagramDmUrl}" target="_blank" rel="noopener noreferrer">${ctaLabel}</a>
      <p class="floating-cta-note">${availabilityNote} · DM on Instagram ${handle}${whatsappUrl ? ` · <a class="text-hover-gold" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}</p>
    `;

    document.body.appendChild(wrap);
  } catch (error) {
    console.warn("Global CTA init failed", error);
  }
})();


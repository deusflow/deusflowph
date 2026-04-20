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
    const telegramUrl = config.TELEGRAM_URL || "";
    const briefTemplate = config.BRIEF_TEMPLATE || "Hi Oleh! Wedding inquiry:\n- Date:\n- City:\n- Format (wedding/elopement/session):\n- Budget range:\n- Guest count:\n- Link to inspiration:";

    function buildWhatsAppWithText(baseUrl, encodedText) {
      if (!baseUrl) {
        return "";
      }
      return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}text=${encodedText}`;
    }

    const encodedBrief = encodeURIComponent(briefTemplate);
    const primaryHref = instagramDmUrl;
    const primaryLabel = `${ctaLabel} via Instagram`;

    const wrap = document.createElement("div");
    wrap.className = "floating-cta";
    wrap.innerHTML = `
      <a class="floating-cta-button" id="global-chat-cta" href="${primaryHref}" target="_blank" rel="noopener noreferrer">${primaryLabel}</a>
      <p class="floating-cta-note" id="global-chat-note">${availabilityNote} · DM on Instagram ${handle}${telegramUrl ? ` · <a class="text-hover-gold" href="${telegramUrl}" target="_blank" rel="noopener noreferrer">Telegram</a>` : ""}${whatsappUrl ? ` · <a class="text-hover-gold" href="${buildWhatsAppWithText(whatsappUrl, encodedBrief)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}</p>
    `;

    document.body.appendChild(wrap);

    const header = document.querySelector(".site-header");
    if (!header) {
      return;
    }

    const mobileBar = document.createElement("div");
    mobileBar.className = "mobile-sticky-cta";
    mobileBar.innerHTML = `
      <a class="mobile-sticky-cta-button" href="${primaryHref}" target="_blank" rel="noopener noreferrer">${primaryLabel}</a>
    `;
    document.body.appendChild(mobileBar);

    const ctaNode = document.getElementById("global-chat-cta");
    const noteNode = document.getElementById("global-chat-note");
    ctaNode?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(briefTemplate);
        if (noteNode) {
          noteNode.textContent = "Brief template copied. Paste it in Instagram DM.";
        }
      } catch (_error) {
        // Clipboard access can be blocked by browser permissions.
      }
    });
  } catch (error) {
    console.warn("Global CTA init failed", error);
  }
})();


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

    const contactTarget = document.getElementById("contact-block") ? "#contact-block" : (document.documentElement.dataset.root || ".") + "/index.html#contact-block";

    const wrap = document.createElement("div");
    wrap.className = "floating-cta";
    wrap.innerHTML = `
      <a class="floating-cta-button" id="global-chat-cta" href="${primaryHref}" target="_blank" rel="noopener noreferrer">${primaryLabel}</a>
      <p class="floating-cta-note" id="global-chat-note">${availabilityNote} &middot; <a class="text-hover-gold" href="${contactTarget}">See all contact options</a></p>
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

    function applyCtaLinks(settings) {
      if (!settings) return;
      const handle = settings.instagram_handle || config.INSTAGRAM_HANDLE || "@deusflow";
      const user = String(handle).replace(/^@/, "") || "deusflow";
      const igDmUrl = settings.instagram_dm_url || config.INSTAGRAM_DM_URL || `https://ig.me/m/${user}`;
      const waUrl = settings.whatsapp_url || config.WHATSAPP_URL || "";
      const tgUrl = settings.telegram_url || config.TELEGRAM_URL || "";

      const ctaBtn = document.getElementById("global-chat-cta");
      const stickyBtn = document.querySelector(".mobile-sticky-cta-button");
      if (ctaBtn) {
        ctaBtn.href = igDmUrl;
      }
      if (stickyBtn) {
        stickyBtn.href = igDmUrl;
      }

      // Update static page contacts (Telegram, WhatsApp)
      const tgLinks = document.querySelectorAll("[data-runtime-link='telegram']");
      tgLinks.forEach((link) => {
        if (tgUrl) {
          link.href = tgUrl;
          link.style.display = "";
        } else {
          link.style.display = "none";
        }
      });

      const waLinks = document.querySelectorAll("[data-runtime-link='whatsapp']");
      waLinks.forEach((link) => {
        if (waUrl) {
          link.href = waUrl;
          link.style.display = "";
        } else {
          link.style.display = "none";
        }
      });

      // Instagram links
      const igLinks = document.querySelectorAll("a[href*='instagram.com']");
      igLinks.forEach((link) => {
        if (user && !link.classList.contains("menu-link")) {
          link.href = `https://instagram.com/${user}`;
        }
      });
    }

    document.addEventListener("settingsloaded", (event) => {
      applyCtaLinks(event.detail);
    });

    if (window.SITE_SETTINGS) {
      applyCtaLinks(window.SITE_SETTINGS);
    }
  } catch (error) {
    console.warn("Global CTA init failed", error);
  }
})();

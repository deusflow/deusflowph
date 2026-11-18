import { getSupabase } from "./supabase-client.js";
import { createStateMessage, initScrollReveals, initSmartHeader } from "./ui.js?v=20261105-1";

const contactNode = document.getElementById("pricing-contact");
const travelNoteNode = document.getElementById("pricing-travel-note");
const pricingUpdatedAtNode = document.getElementById("pricing-updated-at");
const selectedBannerNode = document.getElementById("pricing-selected-banner");
const contactBlockNode = document.getElementById("contact-block");

let currentResolvedPricing = null;
let activeSelectedPackageKey = null;

const PACKAGE_META = {
  essentials: { en: "Essentials (4h)", da: "Essentials (4 timer)", ua: "Essentials (4 год)" },
  signature: { en: "Signature (8h)", da: "Signature (8 timer)", ua: "Signature (8 год)" },
  luxury: { en: "Luxury (12h)", da: "Luxury (12 timer)", ua: "Luxury (12 год)" },
  session: { en: "Individual Session", da: "Individuel session", ua: "Індивідуальна зйомка" }
};

function getServiceSchemaNode() {
  const taggedNode = document.getElementById("pricing-service-jsonld");
  if (taggedNode) {
    return taggedNode;
  }

  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  return scripts.find((node) => {
    try {
      const parsed = JSON.parse(node.textContent || "{}");
      return parsed["@type"] === "Service";
    } catch {
      return false;
    }
  }) || null;
}

const fallbackPricing = {
  essentials_price: 6500,
  signature_price: 12000,
  luxury_price: 18000,
  session_price: 2500,
  currency: "DKK",
  travel_note:
    "Travel costs are included within Jutland. Weddings outside Jutland include standard travel and accommodation fees."
};

function formatPrice(value, currency = "DKK") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (currency === "DKK") {
    return `kr ${new Intl.NumberFormat("en-DK").format(Math.round(numeric))}`;
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency
  }).format(numeric);
}

function applyPackagePrices(content) {
  currentResolvedPricing = content;
  const map = {
    essentials: content.essentials_price,
    signature: content.signature_price,
    luxury: content.luxury_price,
    session: content.session_price
  };

  Object.entries(map).forEach(([key, value]) => {
    const node = document.querySelector(`[data-package-price="${key}"]`);
    if (!node) {
      return;
    }

    const numeric = Number(value);
    const countSpan = node.querySelector("[data-count]");
    if (countSpan && (content.currency || "DKK") === "DKK" && Number.isFinite(numeric)) {
      countSpan.setAttribute("data-count", String(Math.round(numeric)));
      countSpan.setAttribute("data-count-format", "number");
      return;
    }

    const text = formatPrice(value, content.currency);
    if (text) {
      node.textContent = text;
    }
  });
}

function getPricingLang() {
  if (typeof window.getActiveLanguage === "function") {
    return window.getActiveLanguage();
  }
  const htmlLang = (document.documentElement.lang || "en").toLowerCase();
  if (htmlLang === "uk" || htmlLang === "ua") return "ua";
  if (htmlLang === "da") return "da";
  return "en";
}

function buildPackageInquiryText(packageKey, formattedPrice) {
  const lang = getPricingLang();
  const label = (PACKAGE_META[packageKey] && PACKAGE_META[packageKey][lang]) || packageKey;
  if (lang === "ua") {
    return `Привіт, Олеже! Нас цікавить пакет ${label} (${formattedPrice}). Плануємо весілля [Дата] у [Місто/Локація]. Чи вільна ця дата?`;
  }
  if (lang === "da") {
    return `Hej Oleh! Vi er interesserede i ${label} (${formattedPrice}). Vi planlægger bryllup den [Dato] i [By/Sted]. Er denne dato ledig?`;
  }
  return `Hi Oleh! We are interested in the ${label} collection (${formattedPrice}). We are planning our day on [Date] in [City/Venue]. Is this date available?`;
}

function updateSelectedPackageContacts(packageKey) {
  if (!contactBlockNode) return;

  const lang = getPricingLang();
  const pricing = currentResolvedPricing || fallbackPricing;
  const priceMap = {
    essentials: pricing.essentials_price,
    signature: pricing.signature_price,
    luxury: pricing.luxury_price,
    session: pricing.session_price
  };

  const waLink = contactBlockNode.querySelector('a[href*="wa.me"]');
  const tgLink = contactBlockNode.querySelector('a[href*="t.me/"]');
  const mailLink = contactBlockNode.querySelector('a[href*="mailto:"]');

  [waLink, tgLink, mailLink].forEach((link) => {
    if (link && !link.dataset.defaultHref) {
      link.dataset.defaultHref = link.href;
    }
  });

  if (!packageKey) {
    delete contactBlockNode.dataset.pricingSelected;
    [waLink, tgLink, mailLink].forEach((link) => {
      if (link && link.dataset.defaultHref) {
        link.href = link.dataset.defaultHref;
      }
    });
    if (selectedBannerNode) {
      selectedBannerNode.classList.add("hidden");
      selectedBannerNode.innerHTML = "";
    }
    return;
  }

  const formattedPrice = formatPrice(priceMap[packageKey], pricing.currency) || "";
  const message = buildPackageInquiryText(packageKey, formattedPrice);
  const encodedMsg = encodeURIComponent(message);
  const label = (PACKAGE_META[packageKey] && PACKAGE_META[packageKey][lang]) || packageKey;

  contactBlockNode.dataset.pricingSelected = "1";

  if (waLink) {
    waLink.href = `https://wa.me/4550300636?text=${encodedMsg}`;
  }
  if (tgLink) {
    tgLink.href = `https://t.me/OflowPhotography?text=${encodedMsg}`;
  }
  if (mailLink) {
    const subj = lang === "ua"
      ? `Запит: ${label}`
      : (lang === "da" ? `Forespørgsel: ${label}` : `Wedding Inquiry: ${label}`);
    mailLink.href = `mailto:deuswork@icloud.com?subject=${encodeURIComponent(subj)}&body=${encodedMsg}`;
  }

  if (selectedBannerNode) {
    const prefixText = lang === "ua"
      ? "Обраний пакет:"
      : (lang === "da" ? "Valgt pakke:" : "Selected collection:");
    const clearLabel = lang === "ua" ? "Скинути" : (lang === "da" ? "Ryd" : "Clear");
    selectedBannerNode.innerHTML = `
      <span>✦ ${prefixText} <strong>${label}</strong> · ${formattedPrice}</span>
      <button type="button" class="pricing-selected-clear" aria-label="Clear selected collection">${clearLabel} ×</button>
    `;
    selectedBannerNode.classList.remove("hidden");
    const clearBtn = selectedBannerNode.querySelector(".pricing-selected-clear");
    clearBtn?.addEventListener("click", () => {
      activeSelectedPackageKey = null;
      document.querySelectorAll(".editorial-menu-item.is-selected").forEach((el) => el.classList.remove("is-selected"));
      updateSelectedPackageContacts(null);
      if (typeof window.applyTranslations === "function") {
        window.applyTranslations();
      }
    });
  }
}

function initPackageSelection() {
  const buttons = document.querySelectorAll("[data-select-package]");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-select-package");
      if (!key) return;
      activeSelectedPackageKey = key;

      document.querySelectorAll(".editorial-menu-item").forEach((card) => {
        card.classList.toggle("is-selected", card.getAttribute("data-package-card") === key);
      });

      updateSelectedPackageContacts(key);

      if (contactBlockNode) {
        contactBlockNode.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });

  // Copy prefilled message when clicking Instagram DM after selecting a package
  const igLink = contactBlockNode?.querySelector('a[href*="instagram.com"]');
  igLink?.addEventListener("click", async () => {
    if (!activeSelectedPackageKey) return;
    const pricing = currentResolvedPricing || fallbackPricing;
    const priceMap = {
      essentials: pricing.essentials_price,
      signature: pricing.signature_price,
      luxury: pricing.luxury_price,
      session: pricing.session_price
    };
    const formattedPrice = formatPrice(priceMap[activeSelectedPackageKey], pricing.currency) || "";
    const text = buildPackageInquiryText(activeSelectedPackageKey, formattedPrice);
    try {
      await navigator.clipboard.writeText(text);
    } catch (_e) {}
  });
}

function applyTravelNote(content) {
  if (travelNoteNode && content.travel_note) {
    travelNoteNode.textContent = String(content.travel_note).trim();
  }
}

function applyServiceSchema(content) {
  const serviceSchemaNode = getServiceSchemaNode();
  if (!serviceSchemaNode) {
    return;
  }

  try {
    const parsed = JSON.parse(serviceSchemaNode.textContent || "{}");
    const offers = Array.isArray(parsed.offers) ? parsed.offers : [];
    const priceByName = {
      essentials: content.essentials_price,
      signature: content.signature_price,
      luxury: content.luxury_price,
      "individual session": content.session_price
    };

    parsed.offers = offers.map((offer) => {
      const key = String(offer?.name || "").toLowerCase();
      const nextPrice = priceByName[key];
      if (!Number.isFinite(Number(nextPrice))) {
        return offer;
      }
      return {
        ...offer,
        priceCurrency: content.currency || "DKK",
        price: String(Math.round(Number(nextPrice)))
      };
    });

    serviceSchemaNode.textContent = JSON.stringify(parsed);
  } catch {
    // Keep static schema if parsing fails.
  }
}

function applyUpdatedAt(content) {
  if (!pricingUpdatedAtNode || !content.updated_at) {
    return;
  }

  const date = new Date(content.updated_at);
  if (Number.isNaN(date.getTime())) {
    return;
  }

  pricingUpdatedAtNode.textContent = `Last updated: ${new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(date)}`;
}

function applyContactFromConfig() {
  if (!contactNode || !window.APP_CONFIG) {
    return;
  }

  const instagramHandle = window.APP_CONFIG.INSTAGRAM_HANDLE || "@deusflow";
  const telegramUrl = window.APP_CONFIG.TELEGRAM_URL || "";
  const whatsappUrl = window.APP_CONFIG.WHATSAPP_URL || "";

  const links = [
    {
      label: instagramHandle,
      href: `https://instagram.com/${instagramHandle.replace("@", "")}`
    }
  ];

  if (telegramUrl) {
    links.push({ label: "Telegram", href: telegramUrl });
  }
  if (whatsappUrl) {
    links.push({ label: "WhatsApp", href: whatsappUrl });
  }

  contactNode.textContent = "For availability, message ";
  links.forEach((item, index) => {
    const anchor = document.createElement("a");
    anchor.className = "text-hover-gold";
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.href = item.href;
    anchor.textContent = item.label;
    contactNode.appendChild(anchor);

    if (index < links.length - 2) {
      contactNode.append(", ");
    } else if (index === links.length - 2) {
      contactNode.append(links.length > 2 ? ", or " : " or ");
    }
  });
  contactNode.append(".");
}

async function loadPricingContent() {
  let resolved = { ...fallbackPricing };
  try {
    const cached = JSON.parse(localStorage.getItem("deusflow_pricing_cache") || "null");
    if (cached) {
      applyPackagePrices(cached);
      applyTravelNote(cached);
      applyServiceSchema(cached);
      applyUpdatedAt(cached);
      if (cached.show_essentials === false) hidePackage("essentials");
      if (cached.show_signature === false) hidePackage("signature");
      if (cached.show_luxury === false) hidePackage("luxury");
      if (cached.show_session === false) hidePackage("session");
    }
  } catch (_e) {}

  const supabase = getSupabase();
  const { data, error } = await supabase.from("pricing_content").select("*").eq("id", 1).maybeSingle();

  if (error) {
    if (travelNoteNode && !localStorage.getItem("deusflow_pricing_cache")) {
      const hint = error?.code === "42501" || String(error?.message || "").toLowerCase().includes("permission")
        ? "Live pricing unavailable (DB access denied). Check pricing_content grants/RLS in Supabase."
        : `Live pricing unavailable. Showing fallback. ${error.message}`;
      travelNoteNode.prepend(createStateMessage(hint));
    }
  } else if (data) {
    resolved = { ...resolved, ...data };
    localStorage.setItem("deusflow_pricing_cache", JSON.stringify(resolved));
    if (data.show_essentials === false) hidePackage("essentials");
    if (data.show_signature === false) hidePackage("signature");
    if (data.show_luxury === false) hidePackage("luxury");
    if (data.show_session === false) hidePackage("session");
  }

  applyPackagePrices(resolved);
  applyTravelNote(resolved);
  applyServiceSchema(resolved);
  applyUpdatedAt(resolved);
}

function hidePackage(name) {
  const priceNode = document.querySelector(`[data-package-price="${name}"]`);
  if (priceNode) {
    const article = priceNode.closest(".editorial-menu-item");
    if (article) {
      article.style.display = "none";
    }
  }
}

try {
  applyContactFromConfig();
} catch {
  if (contactNode) {
    contactNode.prepend(createStateMessage("Could not read contact settings from config.js."));
  }
}

initPackageSelection();
loadPricingContent().then(() => {
  initSmartHeader();
  initScrollReveals();
  if (typeof window.applyTranslations === "function") {
    window.applyTranslations();
  }
});

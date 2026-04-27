import { getSupabase } from "./supabase-client.js";
import { createStateMessage } from "./ui.js";

const contactNode = document.getElementById("pricing-contact");
const travelNoteNode = document.getElementById("pricing-travel-note");
const pricingUpdatedAtNode = document.getElementById("pricing-updated-at");

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

    const text = formatPrice(value, content.currency);
    if (text) {
      node.textContent = text;
    }
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
  const supabase = getSupabase();
  const { data, error } = await supabase.from("pricing_content").select("*").eq("id", 1).maybeSingle();

  if (error) {
    if (travelNoteNode) {
      travelNoteNode.prepend(createStateMessage(`Live pricing unavailable. Showing fallback. ${error.message}`));
    }
  } else if (data) {
    resolved = { ...resolved, ...data };
  }

  applyPackagePrices(resolved);
  applyTravelNote(resolved);
  applyServiceSchema(resolved);
  applyUpdatedAt(resolved);
}

try {
  applyContactFromConfig();
} catch {
  if (contactNode) {
    contactNode.prepend(createStateMessage("Could not read contact settings from config.js."));
  }
}

loadPricingContent();

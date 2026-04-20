import { createStateMessage } from "./ui.js";

const contactNode = document.getElementById("pricing-contact");

try {
  if (window.APP_CONFIG) {
    const instagramHandle = window.APP_CONFIG.INSTAGRAM_HANDLE || "@deusflow";
    const telegramUrl = window.APP_CONFIG.TELEGRAM_URL || "";
    const whatsappUrl = window.APP_CONFIG.WHATSAPP_URL || "";
    contactNode.innerHTML = `
      For availability, message <a class="text-hover-gold" target="_blank" rel="noopener noreferrer" href="https://instagram.com/${instagramHandle.replace("@", "")}">${instagramHandle}</a>${telegramUrl ? `, <a class="text-hover-gold" target="_blank" rel="noopener noreferrer" href="${telegramUrl}">Telegram</a>` : ""}${whatsappUrl ? `, or <a class="text-hover-gold" target="_blank" rel="noopener noreferrer" href="${whatsappUrl}">WhatsApp</a>` : ""}.
    `;
  }
} catch {
  contactNode.replaceWith(createStateMessage("Could not read contact settings from config.js."));
}

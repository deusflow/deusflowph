import { createStateMessage } from "./ui.js";

const contactNode = document.getElementById("pricing-contact");

try {
  if (window.APP_CONFIG && window.APP_CONFIG.CONTACT_EMAIL) {
    const instagramHandle = window.APP_CONFIG.INSTAGRAM_HANDLE || "@deusflow";
    contactNode.innerHTML = `
      For availability, email <a class="text-hover-gold" href="mailto:${window.APP_CONFIG.CONTACT_EMAIL}">${window.APP_CONFIG.CONTACT_EMAIL}</a>
      or message <a class="text-hover-gold" target="_blank" rel="noopener noreferrer" href="https://instagram.com/${instagramHandle.replace("@", "")}">${instagramHandle}</a>.
    `;
  }
} catch {
  contactNode.replaceWith(createStateMessage("Could not read contact settings from config.js."));
}

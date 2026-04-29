const DADict = {
  // Navigation
  "Weddings": "Bryllupper",
  "Pricing": "Priser",
  "Wedding Photographer | Aarhus, Denmark": "Bryllupsfotograf | Aarhus, Danmark",
  "About": "Om mig",
  "Contact": "Kontakt",

  // Index hero
  "Not loud.": "Ikke højlydt.",
  "But your photos will be.": "Men det vil dine billeder være.",
  "I stay quiet so your moments can speak - raw, awkward, real.": "Jeg forbliver stille, så dine øjeblikke kan tale - rå, akavede, ægte.",
  "Like magic.": "Som magi.",
  "Weddings captured": "Bryllupper",
  "Countries": "Lande",
  "Featured in": "Udgivet i",

  // Pricing
  "Collections": "Priser",
  "Essentials": "Essentielle",
  "Signature": "Signatur",
  "Luxury": "Luksus",
  "Add-ons": "Tilføjelser",
  "Included in Every Collection": "Inkluderet i hver pakke",

  // Global
  "Your moments.": "Dine øjeblikke.",
  "Oleh Ro": "Oleh Ro"
};

function applyTranslations() {
  const currentLang = localStorage.getItem('deusflow_lang') || 'en';
  if (currentLang === 'en') return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    const text = node.nodeValue.trim();
    if (!text) continue;

    // Direct match
    if (DADict[text]) {
      node.nodeValue = node.nodeValue.replace(text, DADict[text]);
      continue;
    }

    // Partial Match for multiline splits or nested strong tags
    for (const [enText, daText] of Object.entries(DADict)) {
       if (text.includes(enText)) {
          node.nodeValue = node.nodeValue.replace(enText, daText);
       }
    }
  }
}

function initLangToggle() {
  // Add mobile/hamburger support if necessary, but site-header inner handles desktop
  const currentLang = localStorage.getItem('deusflow_lang') || 'en';

  // Wait for header
  const headerInner = document.querySelector('.site-header .header-inner');
  if (headerInner) {
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'lang-switcher';

    const btn = document.createElement('button');
    btn.className = 'lang-btn menu-link';

    btn.textContent = currentLang === 'en' ? 'DA' : 'EN';
    btn.title = currentLang === 'en' ? 'Skift til Dansk' : 'Switch to English';


    btn.addEventListener('click', () => {
      const newLang = currentLang === 'en' ? 'da' : 'en';
      localStorage.setItem('deusflow_lang', newLang);
      location.reload();
    });

    toggleContainer.appendChild(btn);
    // Ensure parent has relative position
    headerInner.style.position = 'relative';
    headerInner.appendChild(toggleContainer);
  }
}

// In case the script is loaded async or deferred
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLangToggle();
    applyTranslations();
  });
} else {
  initLangToggle();
  applyTranslations();
}


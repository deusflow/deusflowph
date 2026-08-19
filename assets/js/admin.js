import {
  getSupabase,
  slugify,
  formatDate,
  uploadToPhotosBucket,
  storagePathFromPublicUrl
} from "./supabase-client.js";
import { createStateMessage } from "./ui.js?v=20260819-8";

const state = {
  selectedAlbum: null,
  aboutContent: null,
  pricingContent: null,
  albums: [],
  selectedAlbumPhotos: [],
  selectedAlbumMetaBase: "",
  uploadInProgress: false,
  reorderInProgress: false,
  dragSourceIndex: null,
  photoViewMode: "compact",
  pendingMoves: new Map(),
  pendingAlbumMoves: new Map(),
  albumReorderInProgress: false,
  moveSequence: 0
};

const loginPanel = document.getElementById("login-panel");
const dashboardPanel = document.getElementById("dashboard-panel");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const albumsList = document.getElementById("albums-list");
const createAlbumForm = document.getElementById("create-album-form");
const logoutButton = document.getElementById("logout-button");
const selectedAlbumName = document.getElementById("selected-album-name");
const selectedAlbumMeta = document.getElementById("selected-album-meta");
const selectedAlbumPanel = document.getElementById("selected-album-panel");
const editAlbumForm = document.getElementById("edit-album-form");
const saveAlbumButton = document.getElementById("save-album-button");
const editTitleInput = document.getElementById("edit-title");
const editDateInput = document.getElementById("edit-date");
const editDescriptionInput = document.getElementById("edit-description");
const editCoverInput = document.getElementById("edit-cover");
const editCoverPreview = document.getElementById("edit-cover-preview");
const photosList = document.getElementById("photos-list");
const photoUploadInput = document.getElementById("photo-upload-input");
const dropzone = document.getElementById("photo-dropzone");
const uploadStatusText = document.getElementById("upload-status-text");
const uploadProgressBar = document.getElementById("upload-progress-bar");
const uploadProgressTrack = document.querySelector(".upload-progress-track");
const compactViewButton = document.getElementById("compact-view-button");
const detailedViewButton = document.getElementById("detailed-view-button");
const applyOrderButton = document.getElementById("apply-order-button");
const clearOrderButton = document.getElementById("clear-order-button");
const applyAlbumOrderButton = document.getElementById("apply-album-order-button");
const clearAlbumOrderButton = document.getElementById("clear-album-order-button");
const openPortfolioManagerButton = document.getElementById("open-portfolio-manager-button");
const portfolioQuickNote = document.getElementById("portfolio-quick-note");
const typeInput = document.getElementById("type");
const titleInput = document.getElementById("title");
const slugInput = document.getElementById("slug");
const albumsSection = document.getElementById("albums-section");
const createAlbumSection = document.getElementById("create-album-section");
const albumEditSection = document.getElementById("album-edit-section");
const albumUploadSection = document.getElementById("album-upload-section");
const albumSortSection = document.getElementById("album-sort-section");
const aboutCmsSection = document.getElementById("about-cms-section");
const aboutForm = document.getElementById("about-form");
const saveAboutButton = document.getElementById("save-about-button");
const aboutPhotoPreview = document.getElementById("about-photo-preview");
const aboutPhotoInput = document.getElementById("about-photo");
const aboutStoryInput = document.getElementById("about-story");
const aboutValuesInput = document.getElementById("about-values");
const aboutPersonalInput = document.getElementById("about-personal");
const aboutStatusText = document.getElementById("about-status-text");
const pricingForm = document.getElementById("pricing-form");
const savePricingButton = document.getElementById("save-pricing-button");
const pricingCurrencyInput = document.getElementById("pricing-currency");
const pricingEssentialsInput = document.getElementById("pricing-essentials");
const pricingSignatureInput = document.getElementById("pricing-signature");
const pricingLuxuryInput = document.getElementById("pricing-luxury");
const pricingSessionInput = document.getElementById("pricing-session");
const pricingTravelNoteInput = document.getElementById("pricing-travel-note");
const pricingStatusText = document.getElementById("pricing-status-text");

const settingsForm = document.getElementById("settings-form");
const saveSettingsButton = document.getElementById("save-settings-button");
const settingsStatusText = document.getElementById("settings-status-text");

const settingsShowWeddings = document.getElementById("settings-show-weddings");
const settingsShowPortfolio = document.getElementById("settings-show-portfolio");
const settingsShowAbout = document.getElementById("settings-show-about");
const settingsShowPricing = document.getElementById("settings-show-pricing");

const settingsShowEssentials = document.getElementById("settings-show-essentials");
const settingsShowSignature = document.getElementById("settings-show-signature");
const settingsShowLuxury = document.getElementById("settings-show-luxury");
const settingsShowSession = document.getElementById("settings-show-session");

const settingsHomepageTitle = document.getElementById("settings-homepage-title");
const settingsHomepageDescription = document.getElementById("settings-homepage-description");

const settingsInstagramHandle = document.getElementById("settings-instagram-handle");
const settingsInstagramDmUrl = document.getElementById("settings-instagram-dm-url");
const settingsTelegramUrl = document.getElementById("settings-telegram-url");
const settingsWhatsappUrl = document.getElementById("settings-whatsapp-url");

const testimonialFields = [
  {
    name: document.getElementById("testimonial-1-name"),
    quote: document.getElementById("testimonial-1-quote"),
    up: document.getElementById("testimonial-1-up"),
    down: document.getElementById("testimonial-1-down")
  },
  {
    name: document.getElementById("testimonial-2-name"),
    quote: document.getElementById("testimonial-2-quote"),
    up: document.getElementById("testimonial-2-up"),
    down: document.getElementById("testimonial-2-down")
  },
  {
    name: document.getElementById("testimonial-3-name"),
    quote: document.getElementById("testimonial-3-quote"),
    up: document.getElementById("testimonial-3-up"),
    down: document.getElementById("testimonial-3-down")
  },
  {
    name: document.getElementById("testimonial-4-name"),
    quote: document.getElementById("testimonial-4-quote"),
    up: document.getElementById("testimonial-4-up"),
    down: document.getElementById("testimonial-4-down")
  }
];

function updateTestimonialMoveButtons() {
  testimonialFields.forEach((field, index) => {
    if (field.up) {
      field.up.disabled = index === 0;
    }
    if (field.down) {
      field.down.disabled = index === testimonialFields.length - 1;
    }
  });
}

function swapTestimonialValues(currentIndex, targetIndex) {
  if (
    targetIndex < 0
    || targetIndex >= testimonialFields.length
    || !testimonialFields[currentIndex]
    || !testimonialFields[targetIndex]
  ) {
    return;
  }

  const current = testimonialFields[currentIndex];
  const target = testimonialFields[targetIndex];
  const currentName = current.name?.value || "";
  const currentQuote = current.quote?.value || "";

  if (current.name && target.name) {
    current.name.value = target.name.value;
    target.name.value = currentName;
  }

  if (current.quote && target.quote) {
    current.quote.value = target.quote.value;
    target.quote.value = currentQuote;
  }

  setUploadStatus("Testimonial order updated in form. Click Save About Page to publish.", 0);
  setAboutStatus("Testimonial order updated. Click Save About Page to publish.");
}

function setupTestimonialReorder() {
  testimonialFields.forEach((field, index) => {
    field.up?.addEventListener("click", () => swapTestimonialValues(index, index - 1));
    field.down?.addEventListener("click", () => swapTestimonialValues(index, index + 1));
  });
  updateTestimonialMoveButtons();
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeMultilineText(value) {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "admin-toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `admin-toast ${type}`;

  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--admin-emerald); flex-shrink:0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--admin-danger); flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else {
    iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--admin-gold); flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-message" style="word-break: break-word; flex: 1;"></div>
    <button class="toast-close-btn" type="button">&times;</button>
  `;
  
  toast.querySelector(".toast-message").textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  const closeToast = () => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    toast.addEventListener("transitionend", () => {
      toast.remove();
    });
  };

  toast.querySelector(".toast-close-btn").addEventListener("click", closeToast);
  setTimeout(closeToast, 4000);
}

function setAboutStatus(message, tone = "default") {
  if (!aboutStatusText) {
    return;
  }
  aboutStatusText.textContent = message;
  aboutStatusText.style.color = tone === "error" ? "#d39e9e" : "rgba(232, 226, 217, 0.72)";

  if (tone === "error") {
    showToast(message, "error");
  } else if (message.toLowerCase().includes("saved") || message.toLowerCase().includes("updated")) {
    showToast(message, "success");
  }
}

function setPricingStatus(message, tone = "default") {
  if (!pricingStatusText) {
    return;
  }
  pricingStatusText.textContent = message;
  pricingStatusText.style.color = tone === "error" ? "#d39e9e" : "rgba(232, 226, 217, 0.72)";

  if (tone === "error") {
    showToast(message, "error");
  } else if (message.toLowerCase().includes("saved") || message.toLowerCase().includes("updated")) {
    showToast(message, "success");
  }
}

function getDefaultPricingPayload() {
  return {
    id: 1,
    essentials_price: 6500,
    signature_price: 12000,
    luxury_price: 18000,
    session_price: 2500,
    currency: "DKK",
    travel_note:
      "Travel costs are included within Jutland. Weddings outside Jutland include standard travel and accommodation fees."
  };
}

function fillPricingForm(content) {
  if (!pricingForm) {
    return;
  }

  pricingCurrencyInput.value = String(content.currency || "DKK").toUpperCase();
  pricingEssentialsInput.value = String(Math.max(0, Number(content.essentials_price) || 0));
  pricingSignatureInput.value = String(Math.max(0, Number(content.signature_price) || 0));
  pricingLuxuryInput.value = String(Math.max(0, Number(content.luxury_price) || 0));
  pricingSessionInput.value = String(Math.max(0, Number(content.session_price) || 0));
  pricingTravelNoteInput.value = String(content.travel_note || "");
}

async function loadPricingContentAdmin() {
  if (!pricingForm) {
    return;
  }

  const supabase = getSupabase();
  const defaults = getDefaultPricingPayload();
  const { data, error } = await supabase.from("pricing_content").select("*").eq("id", 1).maybeSingle();

  if (error) {
    setUploadStatus(`Could not load Pricing content: ${error.message}`, 0, "error");
    setPricingStatus(`Could not load Pricing content: ${error.message}`, "error");
    fillPricingForm(defaults);
    return;
  }

  const resolved = data;
  if (!resolved) {
    fillPricingForm(defaults);
    setUploadStatus("Pricing content row is missing (id=1). Add it once in Supabase SQL Editor.", 0, "error");
    setPricingStatus("Missing row in pricing_content (id=1). Run seed SQL once.", "error");
    return;
  }

  state.pricingContent = resolved;
  fillPricingForm({ ...defaults, ...resolved });
  fillSettingsForm(resolved);
  setPricingStatus("Pricing content loaded.");
}

function fillSettingsForm(content) {
  if (!settingsForm) return;
  settingsShowWeddings.checked = content.show_weddings !== false;
  settingsShowPortfolio.checked = content.show_portfolio !== false;
  settingsShowAbout.checked = content.show_about !== false;
  settingsShowPricing.checked = content.show_pricing !== false;

  settingsShowEssentials.checked = content.show_essentials !== false;
  settingsShowSignature.checked = content.show_signature !== false;
  settingsShowLuxury.checked = content.show_luxury !== false;
  settingsShowSession.checked = content.show_session !== false;

  settingsHomepageTitle.value = content.homepage_title || "";
  settingsHomepageDescription.value = content.homepage_description || "";

  settingsInstagramHandle.value = content.instagram_handle || "";
  settingsInstagramDmUrl.value = content.instagram_dm_url || "";
  settingsTelegramUrl.value = content.telegram_url || "";
  settingsWhatsappUrl.value = content.whatsapp_url || "";
}

async function saveSiteSettings(event) {
  event.preventDefault();
  if (!settingsForm || !saveSettingsButton) return;

  saveSettingsButton.disabled = true;
  saveSettingsButton.textContent = "Saving...";
  setUploadStatus("Saving Site Settings...", 30);
  if (settingsStatusText) {
    settingsStatusText.textContent = "Saving settings...";
    settingsStatusText.style.color = "rgba(232, 226, 217, 0.72)";
  }

  const payload = {
    show_weddings: settingsShowWeddings.checked,
    show_portfolio: settingsShowPortfolio.checked,
    show_about: settingsShowAbout.checked,
    show_pricing: settingsShowPricing.checked,
    show_essentials: settingsShowEssentials.checked,
    show_signature: settingsShowSignature.checked,
    show_luxury: settingsShowLuxury.checked,
    show_session: settingsShowSession.checked,
    homepage_title: settingsHomepageTitle.value.trim() || null,
    homepage_description: settingsHomepageDescription.value.trim() || null,
    instagram_handle: settingsInstagramHandle.value.trim() || null,
    instagram_dm_url: settingsInstagramDmUrl.value.trim() || null,
    telegram_url: settingsTelegramUrl.value.trim() || null,
    whatsapp_url: settingsWhatsappUrl.value.trim() || null,
    updated_at: new Date().toISOString()
  };

  const supabase = getSupabase();
  try {
    const result = await supabase
      .from("pricing_content")
      .update(payload)
      .eq("id", 1)
      .select("*")
      .maybeSingle();

    if (result.error) throw result.error;

    if (result.data) {
      state.pricingContent = result.data;
      fillSettingsForm(result.data);
      fillPricingForm({ ...getDefaultPricingPayload(), ...result.data });
    }

    setUploadStatus("Site settings saved.", 100);
    if (settingsStatusText) {
      settingsStatusText.textContent = "Site settings saved.";
      settingsStatusText.style.color = "rgba(232, 226, 217, 0.72)";
    }
  } catch (err) {
    setUploadStatus(`Could not save settings: ${err.message}`, 0, "error");
    if (settingsStatusText) {
      settingsStatusText.textContent = `Could not save settings: ${err.message}`;
      settingsStatusText.style.color = "#d39e9e";
    }
  } finally {
    saveSettingsButton.disabled = false;
    saveSettingsButton.textContent = "Save Settings";
  }
}

function toNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

async function savePricingContent(event) {
  event.preventDefault();
  if (!pricingForm || !savePricingButton) {
    return;
  }

  const currency = String(pricingCurrencyInput?.value || "").trim().toUpperCase();
  const essentialsPrice = toNonNegativeInteger(pricingEssentialsInput?.value);
  const signaturePrice = toNonNegativeInteger(pricingSignatureInput?.value);
  const luxuryPrice = toNonNegativeInteger(pricingLuxuryInput?.value);
  const sessionPrice = toNonNegativeInteger(pricingSessionInput?.value);
  const travelNote = String(pricingTravelNoteInput?.value || "").trim();

  if (!currency || currency.length < 3) {
    setUploadStatus("Currency must be a valid code, e.g. DKK.", 0, "error");
    setPricingStatus("Currency must be a valid code, e.g. DKK.", "error");
    return;
  }

  if ([essentialsPrice, signaturePrice, luxuryPrice, sessionPrice].some((value) => value === null)) {
    setUploadStatus("All prices must be non-negative integers.", 0, "error");
    setPricingStatus("All prices must be non-negative integers.", "error");
    return;
  }

  savePricingButton.disabled = true;
  savePricingButton.textContent = "Saving...";
  setUploadStatus("Saving Pricing page...", 30);
  setPricingStatus("Saving Pricing page...");

  const supabase = getSupabase();
  const payload = {
    essentials_price: essentialsPrice,
    signature_price: signaturePrice,
    luxury_price: luxuryPrice,
    session_price: sessionPrice,
    currency,
    travel_note: travelNote || null,
    updated_at: new Date().toISOString()
  };

  try {
    const result = await supabase
      .from("pricing_content")
      .update(payload)
      .eq("id", 1)
      .select("*")
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      setUploadStatus("Pricing row id=1 not found. Seed pricing_content in SQL editor, then retry.", 0, "error");
      setPricingStatus("Row id=1 not found in pricing_content. Seed table first.", "error");
      return;
    }

    state.pricingContent = result.data;
    fillPricingForm({ ...getDefaultPricingPayload(), ...result.data });
    setUploadStatus("Pricing page saved.", 100);
    setPricingStatus("Pricing page saved.");
  } catch (error) {
    setUploadStatus(`Could not save Pricing page: ${error.message}`, 0, "error");
    setPricingStatus(`Could not save Pricing page: ${error.message}`, "error");
  } finally {
    savePricingButton.disabled = false;
    savePricingButton.textContent = "Save Pricing";
  }
}

function getDefaultAboutPayload() {
  return {
    id: 1,
    photo_url: null,
    story:
      "Many would write here about their deep love for wedding photography, but my true passion is art as a whole. Weddings simply chose me.\n\nHonestly, people started noticing things in my photos that I did not even see myself - raw sincerity and unique, unrepeatable moments. This solves the biggest problem for couples: you do not just want 10 heavily retouched pictures in perfect poses. You want to see the real story of your day in these photos. And I handle that perfectly... or so they tell me.\n\nSome say weddings are stressful. I delivered my wife's baby in an emergency. No hospital. Just us.\n\nYour wedding day? Trust me, I've got this.",
    values_text:
      "I work quietly, observe honestly, and guide only when it helps. I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day.",
    personal_text:
      "Originally from Ukraine, now based near Aarhus. I bring 10 years of wedding photography experience across Denmark and Europe. My visual language mixes documentary truth with editorial frames, so your gallery feels alive, elegant, and deeply personal.",
    testimonials: [
      {
        name: "Volodymyr Ostapchuk (TV Presenter)",
        quote: "Oleh has an incredible talent for capturing genuine emotions. Our wedding photos tell the perfect story of our day. Highly recommended!"
      },
      {
        name: "Jerry Heil (Singer & Songwriter)",
        quote: "We had a cozy winter photoshoot, and Oleh made the whole process effortless and comfortable. The final pictures are pure magic."
      },
      {
        name: "Oleksandr Popov (Actor)",
        quote: "I worked with Oleh on a shoot for my TV series. He is an absolute professional with a great eye for cinematic detail."
      },
      {
        name: "Amalie Frank",
        quote:
          "Wow, hvor ser det godt ud! Tusind tusind tak for det - kaempe anbefaling! Der har virkelig vaeret stor ros for alle billederne fra alle gaester og slottet ogsaa. Det har vaeret fantastisk at have arbejdet med jer."
      }
    ]
  };
}

function normalizeTestimonials(raw) {
  const source = Array.isArray(raw) ? raw : [];
  const normalized = source
    .map((item) => ({
      name: String(item?.name || "").trim(),
      quote: String(item?.quote || "").trim()
    }))
    .filter((item) => item.name && item.quote);

  return normalized.length > 0 ? normalized : getDefaultAboutPayload().testimonials;
}

function fillAboutForm(content) {
  if (!aboutForm) {
    return;
  }

  aboutStoryInput.value = normalizeMultilineText(content.story);
  aboutValuesInput.value = normalizeMultilineText(content.values_text);
  aboutPersonalInput.value = normalizeMultilineText(content.personal_text);

  if (aboutPhotoPreview) {
    if (content.photo_url) {
      aboutPhotoPreview.src = content.photo_url;
      aboutPhotoPreview.classList.remove("hidden");
    } else {
      aboutPhotoPreview.src = "";
      aboutPhotoPreview.classList.add("hidden");
    }
  }

  const testimonials = normalizeTestimonials(content.testimonials);
  testimonialFields.forEach((field, index) => {
    const item = testimonials[index] || { name: "", quote: "" };
    if (field.name) {
      field.name.value = item.name;
    }
    if (field.quote) {
      field.quote.value = item.quote;
    }
  });
}

function collectTestimonialsFromForm() {
  return testimonialFields
    .map((field) => ({
      name: String(field.name?.value || "").trim(),
      quote: String(field.quote?.value || "").trim()
    }))
    .filter((item) => item.name && item.quote);
}

async function loadAboutContent() {
  if (!aboutForm) {
    return;
  }

  const supabase = getSupabase();
  const defaults = getDefaultAboutPayload();
  const { data, error } = await supabase.from("about_content").select("*").eq("id", 1).maybeSingle();

  if (error) {
    setUploadStatus(`Could not load About content: ${error.message}`, 0, "error");
    setAboutStatus(`Could not load About content: ${error.message}`, "error");
    fillAboutForm(defaults);
    return;
  }

  let resolved = data;
  if (!resolved) {
    const insert = await supabase
      .from("about_content")
      .insert(defaults)
      .select("*")
      .single();

    if (insert.error) {
      setUploadStatus(`About content setup failed: ${insert.error.message}`, 0, "error");
      setAboutStatus(`About content setup failed: ${insert.error.message}`, "error");
      fillAboutForm(defaults);
      return;
    }
    resolved = insert.data;
  }

  state.aboutContent = resolved;
  fillAboutForm({ ...defaults, ...resolved, testimonials: normalizeTestimonials(resolved.testimonials) });
  setAboutStatus("About content loaded.");
}

async function saveAboutContent(event) {
  event.preventDefault();
  if (!aboutForm || !saveAboutButton) {
    return;
  }

  const story = String(aboutStoryInput?.value || "").trim();
  if (!story) {
    setUploadStatus("About story cannot be empty.", 0, "error");
    setAboutStatus("About story cannot be empty.", "error");
    return;
  }

  const valuesText = String(aboutValuesInput?.value || "").trim();
  const personalText = String(aboutPersonalInput?.value || "").trim();
  const testimonials = collectTestimonialsFromForm();

  saveAboutButton.disabled = true;
  saveAboutButton.textContent = "Saving...";
  setUploadStatus("Saving About page...", 30);
  setAboutStatus("Saving About page...");

  const supabase = getSupabase();
  const previousPhotoUrl = state.aboutContent?.photo_url || null;
  let nextPhotoUrl = previousPhotoUrl;
  const nextPhotoFile = aboutPhotoInput?.files?.[0] || null;

  if (nextPhotoFile && nextPhotoFile.size > 10 * 1024 * 1024) {
    setUploadStatus("Portrait image exceeds 10MB limit. Please compress it first.", 0, "error");
    setAboutStatus("Portrait image exceeds 10MB limit. Please compress it first.", "error");
    return;
  }

  try {
    if (nextPhotoFile) {
      const extension = nextPhotoFile.name.split(".").pop() || "jpg";
      const path = `about/portrait-${Date.now()}.${extension}`;
      setUploadStatus("Uploading About portrait...", 55);
      setAboutStatus("Uploading About portrait...");
      nextPhotoUrl = await uploadToPhotosBucket(nextPhotoFile, path);
    }

    const payload = {
      photo_url: nextPhotoUrl,
      story,
      values_text: valuesText || null,
      personal_text: personalText || null,
      testimonials,
      updated_at: new Date().toISOString()
    };

    let result = await supabase
      .from("about_content")
      .update(payload)
      .eq("id", 1)
      .select("*")
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      result = await supabase
        .from("about_content")
        .insert({ id: 1, ...payload })
        .select("*")
        .single();
      if (result.error) {
        throw result.error;
      }
    }

    const data = result.data;

    if (nextPhotoFile && previousPhotoUrl && previousPhotoUrl !== nextPhotoUrl) {
      const previousPath = storagePathFromPublicUrl(previousPhotoUrl);
      if (previousPath) {
        const cleanup = await supabase.storage.from("photos").remove([previousPath]);
        if (cleanup.error) {
          console.warn("About portrait cleanup failed", cleanup.error.message);
        }
      }
    }

    state.aboutContent = data;
    fillAboutForm({ ...getDefaultAboutPayload(), ...data, testimonials: normalizeTestimonials(data.testimonials) });
    if (aboutPhotoInput) {
      aboutPhotoInput.value = "";
    }
    if (aboutCmsSection) {
      aboutCmsSection.open = true;
    }
    setUploadStatus("About page saved.", 100);
    setAboutStatus("About page saved.");
  } catch (error) {
    setUploadStatus(`Could not save About page: ${error.message}`, 0, "error");
    setAboutStatus(`Could not save About page: ${error.message}`, "error");
  } finally {
    saveAboutButton.disabled = false;
    saveAboutButton.textContent = "Save About Page";
  }
}

function setSectionOpen(section, isOpen) {
  if (!section) {
    return;
  }
  section.open = Boolean(isOpen);
}

function focusAlbumWorkflowSection(step = "edit") {
  setSectionOpen(albumEditSection, step === "edit");
  setSectionOpen(albumUploadSection, step === "upload");
  setSectionOpen(albumSortSection, step === "sort");
}

function guideToCreatePortfolioAlbum() {
  if (titleInput && !titleInput.value.trim()) {
    titleInput.value = "Main Portfolio";
  }
  if (slugInput && !slugInput.value.trim()) {
    slugInput.value = "portfolio-main";
  }

  createAlbumForm.scrollIntoView({ behavior: "smooth", block: "center" });
  setSectionOpen(createAlbumSection, true);
  setSectionOpen(albumsSection, false);
  titleInput?.focus();
  setUploadStatus("Portfolio album setup is ready below. You can also use Open Portfolio Manager for auto-create.", 0);
}

async function ensurePortfolioAlbum() {
  const existing = getPreferredPortfolioAlbum();
  if (existing) {
    return existing;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("albums")
    .insert({
      slug: "portfolio-main",
      title: "Main Portfolio",
      description: "Curated signature work.",
      cover_url: null,
      type: "portfolio",
      date: null,
      visible: false
    })
    .select("id, slug, title, description, date, type, visible, cover_url")
    .single();

  if (!error && data) {
    await loadAlbums();
    return data;
  }

  if (error && String(error.message || "").toLowerCase().includes("duplicate")) {
    const { data: existingMain, error: existingError } = await supabase
      .from("albums")
      .select("id, slug, title, description, date, type, visible, cover_url")
      .eq("slug", "portfolio-main")
      .single();
    if (existingError) {
      throw existingError;
    }
    await loadAlbums();
    return existingMain;
  }

  throw error || new Error("Could not create default portfolio album.");
}

function getPreferredPortfolioAlbum() {
  const portfolioAlbums = state.albums.filter((album) => album.type === "portfolio");
  if (!portfolioAlbums.length) {
    return null;
  }

  const strictMain = portfolioAlbums.find((album) => album.slug === "portfolio-main");
  if (strictMain) {
    return strictMain;
  }

  const published = portfolioAlbums.find((album) => album.visible);
  return published || portfolioAlbums[0];
}

async function openPortfolioManager() {
  try {
    const portfolioAlbum = await ensurePortfolioAlbum();
    showAlbumDetails(portfolioAlbum);
    await loadPhotos(portfolioAlbum.id);
    focusAlbumWorkflowSection("upload");
    setUploadStatus("Portfolio manager is open. Upload or sort your best photos here.", 0);
  } catch (error) {
    setUploadStatus(`Could not open portfolio manager: ${error.message}`, 0, "error");
    guideToCreatePortfolioAlbum();
  }
}

function updatePortfolioQuickAccessState() {
  const album = getPreferredPortfolioAlbum();

  if (!portfolioQuickNote) {
    return;
  }

  if (!album) {
    portfolioQuickNote.textContent = "No portfolio album yet. Click Open Portfolio Manager to auto-create it.";
    return;
  }

  const governanceNote = album.slug === "portfolio-main" ? "portfolio-main" : `fallback: ${album.slug}`;
  portfolioQuickNote.textContent = `Current portfolio manager target: ${album.title} (${album.visible ? "published" : "draft"}, ${governanceNote}).`;
}

function setUploadStatus(message, percent = 0, tone = "default") {
  if (uploadStatusText) {
    uploadStatusText.textContent = message;
    uploadStatusText.style.color = tone === "error" ? "#d39e9e" : "rgba(232, 226, 217, 0.82)";
  }

  if (uploadProgressBar) {
    uploadProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  if (uploadProgressTrack) {
    uploadProgressTrack.setAttribute("aria-valuenow", String(Math.round(percent)));
  }

  if (tone === "error") {
    showToast(message, "error");
  } else if (percent === 100 || message.toLowerCase().includes("saved") || message.toLowerCase().includes("deleted") || message.toLowerCase().includes("updated") || message.toLowerCase().includes("published")) {
    showToast(message, "success");
  }
}

function setUploadBusy(isBusy) {
  state.uploadInProgress = isBusy;
  photoUploadInput.disabled = isBusy;
  dropzone.style.opacity = isBusy ? "0.65" : "1";
}

function refreshAlbumMeta(photoCount) {
  if (!state.selectedAlbumMetaBase) {
    return;
  }
  selectedAlbumMeta.textContent = `${state.selectedAlbumMetaBase} | photos: ${photoCount}`;
}

function clearPhotoDropTargets() {
  photosList.querySelectorAll(".photo-card-premium.drop-target").forEach((node) => {
    node.classList.remove("drop-target");
  });
}

function clearPendingMoves() {
  state.pendingMoves.clear();
  photosList.querySelectorAll(".photo-card-position-input").forEach((input) => {
    input.value = "";
    input.classList.remove("is-staged");
  });
  updateOrderControlsState();
}

function updateOrderControlsState() {
  const pendingCount = state.pendingMoves.size;
  const hasPending = pendingCount > 0;
  applyOrderButton.disabled = !hasPending || state.reorderInProgress;
  clearOrderButton.disabled = !hasPending || state.reorderInProgress;
  applyOrderButton.textContent = hasPending ? `Save order changes (${pendingCount})` : "Save order changes";
}

function getDisplayOrderValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.MAX_SAFE_INTEGER;
}

function getWeddingAlbumsSorted(albums = state.albums) {
  return albums
    .filter((album) => album.type === "wedding")
    .slice()
    .sort((a, b) => {
      const byOrder = getDisplayOrderValue(a.display_order) - getDisplayOrderValue(b.display_order);
      if (byOrder !== 0) {
        return byOrder;
      }

      const byDate = String(b.date || "").localeCompare(String(a.date || ""));
      if (byDate !== 0) {
        return byDate;
      }

      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
}

function clearPendingAlbumMoves() {
  state.pendingAlbumMoves.clear();
  albumsList.querySelectorAll(".album-move-input").forEach((input) => {
    input.value = "";
    input.classList.remove("is-staged");
  });
  updateAlbumOrderControlsState();
}

function updateAlbumOrderControlsState() {
  if (!applyAlbumOrderButton || !clearAlbumOrderButton) {
    return;
  }

  const pendingCount = state.pendingAlbumMoves.size;
  const hasPending = pendingCount > 0;
  applyAlbumOrderButton.disabled = !hasPending || state.albumReorderInProgress;
  clearAlbumOrderButton.disabled = !hasPending || state.albumReorderInProgress;
  applyAlbumOrderButton.textContent = hasPending ? `Save album order (${pendingCount})` : "Save album order";
}

function stageAlbumMove(albumId, rawValue, max, inputNode = null) {
  const targetIndex = parseTargetPosition(rawValue, max);
  if (targetIndex === null) {
    setUploadStatus(`Enter an album position from 1 to ${max}.`, 0, "error");
    return false;
  }

  state.moveSequence += 1;
  state.pendingAlbumMoves.set(albumId, { targetIndex, sequence: state.moveSequence });
  if (inputNode) {
    inputNode.classList.add("is-staged");
  }
  updateAlbumOrderControlsState();
  setUploadStatus(`Staged ${state.pendingAlbumMoves.size} album move(s). Click Save album order.`, 0);
  return true;
}

async function persistWeddingAlbumOrder(reorderedAlbums, supabaseClient = null) {
  const supabase = supabaseClient || getSupabase();
  const oldOrder = new Map(getWeddingAlbumsSorted().map((album) => [album.id, getDisplayOrderValue(album.display_order)]));

  const promises = [];
  for (let index = 0; index < reorderedAlbums.length; index += 1) {
    const album = reorderedAlbums[index];
    const nextOrder = index + 1;
    if (oldOrder.get(album.id) === nextOrder) {
      continue;
    }

    promises.push(
      supabase
        .from("albums")
        .update({ display_order: nextOrder })
        .eq("id", album.id)
    );
  }

  if (promises.length === 0) {
    return true;
  }

  const results = await Promise.all(promises);
  const failed = results.find((r) => r.error);
  if (failed) {
    setUploadStatus(`Could not reorder albums: ${failed.error.message}`, 0, "error");
    return false;
  }

  return true;
}

async function saveNewAlbumDOMOrder() {
  const albumRows = Array.from(albumsList.querySelectorAll(".album-row"));
  const reordered = [];

  albumRows.forEach((row) => {
    const albumId = row.dataset.id;
    const album = state.albums.find((a) => a.id === albumId);
    if (album && album.type === "wedding") {
      reordered.push(album);
    }
  });

  if (reordered.length === 0) {
    return;
  }

  state.albumReorderInProgress = true;
  setUploadStatus("Saving album order...", 30);

  const success = await persistWeddingAlbumOrder(reordered);
  state.albumReorderInProgress = false;

  if (success) {
    await loadAlbums();
    setUploadStatus("Album order saved.", 100);
  } else {
    setUploadStatus("Album order save failed.", 0, "error");
  }
}

async function applyPendingAlbumOrderChanges() {
  if (state.pendingAlbumMoves.size === 0 || state.albumReorderInProgress) {
    return;
  }

  const weddingAlbums = getWeddingAlbumsSorted();
  if (!weddingAlbums.length) {
    return;
  }

  state.albumReorderInProgress = true;
  updateAlbumOrderControlsState();
  setUploadStatus("Saving album order...", 25);

  const working = new Array(weddingAlbums.length).fill(null);
  const remaining = [...weddingAlbums];
  const moves = Array.from(state.pendingAlbumMoves.entries())
    .map(([albumId, payload]) => ({ albumId, targetIndex: payload.targetIndex, sequence: payload.sequence }))
    .sort((a, b) => {
      if (a.targetIndex !== b.targetIndex) {
        return a.targetIndex - b.targetIndex;
      }
      return a.sequence - b.sequence;
    });

  for (const move of moves) {
    const albumIndex = remaining.findIndex((album) => album.id === move.albumId);
    if (albumIndex === -1) {
      continue;
    }

    const [album] = remaining.splice(albumIndex, 1);
    let target = Math.max(0, Math.min(working.length - 1, move.targetIndex));

    while (target < working.length && working[target] !== null) {
      target += 1;
    }

    if (target >= working.length) {
      target = move.targetIndex;
      while (target >= 0 && working[target] !== null) {
        target -= 1;
      }
    }

    if (target >= 0) {
      working[target] = album;
    }
  }

  let fillCursor = 0;
  for (let i = 0; i < working.length; i += 1) {
    if (working[i] === null) {
      working[i] = remaining[fillCursor];
      fillCursor += 1;
    }
  }

  const success = await persistWeddingAlbumOrder(working);
  state.albumReorderInProgress = false;
  if (!success) {
    setUploadStatus("Album order save failed. Please retry.", 0, "error");
    updateAlbumOrderControlsState();
    return;
  }

  clearPendingAlbumMoves();
  await loadAlbums();
  setUploadStatus("Album order saved.", 100);
}

function applyPhotoViewMode() {
  photosList.classList.toggle("compact-photo-grid", state.photoViewMode === "compact");
  compactViewButton.classList.toggle("is-active", state.photoViewMode === "compact");
  detailedViewButton.classList.toggle("is-active", state.photoViewMode === "detailed");
}

function handleDragAutoScroll(event) {
  const edge = 80;
  const step = 18;
  if (event.clientY < edge) {
    window.scrollBy(0, -step);
  } else if (window.innerHeight - event.clientY < edge) {
    window.scrollBy(0, step);
  }
}

function parseTargetPosition(rawValue, max) {
  const value = Number.parseInt(String(rawValue || "").trim(), 10);
  if (!Number.isInteger(value)) {
    return null;
  }
  if (value < 1 || value > max) {
    return null;
  }
  return value - 1;
}

function setAuthView(isLoggedIn) {
  loginPanel.classList.toggle("hidden", isLoggedIn);
  dashboardPanel.classList.toggle("hidden", !isLoggedIn);
}

function showAlbumDetails(album) {
  state.selectedAlbum = album;
  selectedAlbumName.textContent = album.title;
  state.selectedAlbumMetaBase = `${album.type.toUpperCase()} · ${formatDate(album.date)} · slug: ${album.slug}`;
  selectedAlbumMeta.textContent = state.selectedAlbumMetaBase;
  editTitleInput.value = album.title || "";
  editDateInput.value = album.date || "";
  editDescriptionInput.value = album.description || "";
  if (editCoverPreview) {
    if (album.cover_url) {
      editCoverPreview.src = album.cover_url;
      editCoverPreview.classList.remove("hidden");
    } else {
      editCoverPreview.src = "";
      editCoverPreview.classList.add("hidden");
    }
  }
  if (editCoverInput) {
    editCoverInput.value = "";
  }
  document.querySelectorAll(".admin-tab-pane").forEach((pane) => pane.classList.remove("active"));
  selectedAlbumPanel.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
  setUploadStatus("Ready for upload.", 0);
}

async function requireSession() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  setAuthView(Boolean(data.session));
  return data.session;
}

async function loadAlbums() {
  const supabase = getSupabase();
  albumsList.innerHTML = "";

  let { data: albums, error } = await supabase
    .from("albums")
    .select("id, slug, title, description, date, type, visible, cover_url, display_order, created_at")
    .order("created_at", { ascending: false });

  if (error && String(error.message || "").includes("display_order")) {
    const fallback = await supabase
      .from("albums")
      .select("id, slug, title, description, date, type, visible, cover_url, created_at")
      .order("created_at", { ascending: false });
    albums = (fallback.data || []).map((album) => ({ ...album, display_order: null }));
    error = fallback.error;
    setUploadStatus("Tip: run display_order migration in Supabase SQL editor to enable album sorting.", 0);
  }

  if (error) {
    state.albums = [];
    updatePortfolioQuickAccessState();
    albumsList.appendChild(createStateMessage(`Could not load albums: ${error.message}`));
    return;
  }

  if (!albums || albums.length === 0) {
    state.albums = [];
    clearPendingAlbumMoves();
    updatePortfolioQuickAccessState();
    albumsList.appendChild(createStateMessage("No albums yet. Create your first one."));
    return;
  }

  const weddingAlbums = albums
    .filter((album) => album.type === "wedding")
    .sort((a, b) => {
      const byOrder = getDisplayOrderValue(a.display_order) - getDisplayOrderValue(b.display_order);
      if (byOrder !== 0) {
        return byOrder;
      }

      const byDate = String(b.date || "").localeCompare(String(a.date || ""));
      if (byDate !== 0) {
        return byDate;
      }

      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });

  const portfolioAlbums = albums
    .filter((album) => album.type === "portfolio")
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

  state.albums = [...weddingAlbums, ...portfolioAlbums];
  clearPendingAlbumMoves();
  updatePortfolioQuickAccessState();
  updateAlbumOrderControlsState();

  // DASHBOARD STATS UPDATE
  const tAlbums = document.getElementById("stat-total-albums");
  const pAlbums = document.getElementById("stat-published-albums");
  const dAlbums = document.getElementById("stat-draft-albums");
  if(tAlbums) tAlbums.textContent = state.albums.length;
  if(pAlbums) pAlbums.textContent = state.albums.filter(a => a.visible).length;
  if(dAlbums) dAlbums.textContent = state.albums.filter(a => !a.visible).length;

  state.albums.forEach((album, index) => {
    const row = document.createElement("div");
    row.className = "album-row";

    const weddingAlbumsCurrent = getWeddingAlbumsSorted();
    const weddingIndex = album.type === "wedding" ? weddingAlbumsCurrent.findIndex((item) => item.id === album.id) : -1;

    if (album.type === "wedding" && weddingIndex >= 0) {
      row.draggable = true;
      row.dataset.id = album.id;
      row.dataset.index = String(weddingIndex);

      row.addEventListener("dragstart", (event) => {
        if (state.albumReorderInProgress) {
          event.preventDefault();
          return;
        }
        state.dragSourceIndex = weddingIndex;
        row.classList.add("dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(weddingIndex));
        }
      });

      row.addEventListener("dragend", () => {
        state.dragSourceIndex = null;
        row.classList.remove("dragging");
        albumsList.querySelectorAll(".album-row").forEach((r) => r.classList.remove("drop-target"));
      });

      row.addEventListener("dragover", (event) => {
        if (state.albumReorderInProgress) {
          return;
        }
        event.preventDefault();

        const draggingElement = albumsList.querySelector(".album-row.dragging");
        if (draggingElement && draggingElement !== row) {
          row.classList.add("drop-target");
          const rect = row.getBoundingClientRect();
          const next = (event.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
          albumsList.insertBefore(draggingElement, next ? row.nextSibling : row);
        }
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("drop-target");
      });

      row.addEventListener("drop", async (event) => {
        event.preventDefault();
        row.classList.remove("drop-target");
        await saveNewAlbumDOMOrder();
      });
    }

    const info = document.createElement("div");
    info.className = "album-info-wrap";
    const orderText = album.type === "wedding" && weddingIndex >= 0 ? ` · Pos: ${weddingIndex + 1}` : "";
    const coverHtml = album.cover_url ? `<img src="${escapeHTML(album.cover_url)}" class="album-list-thumb" alt="cover" />` : `<div class="album-list-thumb empty">No Cover</div>`;
    const statusClass = album.visible ? "published" : "draft";
    const statusLabel = album.visible ? "Published" : "Draft";
    info.innerHTML = `
      ${coverHtml}
      <div class="album-meta-stack">
        <h4>${escapeHTML(album.title)}</h4>
        <div class="album-meta-sub">
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          <span>${escapeHTML(album.type.toUpperCase())} · ${formatDate(album.date)}${orderText}</span>
        </div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "album-actions-wrap";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "admin-btn ghost small";
    openButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg> Manage Studio`;
    openButton.addEventListener("click", () => {
      showAlbumDetails(album);
      loadPhotos(album.id);
    });

    const togglePublishBtn = document.createElement("button");
    togglePublishBtn.type = "button";
    togglePublishBtn.className = "admin-btn ghost small";
    togglePublishBtn.textContent = album.visible ? "Unpublish" : "Publish";
    togglePublishBtn.addEventListener("click", async () => {
      const nextVisible = !album.visible;
      const { error: updateError } = await supabase
        .from("albums")
        .update({ visible: nextVisible })
        .eq("id", album.id);

      if (updateError) {
        showToast(updateError.message, "error");
      } else {
        album.visible = nextVisible;
        showToast(`Album "${album.title}" ${nextVisible ? "published" : "set to draft"}.`, "success");
        await loadAlbums();
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "admin-btn danger small";
    deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    deleteButton.title = "Delete Album";
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(`Delete album "${album.title}" and all related photos?`);
      if (!confirmed) {
        return;
      }

      setUploadStatus(`Deleting album "${album.title}"...`, 20);
      try {
        await deleteAlbum(album.id);
        if (state.selectedAlbum && state.selectedAlbum.id === album.id) {
          selectedAlbumPanel.classList.add("hidden");
        }
        await loadAlbums();
        showToast("Album deleted.", "success");
      } catch (deleteError) {
        showToast(`Could not delete album: ${deleteError.message}`, "error");
      }
    });

    actions.appendChild(openButton);
    actions.appendChild(togglePublishBtn);
    actions.appendChild(deleteButton);

    if (album.type === "wedding" && weddingIndex >= 0) {
      const upButton = document.createElement("button");
      upButton.type = "button";
      upButton.className = "ghost";
      upButton.textContent = "Up";
      upButton.disabled = weddingIndex === 0;
      upButton.addEventListener("click", async () => {
        const sibling = row.previousSibling;
        if (sibling && sibling.classList.contains("album-row")) {
          albumsList.insertBefore(row, sibling);
          await saveNewAlbumDOMOrder();
        }
      });

      const downButton = document.createElement("button");
      downButton.type = "button";
      downButton.className = "ghost";
      downButton.textContent = "Down";
      downButton.disabled = weddingIndex === weddingAlbumsCurrent.length - 1;
      downButton.addEventListener("click", async () => {
        const sibling = row.nextSibling;
        if (sibling && sibling.classList.contains("album-row")) {
          albumsList.insertBefore(row, sibling.nextSibling);
          await saveNewAlbumDOMOrder();
        }
      });

      const moveWrap = document.createElement("div");
      moveWrap.className = "move-to-wrap";

      const moveInput = document.createElement("input");
      moveInput.type = "number";
      moveInput.className = "move-to-input album-move-input";
      moveInput.min = "1";
      moveInput.max = String(weddingAlbumsCurrent.length);
      moveInput.placeholder = "#";
      moveInput.title = `Move album to position 1-${weddingAlbumsCurrent.length}`;

      const moveButton = document.createElement("button");
      moveButton.type = "button";
      moveButton.className = "ghost";
      moveButton.textContent = "Set";

      const moveAlbumToPosition = async () => {
        const pos = parseTargetPosition(moveInput.value, weddingAlbumsCurrent.length);
        if (pos === null) return;
        const targetRow = albumsList.children[pos];
        if (targetRow && targetRow !== row) {
          if (pos > weddingIndex) {
            albumsList.insertBefore(row, targetRow.nextSibling);
          } else {
            albumsList.insertBefore(row, targetRow);
          }
          await saveNewAlbumDOMOrder();
        }
      };

      moveButton.addEventListener("click", moveAlbumToPosition);
      moveInput.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          await moveAlbumToPosition();
        }
      });

      moveWrap.appendChild(moveInput);
      moveWrap.appendChild(moveButton);

      actions.appendChild(upButton);
      actions.appendChild(downButton);
      actions.appendChild(moveWrap);
    }

    actions.appendChild(deleteButton);

    row.appendChild(info);
    row.appendChild(visibility);
    row.appendChild(actions);
    albumsList.appendChild(row);
  });
}

async function deleteAlbum(albumId) {
  const supabase = getSupabase();

  const { data: album } = await supabase
    .from("albums")
    .select("cover_url")
    .eq("id", albumId)
    .single();

  const { data: photos } = await supabase
    .from("photos")
    .select("url")
    .eq("album_id", albumId);

  const paths = [];

  if (album?.cover_url) {
    const coverPath = storagePathFromPublicUrl(album.cover_url);
    if (coverPath) {
      paths.push(coverPath);
    }
  }

  if (photos && photos.length > 0) {
    photos.forEach((photo) => {
      const path = storagePathFromPublicUrl(photo.url);
      if (path) {
        paths.push(path);
      }
    });
  }

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("photos").remove(paths);
    if (storageError) {
      throw storageError;
    }
  }

  const { error: deleteError } = await supabase.from("albums").delete().eq("id", albumId);
  if (deleteError) {
    throw deleteError;
  }
}

async function movePhotoByIndex(currentIndex, targetIndex) {
  if (!state.selectedAlbum || state.reorderInProgress || targetIndex < 0 || targetIndex >= state.selectedAlbumPhotos.length) {
    return;
  }

  if (currentIndex === targetIndex) {
    return;
  }

  state.reorderInProgress = true;
  setUploadStatus("Saving photo order...", 25);
  const supabase = getSupabase();
  const reordered = [...state.selectedAlbumPhotos];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, moved);

  try {
    const success = await persistPhotoOrder(reordered, supabase);
    if (!success) {
      setUploadStatus("Photo order save failed. Please retry.", 0, "error");
      return;
    }

    await loadPhotos(state.selectedAlbum.id);
    setUploadStatus("Photo order saved.", 100);
  } finally {
    state.reorderInProgress = false;
    updateOrderControlsState();
  }
}

async function persistPhotoOrder(reorderedPhotos, supabaseClient = null) {
  const supabase = supabaseClient || getSupabase();
  const oldOrder = new Map(state.selectedAlbumPhotos.map((photo) => [photo.id, photo.display_order]));
  const normalized = reorderedPhotos.map((photo, index) => ({ ...photo, display_order: index + 1 }));
  const changedRows = normalized.filter((photo) => oldOrder.get(photo.id) !== photo.display_order);

  const promises = changedRows.map((row) =>
    supabase
      .from("photos")
      .update({ display_order: row.display_order })
      .eq("id", row.id)
  );

  if (promises.length === 0) {
    state.selectedAlbumPhotos = normalized;
    return true;
  }

  const results = await Promise.all(promises);
  const failed = results.find((r) => r.error);
  if (failed) {
    setUploadStatus(`Could not reorder photos: ${failed.error.message}`, 0, "error");
    return false;
  }

  state.selectedAlbumPhotos = normalized;
  return true;
}

async function saveNewPhotoDOMOrder() {
  const photoCards = Array.from(photosList.querySelectorAll(".photo-card-premium"));
  const reordered = [];

  photoCards.forEach((card) => {
    const photoId = card.dataset.id;
    const photo = state.selectedAlbumPhotos.find((p) => p.id === photoId);
    if (photo) {
      reordered.push(photo);
    }
  });

  if (reordered.length === 0) {
    return;
  }

  state.reorderInProgress = true;
  setUploadStatus("Saving photo order...", 30);

  const success = await persistPhotoOrder(reordered);
  state.reorderInProgress = false;

  if (success) {
    reordered.forEach((photo, index) => {
      const card = photosList.querySelector(`.photo-card-premium[data-id="${photo.id}"]`);
      if (card) {
        card.dataset.index = String(index);
        const badge = card.querySelector(".photo-card-badge");
        if (badge) {
          badge.textContent = `#${index + 1}`;
        }
      }
    });
    setUploadStatus("Photo order saved.", 100);
  } else {
    setUploadStatus("Photo order save failed.", 0, "error");
  }
}

async function applyPendingOrderChanges() {
  if (!state.selectedAlbum || state.pendingMoves.size === 0 || state.reorderInProgress) {
    return;
  }

  state.reorderInProgress = true;
  updateOrderControlsState();

  const baseOrder = [...state.selectedAlbumPhotos];
  const working = new Array(baseOrder.length).fill(null);
  const remaining = [...baseOrder];
  const moves = Array.from(state.pendingMoves.entries())
    .map(([photoId, payload]) => ({ photoId, targetIndex: payload.targetIndex, sequence: payload.sequence }))
    .sort((a, b) => {
      if (a.targetIndex !== b.targetIndex) {
        return a.targetIndex - b.targetIndex;
      }
      return a.sequence - b.sequence;
    });

  // Place staged photos into requested slots first.
  for (const move of moves) {
    const photoIndex = remaining.findIndex((photo) => photo.id === move.photoId);
    if (photoIndex === -1) {
      continue;
    }

    const [photo] = remaining.splice(photoIndex, 1);
    let target = Math.max(0, Math.min(working.length - 1, move.targetIndex));

    while (target < working.length && working[target] !== null) {
      target += 1;
    }

    if (target >= working.length) {
      target = move.targetIndex;
      while (target >= 0 && working[target] !== null) {
        target -= 1;
      }
    }

    if (target >= 0) {
      working[target] = photo;
    }
  }

  // Fill empty slots with non-staged photos while preserving their original order.
  let fillCursor = 0;
  for (let i = 0; i < working.length; i += 1) {
    if (working[i] === null) {
      working[i] = remaining[fillCursor];
      fillCursor += 1;
    }
  }

  const success = await persistPhotoOrder(working);
  state.reorderInProgress = false;

  if (!success) {
    updateOrderControlsState();
    return;
  }

  await loadPhotos(state.selectedAlbum.id);
  clearPendingMoves();
  setUploadStatus("Order changes saved.", 100);
}

async function loadPhotos(albumId) {
  const supabase = getSupabase();
  photosList.innerHTML = "";
  applyPhotoViewMode();
  clearPendingMoves();

  const { data: photos, error } = await supabase
    .from("photos")
    .select("id, url, display_order")
    .eq("album_id", albumId)
    .order("display_order", { ascending: true });

  if (error) {
    photosList.appendChild(createStateMessage(`Could not load photos: ${error.message}`));
    return;
  }

  state.selectedAlbumPhotos = photos || [];
  refreshAlbumMeta(state.selectedAlbumPhotos.length);

  if (!photos || photos.length === 0) {
    photosList.appendChild(createStateMessage("No photos in this album yet."));
    focusAlbumWorkflowSection("upload");
    return;
  }

  focusAlbumWorkflowSection("sort");

  photos.forEach((photo, index) => {
    const row = document.createElement("div");
    row.className = "photo-card-premium";
    row.draggable = true;
    row.dataset.id = photo.id;
    row.dataset.index = String(index);

    // Image container
    const media = document.createElement("div");
    media.className = "photo-card-media";
    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = `Photo ${index + 1}`;
    img.loading = "lazy";
    media.appendChild(img);

    // Order indicator Badge
    const badge = document.createElement("div");
    badge.className = "photo-card-badge";
    badge.textContent = `#${index + 1}`;

    // Delete Button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "photo-card-delete-btn";
    deleteBtn.title = "Delete photo permanently";
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;

    deleteBtn.addEventListener("click", async () => {
      const confirmed = window.confirm("Delete this photo permanently?");
      if (!confirmed) {
        return;
      }

      row.remove();

      const deletedIndex = state.selectedAlbumPhotos.findIndex((p) => p.id === photo.id);
      if (deletedIndex !== -1) {
        state.selectedAlbumPhotos.splice(deletedIndex, 1);
      }

      refreshAlbumMeta(state.selectedAlbumPhotos.length);

      const cards = Array.from(photosList.querySelectorAll(".photo-card-premium"));
      cards.forEach((card, idx) => {
        card.dataset.index = String(idx);
        const b = card.querySelector(".photo-card-badge");
        if (b) {
          b.textContent = `#${idx + 1}`;
        }
      });

      setUploadStatus("Deleting photo...", 40);

      try {
        const path = storagePathFromPublicUrl(photo.url);
        if (path) {
          await supabase.storage.from("photos").remove([path]);
        }

        const { error: deleteError } = await supabase.from("photos").delete().eq("id", photo.id);
        if (deleteError) {
          setUploadStatus(deleteError.message, 0, "error");
          return;
        }

        await persistPhotoOrder(state.selectedAlbumPhotos);
        setUploadStatus("Photo deleted and order updated.", 100);
      } catch (err) {
        setUploadStatus(`Error deleting photo: ${err.message}`, 0, "error");
      }
    });

    // Info footer
    const info = document.createElement("div");
    info.className = "photo-card-info";

    // Set cover button
    const isCover = state.selectedAlbum.cover_url === photo.url;
    const coverBtn = document.createElement("button");
    coverBtn.type = "button";
    coverBtn.className = `photo-card-cover-btn ${isCover ? "is-cover" : ""}`;
    coverBtn.style.color = isCover ? "var(--admin-accent)" : "var(--admin-muted)";
    coverBtn.title = "Set as album cover";
    coverBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="${isCover ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
      <span>Cover</span>
    `;

    coverBtn.addEventListener("click", async () => {
      if (state.selectedAlbum.cover_url === photo.url) {
        return;
      }

      setUploadStatus("Updating album cover...", 30);
      const { error: coverError } = await supabase
        .from("albums")
        .update({ cover_url: photo.url })
        .eq("id", albumId);

      if (coverError) {
        setUploadStatus(`Could not update cover: ${coverError.message}`, 0, "error");
        return;
      }

      state.selectedAlbum.cover_url = photo.url;
      if (editCoverPreview) {
        editCoverPreview.src = photo.url;
        editCoverPreview.style.display = "block";
      }

      photosList.querySelectorAll(".photo-card-cover-btn").forEach((btn) => {
        btn.classList.remove("is-cover");
        btn.style.color = "var(--admin-muted)";
        const starSvg = btn.querySelector("svg");
        if (starSvg) starSvg.setAttribute("fill", "none");
      });

      coverBtn.classList.add("is-cover");
      coverBtn.style.color = "var(--admin-accent)";
      const currentStar = coverBtn.querySelector("svg");
      if (currentStar) currentStar.setAttribute("fill", "currentColor");

      setUploadStatus("Album cover updated.", 100);
    });

    // Position input
    const posInput = document.createElement("input");
    posInput.type = "number";
    posInput.className = "photo-card-position-input";
    posInput.min = "1";
    posInput.max = String(photos.length);
    posInput.value = String(index + 1);
    posInput.title = "Jump to position";

    const movePhotoToPosition = async () => {
      const pos = parseTargetPosition(posInput.value, photos.length);
      if (pos === null) {
        setUploadStatus(`Enter a position from 1 to ${photos.length}.`, 0, "error");
        return;
      }

      const cards = Array.from(photosList.querySelectorAll(".photo-card-premium"));
      const targetCard = cards[pos];
      if (targetCard && targetCard !== row) {
        if (pos > index) {
          photosList.insertBefore(row, targetCard.nextSibling);
        } else {
          photosList.insertBefore(row, targetCard);
        }
        await saveNewPhotoDOMOrder();
      }
    };

    posInput.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        await movePhotoToPosition();
      }
    });

    info.appendChild(coverBtn);
    info.appendChild(posInput);

    // Drag-and-drop Events
    row.addEventListener("dragstart", (event) => {
      if (state.reorderInProgress) {
        event.preventDefault();
        return;
      }
      state.dragSourceIndex = index;
      row.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", photo.id);
      }
    });

    row.addEventListener("dragend", async () => {
      state.dragSourceIndex = null;
      row.classList.remove("dragging");
      photosList.querySelectorAll(".photo-card-premium").forEach((c) => c.classList.remove("drop-target"));
      await saveNewPhotoDOMOrder();
    });

    row.addEventListener("dragover", (event) => {
      if (state.reorderInProgress) {
        return;
      }
      event.preventDefault();

      const draggingElement = photosList.querySelector(".photo-card-premium.dragging");
      if (draggingElement && draggingElement !== row) {
        row.classList.add("drop-target");
        const rect = row.getBoundingClientRect();
        const next = (event.clientX - rect.left) / (rect.right - rect.left) > 0.5;
        photosList.insertBefore(draggingElement, next ? row.nextSibling : row);
      }
      handleDragAutoScroll(event);
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drop-target");
    });

    row.appendChild(media);
    row.appendChild(badge);
    row.appendChild(deleteBtn);
    row.appendChild(info);
    photosList.appendChild(row);
  });
}

async function createAlbum(event) {
  event.preventDefault();

  const supabase = getSupabase();
  const formData = new FormData(createAlbumForm);
  const title = String(formData.get("title") || "").trim();
  const type = String(formData.get("type") || "wedding").trim();
  const date = String(formData.get("date") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const slugInputValue = String(formData.get("slug") || "").trim();
  const coverFile = createAlbumForm.querySelector("input[name='cover']").files[0];

  if (type === "portfolio") {
    setUploadStatus("Use Portfolio Quick Access to manage the single portfolio-main album.", 0, "error");
    await openPortfolioManager();
    return;
  }

  if (!title || !coverFile) {
    setUploadStatus("Title and cover image are required.", 0, "error");
    return;
  }

  if (coverFile && coverFile.size > 10 * 1024 * 1024) {
    setUploadStatus("Cover image exceeds 10MB limit. Please compress it first.", 0, "error");
    return;
  }

  setUploadStatus("Creating album...", 20);

  const slug = slugInputValue ? slugify(slugInputValue) : slugify(`${title}-${Date.now()}`);
  const displayOrder = type === "wedding" ? getWeddingAlbumsSorted().length + 1 : 1;
  const extension = coverFile.name.split(".").pop() || "jpg";
  const coverPath = `covers/${slug}-${Date.now()}.${extension}`;

  try {
    const coverUrl = await uploadToPhotosBucket(coverFile, coverPath);

    const payload = {
      slug,
      title,
      description: description || null,
      cover_url: coverUrl,
      type,
      date: date || null,
      display_order: displayOrder,
      visible: false
    };

    let insertQuery = supabase
      .from("albums")
      .insert(payload)
      .select("id, slug, title, description, date, type, visible, cover_url")
      .single();

    let { data: createdAlbum, error } = await insertQuery;
    if (error && String(error.message || "").includes("display_order")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.display_order;
      const fallbackInsert = await supabase
        .from("albums")
        .insert(fallbackPayload)
        .select("id, slug, title, description, date, type, visible, cover_url")
        .single();
      createdAlbum = fallbackInsert.data;
      error = fallbackInsert.error;
    }

    if (error) {
      throw error;
    }

    createAlbumForm.reset();
    await loadAlbums();
    setSectionOpen(createAlbumSection, false);
    setSectionOpen(albumsSection, true);
    setUploadStatus("Album created successfully.", 100);

    if (createdAlbum && createdAlbum.type === "portfolio") {
      showAlbumDetails(createdAlbum);
      await loadPhotos(createdAlbum.id);
      setUploadStatus("Portfolio album created. You can upload and sort photos now.", 0);
    }
  } catch (err) {
    setUploadStatus(`Could not create album: ${err.message}`, 0, "error");
  }
}

async function saveAlbumDetails(event) {
  event.preventDefault();

  if (!state.selectedAlbum) {
    setUploadStatus("Open an album first.", 0, "error");
    return;
  }

  const title = editTitleInput.value.trim();
  const date = editDateInput.value.trim();
  const description = editDescriptionInput.value.trim();
  const nextCoverFile = editCoverInput?.files?.[0] || null;

  if (!title) {
    setUploadStatus("Album title cannot be empty.", 0, "error");
    return;
  }

  saveAlbumButton.disabled = true;
  saveAlbumButton.textContent = "Saving...";
  setUploadStatus("Saving album details...", 30);

  const supabase = getSupabase();
  const previousCoverUrl = state.selectedAlbum.cover_url || null;
  let nextCoverUrl = previousCoverUrl;

  if (nextCoverFile && nextCoverFile.size > 10 * 1024 * 1024) {
    setUploadStatus("Cover image exceeds 10MB limit. Please compress it first.", 0, "error");
    return;
  }

  if (nextCoverFile) {
    const extension = nextCoverFile.name.split(".").pop() || "jpg";
    const coverPath = `covers/${state.selectedAlbum.slug}-${Date.now()}.${extension}`;
    try {
      setUploadStatus("Uploading new cover...", 55);
      nextCoverUrl = await uploadToPhotosBucket(nextCoverFile, coverPath);
      if (editCoverPreview) {
        editCoverPreview.src = nextCoverUrl;
        editCoverPreview.classList.remove("hidden");
      }
    } catch (uploadError) {
      saveAlbumButton.disabled = false;
      saveAlbumButton.textContent = "Save Album Details";
      setUploadStatus(`Could not upload cover: ${uploadError.message}`, 0, "error");
      return;
    }
  }

  const { error } = await supabase
    .from("albums")
    .update({
      title,
      date: date || null,
      description: description || null,
      cover_url: nextCoverUrl
    })
    .eq("id", state.selectedAlbum.id);

  saveAlbumButton.disabled = false;
  saveAlbumButton.textContent = "Save Album Details";

  if (error) {
    setUploadStatus(`Could not save album details: ${error.message}`, 0, "error");
    return;
  }

  if (nextCoverFile && previousCoverUrl && previousCoverUrl !== nextCoverUrl) {
    const previousPath = storagePathFromPublicUrl(previousCoverUrl);
    if (previousPath) {
      const { error: removeError } = await supabase.storage.from("photos").remove([previousPath]);
      if (removeError) {
        console.warn("Old cover cleanup failed", removeError.message);
      }
    }
  }

  state.selectedAlbum = {
    ...state.selectedAlbum,
    title,
    date: date || null,
    description: description || null,
    cover_url: nextCoverUrl
  };

  showAlbumDetails(state.selectedAlbum);
  await loadAlbums();
  await loadPhotos(state.selectedAlbum.id);
  setUploadStatus("Album details saved.", 100);
}

async function uploadPhotos(files) {
  if (!state.selectedAlbum) {
    setUploadStatus("Open an album first.", 0, "error");
    return;
  }

  if (state.uploadInProgress) {
    setUploadStatus("Upload already in progress. Please wait.", 0, "error");
    return;
  }

  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  if (!imageFiles.length) {
    setUploadStatus("No image files detected in this batch.", 0, "error");
    return;
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const tooLargeFiles = imageFiles.filter((file) => file.size > MAX_FILE_SIZE);
  const allowedFiles = imageFiles.filter((file) => file.size <= MAX_FILE_SIZE);

  if (tooLargeFiles.length > 0) {
    if (allowedFiles.length === 0) {
      setUploadStatus(`All selected files exceed the 10MB limit (e.g., ${tooLargeFiles[0].name}). Please compress them first.`, 0, "error");
      return;
    } else {
      setUploadStatus(`Skipping ${tooLargeFiles.length} file(s) exceeding 10MB. Uploading remaining ${allowedFiles.length} file(s)...`, 0, "error");
      // Let the user see the warning for a second before continuing
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  const filesToUpload = allowedFiles;

  const supabase = getSupabase();
  const total = filesToUpload.length;
  let uploaded = 0;
  let failed = 0;

  const startOrder =
    state.selectedAlbumPhotos.length > 0
      ? Math.max(...state.selectedAlbumPhotos.map((photo) => photo.display_order || 0)) + 1
      : 1;

  let order = startOrder;
  setUploadBusy(true);
  setUploadStatus(`Uploading 0/${total} photos...`, 0);

  for (const file of filesToUpload) {
    const completed = uploaded + failed;
    const startedPercent = total > 0 ? (completed / total) * 100 : 0;
    setUploadStatus(`Uploading ${completed + 1}/${total}: ${file.name}`, startedPercent);

    const extension = file.name.split(".").pop() || "jpg";
    const path = `albums/${state.selectedAlbum.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    try {
      const publicUrl = await uploadToPhotosBucket(file, path);
      const { error } = await supabase.from("photos").insert({
        album_id: state.selectedAlbum.id,
        url: publicUrl,
        display_order: order,
        width: null,
        height: null
      });

      if (error) {
        throw error;
      }

      uploaded += 1;
      order += 1;
    } catch (err) {
      failed += 1;
      console.error(`Upload failed for ${file.name}:`, err);
    }

    const done = uploaded + failed;
    const percent = total > 0 ? (done / total) * 100 : 100;
    setUploadStatus(`Uploaded ${uploaded}/${total}${failed ? `, failed ${failed}` : ""}`, percent, failed ? "error" : "default");
  }

  await loadPhotos(state.selectedAlbum.id);
  setUploadBusy(false);

  if (failed === 0) {
    setUploadStatus(`Upload complete. ${uploaded}/${total} photos uploaded.`, 100);
  } else {
    setUploadStatus(`Upload finished with issues: ${uploaded} uploaded, ${failed} failed.`, 100, "error");
  }
}

function setupTabSwitching() {
  const navButtons = document.querySelectorAll(".admin-nav-button");
  const tabPanes = document.querySelectorAll(".admin-tab-pane");
  const selectedAlbumPanel = document.getElementById("selected-album-panel");
  const closeAlbumBtn = document.getElementById("close-album-btn");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navButtons.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((pane) => pane.classList.remove("active"));
      btn.classList.add("active");
      const targetId = btn.getAttribute("data-target");
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add("active");
      }
      if (selectedAlbumPanel) {
        selectedAlbumPanel.classList.add("hidden");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  if (closeAlbumBtn && selectedAlbumPanel) {
    closeAlbumBtn.addEventListener("click", () => {
      selectedAlbumPanel.classList.add("hidden");
      const activeNav = document.querySelector(".admin-nav-button.active");
      const targetId = activeNav ? activeNav.getAttribute("data-target") : "tab-albums";
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add("active");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

function setupDropzone() {
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!state.uploadInProgress) {
      dropzone.classList.add("is-over");
    }
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-over");
  });

  dropzone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-over");

    const files = Array.from(event.dataTransfer.files || []);
    if (!files.length) {
      return;
    }

    await uploadPhotos(files);
  });

  photoUploadInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    await uploadPhotos(files);
    photoUploadInput.value = "";
  });
}

async function boot() {
  try {
    const session = await requireSession();
    if (!session) {
      return;
    }

    await loadAlbums();
    await loadAboutContent();
    await loadPricingContentAdmin();
  } catch (error) {
    loginError.textContent = error.message;
    setAuthView(false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  const supabase = getSupabase();
  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = error.message;
    return;
  }

  loginForm.reset();
  await boot();
});

createAlbumForm.addEventListener("submit", createAlbum);
editAlbumForm.addEventListener("submit", saveAlbumDetails);

logoutButton.addEventListener("click", async () => {
  const supabase = getSupabase();
  await supabase.auth.signOut();
  state.selectedAlbum = null;
  selectedAlbumPanel.classList.add("hidden");
  setAuthView(false);
});

setupTabSwitching();
setupDropzone();
setUploadStatus("No upload in progress.", 0);
compactViewButton.addEventListener("click", () => {
  state.photoViewMode = "compact";
  applyPhotoViewMode();
});
detailedViewButton.addEventListener("click", () => {
  state.photoViewMode = "detailed";
  applyPhotoViewMode();
});
applyOrderButton.addEventListener("click", applyPendingOrderChanges);
clearOrderButton.addEventListener("click", () => {
  clearPendingMoves();
  setUploadStatus("Staged order changes cleared.", 0);
});

if (applyAlbumOrderButton) {
  applyAlbumOrderButton.addEventListener("click", applyPendingAlbumOrderChanges);
}

if (clearAlbumOrderButton) {
  clearAlbumOrderButton.addEventListener("click", () => {
    clearPendingAlbumMoves();
    setUploadStatus("Staged album moves cleared.", 0);
  });
}

if (openPortfolioManagerButton) {
  openPortfolioManagerButton.addEventListener("click", async () => {
    await openPortfolioManager();
  });
}

if (aboutForm) {
  aboutForm.addEventListener("submit", saveAboutContent);
}

if (pricingForm) {
  pricingForm.addEventListener("submit", savePricingContent);
}

if (settingsForm) {
  settingsForm.addEventListener("submit", saveSiteSettings);
}

/* ==========================================================================
   TRANSLATIONS & TEXTS CMS CONTROLLER
   ========================================================================== */

const translationDefaults = {
  da: {
    hero_title_1: "Stille i baggrunden.",
    hero_title_2: "Højlydt i billederne.",
    hero_desc: "Jeg fanger ægte følelser, afslappet elegance og stemningen fra jeres dag, som varer evigt.",
    hero_region: "Danmark og videre",
    elopement_heading: "Skal I giftes i Danmark?",
    elopement_desc: "En intim vielse på Københavns Rådhus. En rolig sommerdag ved havet på Ærø. Et bryllup på et slot et sted i Jylland. Uanset hvad I vælger, er jeg der stille, roligt og til stede, med ærlig dokumentation og billeder, der holder i mange år.",
    elopement_locations: "København · Ærø · Aarhus · Odense · Aalborg · Hele Danmark og Europa",
    meet_quote: "Jeg tror på, at de smukkeste billeder opstår, når man glemmer, at kameraet er der. Jeg holder mig i baggrunden, observerer de ægte øjeblikke, og guider kun forsigtigt, når det gør jer smukkere helt naturligt.",
    meet_btn: "Mød Oleh og hans filosofi →",
    test_1: "Mand, de billeder ligner scener fra en film. Du har et vildt øje for cinematiske detaljer. Super nemt at arbejde med on location også. Topklasse.",
    test_2: "Wow, hvor ser det godt ud! Tusind tusind tak for det, kæmpe anbefaling! Der har virkelig været stor ros for alle billederne fra alle gæster og slottet også. Det har været fantastisk at have arbejdet med jer.",
    test_3: "Vi har lige set galleriet igennem, og vi er målløse. Du fangede stemningen fra dagen helt perfekt. Ingen stive positurer, bare os, som vi er. Tak for denne erindring!",
    test_4: "Vi havde en hyggelig vinterfotografering, og Oleh gjorde hele processen let og afslappet. De endelige billeder er ren magi.",
    about_header: "Oleh Ro. Dokumentar & editorial fotografi",
    about_story_1: "Mange ville skrive her om deres store kærlighed til bryllupsfotografering. Min sande passion er kunst som helhed. Bryllupper valgte simpelthen mig.",
    about_story_2: "Helt ærligt, folk er begyndt at lægge mærke til noget i mine billeder, som jeg ikke selv så: ren ærlighed og unikke øjeblikke, der aldrig kommer igen. Det løser parrenes største problem: I skal ikke bare have ti hårdt retoucherede billeder i perfekte positurer. I skal se den ægte historie fra jeres dag. Og det klarer jeg vist ret godt... i hvert fald siger folk det.",
    about_story_3: "Nogle siger, bryllupper er stressende. Jeg forløste selv min kones barn i en nødsituation. Intet hospital. Bare os. Jeres bryllupsdag? Stol på mig, den klarer jeg.",
    about_values: "Jeg arbejder stille, observerer ærligt og guider kun, når det hjælper. Jeg sætter ægte følelser højere end tvungen perfektion, en gennemført æstetik uden støj, og en rolig proces, hvor I forbliver til stede i jeres dag.",
    about_background: "Oprindeligt fra Ukraine, bor nu tæt på Aarhus. Jeg arbejder i hele Danmark og Europa. Mit visuelle sprog blander dokumentarisk sandhed med editorial billeder, så jeres galleri føles levende, elegant og dybt personligt.",
    about_experience: "10+ Års erfaring i Danmark og Europa.",
    about_awards: "★ Ugens billeder · ★ Naturlige mor-øjeblikke · ★ Glædelig mors dag 2022",
    contact_heading: "Lad os tale om jeres dag",
    contact_desc: "Jeg foretrækker direkte, personlig kontakt. Vælg den app, I er mest trygge ved, for at tale om jeres visioner, tjekke ledighed eller bare sige hej:",
    whatsapp_subtitle: "hurtigst for Europa og internationale par",
    telegram_subtitle: "hurtig chat, engelsk eller dansk",
    instagram_subtitle: "portfolio, reels og live stories",
    email_subtitle: "deuswork@icloud.com",
    prefilled_message: "Hej Oleh! Vi planlægger vores bryllup den [Dato] i [By/Sted]. Er denne dato ledig?",
    email_subject: "Forespørgsel om bryllupsfotografering",
    footer_desc: "Baseret i Danmark (Aarhus-området), tilgængelig i hele Europa.",
    floating_cta_note: "Kalenderen er åben for bryllupper 2026-2027 · Se alle kontaktmuligheder"
  },
  ua: {
    hero_title_1: "Без гучних слів.",
    hero_title_2: "Фото скажуть усе самі.",
    hero_desc: "Тихо фіксую справжні емоції, легку елегантність та той самий timeless вайб вашого дня.",
    hero_region: "Данія та вся Європа",
    elopement_heading: "Одружуєтесь у Данії?",
    elopement_desc: "Камерна церемонія в ратуші Копенгагена, романтична втеча на острів Ере чи свято в замку десь у Ютландії. Хай би що ви обрали, я поруч: спокійно, непомітно, з чесною документальною зйомкою та стильними editorial кадрами.",
    elopement_locations: "Копенгаген · Острів Ере · Орхус · Оденсе · Ольборг · Уся Данія та Європа",
    meet_quote: "Найщиріші кадри народжуються тоді, коли ви забуваєте про камеру. Я спостерігаю, ловлю живі моменти без пози і додаю легку підказку лише тоді, коли це допомагає відчути себе природно красиво.",
    meet_btn: "Познайомитись з Олегом і моїм баченням →",
    test_1: "Чувак, ці кадри виглядають прямо як стоп-кадри з кіно. У тебе шалене відчуття кінематографічних деталей. Працювати на майданчику максимально легко. Топ-рівень.",
    test_2: "Вау, як же круто вийшло! Величезне дякую, це стовідсоткова рекомендація! Усі гості й навіть команда замку були в захваті від фотографій. Працювати з тобою було суцільним задоволенням.",
    test_3: "Щойно передивились галерею, і в нас просто нема слів. Ти вловив точний вайб нашого дня. Жодних застиглих поз, тільки справжні ми. Дякуємо за цей спогад!",
    test_4: "У нас була затишна зимова фотосесія, і Олег зробив увесь процес легким та комфортним. А фінальні фото — це чиста магія.",
    about_header: "Олег Ро. Documentary & Editorial фотографія",
    about_story_1: "Хтось написав би тут довгий текст про велику любов суто до весільної фотографії, але моя справжня пристрасть — це мистецтво взагалі. Просто так вийшло, що весілля обрали мене самі... а я тільки за і настільки кайфонув від цього, що ось уже 11 років у справі.",
    about_story_2: "Чесно кажучи, люди почали помічати в моїх роботах те, чого не бачив навіть я сам: щирість без прикрас і моменти, які більше ніколи не повторяться. Це вирішує головну проблему пар: вам не потрібні 10 перефотошоплених світлин у напружених позах. Вам потрібна жива історія вашого дня. І з цим я справляюсь на відмінно... принаймні так кажуть мої молодята.",
    about_story_3: "Кажуть, весілля — це стрес. А я приймав пологи у власної дружини в екстрених умовах. Без лікарні, тільки ми двоє. Тож ваш весільний день? Довіртесь, усе під повним контролем.",
    about_values: "Працюю тихо, спостерігаю чесно, підказую лише тоді, коли це дійсно потрібно. Ціную справжній нерв більше за штучну ідеальність, преміальну естетику без зайвого візуального шуму і спокійний процес, у якому ви просто проживаєте свій день.",
    about_background: "Родом з України, зараз базуюся біля Орхуса. Працюю по всій Данії та Європі. Мій візуальний почерк поєднує документальну правду з editorial кадрами, тому галерея відчувається живою, елегантною і глибоко особистою.",
    about_experience: "11+ Років досвіду зйомок у Данії та по всій Європі.",
    about_awards: "★ Фото тижня · ★ Unposed Moms Moments · ★ Щасливого Дня матері 2022",
    contact_heading: "Поговоримо про ваш день",
    contact_desc: "Я за живе людське спілкування без зайвої бюрократії. Обирайте зручний месенджер, щоб обговорити ідеї, перевірити вільну дату або просто привітатися:",
    whatsapp_subtitle: "Найшвидше для Європи та міжнародних пар",
    telegram_subtitle: "Прямий чат українською та англійською",
    instagram_subtitle: "Портфоліо, reels і live stories",
    email_subtitle: "Email напряму",
    prefilled_message: "Привіт, Олеже! Ми плануємо весілля [Дата] у [Місто/Локація]. Чи вільна ця дата?",
    email_subject: "Запит щодо весільної фотозйомки",
    footer_desc: "Базуюся в Данії (район Орхуса), відкритий до зйомок по всій Європі.",
    floating_cta_note: "Бронювання весіль на сезон 2026-2027 відкрито · Усі способи зв'язку"
  },
  en: {
    hero_title_1: "Not loud.",
    hero_title_2: "But your photos will be.",
    hero_desc: "Quietly capturing honest emotion, effortless elegance, and the timeless feeling of your day.",
    hero_region: "Denmark & Beyond",
    elopement_heading: "Marrying in Denmark?",
    elopement_desc: "Whether you are planning an intimate civil elopement at Copenhagen City Hall, a romantic seaside escape on Ærø Island, or a castle celebration in Jutland — I provide a calm, discreet documentary presence and timeless editorial photography.",
    elopement_locations: "Copenhagen · Ærø Island · Aarhus · Odense · Aalborg · All Denmark & Europe",
    meet_quote: "I believe the most meaningful photos happen when you forget the camera is there. I stay quiet, watch the unposed moments unfold, and step in with gentle direction only when it makes you feel effortlessly beautiful.",
    meet_btn: "Meet Oleh & Philosophy →",
    test_1: "Man, these shots look straight out of a movie. You have an incredible eye for cinematic detail. Working with you on set was effortless. Top-tier level.",
    test_2: "Wow, hvor ser det godt ud! Tusind tusind tak for det — kæmpe anbefaling! Der har virkelig været stor ros for alle billederne fra alle gæster og slottet også. Det har været fantastisk at have arbejdet med dig.",
    test_3: "We just went through the gallery and we have no words. You captured the exact vibe of our day. No stiff poses, just the real us. Thank you for this memory!",
    test_4: "We had a cozy winter photoshoot, and Oleh made the whole process effortless and comfortable. The final pictures are pure magic.",
    about_header: "Oleh Ro. Documentary & Editorial Photography",
    about_story_1: "Many would write here about their deep love for wedding photography, but my true passion is art as a whole. Weddings simply chose me... and I fell so deeply in love with the process that I have been doing this for over 11 years now.",
    about_story_2: "Honestly, people started noticing things in my photos that I did not even see myself — raw sincerity and unique, unrepeatable moments. This solves the biggest problem for couples: you do not just want 10 heavily retouched pictures in tense, stiff poses. You want to see the real, breathing story of your day. And I handle that with ease... or at least that is what my couples tell me.",
    about_story_3: "Some say weddings are stressful. I delivered my wife's baby in an emergency. No hospital. Just the two of us. Your wedding day? Trust me, everything is completely under control.",
    about_values: "I work quietly, observe honestly, and guide only when it truly helps. I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day.",
    about_background: "Originally from Ukraine, now based near Aarhus. I work across all of Denmark and Europe. My visual language mixes documentary truth with editorial frames, so your gallery feels alive, elegant, and deeply personal.",
    about_experience: "11+ Years of experience across Denmark and Europe.",
    about_awards: "★ Photos of the Week · ★ Unposed Moms Moments · ★ Happy Mother's Day 2022",
    contact_heading: "Let's Talk About Your Day",
    contact_desc: "I prefer direct, personal connection. Choose your preferred messenger below to discuss your vision, check availability, or say hello:",
    whatsapp_subtitle: "Fastest for Europe & International couples",
    telegram_subtitle: "Direct Chat in Ukrainian & English",
    instagram_subtitle: "Portfolio, reels & live stories",
    email_subtitle: "Email Direct",
    prefilled_message: "Hi Oleh! We are planning our wedding on [Date] in [City/Venue]. Is this date available?",
    email_subject: "Wedding Photography Inquiry",
    footer_desc: "Based in Denmark (Aarhus area), available across Europe.",
    floating_cta_note: "Calendar open for 2026-2027 weddings · See all contact options"
  }
};

let currentTransLang = "da";

function loadTranslationsForm(lang) {
  currentTransLang = lang;
  let saved = null;
  try {
    const raw = localStorage.getItem("deusflow_custom_translations_raw_" + lang);
    if (raw) saved = JSON.parse(raw);
  } catch (_e) {}

  const data = { ...(translationDefaults[lang] || {}), ...(saved || {}) };

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };

  setVal("trans-hero-title-1", data.hero_title_1);
  setVal("trans-hero-title-2", data.hero_title_2);
  setVal("trans-hero-desc", data.hero_desc);
  setVal("trans-hero-region", data.hero_region);
  setVal("trans-elopement-heading", data.elopement_heading);
  setVal("trans-elopement-desc", data.elopement_desc);
  setVal("trans-elopement-locations", data.elopement_locations);
  setVal("trans-meet-quote", data.meet_quote);
  setVal("trans-meet-btn", data.meet_btn);
  setVal("trans-test-1", data.test_1);
  setVal("trans-test-2", data.test_2);
  setVal("trans-test-3", data.test_3);
  setVal("trans-test-4", data.test_4);
  setVal("trans-about-header", data.about_header);
  setVal("trans-about-story-1", data.about_story_1);
  setVal("trans-about-story-2", data.about_story_2);
  setVal("trans-about-story-3", data.about_story_3);
  setVal("trans-about-values", data.about_values);
  setVal("trans-about-background", data.about_background);
  setVal("trans-about-experience", data.about_experience);
  setVal("trans-about-awards", data.about_awards);
  setVal("trans-contact-heading", data.contact_heading);
  setVal("trans-contact-desc", data.contact_desc);
  setVal("trans-wa-sub", data.whatsapp_subtitle);
  setVal("trans-tg-sub", data.telegram_subtitle);
  setVal("trans-ig-sub", data.instagram_subtitle);
  setVal("trans-email-sub", data.email_subtitle);
  setVal("trans-prefilled-msg", data.prefilled_message);
  setVal("trans-email-subject", data.email_subject);
  setVal("trans-footer-desc", data.footer_desc);
  setVal("trans-floating-cta", data.floating_cta_note);
}

function saveTranslationsForm(e) {
  if (e) e.preventDefault();
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  };

  const rawData = {
    hero_title_1: getVal("trans-hero-title-1"),
    hero_title_2: getVal("trans-hero-title-2"),
    hero_desc: getVal("trans-hero-desc"),
    hero_region: getVal("trans-hero-region"),
    elopement_heading: getVal("trans-elopement-heading"),
    elopement_desc: getVal("trans-elopement-desc"),
    elopement_locations: getVal("trans-elopement-locations"),
    meet_quote: getVal("trans-meet-quote"),
    meet_btn: getVal("trans-meet-btn"),
    test_1: getVal("trans-test-1"),
    test_2: getVal("trans-test-2"),
    test_3: getVal("trans-test-3"),
    test_4: getVal("trans-test-4"),
    about_header: getVal("trans-about-header"),
    about_story_1: getVal("trans-about-story-1"),
    about_story_2: getVal("trans-about-story-2"),
    about_story_3: getVal("trans-about-story-3"),
    about_values: getVal("trans-about-values"),
    about_background: getVal("trans-about-background"),
    about_experience: getVal("trans-about-experience"),
    about_awards: getVal("trans-about-awards"),
    contact_heading: getVal("trans-contact-heading"),
    contact_desc: getVal("trans-contact-desc"),
    whatsapp_subtitle: getVal("trans-wa-sub"),
    telegram_subtitle: getVal("trans-tg-sub"),
    instagram_subtitle: getVal("trans-ig-sub"),
    email_subtitle: getVal("trans-email-sub"),
    prefilled_message: getVal("trans-prefilled-msg"),
    email_subject: getVal("trans-email-subject"),
    footer_desc: getVal("trans-footer-desc"),
    floating_cta_note: getVal("trans-floating-cta")
  };

  // Convert raw fields into dictionary map for i18n
  const dictMap = {};
  if (rawData.hero_title_1) dictMap["Not loud."] = rawData.hero_title_1;
  if (rawData.hero_title_2) dictMap["But your photos will be."] = rawData.hero_title_2;
  if (rawData.hero_desc) dictMap["Quietly capturing honest emotion, effortless elegance, and the timeless feeling of your day."] = rawData.hero_desc;
  if (rawData.hero_region) dictMap["Denmark & Beyond"] = rawData.hero_region;
  if (rawData.elopement_heading) dictMap["Marrying in Denmark?"] = rawData.elopement_heading;
  if (rawData.elopement_desc) dictMap["Whether you are planning an intimate civil elopement at Copenhagen City Hall, a romantic seaside escape on Ærø Island, or a castle celebration in Jutland — I provide a calm, discreet documentary presence and timeless editorial photography."] = rawData.elopement_desc;
  if (rawData.elopement_locations) dictMap["Copenhagen · Ærø Island · Aarhus · Odense · Aalborg · All Denmark & Europe"] = rawData.elopement_locations;
  if (rawData.meet_quote) dictMap["I believe the most meaningful photos happen when you forget the camera is there. I stay quiet, watch the unposed moments unfold, and step in with gentle direction only when it makes you feel effortlessly beautiful."] = rawData.meet_quote;
  if (rawData.meet_btn) dictMap["Meet Oleh & Philosophy"] = rawData.meet_btn;
  if (rawData.test_1) dictMap["Man, these shots look straight out of a movie. You have an incredible eye for cinematic detail. Working with you on set was effortless. Top-tier level."] = rawData.test_1;
  if (rawData.test_2) dictMap["Wow, hvor ser det godt ud! Tusind tusind tak for det — kæmpe anbefaling! Der har virkelig været stor ros for alle billederne fra alle gæster og slottet også. Det har været fantastisk at have arbejdet med dig."] = rawData.test_2;
  if (rawData.test_3) dictMap["We just went through the gallery and we have no words. You captured the exact vibe of our day. No stiff poses, just the real us. Thank you for this memory!"] = rawData.test_3;
  if (rawData.test_4) dictMap["We had a cozy winter photoshoot, and Oleh made the whole process effortless and comfortable. The final pictures are pure magic."] = rawData.test_4;
  if (rawData.about_header) dictMap["Documentary & Editorial"] = rawData.about_header;
  if (rawData.about_story_1) dictMap["Many would write here about their deep love for wedding photography, but my true passion is art as a whole. Weddings simply chose me... and I fell so deeply in love with the process that I have been doing this for over 11 years now."] = rawData.about_story_1;
  if (rawData.about_story_2) dictMap["Honestly, people started noticing things in my photos that I did not even see myself — raw sincerity and unique, unrepeatable moments. This solves the biggest problem for couples: you do not just want 10 heavily retouched pictures in tense, stiff poses. You want to see the real, breathing story of your day. And I handle that with ease... or at least that is what my couples tell me."] = rawData.about_story_2;
  if (rawData.about_story_3) dictMap["Some say weddings are stressful. I delivered my wife's baby in an emergency. No hospital. Just the two of us. Your wedding day? Trust me, everything is completely under control."] = rawData.about_story_3;
  if (rawData.about_values) dictMap["I work quietly, observe honestly, and guide only when it truly helps. I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day."] = rawData.about_values;
  if (rawData.about_background) dictMap["Originally from Ukraine, now based near Aarhus. I work across all of Denmark and Europe. My visual language mixes documentary truth with editorial frames, so your gallery feels alive, elegant, and deeply personal."] = rawData.about_background;
  if (rawData.about_experience) dictMap["Years of experience across Denmark and Europe."] = rawData.about_experience;
  if (rawData.about_awards) dictMap["★ Photos of the Week"] = rawData.about_awards;
  if (rawData.contact_heading) dictMap["Let's Talk About Your Day"] = rawData.contact_heading;
  if (rawData.contact_desc) dictMap["I prefer direct, personal connection. Choose your preferred messenger below to discuss your vision, check availability, or say hello:"] = rawData.contact_desc;
  if (rawData.whatsapp_subtitle) dictMap["Fastest for Europe & International couples"] = rawData.whatsapp_subtitle;
  if (rawData.telegram_subtitle) dictMap["Прямий чат / Українська та English"] = rawData.telegram_subtitle;
  if (rawData.instagram_subtitle) dictMap["Portfolio, reels & live stories"] = rawData.instagram_subtitle;
  if (rawData.email_subtitle) dictMap["Email Direct"] = rawData.email_subtitle;
  if (rawData.footer_desc) dictMap["Based in Denmark (Aarhus area), available across Europe."] = rawData.footer_desc;
  if (rawData.floating_cta_note) dictMap["Calendar open for 2026-2027 weddings ·"] = rawData.floating_cta_note;

  try {
    localStorage.setItem("deusflow_custom_translations_raw_" + currentTransLang, JSON.stringify(rawData));
    localStorage.setItem("deusflow_custom_translations_" + currentTransLang, JSON.stringify(dictMap));
    showToast(`Translations for ${currentTransLang.toUpperCase()} saved successfully!`, "success");
    const statusEl = document.getElementById("translations-status-text");
    if (statusEl) {
      statusEl.textContent = `All ${currentTransLang.toUpperCase()} phrases saved. Changes are live on site!`;
      setTimeout(() => { statusEl.textContent = ""; }, 4000);
    }
  } catch (err) {
    showToast(`Could not save translations: ${err.message}`, "error");
  }
}

function setupTranslationsCMS() {
  const transForm = document.getElementById("translations-form");
  const langBtns = document.querySelectorAll(".translation-lang-btn");

  langBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      langBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const lang = btn.getAttribute("data-lang") || "da";
      loadTranslationsForm(lang);
    });
  });

  if (transForm) {
    transForm.addEventListener("submit", saveTranslationsForm);
  }

  loadTranslationsForm("da");
}

setupTestimonialReorder();
setupTranslationsCMS();

applyPhotoViewMode();
updateOrderControlsState();
updateAlbumOrderControlsState();
boot();

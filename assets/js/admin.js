import {
  getSupabase,
  slugify,
  formatDate,
  uploadToPhotosBucket,
  storagePathFromPublicUrl
} from "./supabase-client.js";
import { createStateMessage } from "./ui.js";

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

function setAboutStatus(message, tone = "default") {
  if (!aboutStatusText) {
    return;
  }
  aboutStatusText.textContent = message;
  aboutStatusText.style.color = tone === "error" ? "#d39e9e" : "rgba(232, 226, 217, 0.72)";
}

function setPricingStatus(message, tone = "default") {
  if (!pricingStatusText) {
    return;
  }
  pricingStatusText.textContent = message;
  pricingStatusText.style.color = tone === "error" ? "#d39e9e" : "rgba(232, 226, 217, 0.72)";
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
  photosList.querySelectorAll(".photo-row.drop-target").forEach((node) => {
    node.classList.remove("drop-target");
  });
}

function clearPendingMoves() {
  state.pendingMoves.clear();
  photosList.querySelectorAll(".move-to-input").forEach((input) => {
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

  for (let index = 0; index < reorderedAlbums.length; index += 1) {
    const album = reorderedAlbums[index];
    const nextOrder = index + 1;
    if (oldOrder.get(album.id) === nextOrder) {
      continue;
    }

    const { error } = await supabase
      .from("albums")
      .update({ display_order: nextOrder })
      .eq("id", album.id);

    if (error) {
      setUploadStatus(`Could not reorder albums: ${error.message}`, 0, "error");
      return false;
    }
  }

  return true;
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
  state.selectedAlbumMetaBase = `${album.type} | ${formatDate(album.date)} | slug: ${album.slug}`;
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
  selectedAlbumPanel.classList.remove("hidden");
  focusAlbumWorkflowSection("edit");
  setSectionOpen(albumsSection, true);
  setSectionOpen(createAlbumSection, false);
  setUploadStatus("No upload in progress.", 0);
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

    const info = document.createElement("div");
    info.className = "album-info-wrap";
    const orderText = album.type === "wedding" && weddingIndex >= 0 ? ` | order: ${weddingIndex + 1}` : "";
    const coverHtml = album.cover_url ? `<img src="${escapeHTML(album.cover_url)}" class="album-list-thumb" alt="cover" />` : `<div class="album-list-thumb empty">No Cover</div>`;
    info.innerHTML = `
      ${coverHtml}
      <div>
        <strong>${escapeHTML(album.title)}</strong><br />
        <span class="photo-subtitle">${escapeHTML(album.type.toUpperCase())} | ${formatDate(album.date)} | ${escapeHTML(album.slug)}${orderText}</span>
      </div>
    `;

    const visibility = document.createElement("label");
    visibility.className = "visibility-toggle";
    visibility.innerHTML = `<input type="checkbox" ${album.visible ? "checked" : ""} /> Published`;
    const checkbox = visibility.querySelector("input");
    checkbox.addEventListener("change", async () => {
      const { error: updateError } = await supabase
        .from("albums")
        .update({ visible: checkbox.checked })
        .eq("id", album.id);

      if (updateError) {
        checkbox.checked = !checkbox.checked;
        setUploadStatus(updateError.message, 0, "error");
      }
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "0.5rem";
    actions.style.flexWrap = "wrap";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "ghost";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => {
      showAlbumDetails(album);
      loadPhotos(album.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(`Delete album \"${album.title}\" and all related photos?`);
      if (!confirmed) {
        return;
      }

      setUploadStatus(`Deleting album \"${album.title}\"...`, 20);
      try {
        await deleteAlbum(album.id);
        if (state.selectedAlbum && state.selectedAlbum.id === album.id) {
          selectedAlbumPanel.classList.add("hidden");
        }
        await loadAlbums();
        setUploadStatus("Album deleted.", 100);
      } catch (deleteError) {
        setUploadStatus(`Could not delete album: ${deleteError.message}`, 0, "error");
      }
    });

    actions.appendChild(openButton);

    if (album.type === "wedding" && weddingIndex >= 0) {
      const upButton = document.createElement("button");
      upButton.type = "button";
      upButton.className = "ghost";
      upButton.textContent = "Up";
      upButton.disabled = weddingIndex === 0;
      upButton.addEventListener("click", () => {
        stageAlbumMove(album.id, String(Math.max(1, weddingIndex)), weddingAlbumsCurrent.length);
      });

      const downButton = document.createElement("button");
      downButton.type = "button";
      downButton.className = "ghost";
      downButton.textContent = "Down";
      downButton.disabled = weddingIndex === weddingAlbumsCurrent.length - 1;
      downButton.addEventListener("click", () => {
        stageAlbumMove(album.id, String(Math.min(weddingAlbumsCurrent.length, weddingIndex + 2)), weddingAlbumsCurrent.length);
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
      moveButton.addEventListener("click", () => {
        stageAlbumMove(album.id, moveInput.value, weddingAlbumsCurrent.length, moveInput);
      });
      moveInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          stageAlbumMove(album.id, moveInput.value, weddingAlbumsCurrent.length, moveInput);
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

  for (const row of changedRows) {
    const { error } = await supabase
      .from("photos")
      .update({ display_order: row.display_order })
      .eq("id", row.id);

    if (error) {
      setUploadStatus(`Could not reorder photos: ${error.message}`, 0, "error");
      return false;
    }
  }

  state.selectedAlbumPhotos = normalized;
  return true;
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
    row.className = "photo-row";
    row.draggable = true;
    row.dataset.index = String(index);

    row.addEventListener("dragstart", (event) => {
      if (state.reorderInProgress) {
        event.preventDefault();
        return;
      }

      state.dragSourceIndex = index;
      row.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      }
    });

    row.addEventListener("dragend", () => {
      state.dragSourceIndex = null;
      row.classList.remove("dragging");
      clearPhotoDropTargets();
    });

    row.addEventListener("dragover", (event) => {
      if (state.reorderInProgress) {
        return;
      }

      event.preventDefault();
      clearPhotoDropTargets();
      row.classList.add("drop-target");
      handleDragAutoScroll(event);
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drop-target");
    });

    row.addEventListener("drop", async (event) => {
      event.preventDefault();
      clearPhotoDropTargets();

      const targetIndex = Number(row.dataset.index);
      const sourceFromData = event.dataTransfer ? Number(event.dataTransfer.getData("text/plain")) : Number.NaN;
      const sourceIndex = Number.isInteger(sourceFromData) ? sourceFromData : state.dragSourceIndex;

      if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex)) {
        return;
      }

      await movePhotoByIndex(sourceIndex, targetIndex);
    });

    const info = document.createElement("div");
    info.innerHTML = `
      <strong>Order: ${photo.display_order}</strong><br />
      <span class="photo-subtitle">${photo.id}</span>
    `;

    const actions = document.createElement("div");
    actions.className = "photo-actions";

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.className = "ghost";
    upButton.textContent = "Up";
    upButton.disabled = index === 0;
    upButton.addEventListener("click", () => movePhotoByIndex(index, index - 1));

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.className = "ghost";
    downButton.textContent = "Down";
    downButton.disabled = index === photos.length - 1;
    downButton.addEventListener("click", () => movePhotoByIndex(index, index + 1));

    const topButton = document.createElement("button");
    topButton.type = "button";
    topButton.className = "ghost";
    topButton.textContent = "Top";
    topButton.disabled = index === 0;
    topButton.addEventListener("click", () => movePhotoByIndex(index, 0));

    const bottomButton = document.createElement("button");
    bottomButton.type = "button";
    bottomButton.className = "ghost";
    bottomButton.textContent = "Bottom";
    bottomButton.disabled = index === photos.length - 1;
    bottomButton.addEventListener("click", () => movePhotoByIndex(index, photos.length - 1));

    const moveToWrap = document.createElement("div");
    moveToWrap.className = "move-to-wrap";

    const moveToInput = document.createElement("input");
    moveToInput.type = "number";
    moveToInput.className = "move-to-input";
    moveToInput.min = "1";
    moveToInput.max = String(photos.length);
    moveToInput.placeholder = "#";
    moveToInput.title = `Move photo to position 1-${photos.length}`;

    const moveToButton = document.createElement("button");
    moveToButton.type = "button";
    moveToButton.className = "ghost";
    moveToButton.textContent = "Set";

    const stageMoveToPosition = () => {
      const targetIndex = parseTargetPosition(moveToInput.value, photos.length);
      if (targetIndex === null) {
        setUploadStatus(`Enter a position from 1 to ${photos.length}.`, 0, "error");
        return;
      }

      state.moveSequence += 1;
      state.pendingMoves.set(photo.id, { targetIndex, sequence: state.moveSequence });
      moveToInput.classList.add("is-staged");
      updateOrderControlsState();
      setUploadStatus(`Staged ${state.pendingMoves.size} order change(s). Click Save order changes to apply.`, 0);
    };

    moveToButton.addEventListener("click", stageMoveToPosition);
    moveToInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        stageMoveToPosition();
      }
    });

    moveToWrap.appendChild(moveToInput);
    moveToWrap.appendChild(moveToButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm("Delete this photo permanently?");
      if (!confirmed) {
        return;
      }

      setUploadStatus("Deleting photo...", 20);

      const path = storagePathFromPublicUrl(photo.url);
      if (path) {
        const { error: storageError } = await supabase.storage.from("photos").remove([path]);
        if (storageError) {
          setUploadStatus(storageError.message, 0, "error");
          return;
        }
      }

      const { error: deleteError } = await supabase.from("photos").delete().eq("id", photo.id);
      if (deleteError) {
        setUploadStatus(deleteError.message, 0, "error");
        return;
      }

      await loadPhotos(albumId);
      setUploadStatus("Photo deleted.", 100);
    });

    actions.appendChild(upButton);
    actions.appendChild(downButton);
    actions.appendChild(topButton);
    actions.appendChild(bottomButton);
    actions.appendChild(moveToWrap);
    actions.appendChild(deleteButton);

    const thumb = document.createElement("img");
    thumb.src = photo.url;
    thumb.alt = "Album photo";
    thumb.loading = "lazy";

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(actions);
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

  const supabase = getSupabase();
  const total = imageFiles.length;
  let uploaded = 0;
  let failed = 0;

  const startOrder =
    state.selectedAlbumPhotos.length > 0
      ? Math.max(...state.selectedAlbumPhotos.map((photo) => photo.display_order || 0)) + 1
      : 1;

  let order = startOrder;
  setUploadBusy(true);
  setUploadStatus(`Uploading 0/${total} photos...`, 0);

  for (const file of imageFiles) {
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
      if (selectedAlbumPanel && targetId !== "tab-portfolio") {
        selectedAlbumPanel.classList.add("hidden");
      }
    });
  });

  if (closeAlbumBtn && selectedAlbumPanel) {
    closeAlbumBtn.addEventListener("click", () => {
      selectedAlbumPanel.classList.add("hidden");
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

setupTestimonialReorder();

applyPhotoViewMode();
updateOrderControlsState();
updateAlbumOrderControlsState();
boot();

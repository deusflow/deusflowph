import { getSupabase } from "./supabase-client.js";
import { createStateMessage, initScrollReveals, getOptimizedImageUrl, initSmartHeader, setupLightbox, escapeHTML } from "./ui.js?v=20260820-13";

const photoNode = document.getElementById("about-photo");
const photoPanel = document.querySelector(".about-photo-panel");
const galleryContainer = document.getElementById("about-gallery-container");
const storyNode = document.getElementById("about-story");
const valuesNode = document.getElementById("about-values");
const personalNode = document.getElementById("about-personal");
const testimonialsGrid = document.getElementById("testimonials-grid");

const fallback = {
  photo_url: "",
  story:
    "Many would write here about their deep love for wedding photography, but my true passion is art as a whole. Weddings simply chose me... and I fell so deeply in love with the process that I have been doing this for over 11 years now.\n\nHonestly, people started noticing things in my photos that I did not even see myself — raw sincerity and unique, unrepeatable moments. This solves the biggest problem for couples: you do not just want 10 heavily retouched pictures in tense, stiff poses. You want to see the real, breathing story of your day. And I handle that with ease... or at least that is what my couples tell me.\n\nSome say weddings are stressful. I delivered my wife's baby in an emergency. No hospital. Just the two of us.\n\nYour wedding day? Trust me, everything is completely under control.",
  values_text:
    "I work quietly, observe honestly, and guide only when it truly helps. I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day.",
  personal_text:
    "Originally from Ukraine, now based near Aarhus. I work across all of Denmark and Europe. My visual language mixes documentary truth with editorial frames, so your gallery feels alive, elegant, and deeply personal.",
  testimonials: [
    {
      name: "Oleksandr Popov (Actor)",
      quote: "Man, these shots look straight out of a movie. You have an incredible eye for cinematic detail. Working with you on set was effortless. Top-tier level."
    },
    {
      name: "Amalie Frank",
      quote:
        "Wow, hvor ser det godt ud! Tusind tusind tak for det — kæmpe anbefaling! Der har virkelig været stor ros for alle billederne fra alle gæster og slottet også. Det har været fantastisk at have arbejdet med dig."
    },
    {
      name: "Volodymyr Ostapchuk (TV Presenter)",
      quote: "We just went through the gallery and we have no words. You captured the exact vibe of our day. No stiff poses, just the real us. Thank you for this memory!"
    },
    {
      name: "Jerry Heil (Singer & Songwriter)",
      quote: "We had a cozy winter photoshoot, and Oleh made the whole process effortless and comfortable. The final pictures are pure magic."
    }
  ],
  gallery_photos: []
};

function normalizeMultilineText(value) {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

function normalizeTestimonials(value) {
  if (!Array.isArray(value)) {
    return fallback.testimonials;
  }

  const list = value
    .map((item) => ({
      name: String(item?.name || "").trim(),
      quote: String(item?.quote || "").trim()
    }))
    .filter((item) => item.name && item.quote);

  return list.length ? list : fallback.testimonials;
}

function renderRichText(node, text) {
  if (!node) {
    return;
  }

  node.innerHTML = "";
  normalizeMultilineText(text)
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      node.appendChild(p);
    });
}

function renderTestimonials(list) {
  if (!testimonialsGrid) {
    return;
  }

  testimonialsGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  list.forEach((item) => {
    const card = document.createElement("article");
    card.className = "panel testimonial-card";

    const quote = document.createElement("p");
    quote.className = "testimonial-quote";
    quote.textContent = `"${item.quote}"`;

    const author = document.createElement("p");
    author.className = "testimonial-name";
    author.textContent = item.name;

    card.appendChild(quote);
    card.appendChild(author);
    fragment.appendChild(card);
  });

  testimonialsGrid.appendChild(fragment);
}

let currentAboutState = null;

function renderAbout(content) {
  if (content) currentAboutState = content;
  const about = {
    ...fallback,
    ...(content || currentAboutState),
    testimonials: normalizeTestimonials((content || currentAboutState)?.testimonials),
    gallery_photos: Array.isArray((content || currentAboutState)?.gallery_photos) ? (content || currentAboutState).gallery_photos : []
  };

  const currentLang = localStorage.getItem("deusflow_lang") || "en";
  const normalizedLang = currentLang === "uk" ? "ua" : currentLang;
  const rawData = (typeof window.getRawData === "function") ? window.getRawData(normalizedLang) : null;

  let storyText = about.story;
  let valuesText = about.values_text;
  let personalText = about.personal_text;

  if (rawData) {
    if (rawData.about_story_1 || rawData.about_story_2 || rawData.about_story_3) {
      const combined = [rawData.about_story_1, rawData.about_story_2, rawData.about_story_3].filter(Boolean).join("\n\n");
      if (combined) storyText = combined;
    }
    if (rawData.about_values) {
      valuesText = rawData.about_values;
    }
    if (rawData.about_background) {
      personalText = rawData.about_background;
    }
  }

  const hasPortrait = Boolean(about.photo_url);
  const hasGallery = about.gallery_photos.length > 0;

  if (photoNode) {
    if (hasPortrait) {
      photoNode.onload = () => {
        photoNode.style.opacity = "1";
      };
      photoNode.src = getOptimizedImageUrl(about.photo_url, 1200);
      photoNode.setAttribute("data-lightbox-src", about.photo_url);
      photoNode.style.display = "block";
      photoNode.style.cursor = "zoom-in";
      if (photoNode.complete && photoNode.naturalWidth > 0) {
        photoNode.style.opacity = "1";
      }
    } else {
      photoNode.removeAttribute("src");
      photoNode.removeAttribute("data-lightbox-src");
      photoNode.style.display = "none";
      photoNode.style.opacity = "0";
    }
  }

  if (galleryContainer) {
    galleryContainer.innerHTML = "";
    if (hasGallery) {
      const header = document.createElement("div");
      header.className = "about-gallery-header";
      header.innerHTML = `<span class="about-gallery-tag">Moments &amp; Behind the Scenes</span>`;
      galleryContainer.appendChild(header);

      const grid = document.createElement("div");
      grid.className = "about-gallery-grid";
      about.gallery_photos.forEach((photo) => {
        const thumb = document.createElement("a");
        thumb.className = "about-gallery-thumb";
        thumb.href = "#";
        thumb.setAttribute("data-lightbox-src", photo.url);
        const caption = photo.caption || "Oleh Ro - moments";
        thumb.innerHTML = `<img src="${escapeHTML(getOptimizedImageUrl(photo.url, 400))}" alt="${escapeHTML(caption)}" loading="lazy" decoding="async" />`;
        grid.appendChild(thumb);
      });
      galleryContainer.appendChild(grid);
    }
  }

  if (photoPanel) {
    if (hasPortrait) {
      photoPanel.style.display = "block";
      photoPanel.closest(".editorial-grid")?.classList.remove("no-photo");
    } else {
      photoPanel.style.display = "none";
      photoPanel.closest(".editorial-grid")?.classList.add("no-photo");
    }
  }
  
  renderRichText(storyNode, storyText);
  renderRichText(valuesNode, valuesText);
  renderRichText(personalNode, personalText);
  renderTestimonials(about.testimonials);
}

window.renderAboutPage = (forcedContent) => {
  if (forcedContent) {
    renderAbout(forcedContent);
  } else {
    try {
      const cached = JSON.parse(localStorage.getItem("deusflow_about_cache") || "null");
      renderAbout(cached || currentAboutState);
    } catch (_e) {
      renderAbout(currentAboutState);
    }
  }
};

async function loadAbout() {
  try {
    const cached = JSON.parse(localStorage.getItem("deusflow_about_cache") || "null");
    if (cached) {
      renderAbout(cached);
    }
  } catch (_e) {}

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("about_content").select("*").eq("id", 1).maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      localStorage.setItem("deusflow_about_cache", JSON.stringify(data));
      renderAbout(data);
    } else {
      renderAbout(fallback);
    }
  } catch (error) {
    if (!localStorage.getItem("deusflow_about_cache")) {
      renderAbout(fallback);
      if (testimonialsGrid) {
        testimonialsGrid.prepend(createStateMessage(`Live About content unavailable. Showing fallback. ${error.message}`));
      }
    }
  }
}

loadAbout().then(() => {
  initSmartHeader();
  initScrollReveals();
  setupLightbox();
  if (typeof window.applyTranslations === "function") {
    window.applyTranslations();
  }
});

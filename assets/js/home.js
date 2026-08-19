import { observeLazyImages, createStateMessage, initScrollReveals, initMagneticButtons, initParallax, escapeHTML, getOptimizedImageUrl, initRackFocusReveal, initWordReveal, initCustomCursor } from "./ui.js?v=20260819-18";
import { fetchTestimonials, fetchFeaturedAlbums, fetchAlbumFallbackCover } from "./services/api.js";

const featuredGrid = document.getElementById("featured-grid");
const heroImage = document.getElementById("hero-image");
const testimonialsGrid = document.getElementById("testimonials-grid");

const fallbackTestimonials = [
  {
    name: "Amalie & Frederik (Aarhus, Denmark)",
    quote:
      "Tusind tusind tak for det — kæmpe anbefaling! Der har virkelig været stor ros for alle billederne fra alle gæster og slottet også. Det har været fantastisk at have arbejdet med dig, Oleh!"
  },
  {
    name: "Volodymyr Ostapchuk (TV Presenter)",
    quote: "Oleh has an incredible talent for capturing genuine emotions. Our photos tell the perfect story of our day. Calm, unobtrusive, highly recommended!"
  },
  {
    name: "Elena & Marcus (Copenhagen Elopement)",
    quote: "We travelled from Munich to elope in Copenhagen. Oleh guided us through the most aesthetic corners of the city. The photos look like a Vogue editorial!"
  },
  {
    name: "Jerry Heil (Singer & Songwriter)",
    quote: "We had a cozy photoshoot, and Oleh made the whole process effortless and comfortable. The final pictures are pure magic."
  },
  {
    name: "Oleksandr Popov (Actor)",
    quote: "I worked with Oleh on a shoot for my TV series. He is an absolute professional with a great eye for cinematic detail."
  }
];

function normalizeTestimonials(value) {
  if (!Array.isArray(value)) {
    return fallbackTestimonials;
  }

  const list = value
    .map((item) => ({
      name: String(item?.name || "").trim(),
      quote: String(item?.quote || "").trim()
    }))
    .filter((item) => item.name && item.quote);

  return list.length ? list : fallbackTestimonials;
}

function renderTestimonials(items) {
  if (!testimonialsGrid) {
    return;
  }

  testimonialsGrid.innerHTML = "";

  // Create track element
  const track = document.createElement("div");
  track.className = "testimonials-track";

  const createCard = (item) => {
    const card = document.createElement("article");
    card.className = "panel testimonial-card testimonial-chip";

    const quote = document.createElement("p");
    quote.className = "testimonial-quote";
    quote.textContent = `\"${item.quote}\"`;

    const author = document.createElement("p");
    author.className = "testimonial-name";
    author.textContent = item.name;

    card.appendChild(quote);
    card.appendChild(author);
    return card;
  };

  // Render original set
  items.forEach((item) => {
    track.appendChild(createCard(item));
  });

  // Render duplicated set for seamless looping
  items.forEach((item) => {
    track.appendChild(createCard(item));
  });

  testimonialsGrid.appendChild(track);
}

function buildFeaturedAlt(album) {
  return `${album.title} - wedding story by Oleh Ro`;
}

async function loadTestimonials() {
  if (!testimonialsGrid) {
    return;
  }

  try {
    const testimonials = await fetchTestimonials();
    renderTestimonials(normalizeTestimonials(testimonials));
  } catch (error) {
    renderTestimonials(fallbackTestimonials);
  }
}



async function loadFeatured() {
  if (!featuredGrid) {
    return;
  }

  try {
    const albums = await fetchFeaturedAlbums(3);

    if (!albums || albums.length === 0) {
      featuredGrid.appendChild(createStateMessage("No wedding albums published yet."));
      return;
    }

    for (const album of albums) {
      let imageUrl = album.cover_url;

      // Backward compatibility for albums created before cover_url was set.
      if (!imageUrl) {
        const fallbackUrl = await fetchAlbumFallbackCover(album.id);
        if (!fallbackUrl) continue;
        imageUrl = fallbackUrl;
      }

      const card = document.createElement("a");
      card.className = "photo-card polaroid-luxury";
      card.href = `weddings/album/?slug=${encodeURIComponent(album.slug)}`;
      const escapedTitle = escapeHTML(album.title);
      const escapedImgUrl = escapeHTML(getOptimizedImageUrl(imageUrl, 800));
      const escapedAlt = escapeHTML(buildFeaturedAlt(album));
      card.innerHTML = `
        <div class="polaroid-inner">
          <div class="photo-media">
            <img data-src="${escapedImgUrl}" alt="${escapedAlt}" loading="lazy" />
          </div>
          <div class="polaroid-footer">
            <h3 class="photo-title">${escapedTitle}</h3>
          </div>
        </div>
      `;
      featuredGrid.appendChild(card);
    }

    if (!featuredGrid.children.length) {
      featuredGrid.appendChild(createStateMessage("Albums are published, but no photos are attached yet."));
    }

    observeLazyImages();
    initRackFocusReveal();
  } catch (error) {
    featuredGrid.innerHTML = "";
    featuredGrid.appendChild(createStateMessage(`Could not load featured stories. ${error.message}`));
  }
}

Promise.all([loadFeatured(), loadTestimonials()]).then(() => {
  if (typeof window.applyTranslations === "function") {
    window.applyTranslations();
  }
});
initScrollReveals();
initMagneticButtons();
initParallax();
initWordReveal();
initCustomCursor();

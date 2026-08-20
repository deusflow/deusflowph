import { observeLazyImages, createStateMessage, initScrollReveals, initMagneticButtons, initParallax, escapeHTML, getOptimizedImageUrl, initRackFocusReveal, initWordReveal, initCustomCursor, initSmartHeader } from "./ui.js?v=20260820-13";
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

function initPortalZoom() {
  const track = document.getElementById("hero-portal-track");
  const heroImg = document.getElementById("hero-image");
  const heroTitleLeft = document.querySelector(".hero-title-left");
  const heroTitleRight = document.querySelector(".hero-title-right");
  const heroActions = document.querySelector(".hero-actions");
  const heroCopy = document.querySelector(".hero-copy");
  const heroOverlay = document.querySelector(".hero-overlay");
  const ribbon = document.querySelector(".hero-tagline-ribbon");

  if (!track || !heroImg) return;

  let currentProgress = 0;
  let targetProgress = 0;
  let isRunning = false;

  function onScroll() {
    const rect = track.getBoundingClientRect();
    const scrollDistance = track.offsetHeight - window.innerHeight;
    if (scrollDistance <= 0) return;

    const scrolled = -rect.top;
    targetProgress = Math.max(0, Math.min(1, scrolled / scrollDistance));

    if (!isRunning) {
      isRunning = true;
      requestAnimationFrame(render);
    }
  }

  function render() {
    // Smooth inertial lerp
    currentProgress += (targetProgress - currentProgress) * 0.16;

    if (Math.abs(targetProgress - currentProgress) < 0.001) {
      currentProgress = targetProgress;
    }

    const isMobile = window.innerWidth <= 759;
    const maxScale = isMobile ? 2.2 : 2.8;
    const scale = 1.05 + currentProgress * maxScale;
    const yOffset = -currentProgress * (isMobile ? 5 : 3.5);

    heroImg.style.transform = `translate3d(0, ${yOffset}%, 0) scale(${scale})`;

    const textOpacity = Math.max(0, 1 - currentProgress * 2.5);
    const splitDistance = isMobile ? 180 : 320;
    const leftX = -currentProgress * splitDistance;
    const rightX = currentProgress * splitDistance;

    if (heroTitleLeft) {
      heroTitleLeft.style.transform = `translate3d(${leftX}px, 0, 0)`;
      heroTitleLeft.style.opacity = textOpacity;
    }

    if (heroTitleRight) {
      heroTitleRight.style.transform = `translate3d(${rightX}px, 0, 0)`;
      heroTitleRight.style.opacity = textOpacity;
    }

    if (heroActions) {
      heroActions.style.pointerEvents = "auto";
      heroActions.style.opacity = "1";
    }

    if (heroOverlay) {
      heroOverlay.style.opacity = Math.max(0.18, 1 - currentProgress * 1.5);
    }

    if (ribbon) {
      ribbon.style.opacity = Math.max(0, 1 - currentProgress * 4.5);
    }

    if (currentProgress !== targetProgress) {
      requestAnimationFrame(render);
    } else {
      isRunning = false;
    }
  }

  // Smooth click for Check Availability anchor
  const checkAvailBtn = document.querySelector('.hero-actions a[href="#contact-block"]');
  if (checkAvailBtn) {
    checkAvailBtn.addEventListener("click", (e) => {
      const contactBlock = document.getElementById("contact-block");
      if (contactBlock) {
        e.preventDefault();
        contactBlock.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
}

Promise.all([loadFeatured(), loadTestimonials()]).then(() => {
  if (typeof window.applyTranslations === "function") {
    window.applyTranslations();
  }
});
initScrollReveals();
initMagneticButtons();
initPortalZoom();
initWordReveal();
initCustomCursor();
initSmartHeader();

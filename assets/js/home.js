import { observeLazyImages, createStateMessage, initScrollReveals, initMagneticButtons, initParallax, escapeHTML, getOptimizedImageUrl, initRackFocusReveal, initWordReveal, initCustomCursor, initSmartHeader, applyPortraitFocalPoint } from "./ui.js?v=20261105-1";
import { fetchHomeAboutData, fetchFeaturedAlbums, fetchAlbumFallbackCover } from "./services/api.js";

const featuredGrid = document.getElementById("featured-grid");
const heroImage = document.getElementById("hero-image");
const testimonialsGrid = document.getElementById("testimonials-grid");
const meetAvatar = document.querySelector(".meet-avatar");

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
    .map((item) => {
      let quote = String(item?.quote || "").trim();
      if (quote) {
        quote = quote.charAt(0).toUpperCase() + quote.slice(1);
      }
      return {
        name: String(item?.name || "").trim(),
        quote
      };
    })
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
  // Apply cached portrait focal point immediately if available
  try {
    const cachedAbout = JSON.parse(localStorage.getItem("deusflow_about_cache") || "null");
    if (cachedAbout?.photo_url && meetAvatar) {
      applyPortraitFocalPoint(meetAvatar, getOptimizedImageUrl(cachedAbout.photo_url, 600));
    }
  } catch (_e) {}

  try {
    const { testimonials, photo_url } = await fetchHomeAboutData();
    if (photo_url && meetAvatar) {
      applyPortraitFocalPoint(meetAvatar, getOptimizedImageUrl(photo_url, 600));
    }
    if (testimonialsGrid) {
      renderTestimonials(normalizeTestimonials(testimonials));
    }
  } catch (error) {
    if (testimonialsGrid) {
      renderTestimonials(fallbackTestimonials);
    }
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
  const heroBtns = heroActions ? Array.from(heroActions.querySelectorAll(".cta-editorial")) : [];
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
    currentProgress += (targetProgress - currentProgress) * 0.14;

    if (Math.abs(targetProgress - currentProgress) < 0.0008) {
      currentProgress = targetProgress;
    }

    const isMobile = window.innerWidth <= 759;

    // 1. Noble cinematic parallax zoom (1.04 -> 1.20 desktop, 1.04 -> 1.15 mobile)
    const zoomRange = isMobile ? 0.11 : 0.16;
    const scale = 1.04 + currentProgress * zoomRange;
    const yOffset = -currentProgress * (isMobile ? 2.5 : 3.5);
    heroImg.style.transform = `translate3d(0, ${yOffset}%, 0) scale(${scale})`;

    // 2. "Parting Doors" choreography for title lines & action buttons
    if (currentProgress <= 0.001) {
      if (heroTitleLeft) {
        heroTitleLeft.style.transform = "";
        heroTitleLeft.style.opacity = "";
        heroTitleLeft.style.filter = "";
      }
      if (heroTitleRight) {
        heroTitleRight.style.transform = "";
        heroTitleRight.style.opacity = "";
        heroTitleRight.style.filter = "";
      }
      heroBtns.forEach((btn) => {
        btn.style.transform = "";
        btn.style.opacity = "";
      });
      if (heroActions) {
        heroActions.style.pointerEvents = "auto";
      }
    } else {
      // Gentle ease-out curve for the parting doors
      const doorEase = 1 - Math.pow(1 - Math.min(1, currentProgress * 1.35), 2);
      const fadeOpacity = Math.max(0, 1 - currentProgress * 2.05);
      const opticalBlur = (currentProgress * 3.2).toFixed(2);

      const splitDistance = isMobile ? 92 : 168;
      const liftY = -doorEase * (isMobile ? 8 : 12);
      const leftX = -doorEase * splitDistance;
      const rightX = doorEase * splitDistance;

      if (heroTitleLeft) {
        heroTitleLeft.style.transform = `translate3d(${leftX}px, ${liftY}px, 0)`;
        heroTitleLeft.style.opacity = String(fadeOpacity);
        heroTitleLeft.style.filter = currentProgress > 0.04 ? `blur(${opticalBlur}px)` : "none";
      }

      if (heroTitleRight) {
        heroTitleRight.style.transform = `translate3d(${rightX}px, ${liftY}px, 0)`;
        heroTitleRight.style.opacity = String(fadeOpacity);
        heroTitleRight.style.filter = currentProgress > 0.04 ? `blur(${opticalBlur}px)` : "none";
      }

      // Action buttons part in sympathy with the title doors and rise gently
      const btnSplit = isMobile ? 24 : 46;
      const btnLiftY = -doorEase * (isMobile ? 10 : 14);
      const btnOpacity = Math.max(0, 1 - currentProgress * 2.15);

      if (heroBtns.length >= 2) {
        heroBtns[0].style.transform = `translate3d(${-doorEase * btnSplit}px, ${btnLiftY}px, 0)`;
        heroBtns[0].style.opacity = String(btnOpacity);
        heroBtns[1].style.transform = `translate3d(${doorEase * btnSplit}px, ${btnLiftY}px, 0)`;
        heroBtns[1].style.opacity = String(btnOpacity);
      } else if (heroBtns.length === 1) {
        heroBtns[0].style.transform = `translate3d(0, ${btnLiftY}px, 0)`;
        heroBtns[0].style.opacity = String(btnOpacity);
      }

      if (heroActions) {
        heroActions.style.pointerEvents = btnOpacity > 0.18 ? "auto" : "none";
      }
    }

    // 3. Overlay opens softly so the photograph brightens as the doors part
    if (heroOverlay) {
      heroOverlay.style.opacity = String(Math.max(0.32, 1 - currentProgress * 0.85));
    }

    if (ribbon) {
      ribbon.style.opacity = String(Math.max(0, 1 - currentProgress * 3.5));
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

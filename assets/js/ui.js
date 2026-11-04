import { getSupabase } from "./supabase-client.js";

// Clean address bar: automatically strip /index.html from URL
(function cleanUrlPath() {
  try {
    if (window.location.pathname.endsWith("/index.html")) {
      const cleanPath = window.location.pathname.replace(/\/index\.html$/, "/") + window.location.search + window.location.hash;
      window.history.replaceState(null, "", cleanPath);
    } else if (window.location.pathname.endsWith("index.html")) {
      const cleanPath = window.location.pathname.replace(/index\.html$/, "") + window.location.search + window.location.hash;
      window.history.replaceState(null, "", cleanPath);
    }
  } catch (_e) {}
})();

function bindSmoothImageLoad(img) {
  if (!img || img.dataset.smoothBound === "1") return;
  img.dataset.smoothBound = "1";
  img.classList.add("lazy-img-fade");

  const markLoaded = () => {
    img.classList.add("is-loaded");
  };

  if (img.complete && img.naturalWidth > 0) {
    markLoaded();
  } else {
    img.addEventListener("load", markLoaded, { once: true });
    img.addEventListener("error", markLoaded, { once: true });
  }
}

export function parsePortraitFocalPoint(rawUrl) {
  if (!rawUrl) {
    return { url: "", x: 50, y: 28, scale: 1 };
  }
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    const fp = parsed.searchParams.get("fp");
    if (fp) {
      const parts = fp.split(",").map(Number);
      const x = Number.isFinite(parts[0]) ? Math.max(0, Math.min(100, parts[0])) : 50;
      const y = Number.isFinite(parts[1]) ? Math.max(0, Math.min(100, parts[1])) : 28;
      const scale = Number.isFinite(parts[2]) ? Math.max(1, Math.min(2.2, parts[2])) : 1;
      return { url: rawUrl, x, y, scale };
    }
  } catch (_e) {}
  return { url: rawUrl, x: 50, y: 28, scale: 1 };
}

export function applyPortraitFocalPoint(imgEl, rawUrl) {
  if (!imgEl || !rawUrl) return;
  const { url, x, y, scale } = parsePortraitFocalPoint(rawUrl);
  imgEl.src = url;
  imgEl.style.objectPosition = `${x}% ${y}%`;
  if (scale && scale !== 1) {
    imgEl.style.transform = `scale(${scale})`;
  } else {
    imgEl.style.transform = "";
  }
}

export function observeLazyImages(selector = "img[data-src]") {
  const images = Array.from(document.querySelectorAll(selector));
  if (!images.length) {
    return;
  }

  images.forEach((img) => bindSmoothImageLoad(img));

  // Eagerly hydrate the first 4 above-the-fold images so they start downloading immediately
  const eagerCount = Math.min(4, images.length);
  for (let i = 0; i < eagerCount; i++) {
    const img = images[i];
    if (img.dataset.src) {
      img.loading = "eager";
      if (i < 2 && "fetchPriority" in img) {
        img.fetchPriority = "high";
      }
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    }
  }

  const remaining = images.slice(eagerCount);
  if (!remaining.length) {
    return;
  }

  if (!("IntersectionObserver" in window)) {
    remaining.forEach((img) => {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute("data-src");
        }
        observer.unobserve(img);
      });
    },
    {
      rootMargin: "420px 0px"
    }
  );

  remaining.forEach((img) => observer.observe(img));
}

export function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getOptimizedImageUrl(url, width) {
  if (!url) return "";

  const config = window.APP_CONFIG || {};
  if (!config.ENABLE_IMAGE_TRANSFORMATION) {
    return url;
  }

  try {
    const supabaseUrl = config.SUPABASE_URL;
    if (supabaseUrl && url.startsWith(supabaseUrl)) {
      let optimized = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
      if (optimized !== url) {
        const separator = optimized.includes("?") ? "&" : "?";
        optimized = `${optimized}${separator}width=${width}&quality=82`;
        return optimized;
      }
    }
  } catch (err) {
    console.warn("Failed to optimize image URL", err);
  }

  return url;
}

export function createStateMessage(message) {
  const box = document.createElement("div");
  box.className = "state-box";
  box.textContent = message;
  return box;
}

export function createPhotoCard({ title, subtitle, imageUrl, href = "#" }) {
  const card = document.createElement("a");
  card.className = "photo-card reveal-up";
  card.href = href;

  const escapedTitle = escapeHTML(title);
  const escapedSubtitle = escapeHTML(subtitle);
  const escapedImageUrl = escapeHTML(getOptimizedImageUrl(imageUrl, 800));

  card.innerHTML = `
    <div class="photo-media">
      <img data-src="${escapedImageUrl}" alt="${escapedTitle}" loading="lazy" />
    </div>
    <h3 class="photo-title">${escapedTitle}</h3>
    <p class="photo-subtitle">${escapedSubtitle}</p>
  `;

  return card;
}

function getResponsiveColumnCount() {
  if (window.matchMedia("(min-width: 1024px)").matches) {
    return 3;
  }
  if (window.matchMedia("(min-width: 760px)").matches) {
    return 2;
  }
  return 1;
}

export function renderOrderedMasonry(container, items) {
  if (!container) {
    return;
  }

  const nodes = Array.isArray(items) ? items.filter(Boolean) : [];
  const desiredColumns = getResponsiveColumnCount();

  const currentColumns = Number(container.dataset.masonryColumns || "0");
  const sameLayout = currentColumns === desiredColumns;
  if (sameLayout) {
    return;
  }

  container.innerHTML = "";
  container.classList.add("is-ordered-masonry");
  container.dataset.masonryColumns = String(desiredColumns);

  const columns = Array.from({ length: desiredColumns }, () => {
    const column = document.createElement("div");
    column.className = "masonry-column";
    container.appendChild(column);
    return column;
  });

  nodes.forEach((node, index) => {
    const columnIndex = index % desiredColumns;
    columns[columnIndex].appendChild(node);
  });
}

export function setupLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) {
    return;
  }

  const image = lightbox.querySelector("img");
  const close = lightbox.querySelector("button:not([data-lightbox-prev]):not([data-lightbox-next]):not([data-lightbox-pin])");
  const prevButton = lightbox.querySelector("[data-lightbox-prev]");
  const nextButton = lightbox.querySelector("[data-lightbox-next]");
  const pinButton = lightbox.querySelector("[data-lightbox-pin]");
  const counter = lightbox.querySelector(".lightbox-counter");
  let storyBtn = lightbox.querySelector(".lightbox-story-btn");
  if (!storyBtn) {
    storyBtn = document.createElement("a");
    storyBtn.className = "lightbox-story-btn";
    lightbox.appendChild(storyBtn);
  }
  let currentIndex = -1;
  let touchStartX = 0;

  if (pinButton) {
    pinButton.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!image || !image.src) return;
      const pageUrl = encodeURIComponent(window.location.href);
      const imageUrl = encodeURIComponent(image.src);
      const desc = encodeURIComponent(document.title || "Wedding Photography by Oleh Ro");
      const pinUrl = `https://www.pinterest.com/pin/create/button/?url=${pageUrl}&media=${imageUrl}&description=${desc}`;
      window.open(pinUrl, "_blank", "width=600,height=600,scrollbars=yes");
    });
  }

  function getLightboxItems() {
    return Array.from(document.querySelectorAll("[data-lightbox-src]"));
  }

  function renderCurrent(items) {
    if (!items.length || currentIndex < 0 || currentIndex >= items.length) {
      return;
    }

    const trigger = items[currentIndex];
    const src = trigger.getAttribute("data-lightbox-src");
    if (!src) {
      return;
    }

    image.src = src;
    if (counter) {
      counter.textContent = `${currentIndex + 1} / ${items.length}`;
    }

    const storyTitle = trigger.getAttribute("data-story-title");
    const storyUrl = trigger.getAttribute("data-story-url");
    if (storyTitle && storyUrl && storyBtn) {
      storyBtn.href = storyUrl;
      storyBtn.innerHTML = `<span>✦ From "${escapeHTML(storyTitle)}" · View Full Story →</span>`;
      storyBtn.classList.add("is-visible");
    } else if (storyBtn) {
      storyBtn.classList.remove("is-visible");
    }

    const hasMultiple = items.length > 1;
    if (prevButton) {
      prevButton.style.display = hasMultiple ? "inline-block" : "none";
    }
    if (nextButton) {
      nextButton.style.display = hasMultiple ? "inline-block" : "none";
    }
  }

  function shift(delta) {
    const items = getLightboxItems();
    if (!items.length) {
      return;
    }

    currentIndex = (currentIndex + delta + items.length) % items.length;
    renderCurrent(items);
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lightbox-src]");
    if (!trigger) {
      return;
    }

    const items = getLightboxItems();
    const index = items.indexOf(trigger);
    if (index === -1) {
      return;
    }

    currentIndex = index;
    renderCurrent(items);
    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
    
    // Focus trap
    const focusableElements = lightbox.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length) {
      focusableElements[0].focus();
    }
  });

  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    image.src = "";
    if (counter) {
      counter.textContent = "";
    }
    if (storyBtn) {
      storyBtn.classList.remove("is-visible");
    }
    currentIndex = -1;
    document.body.style.overflow = "";
    // Return focus to the body or trigger
    document.body.focus();
  };

  close.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });
  prevButton?.addEventListener("click", () => shift(-1));
  nextButton?.addEventListener("click", () => shift(1));

  lightbox.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0]?.clientX || 0;
  });

  lightbox.addEventListener("touchend", (event) => {
    const endX = event.changedTouches[0]?.clientX || 0;
    const delta = endX - touchStartX;
    if (Math.abs(delta) < 40) {
      return;
    }
    if (delta > 0) {
      shift(-1);
    } else {
      shift(1);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("is-open")) {
      return;
    }
    if (event.key === "Escape") {
      closeLightbox();
    } else if (event.key === "ArrowLeft") {
      shift(-1);
    } else if (event.key === "ArrowRight") {
      shift(1);
    }
  });
}


export function initScrollReveals() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal-up').forEach(el => el.classList.add('is-visible'));
    return;
  }
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        // Animate numbers if they exist
        const counters = entry.target.querySelectorAll('[data-count]');
        counters.forEach(counter => {
          const target = +counter.getAttribute('data-count');
          const duration = 1500;
          const start = performance.now();
          const update = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            counter.textContent = Math.floor(easeProgress * target);
            if (progress < 1) requestAnimationFrame(update);
            else counter.textContent = target;
          };
          requestAnimationFrame(update);
          counter.removeAttribute('data-count'); // ensure it only runs once
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal-up').forEach(el => observer.observe(el));
}

export function initMagneticButtons() {
  const magnets = document.querySelectorAll('.cta');
  
  magnets.forEach((magnet) => {
    magnet.addEventListener('mousemove', (e) => {
      const rect = magnet.getBoundingClientRect();
      const h = rect.width / 2;
      const v = rect.height / 2;
      
      const x = e.clientX - rect.left - h;
      const y = e.clientY - rect.top - v;
      
      magnet.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    });
    
    magnet.addEventListener('mouseleave', () => {
      magnet.style.transform = 'translate(0px, 0px)';
    });
  });
}

export function initParallax() {
  const heroImage = document.querySelector('.hero-media img');
  if (!heroImage) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrolled = window.pageYOffset;
        if (scrolled < window.innerHeight) {
          heroImage.style.transform = `translate3d(0, ${scrolled * 0.3}px, 0) scale(1.05)`;
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

export async function applySiteSettings() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("pricing_content").select("*").eq("id", 1).maybeSingle();
    if (error || !data) {
      return null;
    }

    // Apply navigation visibility
    const links = document.querySelectorAll(".menu-link, .footer-links a");
    links.forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (href.includes("pricing/") && data.show_pricing === false) {
        link.style.display = "none";
      }
      if (href.includes("weddings/") && data.show_weddings === false) {
        link.style.display = "none";
      }
      if (href.includes("portfolio/") && data.show_portfolio === false) {
        link.style.display = "none";
      }
      if (href.includes("about/") && data.show_about === false) {
        link.style.display = "none";
      }
    });

    // Check if the current page should redirect
    const path = window.location.pathname;
    const rootPath = (document.documentElement.dataset.root || ".") + "/";
    if (path.includes("/pricing/") && data.show_pricing === false) {
      window.location.replace(rootPath);
      return data;
    }
    if (path.includes("/weddings/") && data.show_weddings === false) {
      window.location.replace(rootPath);
      return data;
    }
    if (path.includes("/portfolio/") && data.show_portfolio === false) {
      window.location.replace(rootPath);
      return data;
    }
    if (path.includes("/about/") && data.show_about === false) {
      window.location.replace(rootPath);
      return data;
    }

    // Dynamic Title & Description for public Homepage
    const isSubdirectory = path.includes("/pricing/") || path.includes("/weddings/") || path.includes("/portfolio/") || path.includes("/about/") || path.includes("/locations/") || path.includes("/legal/");
    if (!isSubdirectory) {
      if (data.homepage_title) {
        document.title = data.homepage_title;
      }
      const descMeta = document.querySelector('meta[name="description"]');
      if (descMeta && data.homepage_description) {
        descMeta.content = data.homepage_description;
      }
    }

    window.SITE_SETTINGS = data;
    document.dispatchEvent(new CustomEvent("settingsloaded", { detail: data }));
    return data;
  } catch (err) {
    console.warn("Failed to apply site settings", err);
    return null;
  }
}

export function initRackFocusReveal() {
  const cards = document.querySelectorAll('.polaroid-luxury');
  if (!cards.length) return;

  if (!('IntersectionObserver' in window)) {
    cards.forEach(card => card.classList.add('in-focus'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-focus');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.01, rootMargin: '0px 0px 100px 0px' });

  cards.forEach(card => {
    observer.observe(card);
    // Failsafe: if intersection observer doesn't trigger within 1.5s, force show
    setTimeout(() => {
      card.classList.add('in-focus');
    }, 1500);
  });
}

export function initWordReveal() {
  const quoteEl = document.querySelector('.section-quote h2');
  if (!quoteEl) return;

  const text = quoteEl.textContent.trim();
  const words = text.split(/\s+/);
  
  quoteEl.innerHTML = words
    .map((word, index) => `<span class="reveal-word" style="--word-index: ${index}">${word}</span>`)
    .join(' ');

  if (!('IntersectionObserver' in window)) {
    quoteEl.querySelectorAll('.reveal-word').forEach(span => span.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        quoteEl.querySelectorAll('.reveal-word').forEach(span => {
          span.classList.add('is-revealed');
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -50px 0px' });

  observer.observe(quoteEl);
}

// Auto-run when DOM content is loaded
if (typeof window !== "undefined" && !document.body?.classList.contains("admin-page")) {
  document.addEventListener("DOMContentLoaded", () => {
    applySiteSettings();
  });
}

export function initTiltEffect() {
  const cards = document.querySelectorAll('.photo-card');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      card.style.transition = 'transform 0.1s ease-out';
      card.style.zIndex = '10';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      card.style.transition = 'transform 0.5s var(--motion-ease)';
      card.style.zIndex = '1';
    });
  });
}

export function initCustomCursor() {
  // Only initialize on non-touch desktop devices with a fine pointer
  if (
    window.matchMedia("(pointer: coarse)").matches ||
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches
  ) {
    return;
  }

  // Singleton guard so calling initCustomCursor multiple times never duplicates the node
  if (document.querySelector(".gallery-cursor")) {
    return;
  }

  const cursor = document.createElement("div");
  cursor.className = "gallery-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = `<span class="gallery-cursor-label">View</span>`;
  document.body.appendChild(cursor);

  const CARD_SELECTOR = ".photo-card, .polaroid-luxury, .album-card, .masonry-item, .editorial-spread-item";
  const EXCLUDE_SELECTOR = ".portfolio-story-badge, button, .lightbox, .site-header, .floating-cta";

  let mouseX = -100;
  let mouseY = -100;
  let cursorX = -100;
  let cursorY = -100;
  let hasMoved = false;
  let activeCard = null;

  const setActiveCard = (card) => {
    if (activeCard === card) return;
    if (activeCard) {
      activeCard.classList.remove("hide-default-cursor");
    }
    activeCard = card;
    if (activeCard) {
      activeCard.classList.add("hide-default-cursor");
      cursor.classList.add("is-active");
    } else {
      cursor.classList.remove("is-active");
    }
  };

  const evaluateTarget = (target) => {
    const lightbox = document.getElementById("lightbox");
    if (!target || !(target instanceof Element) || (lightbox && lightbox.classList.contains("is-open"))) {
      setActiveCard(null);
      return;
    }
    if (target.closest(EXCLUDE_SELECTOR)) {
      setActiveCard(null);
      return;
    }
    const card = target.closest(CARD_SELECTOR);
    setActiveCard(card || null);
  };

  document.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") {
        setActiveCard(null);
        return;
      }
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!hasMoved) {
        cursorX = mouseX;
        cursorY = mouseY;
        hasMoved = true;
      }
      evaluateTarget(e.target);
    },
    { passive: true }
  );

  document.addEventListener(
    "mouseover",
    (e) => {
      evaluateTarget(e.target);
    },
    { passive: true }
  );

  document.addEventListener(
    "mousedown",
    () => {
      cursor.classList.add("is-pressed");
    },
    { passive: true }
  );

  document.addEventListener(
    "mouseup",
    () => {
      cursor.classList.remove("is-pressed");
      // Re-evaluate in case lightbox opened on click
      setTimeout(() => {
        const lightbox = document.getElementById("lightbox");
        if (lightbox && lightbox.classList.contains("is-open")) {
          setActiveCard(null);
        }
      }, 20);
    },
    { passive: true }
  );

  document.addEventListener("mouseleave", () => {
    setActiveCard(null);
  });

  window.addEventListener(
    "scroll",
    () => {
      if (!hasMoved) return;
      const elUnderPointer = document.elementFromPoint(mouseX, mouseY);
      evaluateTarget(elUnderPointer);
    },
    { passive: true }
  );

  const updateCursor = () => {
    if (hasMoved) {
      cursorX += (mouseX - cursorX) * 0.22;
      cursorY += (mouseY - cursorY) * 0.22;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
    }
    requestAnimationFrame(updateCursor);
  };
  requestAnimationFrame(updateCursor);
}

export function initSmartHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
  let ticking = false;

  const onScroll = () => {
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Add glass background once scrolled past top
    if (currentScrollY > 15) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }

    // Auto-hide when scrolling down past hero, auto-reveal on scroll up
    if (currentScrollY > 100) {
      if (currentScrollY > lastScrollY + 6) {
        // Scrolling DOWN
        header.classList.add('is-hidden');
      } else if (currentScrollY < lastScrollY - 6) {
        // Scrolling UP
        header.classList.remove('is-hidden');
      }
    } else {
      header.classList.remove('is-hidden');
    }

    lastScrollY = Math.max(0, currentScrollY);
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
}


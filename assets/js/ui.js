import { getSupabase } from "./supabase-client.js";

export function observeLazyImages(selector = "img[data-src]") {
  const images = Array.from(document.querySelectorAll(selector));
  if (!images.length) {
    return;
  }

  if (!("IntersectionObserver" in window)) {
    images.forEach((img) => {
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
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
        observer.unobserve(img);
      });
    },
    {
      rootMargin: "250px 0px"
    }
  );

  images.forEach((img) => observer.observe(img));
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
  const close = lightbox.querySelector("button:not([data-lightbox-prev]):not([data-lightbox-next])");
  const prevButton = lightbox.querySelector("[data-lightbox-prev]");
  const nextButton = lightbox.querySelector("[data-lightbox-next]");
  const counter = lightbox.querySelector(".lightbox-counter");
  let currentIndex = -1;
  let touchStartX = 0;

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
    if (path.includes("/pricing/") && data.show_pricing === false) {
      window.location.replace((document.documentElement.dataset.root || ".") + "/index.html");
      return data;
    }
    if (path.includes("/weddings/") && data.show_weddings === false) {
      window.location.replace((document.documentElement.dataset.root || ".") + "/index.html");
      return data;
    }
    if (path.includes("/portfolio/") && data.show_portfolio === false) {
      window.location.replace((document.documentElement.dataset.root || ".") + "/index.html");
      return data;
    }
    if (path.includes("/about/") && data.show_about === false) {
      window.location.replace((document.documentElement.dataset.root || ".") + "/index.html");
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

// Auto-run when DOM content is loaded
if (typeof window !== "undefined" && !document.body?.classList.contains("admin-page")) {
  document.addEventListener("DOMContentLoaded", () => {
    applySiteSettings();
  });
}

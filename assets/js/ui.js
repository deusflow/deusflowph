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

export function createStateMessage(message) {
  const box = document.createElement("div");
  box.className = "state-box";
  box.textContent = message;
  return box;
}

export function createPhotoCard({ title, subtitle, imageUrl, href = "#" }) {
  const card = document.createElement("a");
  card.className = "photo-card";
  card.href = href;

  card.innerHTML = `
    <div class="photo-media">
      <img data-src="${imageUrl}" alt="${title}" loading="lazy" />
    </div>
    <h3 class="photo-title">${title}</h3>
    <p class="photo-subtitle">${subtitle || ""}</p>
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
  });

  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    image.src = "";
    if (counter) {
      counter.textContent = "";
    }
    currentIndex = -1;
    document.body.style.overflow = "";
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


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

export function setupLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) {
    return;
  }

  const image = lightbox.querySelector("img");
  const close = lightbox.querySelector("button");

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lightbox-src]");
    if (!trigger) {
      return;
    }

    const src = trigger.getAttribute("data-lightbox-src");
    if (!src) {
      return;
    }

    image.src = src;
    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
  });

  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    image.src = "";
    document.body.style.overflow = "";
  };

  close.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }
  });
}


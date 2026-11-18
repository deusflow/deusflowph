import {
  observeLazyImages,
  initScrollReveals,
  escapeHTML,
  getOptimizedImageUrl,
  initRackFocusReveal,
  initCustomCursor,
  initSmartHeader
} from "./ui.js?v=20261105-1";
import { fetchFeaturedAlbums, fetchAlbumFallbackCover } from "./services/api.js";

const featuredGrid = document.getElementById("location-featured-grid");
const featuredSection = document.getElementById("location-featured");

async function loadLocationStories() {
  if (!featuredGrid || !featuredSection) {
    return;
  }

  try {
    const albums = await fetchFeaturedAlbums(3);
    if (!albums || albums.length === 0) {
      featuredSection.style.display = "none";
      return;
    }

    for (const album of albums) {
      let imageUrl = album.cover_url;
      if (!imageUrl) {
        imageUrl = await fetchAlbumFallbackCover(album.id);
        if (!imageUrl) continue;
      }

      const card = document.createElement("a");
      card.className = "photo-card polaroid-luxury";
      card.href = `../../weddings/album/?slug=${encodeURIComponent(album.slug)}`;

      const escapedTitle = escapeHTML(album.title);
      const escapedImgUrl = escapeHTML(getOptimizedImageUrl(imageUrl, 800));
      const escapedAlt = escapeHTML(`${album.title} - wedding story by Oleh Ro`);

      card.innerHTML = `
        <div class="polaroid-inner">
          <div class="photo-media">
            <img data-src="${escapedImgUrl}" alt="${escapedAlt}" loading="lazy" decoding="async" />
          </div>
          <div class="polaroid-footer">
            <h3 class="photo-title">${escapedTitle}</h3>
          </div>
        </div>
      `;
      featuredGrid.appendChild(card);
    }

    if (!featuredGrid.children.length) {
      featuredSection.style.display = "none";
      return;
    }

    observeLazyImages();
    initRackFocusReveal();
  } catch (_error) {
    featuredSection.style.display = "none";
  }
}

initCustomCursor();
initSmartHeader();
loadLocationStories().then(() => {
  initScrollReveals();
  if (typeof window.applyTranslations === "function") {
    window.applyTranslations();
  }
});

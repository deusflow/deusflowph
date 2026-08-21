import { getSupabase } from "./supabase-client.js";
import { observeLazyImages, createStateMessage, renderOrderedMasonry, initScrollReveals, setupLightbox, escapeHTML, getOptimizedImageUrl } from "./ui.js?v=20260820-13";

const grid = document.getElementById("portfolio-grid");
let portfolioNodes = [];
let masonryResizeBound = false;

function bindMasonryResize() {
  if (masonryResizeBound || !grid) {
    return;
  }

  masonryResizeBound = true;
  let rafId = 0;

  window.addEventListener("resize", () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
    rafId = window.requestAnimationFrame(() => {
      renderOrderedMasonry(grid, portfolioNodes);
    });
  });
}

function buildPortfolioAlt(index) {
  return `Wedding portfolio photo in Denmark by Oleh Ro, image ${index + 1}`;
}

function getStoryUrl(slug) {
  const isDa = window.location.pathname.includes("/da/");
  const isUk = window.location.pathname.includes("/uk/");
  const langPrefix = isDa ? "/da" : (isUk ? "/uk" : "");
  return `${langPrefix}/weddings/album/?slug=${encodeURIComponent(slug)}`;
}

async function renderPortfolio() {
  if (!grid) {
    return;
  }

  try {
    const supabase = getSupabase();

    let { data: albums, error: albumsError } = await supabase
      .from("albums")
      .select("id, title")
      .eq("slug", "portfolio-main")
      .eq("visible", true)
      .eq("type", "portfolio")
      .limit(1);

    if (!albumsError && (!albums || albums.length === 0)) {
      const fallback = await supabase
        .from("albums")
        .select("id, title")
        .eq("visible", true)
        .eq("type", "portfolio")
        .order("created_at", { ascending: false })
        .limit(1);
      albums = fallback.data;
      albumsError = fallback.error;
    }

    if (albumsError) {
      throw albumsError;
    }

    if (!albums || albums.length === 0) {
      grid.appendChild(createStateMessage("No public portfolio album found. Open /admin and create/publish portfolio-main."));
      return;
    }

    const albumId = albums[0].id;

    // Fetch photos and wedding albums in parallel
    const [photosRes, weddingAlbumsRes] = await Promise.all([
      supabase
        .from("photos")
        .select("id, url, linked_album_id")
        .eq("album_id", albumId)
        .order("display_order", { ascending: true }),
      supabase
        .from("albums")
        .select("id, title, slug")
        .eq("type", "wedding")
    ]);

    let photos = photosRes.data;
    if (photosRes.error) {
      console.warn("Retrying portfolio photos fetch without linked_album_id:", photosRes.error.message);
      const retryRes = await supabase
        .from("photos")
        .select("id, url")
        .eq("album_id", albumId)
        .order("display_order", { ascending: true });

      if (retryRes.error) {
        throw retryRes.error;
      }
      photos = retryRes.data;
    }

    if (!photos || photos.length === 0) {
      grid.appendChild(createStateMessage("This portfolio album has no photos yet."));
      return;
    }

    const weddingMap = new Map();
    if (weddingAlbumsRes.data) {
      weddingAlbumsRes.data.forEach((w) => {
        weddingMap.set(w.id, { title: w.title, slug: w.slug });
      });
    }

    const nodes = [];
    photos.forEach((photo, index) => {
      const item = document.createElement("article");
      item.className = "photo-card reveal-up";
      const escapedUrl = escapeHTML(getOptimizedImageUrl(photo.url, 800));
      const escapedOriginalUrl = escapeHTML(photo.url);

      const linkedWedding = photo.linked_album_id ? weddingMap.get(photo.linked_album_id) : null;
      let storyBadgeHtml = "";
      let storyDataAttrs = "";

      if (linkedWedding && linkedWedding.slug) {
        const storyUrl = getStoryUrl(linkedWedding.slug);
        const storyTitle = linkedWedding.title || "Wedding Story";
        storyDataAttrs = `data-story-title="${escapeHTML(storyTitle)}" data-story-url="${escapeHTML(storyUrl)}"`;
        storyBadgeHtml = `
          <a class="portfolio-story-badge" href="${escapeHTML(storyUrl)}" title="View full wedding story: ${escapeHTML(storyTitle)}" onclick="event.stopPropagation();">
            <span class="badge-icon">✦</span>
            <span>${escapeHTML(storyTitle)} →</span>
          </a>
        `;
      }

      item.innerHTML = `
        <div class="photo-media" style="cursor: zoom-in;">
          <img data-src="${escapedUrl}" data-lightbox-src="${escapedOriginalUrl}" ${storyDataAttrs} alt="${buildPortfolioAlt(index)}" loading="lazy" decoding="async" />
          ${storyBadgeHtml}
        </div>
      `;
      nodes.push(item);
    });

    portfolioNodes = nodes;
    renderOrderedMasonry(grid, portfolioNodes);
    bindMasonryResize();
    observeLazyImages();
  } catch (error) {
    grid.innerHTML = "";
    grid.appendChild(createStateMessage(`Could not load portfolio. ${error.message}`));
  }
}

renderPortfolio().then(() => {
  initScrollReveals();
  setupLightbox();
});

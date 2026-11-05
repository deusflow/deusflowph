import { getSupabase } from "./supabase-client.js";
import { observeLazyImages, createStateMessage, renderOrderedMasonry, initScrollReveals, setupLightbox, escapeHTML, getOptimizedImageUrl, initCustomCursor, initSmartHeader } from "./ui.js?v=20261105-1";

const grid = document.getElementById("portfolio-grid");
let portfolioNodes = [];
let masonryResizeBound = false;

// Verified byte-identical (ETag) matches between portfolio-main photos and published Wedding Stories
const FALLBACK_STORY_LINKS = {
  "77c829f9-066e-4f64-bb7e-ca5f3060644d": "2ec564d5-9286-4180-849d-ed0acf288662",
  "767a19c6-3089-4095-9a07-af201cabad98": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "aaef6a7b-fce3-4f20-a28d-33e2fc5048db": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "c5519f83-6b78-49fc-8f25-2a42311632d4": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "d6105f8a-77f8-4a05-b40e-ff468c74293d": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "6e565476-4df6-4dff-9321-702fd36b9c07": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "e4048a99-05bc-4586-a738-689a0237eab3": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "be999668-3364-421c-9839-d20793e61b74": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "f30e9ffb-6107-4370-8770-940a6fb064d1": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "dd359c80-aa32-4daa-a77c-d45eed227076": "24e23176-d33f-4de5-80e8-9af18f59677a",
  "7ac03e54-68e4-43bf-a4c8-22a4fb284922": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "1a444095-9842-4498-ba19-bf73d3d92d8f": "c2d0be82-63f6-4918-82ed-c8e00ea27221",
  "5d989fcb-cc51-41d8-b462-f66fd29ef801": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "812532af-c4bf-4344-938d-7d45b9973a5b": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "3acc4849-a7e6-4b47-8a7d-165539708475": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "57eb4c41-667d-46f0-ad6f-269f9813a0d6": "a05705e4-9315-4bcf-8324-fd393dc28a20",
  "866ce8da-ab3f-4420-b633-bdb72ed64132": "a05705e4-9315-4bcf-8324-fd393dc28a20"
};

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

      const resolvedAlbumId = photo.linked_album_id || FALLBACK_STORY_LINKS[photo.id] || null;
      const linkedWedding = resolvedAlbumId ? weddingMap.get(resolvedAlbumId) : null;
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
        <div class="photo-media">
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

initCustomCursor();
initSmartHeader();
renderPortfolio().then(() => {
  initScrollReveals();
  setupLightbox();
});

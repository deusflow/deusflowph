import { getSupabase, formatDate } from "./supabase-client.js";
import { observeLazyImages, createStateMessage, setupLightbox, initScrollReveals, escapeHTML, getOptimizedImageUrl, initCustomCursor, initSmartHeader } from "./ui.js?v=20260820-13";

const titleNode = document.getElementById("album-title");
const metaNode = document.getElementById("album-meta");
const descriptionNode = document.getElementById("album-description");
const grid = document.getElementById("album-grid");
const storyNav = document.getElementById("album-story-nav");

function buildAlbumPhotoAlt(album, index) {
  const title = String(album?.title || "Wedding story").trim();
  return `${title} - wedding photography in Denmark, photo ${index + 1}`;
}

function formatFrameNumber(index) {
  return String(index + 1).padStart(2, "0");
}

function createSpreadItem(photo, album, index) {
  const item = document.createElement("figure");
  item.className = "editorial-spread-item reveal-up";
  const escapedUrl = escapeHTML(getOptimizedImageUrl(photo.url, 1400));
  const escapedOriginalUrl = escapeHTML(photo.url);
  const escapedAlt = escapeHTML(buildAlbumPhotoAlt(album, index));
  const frameNum = formatFrameNumber(index);

  item.innerHTML = `
    <div class="editorial-frame-media">
      <img data-src="${escapedUrl}" data-lightbox-src="${escapedOriginalUrl}" alt="${escapedAlt}" loading="lazy" decoding="async" />
      <span class="editorial-frame-num" aria-hidden="true">${frameNum}</span>
    </div>
  `;

  const img = item.querySelector("img");
  if (img) {
    const classifyOrientation = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      if (ratio >= 1.15) {
        item.classList.add("is-landscape");
      } else if (ratio <= 0.88) {
        item.classList.add("is-portrait");
      } else {
        item.classList.add("is-square");
      }
    };
    if (img.complete && img.naturalWidth > 0) {
      classifyOrientation();
    } else {
      img.addEventListener("load", classifyOrientation, { once: true });
    }
  }

  return item;
}

function renderEditorialSpread(container, photos, album) {
  if (!container) return;
  container.innerHTML = "";
  container.classList.remove("masonry", "is-ordered-masonry");
  container.classList.add("editorial-spread-gallery");

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  let spreadCycle = 0;

  // Curated magazine spread pattern:
  // 0: Hero Centerpiece (1 frame)
  // 1: Editorial Diptych (2 frames)
  // 2: Narrative Triptych (3 frames)
  // 3: Asymmetric Spread Left-Heavy (2 frames)
  // 4: Editorial Diptych Offset (2 frames)
  // 5: Asymmetric Spread Right-Heavy (2 frames)
  const PATTERN = [
    { type: "spread-row-hero", count: 1 },
    { type: "spread-row-diptych", count: 2 },
    { type: "spread-row-triptych", count: 3 },
    { type: "spread-row-asymmetric is-left-lead", count: 2 },
    { type: "spread-row-diptych is-offset", count: 2 },
    { type: "spread-row-asymmetric is-right-lead", count: 2 }
  ];

  while (cursor < photos.length) {
    const step = PATTERN[spreadCycle % PATTERN.length];
    const remaining = photos.length - cursor;
    const take = Math.min(step.count, remaining);

    const row = document.createElement("div");
    let rowClass = `editorial-spread-row ${step.type}`;
    if (take === 1 && step.count > 1) {
      rowClass = "editorial-spread-row spread-row-hero";
    } else if (take === 2 && step.count === 3) {
      rowClass = "editorial-spread-row spread-row-diptych";
    }
    row.className = rowClass;

    for (let i = 0; i < take; i++) {
      const photoIndex = cursor + i;
      const itemNode = createSpreadItem(photos[photoIndex], album, photoIndex);
      row.appendChild(itemNode);
    }

    fragment.appendChild(row);
    cursor += take;
    spreadCycle += 1;
  }

  container.appendChild(fragment);
}

function renderAlbumSchema(album, photos) {
  const existing = document.getElementById("album-schema");
  if (existing) {
    existing.remove();
  }

  const pageUrl = window.location.href;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ImageGallery",
        "@id": `${pageUrl}#gallery`,
        name: `${album.title} Wedding Gallery`,
        description: album.description || `Wedding story by Oleh Ro: ${album.title}`,
        url: pageUrl,
        creator: {
          "@type": "Person",
          name: "Oleh Ro"
        },
        associatedMedia: photos.map((photo, index) => ({
          "@type": "ImageObject",
          contentUrl: photo.url,
          name: buildAlbumPhotoAlt(album, index)
        }))
      },
      ...photos.map((photo, index) => ({
        "@type": "Photograph",
        "@id": `${pageUrl}#photo-${index + 1}`,
        name: buildAlbumPhotoAlt(album, index),
        image: photo.url,
        contentUrl: photo.url,
        creator: {
          "@type": "Person",
          name: "Oleh Ro"
        },
        isPartOf: {
          "@id": `${pageUrl}#gallery`
        }
      }))
    ]
  };

  const script = document.createElement("script");
  script.id = "album-schema";
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(graph);
  document.head.appendChild(script);
}

function getDisplayOrderValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.MAX_SAFE_INTEGER;
}

function renderStoryNavigation(currentSlug, albums) {
  if (!storyNav || !albums || albums.length < 2) {
    return;
  }

  const currentIndex = albums.findIndex((item) => item.slug === currentSlug);
  if (currentIndex === -1) {
    return;
  }

  const prevAlbum = albums[currentIndex - 1] || null;
  const nextAlbum = albums[currentIndex + 1] || null;
  if (!prevAlbum && !nextAlbum) {
    return;
  }

  storyNav.classList.remove("hidden");
  storyNav.classList.toggle("story-nav-single", Boolean(prevAlbum) !== Boolean(nextAlbum));
  storyNav.innerHTML = "";

  if (prevAlbum) {
    const prevLink = document.createElement("a");
    prevLink.className = "story-nav-link";
    prevLink.href = `?slug=${encodeURIComponent(prevAlbum.slug)}`;
    const escapedPrevTitle = escapeHTML(prevAlbum.title);
    prevLink.innerHTML = `
      <span class="story-nav-label">Previous story</span>
      <span class="story-nav-title">${escapedPrevTitle}</span>
    `;
    storyNav.appendChild(prevLink);
  }

  if (nextAlbum) {
    const nextLink = document.createElement("a");
    nextLink.className = "story-nav-link";
    nextLink.href = `?slug=${encodeURIComponent(nextAlbum.slug)}`;
    const escapedNextTitle = escapeHTML(nextAlbum.title);
    nextLink.innerHTML = `
      <span class="story-nav-label">Next story</span>
      <span class="story-nav-title">${escapedNextTitle}</span>
    `;
    storyNav.appendChild(nextLink);
  }
}


function getSlugFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

async function renderAlbum() {
  const slug = getSlugFromURL();
  if (!slug) {
    grid.appendChild(createStateMessage("Album slug is missing."));
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: album, error: albumError } = await supabase
      .from("albums")
      .select("id, slug, title, description, date, visible")
      .eq("slug", slug)
      .eq("visible", true)
      .single();

    if (albumError || !album) {
      throw albumError || new Error("Album not found.");
    }

    titleNode.textContent = album.title;
    metaNode.textContent = formatDate(album.date);
    if (descriptionNode) {
      if (album.description && album.description.trim()) {
        descriptionNode.textContent = album.description;
        descriptionNode.style.display = "block";
      } else {
        descriptionNode.textContent = "";
        descriptionNode.style.display = "none";
      }
    }

    const { data: photos, error: photosError } = await supabase
      .from("photos")
      .select("url, display_order, created_at")
      .eq("album_id", album.id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (photosError) {
      throw photosError;
    }

    if (!photos || photos.length === 0) {
      grid.appendChild(createStateMessage("This album has no photos yet."));
      return;
    }

    metaNode.textContent = `${formatDate(album.date)}  ·  ${photos.length} Editorial Frames`;

    let { data: visibleAlbums, error: listError } = await supabase
      .from("albums")
      .select("slug, title, date, display_order, created_at")
      .eq("visible", true)
      .eq("type", "wedding")
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (listError && String(listError.message || "").includes("display_order")) {
      const fallback = await supabase
        .from("albums")
        .select("slug, title, date, created_at")
        .eq("visible", true)
        .eq("type", "wedding")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      visibleAlbums = fallback.data;
      listError = fallback.error;
    }

    if (!listError && Array.isArray(visibleAlbums)) {
      const normalized = visibleAlbums.slice().sort((a, b) => {
        const byOrder = getDisplayOrderValue(a.display_order) - getDisplayOrderValue(b.display_order);
        if (byOrder !== 0) {
          return byOrder;
        }
        const byDate = String(b.date || "").localeCompare(String(a.date || ""));
        if (byDate !== 0) {
          return byDate;
        }
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
      renderStoryNavigation(album.slug, normalized);
    }

    renderEditorialSpread(grid, photos, album);
    renderAlbumSchema(album, photos);
    observeLazyImages();
    initScrollReveals();
  } catch (error) {
    grid.innerHTML = "";
    grid.appendChild(createStateMessage(`Could not load album. ${error.message}`));
  }
}

initCustomCursor();
initSmartHeader();
setupLightbox();
renderAlbum();


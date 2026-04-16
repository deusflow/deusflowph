import { getSupabase, formatDate } from "./supabase-client.js";
import { observeLazyImages, createStateMessage, setupLightbox } from "./ui.js";

const titleNode = document.getElementById("album-title");
const metaNode = document.getElementById("album-meta");
const grid = document.getElementById("album-grid");

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
      .select("id, title, date, visible")
      .eq("slug", slug)
      .eq("visible", true)
      .single();

    if (albumError || !album) {
      throw albumError || new Error("Album not found.");
    }

    titleNode.textContent = album.title;
    metaNode.textContent = formatDate(album.date);

    const { data: photos, error: photosError } = await supabase
      .from("photos")
      .select("url")
      .eq("album_id", album.id)
      .order("display_order", { ascending: true });

    if (photosError) {
      throw photosError;
    }

    if (!photos || photos.length === 0) {
      grid.appendChild(createStateMessage("This album has no photos yet."));
      return;
    }

    const fragment = document.createDocumentFragment();
    photos.forEach((photo, index) => {
      const item = document.createElement("article");
      item.className = "masonry-item";
      item.innerHTML = `<img data-src="${photo.url}" data-lightbox-src="${photo.url}" alt="${album.title} photo ${index + 1}" loading="lazy" />`;
      fragment.appendChild(item);
    });

    grid.appendChild(fragment);
    observeLazyImages();
  } catch (error) {
    grid.innerHTML = "";
    grid.appendChild(createStateMessage(`Could not load album. ${error.message}`));
  }
}

setupLightbox();
renderAlbum();


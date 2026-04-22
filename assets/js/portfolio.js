import { getSupabase } from "./supabase-client.js";
import { observeLazyImages, createStateMessage } from "./ui.js";

const grid = document.getElementById("portfolio-grid");

function buildPortfolioAlt(index) {
  return `Wedding portfolio photo in Denmark by Oleh Ro, image ${index + 1}`;
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

    const { data: photos, error: photosError } = await supabase
      .from("photos")
      .select("url")
      .eq("album_id", albumId)
      .order("display_order", { ascending: true });

    if (photosError) {
      throw photosError;
    }

    if (!photos || photos.length === 0) {
      grid.appendChild(createStateMessage("This portfolio album has no photos yet."));
      return;
    }

    const fragment = document.createDocumentFragment();
    photos.forEach((photo, index) => {
      const item = document.createElement("article");
      item.className = "photo-card";
      item.innerHTML = `
        <div class="photo-media">
          <img data-src="${photo.url}" alt="${buildPortfolioAlt(index)}" loading="lazy" />
        </div>
      `;
      fragment.appendChild(item);
    });

    grid.appendChild(fragment);
    observeLazyImages();
  } catch (error) {
    grid.innerHTML = "";
    grid.appendChild(createStateMessage(`Could not load portfolio. ${error.message}`));
  }
}

renderPortfolio();


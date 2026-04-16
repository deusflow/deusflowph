import { getSupabase } from "./supabase-client.js";
import { observeLazyImages, createStateMessage } from "./ui.js";

const grid = document.getElementById("portfolio-grid");

async function renderPortfolio() {
  if (!grid) {
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: albums, error: albumsError } = await supabase
      .from("albums")
      .select("id, title")
      .eq("visible", true)
      .eq("type", "portfolio")
      .order("created_at", { ascending: true })
      .limit(1);

    if (albumsError) {
      throw albumsError;
    }

    if (!albums || albums.length === 0) {
      grid.appendChild(createStateMessage("No public portfolio album found. Create one from /admin."));
      return;
    }

    const albumId = albums[0].id;

    const { data: photos, error: photosError } = await supabase
      .from("photos")
      .select("url")
      .eq("album_id", albumId)
      .order("display_order", { ascending: true })
      .limit(30);

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
          <img data-src="${photo.url}" alt="Portfolio photo ${index + 1}" loading="lazy" />
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


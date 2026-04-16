import { getSupabase } from "./supabase-client.js";
import { observeLazyImages, createStateMessage } from "./ui.js";

const featuredGrid = document.getElementById("featured-grid");

async function loadFeatured() {
  if (!featuredGrid) {
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: albums, error: albumError } = await supabase
      .from("albums")
      .select("id, title, date")
      .eq("visible", true)
      .eq("type", "wedding")
      .order("date", { ascending: false })
      .limit(3);

    if (albumError) {
      throw albumError;
    }

    if (!albums || albums.length === 0) {
      featuredGrid.appendChild(createStateMessage("No wedding albums published yet."));
      return;
    }

    for (const album of albums) {
      const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select("url")
        .eq("album_id", album.id)
        .order("display_order", { ascending: true })
        .limit(1);

      if (photosError) {
        throw photosError;
      }

      if (!photos || photos.length === 0) {
        continue;
      }

      const card = document.createElement("a");
      card.className = "photo-card";
      card.href = `weddings/album/index.html?slug=${encodeURIComponent(album.title.toLowerCase().replace(/\s+/g, "-"))}`;
      card.innerHTML = `
        <div class="photo-media">
          <img data-src="${photos[0].url}" alt="${album.title}" loading="lazy" />
        </div>
        <h3 class="photo-title">${album.title}</h3>
      `;
      featuredGrid.appendChild(card);
    }

    if (!featuredGrid.children.length) {
      featuredGrid.appendChild(createStateMessage("Albums are published, but no photos are attached yet."));
    }

    observeLazyImages();
  } catch (error) {
    featuredGrid.innerHTML = "";
    featuredGrid.appendChild(createStateMessage(`Could not load featured stories. ${error.message}`));
  }
}

loadFeatured();


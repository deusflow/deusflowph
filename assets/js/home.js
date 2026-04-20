import { getSupabase } from "./supabase-client.js";
import { observeLazyImages, createStateMessage } from "./ui.js";

const featuredGrid = document.getElementById("featured-grid");
const heroImage = document.getElementById("hero-image");

function applyHeroImageFromConfig() {
  if (!heroImage || !window.APP_CONFIG || !window.APP_CONFIG.HERO_IMAGE_URL) {
    return;
  }

  heroImage.src = window.APP_CONFIG.HERO_IMAGE_URL;
}

async function loadFeatured() {
  if (!featuredGrid) {
    return;
  }

  try {
    const supabase = getSupabase();

    let { data: albums, error: albumError } = await supabase
      .from("albums")
      .select("id, slug, title, cover_url, date, display_order, created_at")
      .eq("visible", true)
      .eq("type", "wedding")
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3);

    if (albumError && String(albumError.message || "").includes("display_order")) {
      const fallback = await supabase
        .from("albums")
        .select("id, slug, title, cover_url, date")
        .eq("visible", true)
        .eq("type", "wedding")
        .order("date", { ascending: false })
        .limit(3);
      albums = fallback.data;
      albumError = fallback.error;
    }

    if (albumError) {
      throw albumError;
    }

    if (!albums || albums.length === 0) {
      featuredGrid.appendChild(createStateMessage("No wedding albums published yet."));
      return;
    }

    for (const album of albums) {
      let imageUrl = album.cover_url;

      // Backward compatibility for albums created before cover_url was set.
      if (!imageUrl) {
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

        imageUrl = photos[0].url;
      }

      const card = document.createElement("a");
      card.className = "photo-card";
      card.href = `weddings/album/index.html?slug=${encodeURIComponent(album.slug)}`;
      card.innerHTML = `
        <div class="photo-media">
          <img data-src="${imageUrl}" alt="${album.title}" loading="lazy" />
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

applyHeroImageFromConfig();
loadFeatured();

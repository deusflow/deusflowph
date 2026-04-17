import { getSupabase } from "./supabase-client.js";
import { observeLazyImages, createStateMessage, renderOrderedMasonry } from "./ui.js";

const grid = document.getElementById("portfolio-grid");
let portfolioItems = [];
let masonryResizeTimer = null;

function applyPortfolioMasonry() {
  if (!grid || !portfolioItems.length) {
    return;
  }
  renderOrderedMasonry(grid, portfolioItems);
}

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
      .order("created_at", { ascending: false })
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
      .order("display_order", { ascending: true });

    if (photosError) {
      throw photosError;
    }

    if (!photos || photos.length === 0) {
      grid.appendChild(createStateMessage("This portfolio album has no photos yet."));
      return;
    }

    portfolioItems = photos.map((photo, index) => {
      const item = document.createElement("article");
      item.className = "photo-card";
      item.innerHTML = `
        <div class="photo-media">
          <img data-src="${photo.url}" alt="Portfolio photo ${index + 1}" loading="lazy" />
        </div>
      `;
      return item;
    });

    applyPortfolioMasonry();
    observeLazyImages();

    window.addEventListener("resize", () => {
      clearTimeout(masonryResizeTimer);
      masonryResizeTimer = setTimeout(applyPortfolioMasonry, 120);
    });
  } catch (error) {
    grid.innerHTML = "";
    grid.appendChild(createStateMessage(`Could not load portfolio. ${error.message}`));
  }
}

renderPortfolio();


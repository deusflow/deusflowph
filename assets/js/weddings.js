import { getSupabase, formatDate } from "./supabase-client.js";
import { observeLazyImages, createStateMessage, initScrollReveals, escapeHTML, getOptimizedImageUrl } from "./ui.js";

const list = document.getElementById("weddings-grid");

function buildWeddingCoverAlt(album) {
  const title = String(album?.title || "Wedding story").trim();
  return `${title} - wedding photographer in Denmark`;
}

async function renderWeddings() {
  if (!list) {
    return;
  }

  try {
    const supabase = getSupabase();
    let { data: albums, error } = await supabase
      .from("albums")
      .select("slug, title, description, cover_url, date, display_order, created_at")
      .eq("visible", true)
      .eq("type", "wedding")
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error && String(error.message || "").includes("display_order")) {
      const fallback = await supabase
        .from("albums")
        .select("slug, title, description, cover_url, date")
        .eq("visible", true)
        .eq("type", "wedding")
        .order("date", { ascending: false });
      albums = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw error;
    }

    if (!albums || albums.length === 0) {
      list.appendChild(createStateMessage("No wedding stories published yet."));
      return;
    }

    const fragment = document.createDocumentFragment();
    albums.forEach((album) => {
      const card = document.createElement("a");
      card.className = "album-card";
      card.href = `album/index.html?slug=${encodeURIComponent(album.slug)}`;
      const escapedTitle = escapeHTML(album.title);
      const escapedDesc = escapeHTML(album.description);
      const escapedCoverUrl = escapeHTML(getOptimizedImageUrl(album.cover_url || "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?q=80&w=1974&auto=format&fit=crop", 800));
      const escapedAlt = escapeHTML(buildWeddingCoverAlt(album));
      card.innerHTML = `
        <div class="photo-media">
          <img data-src="${escapedCoverUrl}" alt="${escapedAlt}" loading="lazy" />
        </div>
        <h3 class="photo-title">${escapedTitle}</h3>
        <p class="photo-subtitle">${formatDate(album.date)}</p>
        ${escapedDesc ? `<p class="album-description">${escapedDesc}</p>` : ""}
      `;
      fragment.appendChild(card);
    });

    list.appendChild(fragment);
    observeLazyImages();
  } catch (error) {
    list.innerHTML = "";
    list.appendChild(createStateMessage(`Could not load wedding albums. ${error.message}`));
  }
}

renderWeddings().then(() => {
  initScrollReveals();
});


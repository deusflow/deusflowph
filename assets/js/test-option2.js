import { getSupabase } from "./supabase-client.js";
import { observeLazyImages, createStateMessage, initScrollReveals, initMagneticButtons, initParallax, escapeHTML, getOptimizedImageUrl } from "./ui.js";

// DOM References
const featuredGrid = document.getElementById("featured-grid");
const parentSection = document.getElementById("split-scroll-section");
const leftTrack = document.getElementById("left-track");
const rightTrack = document.getElementById("right-track");

// Option 2: Zerkalny Split-Scroll Animation Logic
let targetProgress = 0;
let currentProgress = 0;

function handleScroll() {
  if (!parentSection) return;
  const rect = parentSection.getBoundingClientRect();
  const totalScroll = rect.height - window.innerHeight;
  if (totalScroll <= 0) return;

  // Progress goes from 0 (top of section hits top of viewport) to 1 (bottom of section hits bottom of viewport)
  let progress = -rect.top / totalScroll;
  targetProgress = Math.max(0, Math.min(1, progress));
}

function updateSplitAnimation() {
  // Smooth easing using linear interpolation (lerp)
  currentProgress += (targetProgress - currentProgress) * 0.08;

  const isMobile = window.innerWidth < 768;
  
  if (isMobile) {
    // In mobile stacked view, Y-translations operate on a 50vh per-panel basis
    const leftY = currentProgress * -100; // Left track Y translates from 0% height to -100% height (2 panels gap)
    const rightY = -100 + currentProgress * 100;
    
    if (leftTrack) leftTrack.style.transform = `translate3d(0, ${leftY}vh, 0)`;
    if (rightTrack) rightTrack.style.transform = `translate3d(0, ${rightY}vh, 0)`;
  } else {
    // In desktop side-by-side view, Y-translations operate on a 100vh per-panel basis
    const leftY = currentProgress * -200; // Left track Y translates from 0px to -200vh
    const rightY = -200 + currentProgress * 200; // Right track Y translates from -200vh to 0px
    
    if (leftTrack) leftTrack.style.transform = `translate3d(0, ${leftY}vh, 0)`;
    if (rightTrack) rightTrack.style.transform = `translate3d(0, ${rightY}vh, 0)`;
  }

  requestAnimationFrame(updateSplitAnimation);
}

async function loadFeatured() {
  if (!featuredGrid) return;
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
    if (albumError) throw albumError;
    if (!albums || albums.length === 0) {
      featuredGrid.appendChild(createStateMessage("No wedding albums published yet."));
      return;
    }

    for (const album of albums) {
      let imageUrl = album.cover_url;
      if (!imageUrl) {
        const { data: photos, error: photosError } = await supabase
          .from("photos")
          .select("url")
          .eq("album_id", album.id)
          .order("display_order", { ascending: true })
          .limit(1);
        if (photosError) throw photosError;
        if (photos && photos.length > 0) {
          imageUrl = photos[0].url;
        }
      }

      const card = document.createElement("a");
      card.className = "photo-card polaroid-luxury";
      card.href = `weddings/album/index.html?slug=${encodeURIComponent(album.slug)}`;
      const escapedTitle = escapeHTML(album.title);
      const escapedImgUrl = escapeHTML(getOptimizedImageUrl(imageUrl || "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?q=80&w=1974&auto=format&fit=crop", 800));
      card.innerHTML = `
        <div class="polaroid-inner">
          <div class="photo-media">
            <img data-src="${escapedImgUrl}" alt="${escapedTitle}" loading="lazy" />
          </div>
          <div class="polaroid-footer">
            <h3 class="photo-title">${escapedTitle}</h3>
          </div>
        </div>
      `;
      featuredGrid.appendChild(card);
    }
    observeLazyImages();
  } catch (error) {
    featuredGrid.innerHTML = "";
    featuredGrid.appendChild(createStateMessage(`Could not load featured stories. ${error.message}`));
  }
}

// Initializations
window.addEventListener("scroll", handleScroll, { passive: true });
window.addEventListener("resize", handleScroll, { passive: true });

loadFeatured();
initScrollReveals();
initMagneticButtons();
initParallax();

// Start animation loop
requestAnimationFrame(updateSplitAnimation);
// Run initial scroll check
handleScroll();

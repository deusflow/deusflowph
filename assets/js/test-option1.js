import { getSupabase } from "./supabase-client.js";
import { observeLazyImages, createStateMessage, initScrollReveals, initMagneticButtons, initParallax, escapeHTML, getOptimizedImageUrl } from "./ui.js";

// DOM References
const featuredGrid = document.getElementById("featured-grid");
const testimonialsGrid = document.getElementById("testimonials-grid");
const parentSection = document.getElementById("scatter-collage-section");
const textEl = document.getElementById("collage-text");

const cards = [
  { el: document.getElementById("card-1"), startX: -35, startY: -28, startR: -18, endX: -160, endY: -180, endR: -3 },
  { el: document.getElementById("card-2"), startX: 35, startY: -20, startR: 15, endX: 160, endY: -180, endR: 3 },
  { el: document.getElementById("card-3"), startX: -30, startY: 32, startR: -10, endX: -160, endY: 180, endR: 2 },
  { el: document.getElementById("card-4"), startX: 30, startY: 25, startR: 12, endX: 160, endY: 180, endR: -2 }
];

// Fallback Data for UI Loader
const fallbackTestimonials = [
  {
    name: "Volodymyr Ostapchuk (TV Presenter)",
    quote: "Oleh has an incredible talent for capturing genuine emotions. Our wedding photos tell the perfect story of our day. Highly recommended!"
  },
  {
    name: "Jerry Heil (Singer & Songwriter)",
    quote: "We had a cozy winter photoshoot, and Oleh made the whole process effortless and comfortable. The final pictures are pure magic."
  },
  {
    name: "Oleksandr Popov (Actor)",
    quote: "I worked with Oleh on a shoot for my TV series. He is an absolute professional with a great eye for cinematic detail."
  },
  {
    name: "Amalie Frank",
    quote:
      "Wow, hvor ser det godt ud! Tusind tusind tak for det - kaempe anbefaling! Der har virkelig vaeret stor ros for alle billederne fra alle gaester og slottet ogsaa. Det har vaeret fantastisk at have arbejdet med jer."
  }
];

function normalizeTestimonials(value) {
  if (!Array.isArray(value)) return fallbackTestimonials;
  const list = value
    .map((item) => ({
      name: String(item?.name || "").trim(),
      quote: String(item?.quote || "").trim()
    }))
    .filter((item) => item.name && item.quote);
  return list.length ? list : fallbackTestimonials;
}

function renderTestimonials(items) {
  if (!testimonialsGrid) return;
  testimonialsGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "panel testimonial-card testimonial-chip";
    const quote = document.createElement("p");
    quote.className = "testimonial-quote";
    quote.textContent = `"${item.quote}"`;
    const author = document.createElement("p");
    author.className = "testimonial-name";
    author.textContent = item.name;
    card.appendChild(quote);
    card.appendChild(author);
    fragment.appendChild(card);
  });
  testimonialsGrid.appendChild(fragment);
}

async function loadTestimonials() {
  if (!testimonialsGrid) return;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("about_content")
      .select("testimonials")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    renderTestimonials(normalizeTestimonials(data?.testimonials));
  } catch (error) {
    renderTestimonials(fallbackTestimonials);
  }
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

// Option 1: Magnetic Scatter Collage Scroll Logic
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

function updateCollageAnimation() {
  // Smooth easing using linear interpolation (lerp)
  currentProgress += (targetProgress - currentProgress) * 0.1;
  
  const isMobile = window.innerWidth < 768;
  const mobileScale = 0.65;
  const desktopScale = 0.85;

  cards.forEach((card) => {
    if (!card.el) return;
    
    // Scattered (starting) transforms in viewport percentage
    const startX = card.startX * (window.innerWidth / 100);
    const startY = card.startY * (window.innerHeight / 100);
    const startR = card.startR;

    // Assembled (ending) transforms in raw pixels
    const endX = card.endX * (isMobile ? 0.45 : 1);
    const endY = card.endY * (isMobile ? 0.45 : 1);
    const endR = card.endR;

    // Interpolate positions
    const curX = startX + (endX - startX) * currentProgress;
    const curY = startY + (endY - startY) * currentProgress;
    const curR = startR + (endR - startR) * currentProgress;
    const curScale = (isMobile ? mobileScale : 1.0) - (1 - (isMobile ? mobileScale : desktopScale)) * currentProgress;

    card.el.style.transform = `translate3d(${curX}px, ${curY}px, 0) rotate(${curR}deg) scale(${curScale})`;
    // Fade cards in as they enter the screen, maintaining full opacity once assembled
    card.el.style.opacity = currentProgress > 0.05 ? 1 : Math.max(0.2, currentProgress * 20);
  });

  // Interpolate center quote text opacity and scale
  if (textEl) {
    textEl.style.opacity = Math.max(0, (currentProgress - 0.4) / 0.6);
    const scale = 0.85 + 0.15 * Math.max(0, (currentProgress - 0.4) / 0.6);
    textEl.style.transform = `scale(${scale})`;
  }

  requestAnimationFrame(updateCollageAnimation);
}

// Initializations
window.addEventListener("scroll", handleScroll, { passive: true });
window.addEventListener("resize", handleScroll, { passive: true });

loadFeatured();
loadTestimonials();
initScrollReveals();
initMagneticButtons();
initParallax();

// Start animation loop
requestAnimationFrame(updateCollageAnimation);
// Run initial scroll check
handleScroll();

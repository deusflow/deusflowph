import { getSupabase } from "./supabase-client.js";
import { observeLazyImages, createStateMessage } from "./ui.js";

const featuredGrid = document.getElementById("featured-grid");
const heroImage = document.getElementById("hero-image");
const testimonialsGrid = document.getElementById("testimonials-grid");

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
  if (!Array.isArray(value)) {
    return fallbackTestimonials;
  }

  const list = value
    .map((item) => ({
      name: String(item?.name || "").trim(),
      quote: String(item?.quote || "").trim()
    }))
    .filter((item) => item.name && item.quote);

  return list.length ? list : fallbackTestimonials;
}

function renderTestimonials(items) {
  if (!testimonialsGrid) {
    return;
  }

  testimonialsGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "panel testimonial-card testimonial-chip";

    const quote = document.createElement("p");
    quote.className = "testimonial-quote";
    quote.textContent = `\"${item.quote}\"`;

    const author = document.createElement("p");
    author.className = "testimonial-name";
    author.textContent = item.name;

    card.appendChild(quote);
    card.appendChild(author);
    fragment.appendChild(card);
  });

  testimonialsGrid.appendChild(fragment);
}

function buildFeaturedAlt(album) {
  return `${album.title} - wedding story by Oleh Ro`;
}

async function loadTestimonials() {
  if (!testimonialsGrid) {
    return;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("about_content")
      .select("testimonials")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    renderTestimonials(normalizeTestimonials(data?.testimonials));
  } catch (error) {
    renderTestimonials(fallbackTestimonials);
  }
}

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
          <img data-src="${imageUrl}" alt="${buildFeaturedAlt(album)}" loading="lazy" />
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
loadTestimonials();

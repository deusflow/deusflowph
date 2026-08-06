import { getSupabase } from "../supabase-client.js";

/**
 * Fetch testimonials for the homepage
 * @returns {Promise<Array>} Array of testimonial objects
 */
export async function fetchTestimonials() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("about_content")
    .select("testimonials")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data?.testimonials || null;
}

/**
 * Fetch featured wedding albums for the homepage
 * @param {number} limit - Number of albums to fetch
 * @returns {Promise<Array>} Array of album objects
 */
export async function fetchFeaturedAlbums(limit = 3) {
  const supabase = getSupabase();

  let { data: albums, error: albumError } = await supabase
    .from("albums")
    .select("id, slug, title, cover_url, date, display_order, created_at")
    .eq("visible", true)
    .eq("type", "wedding")
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (albumError && String(albumError.message || "").includes("display_order")) {
    const fallback = await supabase
      .from("albums")
      .select("id, slug, title, cover_url, date")
      .eq("visible", true)
      .eq("type", "wedding")
      .order("date", { ascending: false })
      .limit(limit);
    albums = fallback.data;
    albumError = fallback.error;
  }

  if (albumError) {
    throw albumError;
  }
  return albums || [];
}

/**
 * Fetch a fallback cover photo for an album if cover_url is missing
 * @param {string} albumId 
 * @returns {Promise<string|null>} The URL of the photo, or null
 */
export async function fetchAlbumFallbackCover(albumId) {
  const supabase = getSupabase();
  const { data: photos, error: photosError } = await supabase
    .from("photos")
    .select("url")
    .eq("album_id", albumId)
    .order("display_order", { ascending: true })
    .limit(1);

  if (photosError) {
    throw photosError;
  }

  if (!photos || photos.length === 0) {
    return null;
  }
  return photos[0].url;
}

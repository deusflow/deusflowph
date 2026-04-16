import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

let cachedClient = null;

function ensureConfig() {
  if (!window.APP_CONFIG) {
    throw new Error("Missing config.js. Copy config.example.js to config.js and fill Supabase keys.");
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required in config.js.");
  }
}

export function getSupabase() {
  if (cachedClient) {
    return cachedClient;
  }

  ensureConfig();
  cachedClient = createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return cachedClient;
}

export function formatDate(value) {
  if (!value) {
    return "Date not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-DK", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function storagePathFromPublicUrl(url) {
  const marker = "/storage/v1/object/public/photos/";
  const index = url.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return decodeURIComponent(url.slice(index + marker.length));
}

export async function uploadToPhotosBucket(file, path) {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from("photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  return data.publicUrl;
}


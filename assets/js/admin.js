import {
  getSupabase,
  slugify,
  formatDate,
  uploadToPhotosBucket,
  storagePathFromPublicUrl
} from "./supabase-client.js";
import { createStateMessage } from "./ui.js";

const state = {
  selectedAlbum: null,
  selectedAlbumPhotos: []
};

const loginPanel = document.getElementById("login-panel");
const dashboardPanel = document.getElementById("dashboard-panel");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const albumsList = document.getElementById("albums-list");
const createAlbumForm = document.getElementById("create-album-form");
const logoutButton = document.getElementById("logout-button");
const selectedAlbumName = document.getElementById("selected-album-name");
const selectedAlbumMeta = document.getElementById("selected-album-meta");
const selectedAlbumPanel = document.getElementById("selected-album-panel");
const photosList = document.getElementById("photos-list");
const photoUploadInput = document.getElementById("photo-upload-input");
const dropzone = document.getElementById("photo-dropzone");

function setAuthView(isLoggedIn) {
  loginPanel.classList.toggle("hidden", isLoggedIn);
  dashboardPanel.classList.toggle("hidden", !isLoggedIn);
}

function showAlbumDetails(album) {
  state.selectedAlbum = album;
  selectedAlbumName.textContent = album.title;
  selectedAlbumMeta.textContent = `${album.type} | ${formatDate(album.date)} | slug: ${album.slug}`;
  selectedAlbumPanel.classList.remove("hidden");
}

async function requireSession() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  setAuthView(Boolean(data.session));
  return data.session;
}

async function loadAlbums() {
  const supabase = getSupabase();
  albumsList.innerHTML = "";

  const { data: albums, error } = await supabase
    .from("albums")
    .select("id, slug, title, date, type, visible")
    .order("created_at", { ascending: false });

  if (error) {
    albumsList.appendChild(createStateMessage(`Could not load albums: ${error.message}`));
    return;
  }

  if (!albums || albums.length === 0) {
    albumsList.appendChild(createStateMessage("No albums yet. Create your first one."));
    return;
  }

  albums.forEach((album) => {
    const row = document.createElement("div");
    row.className = "album-row";

    const info = document.createElement("div");
    info.innerHTML = `
      <strong>${album.title}</strong><br />
      <span class="photo-subtitle">${album.type.toUpperCase()} | ${formatDate(album.date)} | ${album.slug}</span>
    `;

    const visibility = document.createElement("label");
    visibility.className = "visibility-toggle";
    visibility.innerHTML = `<input type="checkbox" ${album.visible ? "checked" : ""} /> Published`;
    const checkbox = visibility.querySelector("input");
    checkbox.addEventListener("change", async () => {
      const { error: updateError } = await supabase
        .from("albums")
        .update({ visible: checkbox.checked })
        .eq("id", album.id);

      if (updateError) {
        checkbox.checked = !checkbox.checked;
        window.alert(updateError.message);
      }
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "0.5rem";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "ghost";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => {
      showAlbumDetails(album);
      loadPhotos(album.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(`Delete album \"${album.title}\" and all related photos?`);
      if (!confirmed) {
        return;
      }

      await deleteAlbum(album.id);
      if (state.selectedAlbum && state.selectedAlbum.id === album.id) {
        selectedAlbumPanel.classList.add("hidden");
      }
      await loadAlbums();
    });

    actions.appendChild(openButton);
    actions.appendChild(deleteButton);

    row.appendChild(info);
    row.appendChild(visibility);
    row.appendChild(actions);
    albumsList.appendChild(row);
  });
}

async function deleteAlbum(albumId) {
  const supabase = getSupabase();

  const { data: album } = await supabase
    .from("albums")
    .select("cover_url")
    .eq("id", albumId)
    .single();

  const { data: photos } = await supabase
    .from("photos")
    .select("url")
    .eq("album_id", albumId);

  const paths = [];

  if (album?.cover_url) {
    const coverPath = storagePathFromPublicUrl(album.cover_url);
    if (coverPath) {
      paths.push(coverPath);
    }
  }

  if (photos && photos.length > 0) {
    photos.forEach((photo) => {
      const path = storagePathFromPublicUrl(photo.url);
      if (path) {
        paths.push(path);
      }
    });
  }

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("photos").remove(paths);
    if (storageError) {
      throw storageError;
    }
  }

  const { error: deleteError } = await supabase.from("albums").delete().eq("id", albumId);
  if (deleteError) {
    throw deleteError;
  }
}

async function loadPhotos(albumId) {
  const supabase = getSupabase();
  photosList.innerHTML = "";

  const { data: photos, error } = await supabase
    .from("photos")
    .select("id, url, display_order")
    .eq("album_id", albumId)
    .order("display_order", { ascending: true });

  if (error) {
    photosList.appendChild(createStateMessage(`Could not load photos: ${error.message}`));
    return;
  }

  state.selectedAlbumPhotos = photos || [];

  if (!photos || photos.length === 0) {
    photosList.appendChild(createStateMessage("No photos in this album yet."));
    return;
  }

  photos.forEach((photo) => {
    const row = document.createElement("div");
    row.className = "photo-row";
    row.innerHTML = `
      <img src="${photo.url}" alt="Album photo" loading="lazy" />
      <div>
        <strong>Order: ${photo.display_order}</strong><br />
        <span class="photo-subtitle">${photo.id}</span>
      </div>
    `;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm("Delete this photo permanently?");
      if (!confirmed) {
        return;
      }

      const path = storagePathFromPublicUrl(photo.url);
      if (path) {
        const { error: storageError } = await supabase.storage.from("photos").remove([path]);
        if (storageError) {
          window.alert(storageError.message);
          return;
        }
      }

      const { error: deleteError } = await supabase.from("photos").delete().eq("id", photo.id);
      if (deleteError) {
        window.alert(deleteError.message);
        return;
      }

      await loadPhotos(albumId);
    });

    row.appendChild(deleteButton);
    photosList.appendChild(row);
  });
}

async function createAlbum(event) {
  event.preventDefault();

  const supabase = getSupabase();
  const formData = new FormData(createAlbumForm);
  const title = String(formData.get("title") || "").trim();
  const type = String(formData.get("type") || "wedding").trim();
  const date = String(formData.get("date") || "").trim();
  const slugInput = String(formData.get("slug") || "").trim();
  const coverFile = createAlbumForm.querySelector("input[name='cover']").files[0];

  if (!title || !coverFile) {
    window.alert("Title and cover image are required.");
    return;
  }

  const slug = slugInput ? slugify(slugInput) : slugify(`${title}-${Date.now()}`);
  const extension = coverFile.name.split(".").pop() || "jpg";
  const coverPath = `covers/${slug}-${Date.now()}.${extension}`;

  try {
    const coverUrl = await uploadToPhotosBucket(coverFile, coverPath);

    const { error } = await supabase.from("albums").insert({
      slug,
      title,
      cover_url: coverUrl,
      type,
      date: date || null,
      visible: false
    });

    if (error) {
      throw error;
    }

    createAlbumForm.reset();
    await loadAlbums();
  } catch (err) {
    window.alert(err.message);
  }
}

async function uploadPhotos(files) {
  if (!state.selectedAlbum) {
    window.alert("Open an album first.");
    return;
  }

  const supabase = getSupabase();
  const startOrder =
    state.selectedAlbumPhotos.length > 0
      ? Math.max(...state.selectedAlbumPhotos.map((photo) => photo.display_order || 0)) + 1
      : 1;

  let order = startOrder;

  for (const file of files) {
    const extension = file.name.split(".").pop() || "jpg";
    const path = `albums/${state.selectedAlbum.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    try {
      const publicUrl = await uploadToPhotosBucket(file, path);
      const { error } = await supabase.from("photos").insert({
        album_id: state.selectedAlbum.id,
        url: publicUrl,
        display_order: order,
        width: null,
        height: null
      });

      if (error) {
        throw error;
      }

      order += 1;
    } catch (err) {
      window.alert(`Upload failed for ${file.name}: ${err.message}`);
      return;
    }
  }

  await loadPhotos(state.selectedAlbum.id);
}

function setupDropzone() {
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-over");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-over");
  });

  dropzone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-over");

    const files = Array.from(event.dataTransfer.files || []);
    if (!files.length) {
      return;
    }

    await uploadPhotos(files);
  });

  photoUploadInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    await uploadPhotos(files);
    photoUploadInput.value = "";
  });
}

async function boot() {
  try {
    const session = await requireSession();
    if (!session) {
      return;
    }

    await loadAlbums();
  } catch (error) {
    loginError.textContent = error.message;
    setAuthView(false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  const supabase = getSupabase();
  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = error.message;
    return;
  }

  loginForm.reset();
  await boot();
});

createAlbumForm.addEventListener("submit", createAlbum);

logoutButton.addEventListener("click", async () => {
  const supabase = getSupabase();
  await supabase.auth.signOut();
  state.selectedAlbum = null;
  selectedAlbumPanel.classList.add("hidden");
  setAuthView(false);
});

setupDropzone();
boot();


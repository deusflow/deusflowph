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
  selectedAlbumPhotos: [],
  selectedAlbumMetaBase: "",
  uploadInProgress: false,
  reorderInProgress: false,
  dragSourceIndex: null,
  photoViewMode: "compact",
  pendingMoves: new Map(),
  moveSequence: 0
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
const editAlbumForm = document.getElementById("edit-album-form");
const saveAlbumButton = document.getElementById("save-album-button");
const editTitleInput = document.getElementById("edit-title");
const editDateInput = document.getElementById("edit-date");
const editDescriptionInput = document.getElementById("edit-description");
const photosList = document.getElementById("photos-list");
const photoUploadInput = document.getElementById("photo-upload-input");
const dropzone = document.getElementById("photo-dropzone");
const uploadStatusText = document.getElementById("upload-status-text");
const uploadProgressBar = document.getElementById("upload-progress-bar");
const uploadProgressTrack = document.querySelector(".upload-progress-track");
const compactViewButton = document.getElementById("compact-view-button");
const detailedViewButton = document.getElementById("detailed-view-button");
const applyOrderButton = document.getElementById("apply-order-button");
const clearOrderButton = document.getElementById("clear-order-button");

function setUploadStatus(message, percent = 0, tone = "default") {
  if (uploadStatusText) {
    uploadStatusText.textContent = message;
    uploadStatusText.style.color = tone === "error" ? "#d39e9e" : "rgba(232, 226, 217, 0.82)";
  }

  if (uploadProgressBar) {
    uploadProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  if (uploadProgressTrack) {
    uploadProgressTrack.setAttribute("aria-valuenow", String(Math.round(percent)));
  }
}

function setUploadBusy(isBusy) {
  state.uploadInProgress = isBusy;
  photoUploadInput.disabled = isBusy;
  dropzone.style.opacity = isBusy ? "0.65" : "1";
}

function refreshAlbumMeta(photoCount) {
  if (!state.selectedAlbumMetaBase) {
    return;
  }
  selectedAlbumMeta.textContent = `${state.selectedAlbumMetaBase} | photos: ${photoCount}`;
}

function clearPhotoDropTargets() {
  photosList.querySelectorAll(".photo-row.drop-target").forEach((node) => {
    node.classList.remove("drop-target");
  });
}

function clearPendingMoves() {
  state.pendingMoves.clear();
  photosList.querySelectorAll(".move-to-input").forEach((input) => {
    input.value = "";
    input.classList.remove("is-staged");
  });
  updateOrderControlsState();
}

function updateOrderControlsState() {
  const pendingCount = state.pendingMoves.size;
  const hasPending = pendingCount > 0;
  applyOrderButton.disabled = !hasPending || state.reorderInProgress;
  clearOrderButton.disabled = !hasPending || state.reorderInProgress;
  applyOrderButton.textContent = hasPending ? `Save order changes (${pendingCount})` : "Save order changes";
}

function applyPhotoViewMode() {
  photosList.classList.toggle("compact-photo-grid", state.photoViewMode === "compact");
  compactViewButton.classList.toggle("is-active", state.photoViewMode === "compact");
  detailedViewButton.classList.toggle("is-active", state.photoViewMode === "detailed");
}

function handleDragAutoScroll(event) {
  const edge = 80;
  const step = 18;
  if (event.clientY < edge) {
    window.scrollBy(0, -step);
  } else if (window.innerHeight - event.clientY < edge) {
    window.scrollBy(0, step);
  }
}

function parseTargetPosition(rawValue, max) {
  const value = Number.parseInt(String(rawValue || "").trim(), 10);
  if (!Number.isInteger(value)) {
    return null;
  }
  if (value < 1 || value > max) {
    return null;
  }
  return value - 1;
}

function setAuthView(isLoggedIn) {
  loginPanel.classList.toggle("hidden", isLoggedIn);
  dashboardPanel.classList.toggle("hidden", !isLoggedIn);
}

function showAlbumDetails(album) {
  state.selectedAlbum = album;
  selectedAlbumName.textContent = album.title;
  state.selectedAlbumMetaBase = `${album.type} | ${formatDate(album.date)} | slug: ${album.slug}`;
  selectedAlbumMeta.textContent = state.selectedAlbumMetaBase;
  editTitleInput.value = album.title || "";
  editDateInput.value = album.date || "";
  editDescriptionInput.value = album.description || "";
  selectedAlbumPanel.classList.remove("hidden");
  setUploadStatus("No upload in progress.", 0);
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
    .select("id, slug, title, description, date, type, visible")
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

async function movePhotoByIndex(currentIndex, targetIndex) {
  if (!state.selectedAlbum || state.reorderInProgress || targetIndex < 0 || targetIndex >= state.selectedAlbumPhotos.length) {
    return;
  }

  if (currentIndex === targetIndex) {
    return;
  }

  state.reorderInProgress = true;
  const supabase = getSupabase();
  const reordered = [...state.selectedAlbumPhotos];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, moved);

  try {
    const success = await persistPhotoOrder(reordered, supabase);
    if (!success) {
      return;
    }

    await loadPhotos(state.selectedAlbum.id);
  } finally {
    state.reorderInProgress = false;
    updateOrderControlsState();
  }
}

async function persistPhotoOrder(reorderedPhotos, supabaseClient = null) {
  const supabase = supabaseClient || getSupabase();
  const oldOrder = new Map(state.selectedAlbumPhotos.map((photo) => [photo.id, photo.display_order]));
  const normalized = reorderedPhotos.map((photo, index) => ({ ...photo, display_order: index + 1 }));
  const changedRows = normalized.filter((photo) => oldOrder.get(photo.id) !== photo.display_order);

  for (const row of changedRows) {
    const { error } = await supabase
      .from("photos")
      .update({ display_order: row.display_order })
      .eq("id", row.id);

    if (error) {
      window.alert(`Could not reorder photos: ${error.message}`);
      return false;
    }
  }

  state.selectedAlbumPhotos = normalized;
  return true;
}

async function applyPendingOrderChanges() {
  if (!state.selectedAlbum || state.pendingMoves.size === 0 || state.reorderInProgress) {
    return;
  }

  state.reorderInProgress = true;
  updateOrderControlsState();

  const working = [...state.selectedAlbumPhotos];
  const moves = Array.from(state.pendingMoves.entries())
    .map(([photoId, payload]) => ({ photoId, targetIndex: payload.targetIndex, sequence: payload.sequence }))
    .sort((a, b) => a.sequence - b.sequence);

  for (const move of moves) {
    const currentIndex = working.findIndex((photo) => photo.id === move.photoId);
    if (currentIndex === -1) {
      continue;
    }

    const targetIndex = Math.max(0, Math.min(working.length - 1, move.targetIndex));
    if (currentIndex === targetIndex) {
      continue;
    }

    const [moved] = working.splice(currentIndex, 1);
    working.splice(targetIndex, 0, moved);
  }

  const success = await persistPhotoOrder(working);
  state.reorderInProgress = false;

  if (!success) {
    updateOrderControlsState();
    return;
  }

  await loadPhotos(state.selectedAlbum.id);
  clearPendingMoves();
  setUploadStatus("Order changes saved.", 100);
}

async function loadPhotos(albumId) {
  const supabase = getSupabase();
  photosList.innerHTML = "";
  applyPhotoViewMode();
  clearPendingMoves();

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
  refreshAlbumMeta(state.selectedAlbumPhotos.length);

  if (!photos || photos.length === 0) {
    photosList.appendChild(createStateMessage("No photos in this album yet."));
    return;
  }

  photos.forEach((photo, index) => {
    const row = document.createElement("div");
    row.className = "photo-row";
    row.draggable = true;
    row.dataset.index = String(index);

    row.addEventListener("dragstart", (event) => {
      if (state.reorderInProgress) {
        event.preventDefault();
        return;
      }

      state.dragSourceIndex = index;
      row.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      }
    });

    row.addEventListener("dragend", () => {
      state.dragSourceIndex = null;
      row.classList.remove("dragging");
      clearPhotoDropTargets();
    });

    row.addEventListener("dragover", (event) => {
      if (state.reorderInProgress) {
        return;
      }

      event.preventDefault();
      clearPhotoDropTargets();
      row.classList.add("drop-target");
      handleDragAutoScroll(event);
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drop-target");
    });

    row.addEventListener("drop", async (event) => {
      event.preventDefault();
      clearPhotoDropTargets();

      const targetIndex = Number(row.dataset.index);
      const sourceFromData = event.dataTransfer ? Number(event.dataTransfer.getData("text/plain")) : Number.NaN;
      const sourceIndex = Number.isInteger(sourceFromData) ? sourceFromData : state.dragSourceIndex;

      if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex)) {
        return;
      }

      await movePhotoByIndex(sourceIndex, targetIndex);
    });

    const info = document.createElement("div");
    info.innerHTML = `
      <strong>Order: ${photo.display_order}</strong><br />
      <span class="photo-subtitle">${photo.id}</span>
    `;

    const actions = document.createElement("div");
    actions.className = "photo-actions";

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.className = "ghost";
    upButton.textContent = "Up";
    upButton.disabled = index === 0;
    upButton.addEventListener("click", () => movePhotoByIndex(index, index - 1));

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.className = "ghost";
    downButton.textContent = "Down";
    downButton.disabled = index === photos.length - 1;
    downButton.addEventListener("click", () => movePhotoByIndex(index, index + 1));

    const topButton = document.createElement("button");
    topButton.type = "button";
    topButton.className = "ghost";
    topButton.textContent = "Top";
    topButton.disabled = index === 0;
    topButton.addEventListener("click", () => movePhotoByIndex(index, 0));

    const bottomButton = document.createElement("button");
    bottomButton.type = "button";
    bottomButton.className = "ghost";
    bottomButton.textContent = "Bottom";
    bottomButton.disabled = index === photos.length - 1;
    bottomButton.addEventListener("click", () => movePhotoByIndex(index, photos.length - 1));

    const moveToWrap = document.createElement("div");
    moveToWrap.className = "move-to-wrap";

    const moveToInput = document.createElement("input");
    moveToInput.type = "number";
    moveToInput.className = "move-to-input";
    moveToInput.min = "1";
    moveToInput.max = String(photos.length);
    moveToInput.placeholder = "#";
    moveToInput.title = `Move photo to position 1-${photos.length}`;

    const moveToButton = document.createElement("button");
    moveToButton.type = "button";
    moveToButton.className = "ghost";
    moveToButton.textContent = "Set";

    const stageMoveToPosition = () => {
      const targetIndex = parseTargetPosition(moveToInput.value, photos.length);
      if (targetIndex === null) {
        window.alert(`Enter a position from 1 to ${photos.length}.`);
        return;
      }

      state.moveSequence += 1;
      state.pendingMoves.set(photo.id, { targetIndex, sequence: state.moveSequence });
      moveToInput.classList.add("is-staged");
      updateOrderControlsState();
    };

    moveToButton.addEventListener("click", stageMoveToPosition);
    moveToInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        stageMoveToPosition();
      }
    });

    moveToWrap.appendChild(moveToInput);
    moveToWrap.appendChild(moveToButton);

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

    actions.appendChild(upButton);
    actions.appendChild(downButton);
    actions.appendChild(topButton);
    actions.appendChild(bottomButton);
    actions.appendChild(moveToWrap);
    actions.appendChild(deleteButton);

    const thumb = document.createElement("img");
    thumb.src = photo.url;
    thumb.alt = "Album photo";
    thumb.loading = "lazy";

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(actions);
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
  const description = String(formData.get("description") || "").trim();
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
      description: description || null,
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

async function saveAlbumDetails(event) {
  event.preventDefault();

  if (!state.selectedAlbum) {
    window.alert("Open an album first.");
    return;
  }

  const title = editTitleInput.value.trim();
  const date = editDateInput.value.trim();
  const description = editDescriptionInput.value.trim();

  if (!title) {
    window.alert("Album title cannot be empty.");
    return;
  }

  saveAlbumButton.disabled = true;
  saveAlbumButton.textContent = "Saving...";

  const supabase = getSupabase();
  const { error } = await supabase
    .from("albums")
    .update({
      title,
      date: date || null,
      description: description || null
    })
    .eq("id", state.selectedAlbum.id);

  saveAlbumButton.disabled = false;
  saveAlbumButton.textContent = "Save Album Details";

  if (error) {
    window.alert(`Could not save album details: ${error.message}`);
    return;
  }

  state.selectedAlbum = {
    ...state.selectedAlbum,
    title,
    date: date || null,
    description: description || null
  };

  showAlbumDetails(state.selectedAlbum);
  await loadAlbums();
  await loadPhotos(state.selectedAlbum.id);
}

async function uploadPhotos(files) {
  if (!state.selectedAlbum) {
    setUploadStatus("Open an album first.", 0, "error");
    return;
  }

  if (state.uploadInProgress) {
    setUploadStatus("Upload already in progress. Please wait.", 0, "error");
    return;
  }

  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  if (!imageFiles.length) {
    setUploadStatus("No image files detected in this batch.", 0, "error");
    return;
  }

  const supabase = getSupabase();
  const total = imageFiles.length;
  let uploaded = 0;
  let failed = 0;

  const startOrder =
    state.selectedAlbumPhotos.length > 0
      ? Math.max(...state.selectedAlbumPhotos.map((photo) => photo.display_order || 0)) + 1
      : 1;

  let order = startOrder;
  setUploadBusy(true);
  setUploadStatus(`Uploading 0/${total} photos...`, 0);

  for (const file of imageFiles) {
    const completed = uploaded + failed;
    const startedPercent = total > 0 ? (completed / total) * 100 : 0;
    setUploadStatus(`Uploading ${completed + 1}/${total}: ${file.name}`, startedPercent);

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

      uploaded += 1;
      order += 1;
    } catch (err) {
      failed += 1;
      console.error(`Upload failed for ${file.name}:`, err);
    }

    const done = uploaded + failed;
    const percent = total > 0 ? (done / total) * 100 : 100;
    setUploadStatus(`Uploaded ${uploaded}/${total}${failed ? `, failed ${failed}` : ""}`, percent, failed ? "error" : "default");
  }

  await loadPhotos(state.selectedAlbum.id);
  setUploadBusy(false);

  if (failed === 0) {
    setUploadStatus(`Upload complete. ${uploaded}/${total} photos uploaded.`, 100);
  } else {
    setUploadStatus(`Upload finished with issues: ${uploaded} uploaded, ${failed} failed.`, 100, "error");
  }
}

function setupDropzone() {
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!state.uploadInProgress) {
      dropzone.classList.add("is-over");
    }
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
editAlbumForm.addEventListener("submit", saveAlbumDetails);

logoutButton.addEventListener("click", async () => {
  const supabase = getSupabase();
  await supabase.auth.signOut();
  state.selectedAlbum = null;
  selectedAlbumPanel.classList.add("hidden");
  setAuthView(false);
});

setupDropzone();
setUploadStatus("No upload in progress.", 0);
compactViewButton.addEventListener("click", () => {
  state.photoViewMode = "compact";
  applyPhotoViewMode();
});
detailedViewButton.addEventListener("click", () => {
  state.photoViewMode = "detailed";
  applyPhotoViewMode();
});
applyOrderButton.addEventListener("click", applyPendingOrderChanges);
clearOrderButton.addEventListener("click", () => {
  clearPendingMoves();
  setUploadStatus("Staged order changes cleared.", 0);
});
applyPhotoViewMode();
updateOrderControlsState();
boot();

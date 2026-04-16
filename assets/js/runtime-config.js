(function applyRuntimeConfig() {
  try {
    const config = window.APP_CONFIG || {};
    if (!config.FAVICON_URL) {
      return;
    }

    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }

    favicon.href = config.FAVICON_URL;
  } catch (error) {
    console.warn("Runtime config apply failed", error);
  }
})();


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

    const linkBindings = [
      { key: "TELEGRAM_URL", selector: "[data-runtime-link='telegram']" },
      { key: "WHATSAPP_URL", selector: "[data-runtime-link='whatsapp']" }
    ];

    linkBindings.forEach(({ key, selector }) => {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (!nodes.length) {
        return;
      }

      const target = config[key];
      nodes.forEach((node) => {
        if (!target) {
          node.style.display = "none";
          return;
        }

        node.href = target;
      });
    });
  } catch (error) {
    console.warn("Runtime config apply failed", error);
  }
})();


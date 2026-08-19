(function applyRuntimeConfig() {
  try {
    const config = window.APP_CONFIG || {};
    const faviconUrl = config.FAVICON_URL || "https://firnyacuwvxsolxljqxu.supabase.co/storage/v1/object/public/photos/favico%20copy.png?v=20260819-20";

    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      favicon.type = "image/png";
      document.head.appendChild(favicon);
    }
    favicon.href = faviconUrl;

    let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (appleIcon) {
      appleIcon.href = faviconUrl;
    }

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


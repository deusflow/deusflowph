(function applySEO() {
  try {
    const config = window.APP_CONFIG || {};
    const siteUrl = (config.SITE_URL || window.location.origin).replace(/\/$/, "");

    // Strip tracking params from canonical — only keep content-meaningful params (slug, lang)
    const rawParams = new URLSearchParams(window.location.search);
    const cleanParams = new URLSearchParams();
    const trackingPrefixes = ["utm_", "fbclid", "gclid", "igshid", "mc_", "ref", "_ga", "hsCtaTracking"];
    for (const [key, value] of rawParams) {
      if (!trackingPrefixes.some((prefix) => key.toLowerCase().startsWith(prefix))) {
        cleanParams.set(key, value);
      }
    }
    const cleanSearch = cleanParams.toString() ? `?${cleanParams.toString()}` : "";
    const canonicalUrl = `${siteUrl}${window.location.pathname}${cleanSearch}`;

    const canonical = document.querySelector("link[rel='canonical']");
    if (canonical) {
      canonical.href = canonicalUrl;
    }

    const ogUrl = document.querySelector("meta[property='og:url']");
    if (ogUrl) {
      ogUrl.content = canonicalUrl;
    }

    const siteName = config.SITE_NAME || "Oleh Ro Photography";
    const ogSiteName = document.querySelector("meta[property='og:site_name']");
    if (ogSiteName) {
      ogSiteName.content = siteName;
    }

    const socialImage = config.DEFAULT_OG_IMAGE || config.HERO_IMAGE_URL || "";
    if (socialImage) {
      const ogImage = document.querySelector("meta[property='og:image']");
      const twitterImage = document.querySelector("meta[name='twitter:image']");
      if (ogImage) {
        ogImage.content = socialImage;
      }
      if (twitterImage) {
        twitterImage.content = socialImage;
      }
    }
  } catch (error) {
    console.warn("SEO runtime apply failed", error);
  }
})();

window.injectDynamicSchema = function(type, data) {
  try {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    
    let schema = {
      "@context": "https://schema.org"
    };

    if (type === "ImageGallery" && data) {
      schema["@type"] = "ImageGallery";
      schema.name = data.title;
      schema.description = data.description || `Wedding photography gallery by Oleh Ro: ${data.title}`;
      schema.url = window.location.href;
      if (data.coverUrl) {
        schema.primaryImageOfPage = {
          "@type": "ImageObject",
          "contentUrl": data.coverUrl
        };
      }
      schema.author = {
        "@type": "Person",
        "name": "Oleh Ro"
      };
    }

    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  } catch (err) {
    console.warn("Failed to inject dynamic schema", err);
  }
};

// Global image error fallback — gracefully hide broken images instead of showing browser's broken-file icon
document.addEventListener("error", function (e) {
  if (e.target.tagName === "IMG" && !e.target.dataset.fallbackApplied) {
    e.target.dataset.fallbackApplied = "true";
    e.target.style.opacity = "0";
    e.target.style.minHeight = "0";

    // If inside a photo-card or masonry-item, collapse the container gracefully
    const card = e.target.closest(".photo-card, .masonry-item, .photo-media");
    if (card) {
      card.style.display = "none";
    }
  }
}, true);

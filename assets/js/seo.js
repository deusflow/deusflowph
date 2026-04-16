(function applySEO() {
  try {
    const config = window.APP_CONFIG || {};
    const siteUrl = (config.SITE_URL || window.location.origin).replace(/\/$/, "");
    const canonicalPath = window.location.pathname + window.location.search;
    const canonicalUrl = `${siteUrl}${canonicalPath}`;

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


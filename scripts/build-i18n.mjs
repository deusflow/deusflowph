import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const metaTranslations = {
  da: {
    "": {
      title: "Oleh Ro | Bryllupsfotograf i Danmark",
      desc: "Eksklusivt bryllupsfotografi i Danmark af Oleh Ro - rolige, ægte øjeblikke og tidløs elegance.",
      ogTitle: "Oleh Ro | Bryllupsfotograf i Danmark",
      ogDesc: "Eksklusivt bryllupsfotografi i Danmark af Oleh Ro - rolige, ægte øjeblikke og tidløs elegance."
    },
    "about": {
      title: "Om Oleh Ro | Bryllupsfotograf",
      desc: "Mød Oleh Ro - bryllupsfotograf i Danmark. Historie, værdier og tilgang bag hvert bryllup.",
      ogTitle: "Om Oleh Ro | Bryllupsfotograf",
      ogDesc: "Mød Oleh Ro - bryllupsfotograf i Danmark. Historie, værdier og tilgang bag hvert bryllup."
    },
    "portfolio": {
      title: "Portfolio | Oleh Ro",
      desc: "Udvalgt bryllupsfotografi portfolio af Oleh Ro med kuraterede øjeblikke.",
      ogTitle: "Portfolio | Oleh Ro",
      ogDesc: "Udvalgt bryllupsfotografi portfolio af Oleh Ro med kuraterede øjeblikke."
    },
    "weddings": {
      title: "Bryllupper | Oleh Ro",
      desc: "Bryllupshistorier fotograferet i Danmark og Europa af Oleh Ro.",
      ogTitle: "Bryllupper | Oleh Ro",
      ogDesc: "Bryllupshistorier fotograferet i Danmark og Europa af Oleh Ro."
    },
    "weddings/album": {
      title: "Bryllupshistorie | Oleh Ro",
      desc: "Komplet bryllupsgalleri i eksklusiv dokumentarisk stil af Oleh Ro.",
      ogTitle: "Bryllupshistorie | Oleh Ro",
      ogDesc: "Komplet bryllupsgalleri i eksklusiv dokumentarisk stil af Oleh Ro."
    },
    "pricing": {
      title: "Priser & Pakker | Oleh Ro",
      desc: "Gennemskuelige priser for bryllupsfotografering i Danmark af Oleh Ro.",
      ogTitle: "Priser & Pakker | Oleh Ro",
      ogDesc: "Gennemskuelige priser for bryllupsfotografering i Danmark af Oleh Ro."
    },
    "locations/aarhus": {
      title: "Aarhus Bryllupsfotograf | Oleh Ro",
      desc: "Bryllupsfotograf i Aarhus, Danmark. Ærlige og elegante bryllupshistorier af Oleh Ro.",
      ogTitle: "Aarhus Bryllupsfotograf | Oleh Ro",
      ogDesc: "Bryllupsfotograf i Aarhus, Danmark. Ærlige og elegante bryllupshistorier af Oleh Ro."
    },
    "locations/copenhagen": {
      title: "København Bryllupsfotograf | Oleh Ro",
      desc: "Bryllupsfotograf til bryllupper og elopements i København af Oleh Ro.",
      ogTitle: "København Bryllupsfotograf | Oleh Ro",
      ogDesc: "Bryllupsfotograf til bryllupper og elopements i København af Oleh Ro."
    },
    "locations/odense": {
      title: "Odense Bryllupsfotograf | Oleh Ro",
      desc: "Bryllupsfotograf i Odense og Fyn. Dokumentarisk bryllupsfotografi af Oleh Ro.",
      ogTitle: "Odense Bryllupsfotograf | Oleh Ro",
      ogDesc: "Bryllupsfotograf i Odense og Fyn. Dokumentarisk bryllupsfotografi af Oleh Ro."
    },
    "locations/aalborg": {
      title: "Aalborg Bryllupsfotograf | Oleh Ro",
      desc: "Bryllupsfotograf i Aalborg og Nordjylland. Ægte historiefortælling af Oleh Ro.",
      ogTitle: "Aalborg Bryllupsfotograf | Oleh Ro",
      ogDesc: "Bryllupsfotograf i Aalborg og Nordjylland. Ægte historiefortælling af Oleh Ro."
    },
    "legal": {
      title: "Vilkår og Privatliv | Oleh Ro",
      desc: "Vilkår og privatlivspolitik for kontakt og booking hos Oleh Ro Photography.",
      ogTitle: "Vilkår og Privatliv | Oleh Ro",
      ogDesc: "Vilkår og privatlivspolitik for kontakt og booking hos Oleh Ro Photography."
    }
  },
  uk: {
    "": {
      title: "Олег Ро | Весільний фотограф у Данії",
      desc: "Весільна та editorial фотографія в Данії від Олега Ро. Щирі емоції, елегантність та позачасовий стиль.",
      ogTitle: "Олег Ро | Весільний фотограф у Данії",
      ogDesc: "Весільна та editorial фотографія в Данії від Олега Ро. Щирі емоції, елегантність та позачасовий стиль."
    },
    "about": {
      title: "Про Олега Ро | Весільний фотограф",
      desc: "Познайомтеся з Олегом Ро — весільним фотографом у Данії. Історія, цінності та підхід до зйомки.",
      ogTitle: "Про Олега Ро | Весільний фотограф",
      ogDesc: "Познайомтеся з Олегом Ро — весільним фотографом у Данії. Історія, цінності та підхід до зйомки."
    },
    "portfolio": {
      title: "Портфоліо | Олег Ро",
      desc: "Вибрані серії та кадри весільної фотографії від Олега Ро.",
      ogTitle: "Портфоліо | Олег Ро",
      ogDesc: "Вибрані серії та кадри весільної фотографії від Олега Ро."
    },
    "weddings": {
      title: "Весілля | Олег Ро",
      desc: "Весільні історії, зняті в Данії та по всій Європі Олегом Ро.",
      ogTitle: "Весілля | Олег Ро",
      ogDesc: "Весільні історії, зняті в Данії та по всій Європі Олегом Ро."
    },
    "weddings/album": {
      title: "Весільна історія | Олег Ро",
      desc: "Повна весільна фотогалерея в авторському editorial стилі від Олега Ро.",
      ogTitle: "Весільна історія | Олег Ро",
      ogDesc: "Повна весільна фотогалерея в авторському editorial стилі від Олега Ро."
    },
    "pricing": {
      title: "Ціни та пакети | Олег Ро",
      desc: "Прозорі ціни та пакети послуг весільного фотографа в Данії та Європі.",
      ogTitle: "Ціни та пакети | Олег Ро",
      ogDesc: "Прозорі ціни та пакети послуг весільного фотографа в Данії та Європі."
    },
    "locations/aarhus": {
      title: "Весільний фотограф в Орхусі | Олег Ро",
      desc: "Весільна фотозйомка в Орхусі та Ютландії. Чесна документалістика та живі емоції.",
      ogTitle: "Весільний фотограф в Орхусі | Олег Ро",
      ogDesc: "Весільна фотозйомка в Орхусі та Ютландії. Чесна документалістика та живі емоції."
    },
    "locations/copenhagen": {
      title: "Весільний фотограф у Копенгагені | Олег Ро",
      desc: "Весільна фотозйомка для камерних церемоній та весіль у Копенгагені.",
      ogTitle: "Весільний фотограф у Копенгагені | Олег Ро",
      ogDesc: "Весільна фотозйомка для камерних церемоній та весіль у Копенгагені."
    },
    "locations/odense": {
      title: "Весільний фотограф в Оденсе | Олег Ро",
      desc: "Весільні історії в Оденсе та на острові Фюн від Олега Ро.",
      ogTitle: "Весільний фотограф в Оденсе | Олег Ро",
      ogDesc: "Весільні історії в Оденсе та на острові Фюн від Олега Ро."
    },
    "locations/aalborg": {
      title: "Весільний фотограф в Ольборзі | Олег Ро",
      desc: "Весільна фотографія в Ольборзі та Північній Ютландії від Олега Ро.",
      ogTitle: "Весільний фотограф в Ольборзі | Олег Ро",
      ogDesc: "Весільна фотографія в Ольборзі та Північній Ютландії від Олега Ро."
    },
    "legal": {
      title: "Умови та приватність | Олег Ро",
      desc: "Умови співпраці та конфіденційність при замовленні зйомки в Oleh Ro Photography.",
      ogTitle: "Умови та приватність | Олег Ро",
      ogDesc: "Умови співпраці та конфіденційність при замовленні зйомки в Oleh Ro Photography."
    }
  }
};

const routePaths = [
  "",
  "about",
  "portfolio",
  "weddings",
  "weddings/album",
  "pricing",
  "locations/aarhus",
  "locations/copenhagen",
  "locations/odense",
  "locations/aalborg",
  "legal"
];

// Read i18n dictionaries from assets/js/i18n.js
const i18nContent = fs.readFileSync(path.join(root, "assets/js/i18n.js"), "utf8");

function extractObject(varName) {
  const marker = `const ${varName} = `;
  const start = i18nContent.indexOf(marker);
  if (start === -1) return {};
  const openBrace = i18nContent.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = openBrace; i < i18nContent.length; i++) {
    if (i18nContent[i] === "{") depth++;
    else if (i18nContent[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return {};
  const code = i18nContent.slice(openBrace, end);
  try {
    return Function(`return (${code})`)();
  } catch (e) {
    console.error(`Failed to parse ${varName}:`, e);
    return {};
  }
}

const DADict = extractObject("DADict");
const UADict = extractObject("UADict");
const rawDefaults = extractObject("rawDefaults");

function getPageRelativePrefix(routePath, lang = "") {
  const depth = (lang ? 1 : 0) + (routePath ? routePath.split("/").length : 0);
  if (depth === 0) return "./";
  return "../".repeat(depth);
}

function adjustRelativeAssetPaths(html, currentPrefix, targetPrefix) {
  // In source EN file, assets are referenced via currentPrefix (e.g. "" or "../" or "../../")
  // We normalize to targetPrefix
  if (currentPrefix === targetPrefix) return html;

  let out = html;
  const assets = ["assets/", "config.js", "favicon", "manifest.json", "apple-touch-icon"];
  for (const a of assets) {
    const srcRef = currentPrefix ? `${currentPrefix}${a}` : a;
    const targetRef = targetPrefix ? `${targetPrefix}${a}` : a;
    out = out.split(`href="${srcRef}`).join(`href="${targetRef}`);
    out = out.split(`src="${srcRef}`).join(`src="${targetRef}`);
  }
  return out;
}

function translateHtmlContent(html, lang, routePath) {
  const dict = lang === "da" ? DADict : (lang === "uk" ? UADict : {});
  const raw = rawDefaults[lang === "uk" ? "ua" : lang] || {};
  const meta = metaTranslations[lang]?.[routePath] || {};

  let out = html;

  // 1. Update <html lang="...">
  out = out.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);

  // 2. Adjust data-root attribute
  const targetPrefix = getPageRelativePrefix(routePath, lang);
  out = out.replace(/data-root="[^"]*"/, `data-root="${targetPrefix.replace(/\/$/, "") || "."}"`);

  // 3. Update Title & Meta description
  if (meta.title) {
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`);
    out = out.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${meta.ogTitle || meta.title}"`);
    out = out.replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${meta.ogTitle || meta.title}"`);
  }
  if (meta.desc) {
    out = out.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${meta.desc}"`);
    out = out.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${meta.ogDesc || meta.desc}"`);
    out = out.replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${meta.ogDesc || meta.desc}"`);
  }

  // 4. Update canonical URL to self-referencing language URL
  const langUrlPath = lang ? `${lang}/${routePath ? routePath + "/" : ""}` : (routePath ? `${routePath}/` : "");
  const canonicalUrl = `https://deusflow.dk/${langUrlPath}`;
  out = out.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${canonicalUrl}"`);
  out = out.replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${canonicalUrl}"`);

  // 5. Update og:locale
  const localeMap = { en: "en_US", da: "da_DK", uk: "uk_UA" };
  out = out.replace(/<meta property="og:locale" content="[^"]*"/, `<meta property="og:locale" content="${localeMap[lang] || "en_US"}"`);

  // 6. Update hreflang alternate tags in head
  const baseRouteUrl = routePath ? `${routePath}/` : "";
  const hreflangBlock = `  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="alternate" hreflang="en" href="https://deusflow.dk/${baseRouteUrl}" />
  <link rel="alternate" hreflang="da" href="https://deusflow.dk/da/${baseRouteUrl}" />
  <link rel="alternate" hreflang="uk" href="https://deusflow.dk/uk/${baseRouteUrl}" />
  <link rel="alternate" hreflang="x-default" href="https://deusflow.dk/${baseRouteUrl}" />`;

  out = out.replace(/<link rel="canonical"[\s\S]*?<link rel="alternate" hreflang="x-default"[^>]*>/, hreflangBlock);

  // 7. Adjust relative asset script & style paths
  const srcPrefix = getPageRelativePrefix(routePath, "");
  out = adjustRelativeAssetPaths(out, srcPrefix, targetPrefix);

  // 8. Translate data-i18n-key attributes statically
  for (const [key, val] of Object.entries(raw)) {
    if (!val) continue;
    // Replace text inside elements with data-i18n-key="key"
    const regex = new RegExp(`(<[^>]+data-i18n-key="${key}"[^>]*>)([\\s\\S]*?)(<\\/[a-zA-Z0-9]+>)`, "g");
    out = out.replace(regex, `$1${val}$3`);
  }

  // 9. Dictionary substitutions for common static text nodes
  const sortedEntries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
  for (const [enText, trText] of sortedEntries) {
    if (!enText || enText.length < 2 || !trText) continue;
    // Replace exact text node between tags
    out = out.split(`>${enText}<`).join(`>${trText}<`);
    out = out.split(`> ${enText} <`).join(`> ${trText} <`);
    out = out.split(`>${enText} `).join(`>${trText} `);
    out = out.split(` ${enText}<`).join(` ${trText}<`);
  }

  // 10. Update internal links for language folder
  const langPrefix = `/${lang}/`;
  const internalRoutes = ["about/", "weddings/", "pricing/", "portfolio/", "legal/"];
  for (const r of internalRoutes) {
    // Replace relative links like href="weddings/" or href="../weddings/" with language-scoped links
    const relLinkRegex = new RegExp(`href="(\\.\\.\\/)*(${r})"`, "g");
    out = out.replace(relLinkRegex, `href="${targetPrefix}${lang}/${r}"`);
  }
  // Home link
  out = out.replace(/href="(\.\.\/)*\.\/"/g, `href="${targetPrefix}${lang}/"`);
  out = out.replace(/href="(\.\.\/)*"/g, `href="${targetPrefix}${lang}/"`);

  return out;
}

// Build all pages
for (const lang of ["da", "uk"]) {
  for (const route of routePaths) {
    const srcFilePath = route ? path.join(root, route, "index.html") : path.join(root, "index.html");
    if (!fs.existsSync(srcFilePath)) continue;

    const srcHtml = fs.readFileSync(srcFilePath, "utf8");
    const targetDir = route ? path.join(root, lang, route) : path.join(root, lang);
    fs.mkdirSync(targetDir, { recursive: true });

    const targetFilePath = path.join(targetDir, "index.html");
    const translatedHtml = translateHtmlContent(srcHtml, lang, route);
    fs.writeFileSync(targetFilePath, translatedHtml, "utf8");
    console.log(`Generated ${lang.toUpperCase()} page: ${path.relative(root, targetFilePath)}`);
  }
}

// Update root EN pages hreflang tags to point to /da/... and /uk/...
for (const route of routePaths) {
  const srcFilePath = route ? path.join(root, route, "index.html") : path.join(root, "index.html");
  if (!fs.existsSync(srcFilePath)) continue;
  let html = fs.readFileSync(srcFilePath, "utf8");

  const baseRouteUrl = route ? `${route}/` : "";
  const canonicalUrl = `https://deusflow.dk/${baseRouteUrl}`;
  const hreflangBlock = `  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="alternate" hreflang="en" href="https://deusflow.dk/${baseRouteUrl}" />
  <link rel="alternate" hreflang="da" href="https://deusflow.dk/da/${baseRouteUrl}" />
  <link rel="alternate" hreflang="uk" href="https://deusflow.dk/uk/${baseRouteUrl}" />
  <link rel="alternate" hreflang="x-default" href="https://deusflow.dk/${baseRouteUrl}" />`;

  html = html.replace(/<link rel="canonical"[\s\S]*?<link rel="alternate" hreflang="x-default"[^>]*>/, hreflangBlock);
  fs.writeFileSync(srcFilePath, html, "utf8");
}

console.log("Static multilingual build completed successfully.");

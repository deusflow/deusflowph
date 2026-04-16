import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const requiredFiles = [
  "index.html",
  "config.example.js",
  "supabase-schema.sql",
  ".github/workflows/deploy.yml",
  "assets/css/styles.css",
  "assets/js/supabase-client.js",
  "assets/js/seo.js",
  "assets/js/home.js",
  "assets/js/portfolio.js",
  "assets/js/weddings.js",
  "assets/js/wedding-album.js",
  "assets/js/pricing.js",
  "assets/js/admin.js",
  "portfolio/index.html",
  "weddings/index.html",
  "weddings/album/index.html",
  "pricing/index.html",
  "admin/index.html",
  "README.md",
  "robots.txt",
  "sitemap.xml"
];

const missing = requiredFiles.filter((relativePath) => !fs.existsSync(path.join(root, relativePath)));

if (missing.length > 0) {
  console.error("Missing required files:\n" + missing.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}

const htmlChecks = [
  { file: "index.html", includes: ["assets/css/styles.css", "assets/js/home.js", "assets/js/seo.js", "<link rel=\"canonical\"", "og:title"] },
  { file: "portfolio/index.html", includes: ["../assets/js/portfolio.js", "../assets/js/seo.js", "<link rel=\"canonical\""] },
  { file: "weddings/index.html", includes: ["../assets/js/weddings.js", "../assets/js/seo.js", "<link rel=\"canonical\""] },
  { file: "weddings/album/index.html", includes: ["../../assets/js/wedding-album.js", "../../assets/js/seo.js", "id=\"lightbox\"", "<link rel=\"canonical\""] },
  { file: "pricing/index.html", includes: ["../assets/js/pricing.js", "../assets/js/seo.js", "Essentials", "Signature", "Luxury", "<link rel=\"canonical\""] },
  { file: "admin/index.html", includes: ["../assets/js/admin.js", "id=\"login-form\""] }
];

for (const check of htmlChecks) {
  const fullPath = path.join(root, check.file);
  const content = fs.readFileSync(fullPath, "utf8");
  for (const token of check.includes) {
    if (!content.includes(token)) {
      console.error(`Validation failed: ${check.file} is missing token: ${token}`);
      process.exit(1);
    }
  }
}

const schema = fs.readFileSync(path.join(root, "supabase-schema.sql"), "utf8");
for (const token of ["create table if not exists public.albums", "create table if not exists public.photos", "enable row level security", "storage.buckets"]) {
  if (!schema.includes(token)) {
    console.error(`Schema check failed: missing '${token}'`);
    process.exit(1);
  }
}

console.log("Smoke test passed: core files and wiring look correct.");


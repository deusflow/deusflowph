# Luxury Wedding Photography Portfolio (GitHub Pages + Supabase)

Production-ready static website for a wedding photographer based in Denmark.

- Frontend: pure HTML + CSS + Vanilla JS
- Hosting: GitHub Pages
- Backend/Auth/DB/Storage: Supabase
- Design: luxury dark minimal style inspired by your `exempl` mockup

## Project routes

- `/` Home
- `/portfolio` 30-photo selected portfolio
- `/weddings` list of wedding albums
- `/weddings/album?slug=<album-slug>` individual wedding album page
- `/pricing` package pricing (DKK)
- `/admin` protected admin panel (Supabase Auth)

## 1) Supabase setup

1. Create a new project in Supabase.
2. Go to SQL Editor and run `supabase-schema.sql`.
3. Go to Authentication -> Users and create one admin user manually (email/password).
4. In Storage, verify bucket `photos` exists and is public (the SQL script creates/updates it).
5. In Settings -> API, copy:
   - Project URL
   - anon public key

If your project already exists, run this migration once:

```sql
alter table public.albums add column if not exists description text;
alter table public.albums add column if not exists display_order integer not null default 1;
```

## 2) Configure local project

1. Copy template config:

```bash
cp config.example.js config.js
```

2. Edit `config.js` with your real values:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `CONTACT_EMAIL`
   - `INSTAGRAM_HANDLE`
   - `HERO_IMAGE_URL`
   - `FAVICON_URL`
   - `SITE_NAME`
   - `SITE_URL`
   - `DEFAULT_OG_IMAGE`

3. Run quick validation:

```bash
npm test
```

4. Run local static server:

```bash
npm run serve
```

5. Open in browser:
   - `http://localhost:4173/`
   - `http://localhost:4173/admin/`

## 3) GitHub repository setup

1. Initialize and push:

```bash
git init
git add .
git commit -m "Initial production portfolio"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

2. In GitHub repo -> Settings -> Pages:
   - Source: `GitHub Actions`

## 4) GitHub Actions secrets

In GitHub repo -> Settings -> Secrets and variables -> Actions, add these repository secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CONTACT_EMAIL`
- `INSTAGRAM_HANDLE`
- `HERO_IMAGE_URL`
- `FAVICON_URL`
- `SITE_NAME`
- `SITE_URL`
- `DEFAULT_OG_IMAGE`

`deploy.yml` will generate `config.js` during CI from these secrets and deploy the whole static site.

## 5) First deploy

1. Push to `main`.
2. Open Actions tab and wait for workflow `Deploy GitHub Pages` to pass.
3. Open your Pages URL from workflow output.

## 6) Create admin account (if not created earlier)

- Go to Supabase -> Authentication -> Users -> Add user.
- Use the same credentials to sign in at `/admin`.
- No public registration page is included by design.

## 7) First content upload workflow

1. Open `/admin` and login.
2. Create first **wedding** album:
   - title
   - type `wedding`
   - date
   - cover image
3. Open that album and upload multiple photos (input or drag & drop).
4. Toggle album visibility to **Published**.
5. Repeat for 2-4 weddings.
6. Create one **portfolio** album (type `portfolio`) and upload at least 30 photos.
7. Publish it to show selected portfolio grid on `/portfolio`.

## 8) Reorder wedding albums

1. Open `/admin` and login.
2. In **Albums**, use `Up`, `Down`, or enter a number in `#` and click `Set`.
3. Stage multiple changes if needed.
4. Click `Save album order` once.
5. Verify on `/weddings` and on the home `Featured Stories` section.

## Operational notes

- `config.js` is ignored by git via `.gitignore`.
- anon key in frontend is safe when RLS is configured correctly.
- never put Supabase service role key in frontend code.
- all reads/writes are controlled by RLS + Auth policies in `supabase-schema.sql`.
- SEO files are static: `robots.txt` and `sitemap.xml`.
- replace `YOUR_GITHUB_USERNAME` in `robots.txt` and `sitemap.xml` with your real username or custom domain.

## Useful commands

```bash
npm test
npm run serve
```

## File map (key files)

- `index.html`
- `portfolio/index.html`
- `weddings/index.html`
- `weddings/album/index.html`
- `pricing/index.html`
- `admin/index.html`
- `assets/css/styles.css`
- `assets/js/supabase-client.js`
- `assets/js/seo.js`
- `assets/js/home.js`
- `assets/js/portfolio.js`
- `assets/js/weddings.js`
- `assets/js/wedding-album.js`
- `assets/js/pricing.js`
- `assets/js/admin.js`
- `supabase-schema.sql`
- `config.example.js`
- `robots.txt`
- `sitemap.xml`
- `.github/workflows/deploy.yml`


const fs = require('fs');

let html = fs.readFileSync('admin/index.html', 'utf8');

// Use literal string replacements or regex
html = html.replace(/<details\s+id="([^"]+)"\s*class="([^"]+)"(?:\s*open)?\s*>/g, '<div id="$1" class="$2">');
html = html.replace(/<details\s+class="([^"]+)"(?:\s*open)?\s*>/g, '<div class="$1">');
html = html.replace(/<\/details>/g, '</div>');

html = html.replace(/<summary>([^<]+)<\/summary>/g, '<div class="admin-card-header"><h3>$1</h3></div>');

fs.writeFileSync('admin/index.html', html);

fs.appendFileSync('assets/css/admin.css', `
.admin-card-header {
  padding: 1.25rem 1.5rem;
  font-family: inherit;
  font-weight: 600;
  font-size: 1.1rem;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--admin-border);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.admin-card-header h3 { margin: 0; font-size: inherit; color: var(--admin-text); }
`);


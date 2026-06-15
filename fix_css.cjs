const fs = require('fs');
let css = fs.readFileSync('assets/css/admin.css', 'utf8');

const marker = '/* Photos List Overrides */';
const index = css.indexOf(marker);

const newRules = `
/* Photos List Overrides */
#photos-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
#photos-list.compact-photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}
.photo-row {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 8px;
  overflow: hidden;
  display: flex !important;
  align-items: center;
  padding: 0.75rem 1rem;
  gap: 1rem;
  transition: border-color 0.2s, background 0.2s;
  flex-direction: row !important;
}
.photo-row:hover {
  border-color: var(--admin-muted);
  background: #18181b;
}
.photo-row img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}
.photo-row > div:not(.photo-actions) {
  flex: 1;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--admin-muted);
}
.photo-row > div:not(.photo-actions) strong {
  color: var(--admin-text);
  font-weight: 600;
}
.photo-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  background: none;
  padding: 0;
}
.photo-actions button, .move-to-wrap button {
  padding: 0.4rem 0.6rem !important;
  font-size: 0.7rem !important;
  border-radius: 4px !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid var(--admin-border) !important;
  flex: none;
}
.photo-actions button:hover, .move-to-wrap button:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: var(--admin-muted) !important;
}
.photo-actions button.danger {
  color: var(--admin-danger) !important;
  border-color: var(--admin-danger) !important;
  background: var(--admin-danger-bg) !important;
}
.move-to-wrap {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.move-to-input {
  width: 50px !important;
  padding: 0.3rem !important;
  text-align: center;
  font-size: 0.75rem !important;
  height: 25px;
}
/* Compact Grid View Overrides */
#photos-list.compact-photo-grid .photo-row {
  flex-direction: column !important;
  padding: 1rem;
  text-align: center;
  align-items: stretch;
}
#photos-list.compact-photo-grid .photo-row img {
  width: 100%;
  height: 140px;
  margin-bottom: 0.5rem;
}
#photos-list.compact-photo-grid .photo-actions {
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 0.5rem;
}
#photos-list.compact-photo-grid .move-to-wrap {
  width: 100%;
  justify-content: center;
}
.photo-row.dragging { opacity: 0.5; border-color: var(--admin-accent); }
.photo-row.drop-target {
  border-color: var(--admin-accent);
  box-shadow: 0 0 0 2px var(--admin-accent);
}
`;

if (index !== -1) {
  fs.writeFileSync('assets/css/admin.css', css.substring(0, index) + newRules);
} else {
  fs.appendFileSync('assets/css/admin.css', newRules);
}
console.log('done fixing css');


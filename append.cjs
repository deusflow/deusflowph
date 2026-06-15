const fs = require("fs");
const css = `
/* Admin Dashboard layout */
.admin-dashboard-layout {
  display: flex;
  min-height: calc(100vh - 80px);
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  gap: 2rem;
  padding-top: 100px;
  padding-bottom: 4rem;
}

.admin-sidebar {
  width: 250px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding-right: 1.5rem;
}

.admin-nav-menu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: sticky;
  top: 120px;
}

.admin-nav-button {
  background: transparent;
  border: none;
  color: var(--text-muted);
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: color 0.3s, background 0.3s;
  border-left: 2px solid transparent;
}

.admin-nav-button:hover, .admin-nav-button.active {
  color: var(--gold);
  background: rgba(255, 255, 255, 0.03);
  border-left-color: var(--gold);
}

.admin-content-area {
  flex-grow: 1;
  min-width: 0; 
}

.admin-tab-pane {
  display: none;
  animation: fadeIn 0.4s ease-in-out;
}

.admin-tab-pane.active {
  display: block;
}

.admin-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 1rem;
}

.admin-header-row h1, .admin-header-row h2 {
  margin: 0;
  font-size: 2.2rem;
}

@media (max-width: 768px) {
  .admin-dashboard-layout {
    flex-direction: column;
    padding-top: 5rem;
  }
  .admin-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding-right: 0;
    padding-bottom: 1rem;
  }
  .admin-nav-menu {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .admin-nav-button {
    border-left: none;
    border-bottom: 2px solid transparent;
  }
  .admin-nav-button:hover, .admin-nav-button.active {
    border-left-color: transparent;
    border-bottom-color: var(--gold);
  }
}
`;
fs.appendFileSync("assets/css/styles.css", "\n" + css + "\n");


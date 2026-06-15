const fs = require('fs');
const files = ['pricing/index.html', 'weddings/index.html', 'about/index.html', 'legal/index.html', 'portfolio/index.html'];
files.forEach(f => {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    const prefix = '../';
    if (!text.includes('i18n.js')) {
      // Find the Google Fonts link to inject after it
      text = text.replace(/<link rel=\"stylesheet\" href=\"\.\.\/assets\/css\/styles\.css/, '<script src=\"' + prefix + 'assets/js/i18n.js?v=20260427\" defer></script>\n  <link rel=\"stylesheet\" href=\"../assets/css/styles.css');
      fs.writeFileSync(f, text);
    }
  }
});

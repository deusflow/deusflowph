const fs = require("fs");
const path = require("path");

const SITE_URL = "https://deusflow.github.io/deusflowph";

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !file.includes("node_modules")) {
            results = results.concat(walk(file));
        } else if (file.endsWith(".html")) {
            results.push(file);
        }
    });
    return results;
}

const htmlFiles = walk(".");

htmlFiles.forEach(file => {
    let content = fs.readFileSync(file, "utf8");
    let relativePath = file;
    if (relativePath.startsWith(".")) relativePath = relativePath.substring(1);
    if (relativePath.startsWith("/")) relativePath = relativePath.substring(1);

    // Convert to absolute URL
    let urlPath = relativePath === "index.html" ? "" : (relativePath.endsWith("/index.html") ? relativePath.replace("/index.html", "") : relativePath);
    let fullUrl = SITE_URL + (urlPath ? "/" + urlPath : "");

    content = content.replace(/<link rel=\"canonical\" href=\"[^\"]*\"[ \/]*>/g, `<link rel="canonical" href="${fullUrl}" />`);
    content = content.replace(/<meta property=\"og:url\" content=\"[^\"]*\"[ \/]*>/g, `<meta property="og:url" content="${fullUrl}" />`);

    fs.writeFileSync(file, content);
});
console.log("Updated og:url and canonical for all files.");

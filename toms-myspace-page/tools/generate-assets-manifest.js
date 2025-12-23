const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const outFile = path.join(assetsDir, 'manifest.json');
const outJsFile = path.join(assetsDir, 'manifest.js');

function isImage(name) {
  const ext = path.extname(name).toLowerCase();
  return ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.webp';
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter(isImage)
    .sort();
}

const categories = listDirs(assetsDir).map((cat) => {
  const dir = path.join(assetsDir, cat);
  const items = listFiles(dir).map((f) => ({
    name: path.basename(f, path.extname(f)),
    src: `assets/${cat}/${f}`
  }));

  return { name: cat, items };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  categories
};

fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outFile}`);

const js = 'window.TB_ASSET_MANIFEST = ' + JSON.stringify(manifest, null, 2) + ';\n';
fs.writeFileSync(outJsFile, js, 'utf8');
console.log(`Wrote ${outJsFile}`);

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] || join(root, 'dist', 'index.html'));
const read = name => readFile(join(root, name), 'utf8');

const [html, css, reportSource, appSource, demoSource] = await Promise.all([
  read('index.html'), read('style.css'), read('report.js'), read('app.js'),
  read(join('examples', 'demo.pea.json')),
]);
const importLine = /^import \{[^\n]+\} from '\.\/report\.js';\r?\n/;
if (!importLine.test(appSource)) throw new Error('Unexpected app.js import; offline build needs updating.');
const reportCode = reportSource.replace(/^export /gm, '');
const appCode = appSource.replace(importLine, '');
const demo = JSON.stringify(JSON.parse(demoSource));
const script = `globalThis.SPROUT_PEA_EMBEDDED_DEMO = ${demo};\n${reportCode}\n${appCode}`
  .replaceAll('</script', '<\\/script');
const bundled = html
  .replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="app.js"></script>', `<script>\n${script}\n</script>`);
if (bundled === html || bundled.includes('src="app.js"') || bundled.includes('href="style.css"')) {
  throw new Error('Unexpected index.html structure; offline build needs updating.');
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, bundled, 'utf8');
console.log(output);

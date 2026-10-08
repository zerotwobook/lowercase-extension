import { readFile, writeFile } from "node:fs/promises";

const base = new URL("../", import.meta.url);
let html = await readFile(new URL("lowercase-extension/popup.html", base), "utf8");
let css = await readFile(new URL("lowercase-extension/popup.css", base), "utf8");
const font = await readFile(new URL("lowercase-extension/fonts/InterVariable.woff2", base));
const fontLicense = await readFile(new URL("lowercase-extension/fonts/OFL.txt", base), "utf8");
const js = (await readFile(new URL("lowercase-extension/popup.js", base), "utf8"))
  .replaceAll("chrome.storage.local", "previewStorage");

css = css.replace("fonts/InterVariable.woff2", `data:font/woff2;base64,${font.toString("base64")}`);
const previewStyles = `
body { width: auto; padding: 32px 16px; background: radial-gradient(ellipse at top, #fff3e7, #faf9f7 70%); min-height: 100vh; }
main { width: 380px; max-width: 100%; margin: 0 auto; background: #ffffff; border: 1px solid #eee5dc; border-radius: 22px; box-shadow: 0 16px 48px #6a3b1810; }
.preview-note { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0 0 25px; color: #9a5a2e; font-size: 10px; font-weight: 600; letter-spacing: 0.7px; text-transform: uppercase; }
.preview-note::before { content: ""; width: 5px; height: 5px; background: #e88944; border-radius: 50%; }
`;

const bridge = `const previewStorage = {
  async get(keys) {
    const saved = {};
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const text = localStorage.getItem('lowercase.preview.' + key);
      if (text !== null) saved[key] = text;
    }
    return saved;
  },
  async set(values) {
    for (const [key, text] of Object.entries(values)) {
      localStorage.setItem('lowercase.preview.' + key, text);
    }
  },
  async remove(key) { localStorage.removeItem('lowercase.preview.' + key); }
};`;

html = html
  .replace("<!doctype html>", `<!doctype html>\n<!-- Bundled Inter font: https://github.com/rsms/inter\n${fontLicense.replaceAll("-->", "-- >")}\n-->`)
  .replace("<title>Lowercase</title>", "<title>Lowercase — Try it out</title>")
  .replace('<link rel="stylesheet" href="popup.css">', `<style>${css}${previewStyles}</style>`)
  .replace('<script src="popup.js" defer></script>', "")
  .replace("<main>", '<main><p class="preview-note">Live preview · No installation needed</p>')
  .replace("</body>", `<script>${bridge}\n${js.replaceAll("</script", "<\\/script")}</script></body>`)
  .replace(/^ +$/gm, "");

await writeFile(new URL("lowercase-preview.html", base), html);
console.log("Built lowercase-preview.html with the bundled Inter font.");

// Original HTML/CSS composition; reuse the project's CC0 SVG art and local OFL fonts.
// PNGs are committed: deployment builds never need a browser or graphics service.
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const dataUrl = async (path, mime) =>
  `data:${mime};base64,${(await readFile(new URL(path, root))).toString('base64')}`;
const art = {};
for (const name of ['helmet', 'cat', 'dog', 'bird']) {
  art[name] = await dataUrl(`public/art/${name}.svg`, 'image/svg+xml');
}
const headingFont = await dataUrl(
  'node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2',
  'font/woff2',
);
const bodyFont = await dataUrl(
  'node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2',
  'font/woff2',
);

const html = `<!doctype html><html lang="en-GB"><meta charset="utf-8"><title>London Animal Rescue social artwork</title>
<style>
@font-face { font-family: Dispatch; src: url('${headingFont}'); font-weight: 700; }
@font-face { font-family: Body; src: url('${bodyFont}'); font-weight: 400; }
* { box-sizing: border-box; }
body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #f6f1e5; color: #1c3947; font-family: Body, sans-serif; }
body::after { content: ''; position: absolute; inset: 18px; border: 1px solid #1c394726; pointer-events: none; }
header { height: 112px; background: #b92c2e; color: #fff7e6; display: flex; align-items: center; padding: 22px 58px; gap: 20px; }
.helmet { width: 68px; height: 64px; }
.desk { font: 700 29px Dispatch; letter-spacing: 2px; text-transform: uppercase; }
.collection { margin-left: auto; font: 700 20px Dispatch; letter-spacing: 2px; }
main { position: relative; height: 431px; padding: 38px 60px; }
.eyebrow { margin: 0 0 13px; color: #b92c2e; font: 700 22px Dispatch; letter-spacing: 3px; }
h1 { margin: 0; font: 700 98px/.92 Dispatch; letter-spacing: -1px; text-transform: uppercase; }
h1 span { display: block; }
.intro { width: 530px; margin: 22px 0 0; font: 400 25px/1.45 Body; }
.portraits { position: absolute; width: 420px; height: 372px; right: 43px; top: 31px; }
.orbit { position: absolute; width: 335px; height: 335px; top: 15px; left: 40px; border: 1px dashed #8c9a84; border-radius: 50%; }
.portrait { position: absolute; border: 8px solid #fffaf0; border-radius: 50%; box-shadow: 0 9px 18px #19344320; }
.portrait img { display: block; width: 100%; height: 100%; border-radius: 50%; }
.cat { width: 245px; height: 245px; top: 0; left: 35px; outline: 4px solid #b92c2e; z-index: 2; }
.dog { width: 178px; height: 178px; left: 9px; bottom: 0; transform: rotate(-9deg); z-index: 3; }
.bird { width: 185px; height: 185px; right: 0; bottom: 37px; transform: rotate(9deg); }
.label { position: absolute; top: 24px; right: -8px; color: #b92c2e; background: #f6f1e5; border: 2px solid #b92c2e; padding: 8px 12px; font: 700 19px Dispatch; letter-spacing: 2px; transform: rotate(9deg); z-index: 4; }
footer { position: absolute; bottom: 0; width: 100%; height: 87px; background: #1c3947; color: #fff7e6; padding: 18px 60px; display: flex; align-items: center; justify-content: space-between; }
.features { font: 700 24px Dispatch; letter-spacing: 1px; }
.features span { color: #d9ba75; margin: 0 12px; }
.note { font: 400 16px/1.55 Body; text-align: right; color: #e7e1d2; }
@media (aspect-ratio: 1/1) {
  body { width: 1080px; height: 1080px; }
  header { height: 122px; }
  main { height: 841px; padding-top: 40px; text-align: center; }
  h1 { font-size: 112px; }
  .intro { width: 760px; margin: 23px auto 0; font-size: 29px; }
  .portraits { top: 407px; right: 270px; width: 540px; height: 390px; }
  .cat { left: 149px; width: 258px; height: 258px; }
  .dog { left: 0; bottom: 12px; width: 215px; height: 215px; }
  .bird { bottom: 8px; width: 209px; height: 209px; }
  .orbit { left: 88px; width: 360px; height: 360px; }
  .label { right: -6px; top: 39px; }
  footer { height: 117px; }
}
</style>
<body>
<header><img class="helmet" src="${art.helmet}" alt=""><div class="desk">The dispatch desk</div><div class="collection">THE HISTORICAL COLLECTION</div></header>
<main>
<p class="eyebrow">LONDON'S ANIMAL CALLOUTS, ON THE MAP</p>
<h1><span>London</span><span>Animal Rescue</span></h1>
<p class="intro">Explore the records.<br>Discover the stories behind the callouts.</p>
<div class="portraits"><div class="orbit"></div><div class="label">ILLUSTRATED COMPANIONS</div><div class="portrait cat"><img src="${art.cat}" alt="Cat illustration"></div><div class="portrait dog"><img src="${art.dog}" alt="Dog illustration"></div><div class="portrait bird"><img src="${art.bird}" alt="Bird illustration"></div></div>
</main>
<footer><div class="features">EXPLORE <span>·</span> REPLAY <span>·</span> NOTEBOOK</div><div class="note">Independent historical explorer<br>app.teinum.no/london-animal-rescue</div></footer>
</body></html>`;

await mkdir(new URL('public/social/', root), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height, name] of [
    [1200, 630, 'london-animal-rescue'],
    [1080, 1080, 'london-animal-rescue-square'],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(html);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (image) => image.decode()));
    });
    await page.screenshot({ path: new URL(`public/social/${name}.png`, root).pathname });
    await page.close();
    console.log(`Created ${name}.png (${width} × ${height})`);
  }
} finally {
  await browser.close();
}

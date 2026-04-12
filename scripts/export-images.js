#!/usr/bin/env node
/**
 * Exports:
 *   docs/avatar.png     — 500x500 org icon for GitHub
 *   docs/social.png     — 1280x640 social preview for GitHub repo
 */

const puppeteer = require('puppeteer');
const path = require('path');

const OUT = path.join(__dirname, '../docs');

const AVATAR_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 500px; height: 500px; }
  body {
    display: flex; align-items: center; justify-content: center;
    background: #111317;
    position: relative;
    overflow: hidden;
  }
  /* Subtle indigo glow behind the sparkle */
  .glow {
    position: absolute;
    width: 340px; height: 340px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(99,86,249,0.32) 0%, rgba(79,70,229,0.12) 45%, transparent 72%);
  }
  /* Four-pointed star drawn as SVG — crisp at any size */
  svg {
    position: relative;
    z-index: 1;
    width: 220px;
    height: 220px;
    filter: drop-shadow(0 0 32px rgba(139,120,255,0.45));
  }
</style>
</head>
<body>
  <div class="glow"></div>
  <!-- Four-pointed star path: sharp at top/bottom, wider on sides -->
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#a78bfa"/>
        <stop offset="100%" stop-color="#6366f1"/>
      </linearGradient>
    </defs>
    <!-- Four-point star: M cx,top C ... cx,bottom C ... cx,top -->
    <path d="
      M 100 8
      C 103 52, 148 97, 192 100
      C 148 103, 103 148, 100 192
      C 97 148, 52 103, 8 100
      C 52 97, 97 52, 100 8
      Z
    " fill="url(#g)"/>
    <!-- Small center dot for depth -->
    <circle cx="100" cy="100" r="7" fill="white" opacity="0.55"/>
  </svg>
</body>
</html>`;

const SOCIAL_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1280px; height: 640px; background: #ffffff; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
    position: relative;
  }

  /* Dot grid background */
  .dots {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px);
    background-size: 32px 32px;
    pointer-events: none;
  }
  /* Accent glow top-right */
  .glow {
    position: absolute;
    top: -120px; right: -80px;
    width: 520px; height: 520px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(79,70,229,0.13) 0%, transparent 70%);
    pointer-events: none;
  }

  .layout {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 460px;
    height: 100%;
    padding: 72px 80px 72px 96px;
    gap: 48px;
    align-items: center;
    z-index: 1;
  }

  /* LEFT */
  .left { display: flex; flex-direction: column; gap: 0; }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #8a8f98;
    margin-bottom: 28px;
  }
  .eyebrow .dot { color: #4f46e5; font-size: 16px; }

  h1 {
    font-size: 76px;
    line-height: 0.95;
    letter-spacing: -0.065em;
    font-weight: 880;
    color: #111317;
    margin-bottom: 28px;
    max-width: 9ch;
  }
  h1 em { font-style: normal; color: #4f46e5; }

  .desc {
    font-size: 19px;
    color: #45474d;
    line-height: 1.6;
    max-width: 420px;
    margin-bottom: 40px;
  }

  .tags {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .tag {
    padding: 6px 14px;
    border-radius: 9999px;
    border: 1px solid rgba(0,0,0,0.1);
    font-size: 13px;
    font-weight: 600;
    color: #45474d;
    background: #fff;
  }

  /* RIGHT — mock card */
  .card {
    background: #fff;
    border: 1px solid rgba(0,0,0,0.09);
    border-radius: 24px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.1);
    overflow: hidden;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .dots-row { display: flex; gap: 6px; }
  .dots-row span { width: 10px; height: 10px; border-radius: 50%; background: #e4e7ec; }
  .chip {
    font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
    color: #8a8f98; border: 1px solid rgba(0,0,0,0.07);
    background: rgba(0,0,0,0.03); border-radius: 9999px; padding: 4px 10px;
  }
  .card-body { padding: 14px; flex: 1; display: flex; flex-direction: column; gap: 12px; }

  .mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat {
    background: #f9fafb; border: 1px solid rgba(0,0,0,0.06); border-radius: 12px;
    padding: 12px 14px;
  }
  .stat.active { border-color: rgba(79,70,229,0.25); background: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.09); }
  .stat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #8a8f98; margin-bottom: 4px; }
  .stat-val { font-size: 22px; font-weight: 800; letter-spacing: -0.04em; color: #111317; }
  .stat-sub { font-size: 11px; color: #45474d; margin-top: 2px; }

  .code-strip {
    background: #f9fafb; border: 1px solid rgba(0,0,0,0.07); border-radius: 12px;
    padding: 12px 14px; font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 11px; line-height: 1.6; color: #45474d; white-space: pre;
  }
  .code-strip .hl { color: #4f46e5; font-weight: 700; }

  /* BOTTOM BAR */
  .bottom-bar {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 52px;
    border-top: 1px solid rgba(0,0,0,0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 96px 0 96px;
    background: #fff;
    z-index: 2;
  }
  .brand { font-size: 18px; font-weight: 800; letter-spacing: -0.04em; color: #111317; }
  .brand em { font-style: normal; color: #4f46e5; }
  .pills { display: flex; gap: 8px; }
  .pill {
    padding: 4px 12px; border-radius: 9999px;
    font-size: 12px; font-weight: 600; color: #8a8f98;
    border: 1px solid rgba(0,0,0,0.08);
  }
</style>
</head>
<body>
  <div class="dots"></div>
  <div class="glow"></div>

  <div class="layout">
    <div class="left">
      <div class="eyebrow"><span class="dot">✦</span> One attribute. Real context.</div>
      <h1>Your model knows what <em>they</em> see.</h1>
      <p class="desc">
        Give any UI element LLM awareness with <code style="font-family:ui-monospace,monospace;font-size:.9em;background:rgba(79,70,229,0.08);color:#4f46e5;padding:2px 7px;border-radius:6px">data-askable</code>.
        Zero framework lock-in. Lightweight core.
      </p>
      <div class="tags">
        <span class="tag">React</span>
        <span class="tag">Vue</span>
        <span class="tag">Svelte</span>
        <span class="tag">Django</span>
        <span class="tag">Streamlit</span>
      </div>
    </div>

    <div class="card">
      <div class="card-top">
        <div class="dots-row"><span></span><span></span><span></span></div>
        <div class="chip">live focus lens</div>
      </div>
      <div class="card-body">
        <div class="mini-grid">
          <div class="stat active">
            <div class="stat-label">MRR</div>
            <div class="stat-val">$128,400</div>
            <div class="stat-sub">+12.4% this month</div>
          </div>
          <div class="stat">
            <div class="stat-label">Churn</div>
            <div class="stat-val">3.2%</div>
            <div class="stat-sub">improving</div>
          </div>
          <div class="stat">
            <div class="stat-label">NPS</div>
            <div class="stat-val">67</div>
            <div class="stat-sub">avg 44</div>
          </div>
          <div class="stat">
            <div class="stat-label">Upsell</div>
            <div class="stat-val" style="font-size:16px">Umbrella</div>
            <div class="stat-sub">starter → biz</div>
          </div>
        </div>
        <div class="code-strip"><span class="hl">askable</span>.toPromptContext()
→ User is focused on: widget: revenue,
  metric: MRR, value: $128,400, change: +12.4%</div>
      </div>
    </div>
  </div>

  <div class="bottom-bar">
    <div class="brand"><em>ask</em>able-ui</div>
    <div class="pills">
      <span class="pill">github.com/askable-ui/askable</span>
      <span class="pill">lightweight core</span>
      <span class="pill">MIT</span>
    </div>
  </div>
</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // --- Avatar ---
  const avatarPage = await browser.newPage();
  await avatarPage.setViewport({ width: 500, height: 500, deviceScaleFactor: 2 });
  await avatarPage.setContent(AVATAR_HTML, { waitUntil: 'networkidle0' });
  await avatarPage.screenshot({ path: `${OUT}/avatar.png`, clip: { x: 0, y: 0, width: 500, height: 500 } });
  console.log('✓ avatar.png saved');

  // --- Social preview ---
  const socialPage = await browser.newPage();
  await socialPage.setViewport({ width: 1280, height: 640, deviceScaleFactor: 2 });
  await socialPage.setContent(SOCIAL_HTML, { waitUntil: 'networkidle0' });
  await socialPage.screenshot({ path: `${OUT}/social.png`, clip: { x: 0, y: 0, width: 1280, height: 640 } });
  console.log('✓ social.png saved');

  await browser.close();
  console.log('\nDone. Files in docs/');
})().catch(err => { console.error(err); process.exit(1); });

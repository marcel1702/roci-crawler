/**
 * Rauchtest der gebauten App im Headless-Browser (Playwright).
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/smoke.cjs http://localhost:4173/ [Ausgabeordner]
 *
 * Prüft: Titelseite startet, ein Spielstand entsteht, Hub und Mission laufen, die Figur lässt sich bewegen, eine
 * Fähigkeit wirkt, der Service Worker wird aktiv, die App startet offline neu, und es gab keine Konsolenfehler.
 * Das Debug-Objekt `window.__roci` steht in der gebauten App nur mit `?debug` zur Verfügung.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const base = (process.argv[2] ?? 'http://localhost:4173/').replace(/\/?$/, '/');
const outDir = process.argv[3] ?? path.join(__dirname, '..', 'smoke-out');
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`));
  page.on('console', (message) => {
    // Treiber-Hinweise des Software-Renderers sind keine Fehler des Spiels.
    if (message.type() === 'error' && !/GL Driver Message|GPU stall/.test(message.text())) errors.push(message.text());
  });

  const active = (keys) => page.evaluate((keys) => keys.filter((key) => window.__roci.scene.isActive(key)), keys);
  const ready = (scene, timeout = 30000) => page.waitForFunction((scene) => window.__roci?.scene.isActive(scene), scene, { timeout });

  // 1) Titelseite
  await page.goto(`${base}?debug`);
  await ready('TitleScene');
  check('Titelseite startet', (await active(['TitleScene'])).length === 1);
  await page.screenshot({ path: path.join(outDir, '1-title.png') });

  // 2) Neuer Spielstand direkt im Hub
  await page.goto(`${base}?debug&slot=1&reset&class=naomi`);
  await ready('HubScene');
  await sleep(1500);
  check('Hub und HUD laufen', (await active(['HubScene', 'HudScene'])).length === 2);
  await page.screenshot({ path: path.join(outDir, '2-hub.png') });

  // 3) Mission mit festem Seed
  await page.goto(`${base}?debug&seed=7&class=amos&reset`);
  await ready('MissionScene');
  await page.waitForFunction(() => window.__roci.scene.getScene('MissionScene').player, null, { timeout: 30000 });
  await sleep(6000); // Phaser begrenzt die ersten Bilder
  const mission = await page.evaluate(() => {
    const scene = window.__roci.scene.getScene('MissionScene');
    return { enemies: scene.enemies.length, chests: scene.chests.length, hp: scene.player.hp, x: scene.player.x, y: scene.player.y };
  });
  check('Mission hat Gegner und Truhen', mission.enemies > 0 && mission.chests > 0, JSON.stringify(mission));

  // Figur per Befehl bewegen
  const moved = await page.evaluate(async () => {
    const scene = window.__roci.scene.getScene('MissionScene');
    const player = scene.player;
    const start = { x: player.x, y: player.y };
    player.commandMoveTo(start.x + 60, start.y);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return Math.hypot(player.x - start.x, player.y - start.y);
  });
  check('Figur bewegt sich', moved > 20, `${Math.round(moved)} px`);

  // Fähigkeit gegen einen herbeigeholten Gegner
  const ability = await page.evaluate(async () => {
    const scene = window.__roci.scene.getScene('MissionScene');
    const player = scene.player;
    const grid = scene.grid;
    let dx = 0;
    for (const d of [40, -40, 30, -30]) if (grid.isWalkable(grid.toCol(player.x + d), grid.toRow(player.y))) { dx = d; break; }
    const enemy = scene.spawnEnemy('thug', player.x + dx, player.y);
    enemy.hp = enemy.stats.maxHp = 100000;
    const before = enemy.hp;
    player.useAbility(2); // Gnadenloser Schlag: Fläche um die Figur
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { hit: before - enemy.hp };
  });
  check('Fähigkeit trifft', ability.hit > 0, JSON.stringify(ability));
  await page.screenshot({ path: path.join(outDir, '3-mission.png') });

  // 4) Ein Tipp auf einen Gegner löst den Angriff aus (Touch-Eingabe, Weltkoordinaten -> Bildschirm)
  const index = await page.evaluate(() => {
    const scene = window.__roci.scene.getScene('MissionScene');
    const enemy = scene.enemies.find((e) => !e.isDead && e.hp > 0 && e.def.id !== 'brute');
    if (!enemy) return -1;
    // In einen freien Bereich vor dem Gegner stellen; Gegner stillhalten, damit er nicht wegläuft.
    scene.player.cancelCommands();
    scene.player.setPosition(enemy.x - 60, enemy.y);
    enemy.stun(60000);
    return scene.enemies.indexOf(enemy);
  });
  if (index >= 0) {
    await sleep(2000); // Kamera folgt mit Verzögerung
    const screen = await page.evaluate((index) => {
      const scene = window.__roci.scene.getScene('MissionScene');
      const cam = scene.cameras.main;
      const dpr = window.__roci.registry.get('devicePixelRatio');
      const enemy = scene.enemies[index];
      return { x: ((enemy.x - cam.worldView.x) * cam.zoom) / dpr, y: ((enemy.y - cam.worldView.y) * cam.zoom) / dpr };
    }, index);
    await page.touchscreen.tap(screen.x, screen.y);
    await sleep(300);
    const attacking = await page.evaluate((index) => window.__roci.scene.getScene('MissionScene').player.attackTarget === window.__roci.scene.getScene('MissionScene').enemies[index], index);
    check('Tippen auf einen Gegner greift an', attacking, `Tipp bei ${Math.round(screen.x)}, ${Math.round(screen.y)}`);
  } else {
    check('Tippen auf einen Gegner greift an', false, 'kein Gegner gefunden');
  }

  // 5) PWA: Service Worker aktiv, Neustart ohne Netz
  await page.goto(`${base}?debug`);
  await ready('TitleScene');
  const worker = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    await navigator.serviceWorker.ready;
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.active?.state ?? null;
  });
  check('Service Worker aktiv', worker === 'activated', String(worker));
  await sleep(1500);
  await context.setOffline(true);
  await page.reload();
  await ready('TitleScene', 20000).then(
    () => check('Offline-Neustart zeigt die Titelseite', true),
    () => check('Offline-Neustart zeigt die Titelseite', false),
  );
  await context.setOffline(false);

  check('keine Konsolenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures.length === 0 ? '\nRauchtest bestanden.' : `\nRauchtest FEHLGESCHLAGEN: ${failures.join(', ')}`);
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

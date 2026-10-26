# CLAUDE.md – Projektregeln

**Roci Crawler** ist ein Diablo-artiges Action-RPG im Universum von *The Expanse* (privates Fanprojekt), als PWA für Smartphone und Tablet.
Design: `docs/GDD.md` (Quelle der Wahrheit für Spielinhalte). Fahrplan: `docs/MILESTONES.md`.

## Arbeitsweise

- **Meilensteinweise arbeiten.** Nur umsetzen, was im aktuellen Meilenstein steht. Nichts vorwegnehmen.
- **Vor größeren Designentscheidungen den Auftraggeber fragen** (neue Mechaniken, Klassenfähigkeiten, Balancing-Konzepte, Story). Kleine technische Entscheidungen selbst treffen und im Ergebnis nennen.
- Änderungen am Design im GDD nachziehen, Änderungen an Architektur/Regeln hier.
- Sprache: **Doku, UI-Texte und Code-Kommentare auf Deutsch; Bezeichner im Code auf Englisch.**

## Befehle

```bash
npm run dev        # Dev-Server, im WLAN erreichbar (host: true), Port 5173
npm run build      # Typprüfung + Produktions-Build inkl. Service Worker (dist/)
npm run preview    # Build ansehen, Port 4173 (hier läuft die PWA/der Service Worker)
npm run check      # Typprüfung + Unit-Tests – vor jedem Commit ausführen
npm test           # Vitest einmalig; npm run test:watch zum Entwickeln
npm run icons      # PWA-Icons aus public/favicon.svg neu erzeugen
```

## Technik (Versionen bewusst gewählt)

- **Phaser 3.90.x** (nicht Phaser 4, auch wenn npm `latest` darauf zeigt), TypeScript strikt, Vite 8, `vite-plugin-pwa`, Vitest.
- Keine weiteren Laufzeit-Abhängigkeiten ohne Absprache. Keine Bilddateien: Platzhaltergrafik entsteht zur Laufzeit (`src/graphics/placeholderTextures.ts`).
- Service Worker läuft nur im Produktions-Build und nur über HTTPS oder `localhost`. Im WLAN über `http://<ip>:5173` ist das Spiel spielbar, aber nicht installierbar.

## Architektur

```
src/
  core/        Reine Spiellogik, KEIN Phaser-Import. Gut testbar (tests/core).
               Raster, Kollision, Pfadfindung, Wegverfolgung, Kampfformeln, Werte/Stufen, Geschosse, Zufall (seeded).
  data/        Statische Inhalte (Klassen, Gegner, Level) als typisierte Objekte. Keine Logik, keine Texte.
  abilities/   Wirkung der Klassenfähigkeiten (Phaser-abhängig), Registry `ABILITIES` je `AbilityId`.
  entities/    Phaser-Objekte mit Zustand: Actor (Basis), Player, Enemy.
  systems/     Eigenständige Spielsysteme pro Szene: Eingabe (Tippen), Kampf, Geschosse, Kamera, Trennung.
  scenes/      Dünn halten: BootScene, MissionScene (Spielwelt), HudScene (Oberfläche darüber).
  ui/          Wiederverwendbare HUD-Bausteine.
  graphics/    Erzeugung der Platzhalter-Texturen.
  platform/    Gerätenahes: HiDPI-Skalierung, Safe-Area.
  pwa/         Service-Worker-Registrierung und Update-Hinweis.
  i18n/        t(key), Sprachtabellen (de.ts ist die Referenz).
  config/      Konstanten, Palette.
```

**Abhängigkeitsrichtung:** `scenes → systems/entities/ui → core/data/config`. `core` importiert nie aus `entities`, `scenes` oder Phaser.
Entities kennen ihre Szene nur über das Interface `WorldContext` (kein Import von `MissionScene`).
Szenen sprechen untereinander über Ereignisse auf `game.events` (`GAME_EVENTS` in `config/constants.ts`), nicht über direkte Referenzen. Ausnahme: `HudScene.isOverUi()` für den Touch-Filter.

## Konventionen

- **Einheiten:** Längen in Welt-Pixeln (Kachel = 32), Geschwindigkeit in px/s, Zeiten in `core` und Daten in **ms**, in Update-Schleifen `dt` in **Sekunden** (auf 50 ms gedeckelt).
- **Gegnerangriffe** haben immer eine Ankündigung (`windupMs` + rote Gefahrenzone); neue Gegner folgen dieser Regel (Lesbarkeit, siehe GDD).
- **Neue Fähigkeit:** Kennung in `AbilityId` (`data/types.ts`), Wirkung in `src/abilities`, Text-Schlüssel `ability.<id>.name`, Eintrag in `ABILITIES`, Belegung in `data/classes.ts`.
- **Schaden:** immer über `CombatSystem.dealDamage` (zeigt Zahlen, meldet Todesfälle über `MISSION_EVENTS.actorKilled`), nie direkt `takeDamage`.
- **Fortschritt** (`Progression`) lebt im `game.registry` und überdauert Missionsneustarts; Meilenstein 4 ersetzt das durch den Spielstand.
- **Entities** heißen ihre Update-Methode `tick()` (Phasers `update` ist belegt) und werden von der Szene aufgerufen.
- **Texte:** Nie sichtbare Texte im Code. Immer `t('schluessel')`; Schlüssel in `src/i18n/de.ts`. Daten verweisen mit `TextKey`.
- **Zufall:** Nur über `Rng` aus `core/rng.ts` (seeded), nie `Math.random()`, damit Dungeons und Beute reproduzierbar sind.
- **Kollision/Bewegung:** Eigene Kreis-gegen-Kachel-Kollision (`core/collision.ts`), keine Phaser-Physik. Neue Bewegungsarten (Schwerelosigkeit) erweitern `Actor.moveBy` bzw. den Weg-/Geschwindigkeitsteil, nicht die Kollision.
- **Kein `any`**, kein Ignorieren von Typfehlern. Kommentare nur, wo das *Warum* nicht offensichtlich ist.
- **Speicherstände** (ab Meilenstein 4): versioniertes Schema mit Migrationsfunktionen; nie das Format ändern, ohne zu migrieren.

## Mobile & PWA

- Mindest-Tippfläche 44–48 CSS-px. Nichts darf nur über Hover oder Rechtsklick erreichbar sein.
- Die Spielfläche hat Geräte-Pixel-Größe (`devicePixelRatio`, auf 2 begrenzt) und wird per CSS verkleinert. HUD-Maße in CSS-px denken und mit `u` (= Pixelverhältnis) multiplizieren. Kamera-Zoom kommt aus `ResponsiveCamera`.
- Seitenränder (Notch) über `readSafeArea()` beachten.
- `touch-action: none`, kein Scrollen/Zoomen/Textmarkieren (siehe `styles.css`); Mehrfingerbedienung muss funktionieren.
- Neue Releases aktivieren sich erst nach Tippen auf den Update-Hinweis (`registerType: 'prompt'`).

## Tests & Prüfen

- Neue Logik in `src/core` bekommt Vitest-Tests in `tests/core`.
- Dev-Server stellt `window.__roci` (das Phaser-Spiel) bereit: für Konsole und automatisierte Browser-Tests. Nützlich: `scene.getScene('MissionScene').spawnEnemy('gunner', x, y)`, `.player.useAbility(i)`, `.player.gainXp(n)`.
- Beim Prüfen im Headless-Browser beachten: Phaser deckelt `delta` in den ersten ~120 Frames nach dem Start auf einen Frame. Vor Bewegungstests ca. 5 s warten.
- Vor jeder Übergabe: `npm run check` und `npm run build`.

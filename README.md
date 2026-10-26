# Roci Crawler

Diablo-artiges Action-RPG im Universum von *The Expanse*: privates, nicht-kommerzielles Fanprojekt.
Läuft als Progressive Web App (Phaser 3 + TypeScript + Vite) auf Smartphone und Tablet.

**Stand: Meilenstein 6** – vier spielbare Klassen (Amos, Naomi, Bobbie, Holden) mit je drei Fähigkeiten und Talentbaum, Titelseite mit drei Spielständen, begehbare Rocinante als Hub (Missionskonsole, Waffenkammer, Händler), zufällige Dungeon-Missionen mit Nebel, Truhen, Gegnern (Nahkämpfer, Schützen, Elite), Fähigkeiten, Erfahrung, Beute in fünf Seltenheiten (Herkunft Erde/Mars/Gürtel), Rucksack mit Ausrüstung und automatischem Spielstand.
Design: [`docs/GDD.md`](docs/GDD.md) · Fahrplan: [`docs/MILESTONES.md`](docs/MILESTONES.md) · Projektregeln: [`CLAUDE.md`](CLAUDE.md)

## Starten

Voraussetzung: Node.js 20.19+ oder 22.12+.

```bash
npm install
npm run dev
```

Der Dev-Server ist im lokalen WLAN erreichbar. Vite zeigt die Adresse an (`Network: http://192.168.x.x:5173/`);
diese Adresse im Browser des Tablets öffnen. Rechner und Tablet müssen im selben Netz sein, ggf. Firewall-Freigabe für Port 5173.

## Bedienung

- Auf den Boden tippen (oder halten und ziehen): dorthin laufen.
- Gegner antippen: hinlaufen und angreifen.
- In **schwerelosen Räumen** (violetter Boden) gleitet die Figur weiter, bis sie gegensteuert; Treffer und Schüsse stoßen zurück. Die Taste unten links (oder Leertaste) **stabilisiert** und bremst ab.
- Die drei Kreise unten rechts sind die Fähigkeiten der gewählten Figur, der kleine grüne Kreis ist der Trank. Links oben öffnen Rucksack-Taste (`I`) und Talent-Taste (`T`, mit Zahl der freien Punkte) die Fenster.
- Im Hub: Station antippen, die Figur läuft hin und benutzt sie. Die Missionskonsole bietet drei Aufträge, der Händler verkauft Ausrüstung, das Terminal wechselt den Spielstand.
- Ziel jeder Mission: Luftschleuse finden, ihre Wächter besiegen, hineingehen. Truhen öffnen sich beim Herangehen. Nach drei Missionen schaltet sich der **Hauptauftrag** mit dem Gangboss frei (Akt 1).
- In Akt 2 (Eros) bremsen und schaden grüne Wucherungen am Boden und Sporenzonen; rote Kreise kündigen sie an. Nach jedem Boss schaltet sich der nächste Akt frei (Reiter oben in der Missionskonsole); nach dem Finale am Ringtor (Akt 3) folgt der Abspann.
- Ton: Lautsprecher-Taste links oben (oder `M`) schaltet stumm; die Wahl bleibt gespeichert. Der Ton beginnt nach der ersten Berührung.
- Beute (farbige Kristalle) wird beim Darüberlaufen aufgehoben. Der Rucksack-Knopf links oben (oder Taste `I`) öffnet Ausrüstung und Inventar.
- Der Spielstand (drei Plätze) wird automatisch im Browser gespeichert. Zum Testen: `?slot=2` lädt/beginnt Platz 2 direkt im Hub, `?reset` beginnt Platz 1 neu.
- Am Desktop funktioniert die Maus genauso.
- Zum Ausprobieren: `?seed=123` an die URL hängen lädt genau diesen Dungeon, `?mode=arena` die Testarena mit endlosen Wellen, `&zerog=1` macht jeden Kampfraum schwerelos, `&act=3` wählt den Akt, `&boss` stellt dessen Boss in den Ausgangsraum, `?ending` zeigt den Abspann.

## PWA und Installation auf dem Homescreen

Service Worker und „Zum Homescreen hinzufügen“ brauchen **HTTPS** (oder `localhost`). Über `http://<ip>:5173` im WLAN ist das Spiel spielbar, aber nicht installierbar.

```bash
npm run build      # erzeugt dist/ inkl. Service Worker und Manifest
npm run preview    # http://localhost:4173, hier lässt sich Offline-Betrieb prüfen
```

### GitHub Pages (HTTPS, für Installation auf dem Tablet)

`.github/workflows/pages.yml` prüft jeden Push (Typen, Tests, Build) und veröffentlicht Pushes auf den Default-Branch
unter `https://<benutzer>.github.io/roci-crawler/`. Einmalig einrichten:

1. Im Repository **Settings → Pages → Build and deployment → Source: „GitHub Actions“** wählen.
2. Einen Push auf den Default-Branch machen oder unter **Actions → „Prüfen & GitHub Pages“ → Run workflow** starten.
3. Die URL auf dem Tablet öffnen, einmal laden (danach läuft das Spiel offline) und „Zum Homescreen hinzufügen“ wählen.

Hinweise: GitHub Pages aus einem **privaten** Repository gibt es nur mit einem kostenpflichtigen Plan (Pro/Team), und die veröffentlichte Seite
ist dann trotzdem öffentlich per URL erreichbar. Wer das nicht möchte, kann `dist/` auch auf einen anderen HTTPS-Host legen
(`VITE_BASE` setzen, wenn er einen Unterpfad nutzt).

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit Hot Reload |
| `npm run build` | Typprüfung und Produktions-Build |
| `npm run preview` | Build lokal ansehen |
| `npm run check` | Typprüfung und Unit-Tests |
| `npm test` | Unit-Tests (Vitest) |
| `npm run icons` | PWA-Icons aus `public/favicon.svg` erzeugen |

## Hinweis zu Phaser

Das Projekt nutzt bewusst **Phaser 3.90**. Auf npm zeigt `latest` inzwischen auf Phaser 4; ein Update wäre eine eigene Migration.

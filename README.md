# Roci Crawler

Diablo-artiges Action-RPG im Universum von *The Expanse*: privates, nicht-kommerzielles Fanprojekt.
Läuft als Progressive Web App (Phaser 3 + TypeScript + Vite) auf Smartphone und Tablet.

**Stand: Meilenstein 1** – eine Spielfigur (Amos) läuft per Tippen durch eine Testarena, weicht Wänden per Pfadfindung aus und bekämpft Gegner.
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
- Die drei Kreise unten rechts sind Platzhalter für Fähigkeiten (ab Meilenstein 2).
- Am Desktop funktioniert die Maus genauso.

## PWA und Installation auf dem Homescreen

Service Worker und „Zum Homescreen hinzufügen“ brauchen **HTTPS** (oder `localhost`). Über `http://<ip>:5173` im WLAN ist das Spiel spielbar, aber nicht installierbar.

```bash
npm run build      # erzeugt dist/ inkl. Service Worker und Manifest
npm run preview    # http://localhost:4173, hier lässt sich Offline-Betrieb prüfen
```

Für die Installation auf dem Tablet braucht `dist/` einen HTTPS-Host, z. B. GitHub Pages (`VITE_BASE=/roci-crawler/ npm run build`
für den Unterpfad), ein Tunnel-Dienst oder ein lokales Zertifikat. Welche Variante gewünscht ist, ist im GDD als offene Frage vermerkt.

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

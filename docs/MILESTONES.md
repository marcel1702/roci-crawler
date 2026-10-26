# Meilensteinplan

Jeder Meilenstein ist einzeln spielbar und prüfbar. Umfang: **S** ≈ 1 Sitzung, **M** ≈ 2–3, **L** ≈ 4+.
Vor jedem Meilenstein werden die zugehörigen offenen Fragen aus `docs/GDD.md` geklärt.

| # | Titel | Inhalt | Fertig, wenn … | Umfang |
|---|---|---|---|---|
| **1** | **Fundament** ✅ | Vite + TypeScript + Phaser 3, PWA (offline, installierbar), Dev-Server im WLAN, Testarena, Spielfigur (Amos) mit Tippen-zum-Laufen, Pfadfindung, Gegner mit einfacher KI, Nahkampf, HUD-Grundlayout, Hoch- und Querformat | Auf dem Tablet läuft die Figur per Tippen, greift Gegner an, stirbt und startet neu; die gebaute App startet offline | M |
| **2** | Kampfkern ✅ | 3 Fähigkeiten-Tasten (Amos) mit Abklingzeit, Fernkampf-Gegner mit Projektilen und Sichtlinie, Elite-Gegner, Angriffs-Ankündigung, Erfahrung und Stufenaufstieg, Trank-Taste | Ein Kampf mit 3 Gegnertypen macht Spaß und ist fair lesbar | M |
| **3** | Dungeon-Generator ✅ | Seeded Räume-und-Gänge-Generator, Spawn-Tabellen, Truhen, Missionsziel (Ausgang/Boss), Kamera/Nebel, Ergebnisbildschirm | Jeder Seed erzeugt einen lösbaren Dungeon (automatisch geprüft); eine Mission lässt sich von Start bis Ziel spielen | M |
| **4** | Beute, Inventar, Speichern ✅ | Item-Modell, 5 Seltenheiten, Herkunft Erde/Mars/Gürtel mit Boni, Drops, touchfreundliches Inventar und Ausrüstung, versionierter Spielstand (localStorage) | Ausgerüstete Items ändern Werte spürbar; Spielstand überlebt Neuladen | L |
| **5** | Rocinante-Hub ✅ | Hub-Szene, Missionswahl, Händler, Ausrüstung, Neues Spiel und Spielstand-Auswahl, Klassenwahl | Der komplette Kreislauf Hub → Mission → Hub funktioniert | M |
| **6** | Klassen & Talente | Naomi (Drohnen, Hacks), Bobbie (Fernkampf, Rüstung), Holden (Crew-Rufe), Talentbaum-System und -Oberfläche | Alle 4 Klassen sind spielbar und unterscheiden sich deutlich | L |
| **7** | Schwerelosigkeit | Bewegungsmodus mit Trägheit, markierte Zonen, Abprallen, Rückstoß, „Stabilisieren“, Gürtler-Boni | Übergang normal ↔ schwerelos ist verständlich und macht Spaß | M |
| **8** | Akt 1: Ceres/Tycho | Missionen, 4 Gegnertypen, Gangboss, Dialogtexte, Schwierigkeitskurve, Platzhalter-Audio | Akt 1 ist von Anfang bis Boss durchspielbar (ca. 60–75 Min.) | L |
| **9** | Akt 2: Eros | Mutanten-Gegner, Schwerelosigkeits-Sektionen, Boss | Akt 2 komplett durchspielbar | L |
| **10** | Akt 3: Ganymed/Ringtore | Hybrid-Soldaten, Finale am Ringtor, Abspann | Das gesamte Spiel ist in 3–5 Stunden durchspielbar | L |
| **11** | Politur & Release | Balancing, Audio, Einführung/Tutorial, Performance auf schwachen Geräten, Barrierefreiheit, optional Capacitor-Pakete (iOS/Android) | Spielbare Fassung ohne bekannte Blocker auf Zielgeräten | L |

## Querschnittsthemen (laufend)

- **Tests:** Spiellogik in `src/core` ist per Vitest abgedeckt (u. a. 600 Seeds auf Lösbarkeit). Ein automatischer Browser-Rauchtest (Playwright) in CI steht noch aus; bisher wurde der Ablauf manuell per Skript im Headless-Browser geprüft.
- **Hosting:** GitHub Pages über `.github/workflows/pages.yml` (Prüfen bei jedem Push, Deploy vom Default-Branch).
- **Leistung:** Zielwert 60 fps auf einem mittleren Tablet; Phaser-Chunk bleibt getrennt (Cache-freundlich).
- **Dokumente pflegen:** Änderungen am Design landen im GDD, Änderungen an Architektur oder Regeln in `CLAUDE.md`.

## Meilenstein 1: Umfang im Detail

Enthalten: Projekt-Setup, PWA-Grundgerüst, eine Spielfigur (Amos), die per Tippen läuft und Gegner angreift.
Zusätzlich, weil dafür nötig oder sehr klein: Pfadfindung (A*), Wandkollision, Gegner-KI (verfolgen und schlagen), HUD mit Platzhaltern für die 3 Fähigkeiten (damit Touch-Layout und „Tipp auf HUD läuft nicht los“ früh feststehen), Tod und Neustart, Gegnerwellen in der Testarena.
Bewusst **nicht** enthalten: funktionierende Fähigkeiten, Items, Dungeon-Generator, Speichern, weitere Klassen, Schwerelosigkeit, Audio.

## Meilenstein 2: Umfang im Detail

Umgesetzt (Details und Zahlen: GDD, Abschnitte 5, 6 und 10):
- **Fähigkeiten-System** (`src/abilities`): Taste → Fähigkeit mit Abklingzeit; Amos: Rammbock, Standhaft, Gnadenloser Schlag. Tasten zeigen Symbol und Abklingzeit, Tipp auf Taste lässt die Figur nie laufen.
- **Trank-Taste:** 3 Tränke pro Mission, heilt 40 %.
- **Gegner:** Schläger (Nahkampf), Schütze (Fernkampf mit Projektilen, Sichtlinie, hält Abstand), Brecher (Elite, Flächenschlag). Jeder Angriff wird durch eine rote Gefahrenzone angekündigt; Ausweichen und Betäubung unterbrechen ihn.
- **Erfahrung und Stufen:** Kurve bis Stufe 30, Werte wachsen pro Stufe; Stufe und Erfahrung bleiben über Neustarts erhalten (bis der Spielstand in Meilenstein 4 kommt).
- **Testarena:** 5 Wellen, danach Wiederholung mit härteren Gegnern; Wellenzähler im HUD.

Bewusst **nicht** enthalten (kommt später): Talentpunkte (Meilenstein 6), Items und Beute (4), weitere Klassen (6), Elite-Zusatzfähigkeiten, Audio.

## Meilenstein 3: Umfang im Detail

Umgesetzt (Details und Zahlen: GDD, Abschnitt 7):
- **Dungeon-Generator** (`core/dungeon.ts`): seeded Räume-und-Gänge-Karte, 64×44 Kacheln; Rollen Start, Ausgang, Kampf, Schatz. Ein Test erzeugt 600 Seeds und prüft Erreichbarkeit aller Räume, Gegner, Truhen und einen Pfad zum Ausgang (für Spielfigur und größten Gegner).
- **Begegnungsplanung** (`core/encounters.ts`) mit Spawn-Tabelle für Akt 1 (`data/spawnTables.ts`): Gruppen nach Tiefe gewichtet, Wächter im Ausgangsraum, Bewacher in Schatzräumen.
- **Missionsablauf:** Luftschleuse finden, Wächter besiegen, Ausgang betreten, Ergebnisbildschirm (Zeit, Gegner, Truhen, Credits, Erfahrung), Tippen startet die nächste Mission mit neuem Seed.
- **Truhen** (Credits, manchmal ein Trank), **Nebel des Krieges** mit weichem Rand und Minikarte, Aufgabentext im HUD.
- Gegner bemerken den Spieler durch Wände erst aus nächster Nähe (sonst brauchen sie Sichtlinie).
- Testarena bleibt als Übungsmodus erhalten: `?mode=arena`. Feste Karte zum Nachstellen: `?seed=123`.

Bewusst **nicht** enthalten: Items als Beute (Meilenstein 4), Hub und Händler für die Credits (5), Bossräume und Raum-Module (8), Schwerelosigkeits-Zonen (7).

## Meilenstein 4: Umfang im Detail

Umgesetzt (Details und Zahlen: GDD, Abschnitte 9 und 12):
- **Item-Modell** (`core/items.ts`): 5 Seltenheiten, 5 Plätze, Herkunft Erde/Mars/Gürtel mit Bonus und Set-Bonus ab 3 Teilen, 2 legendäre Spezialeffekte; deterministisch würfelbar. Regeln und Zahlen in `data/items.ts`, `data/loot.ts`.
- **Wirkung im Spiel:** Panzerung, Krit., Lebensraub, Abklingzeit, Tempo, Leben, Schaden, Trankheilung und -anzahl.
- **Beute:** Drops von Gegnern (Elite/Wächter sicher), Truhen; Aufheben beim Darüberlaufen.
- **Inventar-Oberfläche** (`scenes/InventoryScene.ts`): Rucksack (20), Ausrüstung, Detailkarte mit Vergleich, Ablegen, Verwerten, „Gewöhnliche verwerten“; Quer- und Hochformat; öffnet per HUD-Taste oder `I`, pausiert die Mission.
- **Spielstand** (`core/profile.ts`, `persistence/`): versioniert, robust gegen kaputte Daten, Autospeichern; `?reset` zum Zurücksetzen.
- Tests: Item-Würfeln (Verteilungen, Herkunft, Skalierung), Inventar, Spielstand-Rundreise, Beschädigung, neuere Version.

Bewusst **nicht** enthalten: Händler (Meilenstein 5), Klassen-spezifische Waffen, Verbessern/Zerlegen von Gegenständen, weitere legendäre Effekte, mehrere Spielstände.

## Meilenstein 5: Umfang im Detail

Umgesetzt (Details: GDD, Abschnitte 4, 11, 12):
- **Titelseite** mit **3 Spielständen** (Spielstand-Karten mit Figur, Stufe, Credits, Missionen, Datum, Löschen mit Bestätigung) und **Klassenwahl** für neue Spiele (alle vier Figuren sichtbar, bisher nur Amos wählbar). Der Spielstand aus Meilenstein 4 wird in Platz 1 übernommen.
- **Hub „Rocinante“** als begehbare Ebene: Missionskonsole, Waffenkammer (Rucksack/Ausrüstung), Händler, Spielstand-Terminal (zurück zur Titelseite); Besatzung (die drei übrigen Figuren) mit Platzhalter-Sprüchen. Tippen auf eine Station läuft hin und benutzt sie.
- **Aufträge** an der Missionskonsole: drei Angebote (zwei normal, einer schwer: +35 % Leben, +20 % Schaden, bessere Beute, +50 % Credits), wechseln nach jeder abgeschlossenen Mission.
- **Händler:** sechs Gegenstände (je Platz einer, dazu ein weiterer), Preis = 3 × Wert, wechselt nach jeder Mission, Käufe bleiben im Spielstand.
- **Kreislauf:** Hub → Auftrag → Mission → Ergebnis/Tod → Hub. Die Testarena (`?mode=arena`) bleibt als Übungsmodus.
- Gemeinsamer UI-Unterbau (`ui/PanelScene`, `ui/itemWidgets`) für Rucksack, Händler, Aufträge und Titel.
- Tests: Hub-Karte (Stationen erreichbar), Aufträge, Händler und Kauf, Spielstand-Plätze und Übernahme.

Bewusst **nicht** enthalten: Missionen mit Handlung und Akt-Auswahl (kommen mit den Akten, Meilensteine 8–10), Werkbank zum Verbessern, echte Dialoge der Besatzung (die Sprüche sind Platzhalter), Klassenwechsel innerhalb eines Spielstands.


# Meilensteinplan

Jeder Meilenstein ist einzeln spielbar und prüfbar. Umfang: **S** ≈ 1 Sitzung, **M** ≈ 2–3, **L** ≈ 4+.
Vor jedem Meilenstein werden die zugehörigen offenen Fragen aus `docs/GDD.md` geklärt.

| # | Titel | Inhalt | Fertig, wenn … | Umfang |
|---|---|---|---|---|
| **1** | **Fundament** ✅ | Vite + TypeScript + Phaser 3, PWA (offline, installierbar), Dev-Server im WLAN, Testarena, Spielfigur (Amos) mit Tippen-zum-Laufen, Pfadfindung, Gegner mit einfacher KI, Nahkampf, HUD-Grundlayout, Hoch- und Querformat | Auf dem Tablet läuft die Figur per Tippen, greift Gegner an, stirbt und startet neu; die gebaute App startet offline | M |
| **2** | Kampfkern | 3 Fähigkeiten-Tasten (Amos) mit Abklingzeit, Fernkampf-Gegner mit Projektilen und Sichtlinie, Elite-Gegner, Angriffs-Ankündigung, Erfahrung und Stufenaufstieg, Trank-Taste | Ein Kampf mit 3 Gegnertypen macht Spaß und ist fair lesbar | M |
| **3** | Dungeon-Generator | Seeded Räume-und-Gänge-Generator, Spawn-Tabellen, Truhen, Missionsziel (Ausgang/Boss), Kamera/Nebel, Ergebnisbildschirm | Jeder Seed erzeugt einen lösbaren Dungeon (automatisch geprüft); eine Mission lässt sich von Start bis Ziel spielen | M |
| **4** | Beute, Inventar, Speichern | Item-Modell, 5 Seltenheiten, Herkunft Erde/Mars/Gürtel mit Boni, Drops, touchfreundliches Inventar und Ausrüstung, versionierter Spielstand (localStorage) | Ausgerüstete Items ändern Werte spürbar; Spielstand überlebt Neuladen | L |
| **5** | Rocinante-Hub | Hub-Szene, Missionswahl, Händler, Ausrüstung, Neues Spiel und Spielstand-Auswahl, Klassenwahl | Der komplette Kreislauf Hub → Mission → Hub funktioniert | M |
| **6** | Klassen & Talente | Naomi (Drohnen, Hacks), Bobbie (Fernkampf, Rüstung), Holden (Crew-Rufe), Talentbaum-System und -Oberfläche | Alle 4 Klassen sind spielbar und unterscheiden sich deutlich | L |
| **7** | Schwerelosigkeit | Bewegungsmodus mit Trägheit, markierte Zonen, Abprallen, Rückstoß, „Stabilisieren“, Gürtler-Boni | Übergang normal ↔ schwerelos ist verständlich und macht Spaß | M |
| **8** | Akt 1: Ceres/Tycho | Missionen, 4 Gegnertypen, Gangboss, Dialogtexte, Schwierigkeitskurve, Platzhalter-Audio | Akt 1 ist von Anfang bis Boss durchspielbar (ca. 60–75 Min.) | L |
| **9** | Akt 2: Eros | Mutanten-Gegner, Schwerelosigkeits-Sektionen, Boss | Akt 2 komplett durchspielbar | L |
| **10** | Akt 3: Ganymed/Ringtore | Hybrid-Soldaten, Finale am Ringtor, Abspann | Das gesamte Spiel ist in 3–5 Stunden durchspielbar | L |
| **11** | Politur & Release | Balancing, Audio, Einführung/Tutorial, Performance auf schwachen Geräten, Barrierefreiheit, optional Capacitor-Pakete (iOS/Android) | Spielbare Fassung ohne bekannte Blocker auf Zielgeräten | L |

## Querschnittsthemen (laufend)

- **Tests:** Spiellogik in `src/core` ist per Vitest abgedeckt. Ab Meilenstein 3 zusätzlich ein Browser-Rauchtest (Playwright) für Start, Laufen, Angreifen.
- **Hosting:** Sobald ein HTTPS-Ziel feststeht (siehe GDD, Frage 5), Deploy-Workflow ergänzen.
- **Leistung:** Zielwert 60 fps auf einem mittleren Tablet; Phaser-Chunk bleibt getrennt (Cache-freundlich).
- **Dokumente pflegen:** Änderungen am Design landen im GDD, Änderungen an Architektur oder Regeln in `CLAUDE.md`.

## Meilenstein 1: Umfang im Detail

Enthalten: Projekt-Setup, PWA-Grundgerüst, eine Spielfigur (Amos), die per Tippen läuft und Gegner angreift.
Zusätzlich, weil dafür nötig oder sehr klein: Pfadfindung (A*), Wandkollision, Gegner-KI (verfolgen und schlagen), HUD mit Platzhaltern für die 3 Fähigkeiten (damit Touch-Layout und „Tipp auf HUD läuft nicht los“ früh feststehen), Tod und Neustart, Gegnerwellen in der Testarena.
Bewusst **nicht** enthalten: funktionierende Fähigkeiten, Items, Dungeon-Generator, Speichern, weitere Klassen, Schwerelosigkeit, Audio.

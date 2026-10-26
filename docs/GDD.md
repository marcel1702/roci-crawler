# Roci Crawler – Game Design Document (Entwurf)

Arbeitstitel. Privates, nicht-kommerzielles Fanprojekt im Universum von *The Expanse*.
Figuren, Namen und Schauplätze gehören ihren Urhebern; das Projekt wird nicht veröffentlicht oder verkauft.

**Kennzeichnung:** `[Vorgabe]` stammt aus dem Projektbriefing, `[Entschieden]` wurde mit dem Auftraggeber geklärt,
`[Vorschlag]` ist ein Entwurf, der vor der Umsetzung des jeweiligen Meilensteins bestätigt werden muss (siehe „Offene Fragen“).

## 1. Vision

Ein Diablo-artiges Action-RPG für Smartphone und Tablet: kurze, dichte Missionen, zufällige Dungeons, Beute-Jagd.
Statt Fantasy: Raumstationen, Minen und Wracks des Sonnensystems, Gürtler, Marsianer und Erdlinge.
Eine Durchspielzeit von etwa **3–5 Stunden** `[Vorgabe]`, mit Wiederspielwert durch vier Klassen.

**Säulen**
1. **Einhändig spielbar:** Alles geht mit Tippen und drei Tasten im Daumenbereich.
2. **Kurze Schleifen:** Eine Mission dauert 10–15 Minuten, jederzeit speicherbar.
3. **Beute mit Charakter:** Seltenheit *und* Herkunft (Erde/Mars/Gürtel) machen Gegenstände unterscheidbar.
4. **Schwerelosigkeit als Besonderheit:** Manche Zonen verändern, wie man sich bewegt und kämpft.

## 2. Plattform & Ansicht

- Progressive Web App, offline-fähig, installierbar; später optional via Capacitor als native App `[Vorgabe]`.
- Fokus Querformat, Hochformat bleibt bedienbar `[Vorgabe]`.
- **Ansicht: Top-down 2D** `[Entschieden]`, Platzhaltergrafik aus Formen und Farben `[Vorgabe]`.
- Texte: Deutsch mit i18n-Schicht, weitere Sprachen später `[Entschieden]`.
- Technik und Architektur: siehe `CLAUDE.md`.

## 3. Steuerung (Touch) `[Vorgabe]`

| Eingabe | Wirkung |
|---|---|
| Tippen auf Boden | Dorthin laufen (Pfadfindung um Hindernisse) |
| Finger halten und ziehen | Laufziel folgt dem Finger |
| Tippen auf Gegner | Hinlaufen und automatisch angreifen, bis er tot ist |
| 3 Fähigkeiten-Tasten | Unten rechts im Bogen (Daumenbereich), Abklingzeit statt Ressourcen |

Treffer-Toleranz: Gegner lassen sich mit einem Rand von 16 px sicher antippen. Taps auf HUD-Elemente lösen nie Bewegung aus.
Mehrfingerbedienung: Laufen und Fähigkeiten gleichzeitig. Zusätzlich eine kleinere **Trank-Taste** in der Mitte des Tastenfächers `[Umgesetzt]`.

## 4. Spielschleife

```
Rocinante (Hub) → Mission wählen → Dungeon durchqueren, kämpfen, Beute sammeln
        ↑                                              ↓
   Ausrüsten, handeln  ←——————— Ergebnis, Erfahrung, Credits ———┘
```

Jeder Akt besteht aus mehreren Missionen und endet mit einem Bosskampf; danach öffnet sich der nächste Akt.

## 5. Klassen `[Vorgabe]`: vier Figuren, Details `[Vorschlag]`

Pro Spielstand wird **eine** Klasse gewählt. Jede hat Grundangriff (automatisch beim Tippen auf Gegner), 3 aktive Fähigkeiten und einen kleinen Talentbaum.

| Klasse | Rolle | Grundangriff | Fähigkeiten (Entwurf) | Talent-Zweige (Entwurf) |
|---|---|---|---|---|
| **Amos** | Nahkampf-Tank | Schlag | Rammbock (Sturmangriff, Betäubung) · Standhaft (Schadensminderung + Spott) · Gnadenloser Schlag (Flächenschaden) | Bollwerk · Schläger · Pragmatiker (Heilung/Beute) |
| **Naomi** | Technikerin | Schweißbrenner / Pistole (kurze Reichweite) | Kampfdrohne · Hack (Türme/Geräte übernehmen, Türen öffnen) · EMP-Impuls | Drohnen · Hacks · Ingenieurin (Schwerelosigkeit) |
| **Bobbie** | Power-Rüstung, Fernkampf | Rüstungs-Sturmgewehr | Raketensalve (Fläche) · Rüstung versiegeln (Schild) · Gauss-Schuss (Durchschlag) | Schwerwaffen · Panzerung · Präzision |
| **Holden** | Anführer / Support | Pistole | Crew-Rufe: Sperrfeuer der Rocinante · Amos greift ein · Naomis Drohne; Inspirieren (Heilung + Tempo) | Befehle · Diplomatie (Gegner verwirren) · Überlebender |

**Amos, wie umgesetzt (Meilenstein 2)** `[Umgesetzt]`, alle Zahlen sind Startwerte für das spätere Balancing:

| Fähigkeit | Wirkung | Abklingzeit |
|---|---|---|
| Rammbock | Stürmt bis 140 px auf das Angriffsziel (sonst den nächsten Gegner, sonst geradeaus), stoppt am ersten gerammten Gegner: 150 % Schaden, 1,2 s Betäubung | 7 s |
| Standhaft | 4,5 s halber Schaden; zieht Gegner im Umkreis von 230 px heran, Schützen halten keinen Abstand mehr | 14 s |
| Gnadenloser Schlag | Flächenschlag (72 px): 220 % Schaden und 0,5 s Betäubung. Ohne Gegner in Reichweite passiert nichts und es beginnt keine Abklingzeit | 9 s |

Stufenwachstum Amos: +12 Lebenspunkte und +6 % Schaden pro Stufe.

Support im Einzelspiel: Holdens Besonderheit sind **Crew-Rufe** (Fähigkeiten, die die übrigen Figuren als Unterstützung einsetzen).

## 6. Akte `[Vorgabe]`, Inhalte `[Vorschlag]`

| Akt | Schauplatz | Gegner | Boss | Mechanik |
|---|---|---|---|---|
| **1** | Ceres / Tycho | Straßenschläger, Gang-Schützen, OPA-Saboteure, Sicherheitsdrohnen | Gangboss (Arbeitsname) | Einführung, einzelne kleine Schwerelosigkeits-Räume |
| **2** | Eros | Protomolekül-Mutanten: Infizierte, Kriecher, Sporenträger | Verschmolzener Knoten (Arbeitsname) | Viele Schwerelosigkeits-Sektionen, Infektions-Flächen |
| **3** | Ganymed / Ringtore | Hybrid-Soldaten, Wachdrohnen | Hybrid-Kommandant (Arbeitsname) | Mischung aus allem, Finale am Ringtor |

Eigene Gegner im Universum; bekannte Hauptfiguren treten höchstens als NPC in Dialogen auf. Umfang: je Akt ca. 4 Missionen + Boss, 60–75 Minuten.

### Kampf und Gegner-Regeln `[Umgesetzt, Meilenstein 2]`

**Lesbarkeit vor Härte:** Jeder Gegnerangriff wird vorher durch eine **rote Gefahrenzone** angekündigt. Die Richtung wird beim Start festgelegt; wer sich herausbewegt, wird nicht getroffen. Betäubung unterbricht den Angriff.

| Gegner (Akt 1) | Rolle | Angriff und Ankündigung | Besonderheit |
|---|---|---|---|
| **Gang-Schläger** | Nahkämpfer, in Gruppen | Schlag, 0,3 s Ankündigung (roter Kegel) | schnell, schwach |
| **Gang-Schütze** | Fernkämpfer | Schuss, 0,5 s Ankündigung (rote Schusslinie), Geschoss fliegt sichtbar | hält Abstand, braucht Sichtlinie, Wände sind Deckung |
| **Gang-Brecher** (Elite) | Zäher Brocken | Flächenschlag, 0,75 s Ankündigung (wachsender roter Kreis), 62 px | langsam, goldener Rand, 80 EP |

Gegner bemerken den Spieler ab einer Aggro-Reichweite oder wenn sie getroffen werden und geben bei großer Entfernung auf.

## 7. Dungeons `[Vorgabe: zufallsgeneriert]`, Verfahren `[Vorschlag]`

- Kachelraster (32 px), Räume und Gänge, **seeded** (gleicher Seed = gleiche Karte, reproduzierbar für Tests und Bugs).
- Aufbau: Eingang → Räume mit Gegnergruppen und Truhen → Ziel (Ausgang, Objekt bergen oder Boss).
- Vorgefertigte Module für Bossarenen; pro Akt eigene Farbwelt und Hindernisse.
- Gegner kommen aus Spawn-Tabellen je Akt und Schwierigkeit; Elite-Gegner mit Zusatzfähigkeit.

## 8. Schwerelosigkeit `[Vorgabe]`, Regeln `[Vorschlag]`

Bereiche (Räume oder Zonen) sind als schwerelos markiert. Dort bewegt sich die Figur **träge mit Schwung**:

- Tippen setzt ein Ziel; die Figur beschleunigt dorthin und gleitet weiter, wenn man loslässt.
- Wände prallen ab (gedämpft). Man kann sich von Wänden abstoßen.
- Treffer und Rückstoß verschieben Figur und Gegner deutlich; Bobbies Schüsse stoßen sie zurück.
- Fähigkeit/Taste „Stabilisieren“ bremst ab. Gürtler-Ausrüstung und Naomis Talente verbessern die Kontrolle.
- Pfadfindung entfällt dort: Die Bewegung ist direkte Steuerung.

## 9. Beute `[Vorgabe]`

**Seltenheit** `[Vorschlag: 5 Stufen]`: Gewöhnlich · Ungewöhnlich · Selten · Episch · Legendär.
Mehr Seltenheit = mehr Eigenschaften (0 bis 4); Legendäre haben zusätzlich einen festen Spezialeffekt.

**Herkunft** `[Vorgabe]` mit eigenen Boni `[Vorschlag]`:

| Herkunft | Charakter | Typische Boni |
|---|---|---|
| **Erde** | Solide, teuer, sicher | Mehr Lebenspunkte und Panzerung |
| **Mars** | Militärische Präzision | Mehr Schaden, Krit, Reichweite; weniger Rückstoß |
| **Gürtel** | Improvisiert, effizient | Bewegungstempo, kürzere Abklingzeiten, Schwerelosigkeits-Kontrolle |

Drei Teile gleicher Herkunft geben einen Set-Bonus. Slots: Waffe, Rüstung, Helm, Gadget, Modul.
Quellen: Gegner-Drops, Truhen, Bosse (garantiert Selten+), Händler.

## 10. Fortschritt `[Vorgabe]`, Zahlen `[Vorschlag]`

- Level 1–30; ca. 10 Level pro Akt. Pro Level ein Talentpunkt ab Level 2 (Talente: Meilenstein 6).
- Erfahrung für die nächste Stufe: `30 + 20·Stufe + 3·Stufe²`; Stufenaufstieg heilt vollständig. Schläger 15 EP, Schütze 20 EP, Brecher 80 EP `[Umgesetzt, Startwerte]`.
- Tränke: 3 pro Mission, heilen 40 % der maximalen Lebenspunkte, 4 s Abklingzeit `[Umgesetzt]`.
- Kleiner Talentbaum: 3 Zweige mit je 4 Knoten pro Klasse (ca. 12 Knoten), Respec im Hub gegen Credits.
- Schwierigkeit skaliert pro Akt; kein Level-Grind nötig, Wiederholen früherer Missionen bleibt möglich.

## 11. Hub: Die Rocinante `[Vorgabe]`

Stationen: **Missionskonsole** (Akt und Mission wählen) · **Waffenkammer** (Inventar, Ausrüstung, Talente) · **Händler** (kaufen/verkaufen, Bestand nach Herkunft) · **Messe** (Crew-Dialoge, Story).
Die nicht gewählten Hauptfiguren besetzen Stationen der Crew.

## 12. Speichern `[Vorgabe: localStorage/IndexedDB]`

- localStorage mit versioniertem Format und Migrationen; IndexedDB erst, wenn der Platz nicht reicht.
- Autosave beim Betreten des Hubs und nach jeder Mission; mehrere Spielstände `[Vorschlag: 3]`.
- `navigator.storage.persist()` anfragen, damit Safari den Spielstand nicht räumt.

## 13. Nicht-Ziele

Mehrspieler, Online-Konten, Monetarisierung, 3D, Sprachausgabe, aufwendige Zwischensequenzen.

## 14. Offene Fragen (bitte vor dem jeweiligen Meilenstein klären)

1. **Eine Klasse pro Spielstand** oder im Hub wechselbar? (Meilenstein 5/6)
2. **Holdens Crew-Rufe** als Support-Mechanik: einverstanden? (Meilenstein 6)
3. **Schwerelosigkeit:** direkte Steuerung mit „Stabilisieren“-Taste (Vorschlag) oder Autopilot, der selbst abbremst? (Meilenstein 7)
4. **Gegner und Bosse:** eigene Figuren im Universum (Vorschlag) oder bekannte Figuren aus Büchern/Serie? (Meilenstein 8)
5. ~~Hosting für den Tablet-Test~~ `[Entschieden]` GitHub Pages (siehe README).
6. **Titel:** „Roci Crawler“ ist ein Arbeitstitel.
7. **Audio:** ab wann Platzhalter-Effekte und Musik? (Vorschlag: ab Meilenstein 8)

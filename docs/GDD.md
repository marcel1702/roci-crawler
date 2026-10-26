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
Rocinante (Hub) → Auftrag wählen → Dungeon durchqueren, kämpfen, Beute sammeln
        ↑                                              ↓
   Ausrüsten, handeln  ←——————— Ergebnis, Erfahrung, Credits ———┘
```
Nach Mission oder Tod geht es immer zurück in den Hub; der Spielstand wird dabei gespeichert.

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

**Naomi, Bobbie und Holden, wie umgesetzt (Meilenstein 6)** `[Umgesetzt]`, alle Zahlen sind Startwerte. Alle drei kämpfen im **Fernkampf** (Grundangriff ist ein Geschoss, braucht Sichtlinie; die Figur läuft, bis sie schießen kann):

| Klasse | Werte (Stufe 1) | Fähigkeiten |
|---|---|---|
| **Naomi** (Technikerin) | 100 LP, Tempo 165, Schaden 7–10, Reichweite 170 | **Kampfdrohne:** 10 s Verbündete, schießt mit 70 % deines Schadens (14 s) · **Hack:** nächster Gegner ≤ 280 px: 2,5 s betäubt, nimmt 5 s lang +35 % Schaden (9 s) · **EMP-Impuls:** Radius 110: 90 % Schaden und 2 s Betäubung (12 s) |
| **Bobbie** (Power-Rüstung) | 175 LP, Tempo 128, Schaden 13–17, Reichweite 190 | **Raketensalve:** 3 Raketen auf die dichteste Gruppe ≤ 340 px, Warnzone, je 110 % Schaden, Radius 56 (10 s) · **Rüstung versiegeln:** 5 s −70 % Schaden, −50 % Tempo (16 s) · **Gauss-Schuss:** durchschlägt alles auf 380 px, 260 % Schaden (8 s) |
| **Holden** (Anführer) | 125 LP, Tempo 150, Schaden 8–11, Reichweite 140 | **Sperrfeuer:** Warnzone, dann 4 Einschläge (je 100 %, Radius 58) auf die dichteste Gruppe (14 s) · **Amos greift ein:** 10 s Verbündeter im Nahkampf, 110 % Schaden (18 s) · **Inspirieren:** heilt 35 % und gibt 6 s +25 % Schaden und Tempo (20 s) |

**Verbündete** (Drohne, Amos) sind unverwundbar, werden von Gegnern ignoriert und verschwinden nach Ablauf; ein gleicher Verbündeter wird abgelöst. Für alle Klassen gilt Stufenwachstum von etwa +6 % Schaden und +9 bis +13 Leben je Stufe.

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

## 7. Dungeons `[Vorgabe: zufallsgeneriert]`

Umgesetzt in Meilenstein 3 `[Umgesetzt]`, alle Zahlen sind Startwerte:

- **Karte:** Kachelraster 64×44 (Kachel 32 px), 8–11 Räume von 6–11 Kacheln, durch 2 Kacheln breite Gänge verbunden (Spannbaum plus wenige Rundwege). **Seeded:** gleicher Seed = gleiche Karte und gleiche Gegnerverteilung.
- **Räume:** *Start* (gegnerfrei), *Ausgang* (am weitesten vom Start, bewacht), *Schatz* (Sackgasse mit Truhe und zwei Bewachern, höchstens zwei), *Kampf* (Gegnergruppe nach Tiefe, große Räume bekommen einen Gegner mehr, 25 % haben eine Truhe).
- **Aufgabe der Mission:** Luftschleuse finden → ihre **Wächter** (Brecher + 2 Schützen) besiegen → Schleuse betreten. Dann Ergebnisbildschirm und nächste Mission.
- **Nebel des Krieges:** Sichtweite 8 Kacheln, Wände blockieren die Sicht, Entdecktes bleibt abgedunkelt sichtbar; **Minikarte** oben rechts mit Spielfigur, Truhen und Schleuse (nach Entdeckung).
- **Truhen:** öffnen sich beim Herangehen, geben 40–90 Credits und mit 30 % einen zusätzlichen Trank (höchstens 5). Items als Beute folgen mit Meilenstein 4.
- **Credits** sind die Währung (Händler im Hub, Meilenstein 5).
- Gegner bemerken den Spieler nur mit Sichtlinie (durch Wände erst aus ca. 70 px).
- **Später:** vorgefertigte Module für Bossarenen, eigene Farbwelt pro Akt, Elite-Gegner mit Zusatzfähigkeit. Schwerelose Räume sind seit Meilenstein 7 dabei (Abschnitt 8).
- **Zum Ausprobieren:** `?seed=123` lädt genau diesen Dungeon, `?mode=arena` die Testarena mit endlosen Wellen.

## 8. Schwerelosigkeit `[Vorgabe]`, Regeln `[Umgesetzt]`

Umgesetzt in Meilenstein 7; alle Zahlen sind Startwerte für das Balancing (`core/zerog.ts`, `config/constants.ts`: `KNOCKBACK`, `ZEROG`).

Bereiche (im Dungeon: ganze Räume) sind als schwerelos markiert, erkennbar am **violetten Boden mit Diagonalraster** (auch auf der Minikarte). Dort bewegt sich die Figur **träge mit Schwung**:

- **Schub:** Tippen setzt ein Ziel; die Figur beschleunigt dorthin (bis zum Lauftempo ihrer Klasse) und **gleitet weiter**, wenn der Schub endet (sanfte Dämpfung: Geschwindigkeit sinkt auf etwa die Hälfte pro 1,5 s). Pfadfindung bleibt als Wegweiser (Schub zeigt zum nächsten Wegpunkt), damit Türen und Ecken funktionieren.
- **Wände prallen ab** (55 % der Geschwindigkeit bleiben), mit leichtem Wackeln der Kamera bei hartem Aufprall. Kein Schaden durch Aufprall.
- **Rückstoß und Treffer:** Nahkampftreffer, Geschosse, Flächenschaden und Fähigkeiten stoßen Figur und Gegner weg (schwerere Gegner weniger); jeder Schuss schiebt die Schützin zurück: Bobbie stärker (55), Gauß-Strahl am stärksten (190), Naomi/Holden/Drohne mit Standardwert (28).
- **„Stabilisieren“:** Taste unten links (nur in der Schwerelosigkeit sichtbar) oder Leertaste. Bremst ~0,9 s stark ab und bricht Lauf-/Angriffsbefehl ab; Abklingzeit 2 s. **Angriffshilfe:** Wer ein Ziel in Reichweite hat und angreift, bremst automatisch, damit Nahkämpfer nicht am Gegner vorbeitreiben.
- **Sturmangriff** (Rammbock) behält danach 35 % des Schwungs.
- **Gegner** steuern ihr Tempo nach (kein Rutschen ins Leere), bremsen im Stand von selbst leicht, treiben aber nach Stößen und Betäubung frei weiter. Schützen weichen per Schub zurück.
- **Übergang:** Beim Betreten nimmt die Figur ihre Laufgeschwindigkeit mit, beim Verlassen ist der Schwung sofort weg (Laufbewegung greift wieder). Beim ersten Betreten einer schwerelosen Mission erscheint ein Hinweis.
- **Kontrolle:** Gürtler-Ausrüstung (Gürtel mit Gürtler-Herkunft, Gürtel-Zusatzwert, Gürtler-Set) und Naomis Talente (Ingenieurin) verbessern Schub und Bremse (Wert „Kontrolle“, +Prozent auf beides).
- **Im Dungeon:** Nur Kampf- und Schatzräume können schwerelos sein, nie Start- oder Ausgangsraum (Wahrscheinlichkeit 18 % in Akt 1, `ZEROG.roomChance`; Akt 2 erhöht sie). Die Karte selbst hängt nicht davon ab (gleiche Seeds, gleiche Räume).
- Zum Ausprobieren: `?seed=7&zerog=1` macht jeden Kampf- und Schatzraum schwerelos, `&zerog=0` keinen.

**Entscheidung (statt „Autopilot“):** direkte Steuerung mit Stabilisieren-Taste und kleiner Angriffshilfe; ein Autopilot nähme dem Modus die Eigenart. Bei Tests auf dem Tablet bitte darauf achten, ob das Gleiten zu rutschig oder zu zahm wirkt (Dämpfung, Höchsttempo, Rückstoßwerte sind Zahlen in `core/zerog.ts` bzw. `config/constants.ts`).

## 9. Beute `[Vorgabe]`

Umgesetzt in Meilenstein 4 `[Umgesetzt]`, alle Zahlen sind Startwerte für das Balancing (`src/data/items.ts`, `src/data/loot.ts`):

**Aufbau eines Gegenstands:** Platz, Grundtyp, **Seltenheit**, **Herkunft**, Gegenstandsstufe, ein **Hauptwert** (je Platz), ein **Herkunftsbonus** und 0–4 **Zusatzwerte**. Gegenstände haben keine Klassenbeschränkung (kann mit den Klassen in Meilenstein 6 überdacht werden).

| Platz | Hauptwert | | Seltenheit | Zusatzwerte | Hauptwert × |
|---|---|---|---|---|---|
| Waffe | Waffenschaden | | Gewöhnlich (grau) | 0 | 1,0 |
| Rüstung | Panzerung | | Ungewöhnlich (grün) | 1 | 1,1 |
| Helm | Leben | | Selten (blau) | 2 | 1,25 |
| Gadget | Lauftempo | | Episch (lila) | 3 | 1,45 |
| Modul | Krit.-Chance | | Legendär (orange) | 4 + Spezialeffekt | 1,7 |

Spezialeffekte (Legendär): **Vampirisch** (+6 % Lebensraub), **Sanitäter** (+35 % Trankheilung, +1 Trank).
Weitere Werte: Schaden %, Leben %, Panzerung, Abklingzeit, Lebensraub, Trankheilung. Werte wachsen mit der **Gegenstandsstufe** (= Spielerstufe beim Fund).

**Herkunft** `[Vorgabe]` mit Boni:

| Herkunft | Charakter | Hauptwert × | Herkunftsbonus (fest) | bevorzugte Zusatzwerte | Set-Bonus ab 3 Teilen |
|---|---|---|---|---|---|
| **Erde** | Solide, sicher | 1,2 | Leben oder Panzerung | Leben, Panzerung, Trankheilung | +10 % Leben |
| **Mars** | Militärische Präzision | 1,0 | Schaden % oder Krit. | Schaden, Krit. | +10 % Schaden |
| **Gürtel** | Improvisiert, effizient | 0,9 | Tempo oder Abklingzeit | Tempo, Abklingzeit | +8 % Tempo, +8 % kürzere Abklingzeit |

Panzerung hält `Panzerung / (Panzerung + 120)` des Schadens ab; Krit. verursacht 150 % Schaden (Deckel 50 % Chance); Abklingzeit-Reduktion höchstens 40 %.

**Quellen:** normale Gegner 12 % (meist gewöhnlich), **Elite** immer (viel besser), **Wächter der Luftschleuse** immer (mindestens ungewöhnlich, meist selten/episch), **Truhen** immer einen Gegenstand. Beute liegt als farbiger Kristall am Boden (ab selten mit Namen, ab episch mit Lichtsäule) und wird beim Darüberlaufen aufgehoben.

**Rucksack:** 20 Plätze. Gegenstände lassen sich **ausrüsten**, **ablegen** und **verwerten** (halber Wert in Credits; Episch/Legendär verlangen eine zweite Bestätigung). „Gewöhnliche verwerten“ räumt mit einem Tipp auf. Vor dem Ausrüsten zeigt ein **Vergleich** (▲/▼), wie sich die Werte ändern.

Gegner werden mit der Spielerstufe etwas stärker (+6 % Leben, +4 % Schaden je Stufe), die Figur wächst schneller, Ausrüstung bringt zusätzlichen Vorsprung. Händler, die Credits für Gegenstände anbieten, kommen im Hub (Meilenstein 5).

## 10. Fortschritt `[Vorgabe]`, Zahlen `[Vorschlag]`

- Level 1–30; ca. 10 Level pro Akt. Pro Level ein Talentpunkt ab Level 2 (Talente: Meilenstein 6).
- Erfahrung für die nächste Stufe: `30 + 20·Stufe + 3·Stufe²`; Stufenaufstieg heilt vollständig. Schläger 15 EP, Schütze 20 EP, Brecher 80 EP `[Umgesetzt, Startwerte]`.
- Tränke: 3 pro Mission, heilen 40 % der maximalen Lebenspunkte, 4 s Abklingzeit `[Umgesetzt]`.
- **Talentbaum** `[Umgesetzt, Meilenstein 6]`: je Klasse **3 Zweige × 4 Reihen** (12 Knoten). Reihe 1–3 haben je 3 Ränge, Reihe 4 (Spitze) einen Rang. Eine Reihe schaltet sich frei, wenn im Zweig genug Punkte stecken (3 / 6 / 9). Insgesamt 30 Ränge für 29 Punkte bis Stufe 30, also eine echte Auswahl. Effekte: Werte (Leben, Schaden, Panzerung, Krit., Tempo, Tränke …) und Verbesserungen der eigenen Fähigkeiten (kürzere Abklingzeit, mehr Wirkung/Bereich/Dauer). Beschreibungen entstehen aus den Zahlen.
- **Zurücksetzen** kostet `25 × Stufe` Credits und geht nur im Hub. Ungenutzte Punkte zeigt die Talent-Taste (neben dem Rucksack) als Zahl.
- Schwierigkeit skaliert pro Akt; kein Level-Grind nötig, Wiederholen früherer Missionen bleibt möglich.

## 11. Hub: Die Rocinante `[Vorgabe]`

Umgesetzt in Meilenstein 5 `[Umgesetzt]`: Der Hub ist eine kleine begehbare Karte (Cockpit, Gang, Messe, Waffenkammer, Frachtraum). Die Figur läuft per Tippen; **Tippen auf eine Station** läuft hin und öffnet sie.

| Station | Ort | Funktion |
|---|---|---|
| **Missionskonsole** | Cockpit | Drei Aufträge (Ort, Normal/Schwer); wechseln nach jeder abgeschlossenen Mission. Schwer: +35 % Leben, +20 % Schaden der Gegner, seltenere Beute (×1,8 auf selten und besser), +50 % Credits |
| **Waffenkammer** | unten | Rucksack und Ausrüstung (wie in der Mission) |
| **Händler** | Frachtraum | 6 Gegenstände (je Platz einer plus ein zufälliger), Preis = 3 × Wert, Angebot wechselt nach jeder Mission, gekaufte Teile bleiben weg |
| **Spielstand-Terminal** | Frachtraum | Zurück zur Titelseite (anderen Spielstand laden) |
| **Besatzung** | Messe | Die drei übrigen Figuren mit je zwei **Platzhalter-Sprüchen** (Texte sind vorläufig und noch nicht inhaltlich abgestimmt) |

Aufträge zeigen Akt 1 (Ceres/Tycho); echte Akt-Wahl und Handlung folgen mit den Akten (Meilensteine 8–10). Tränke füllen sich zu jeder Mission wieder auf.

## 12. Speichern `[Vorgabe: localStorage/IndexedDB]`

Umgesetzt `[Umgesetzt, Meilenstein 4]`:

- **localStorage** (ein Eintrag, JSON) mit **Versionsnummer** und vorbereiteten Migrationen; IndexedDB erst, wenn der Platz nicht reicht.
- Gespeichert werden Stufe, Erfahrung, Credits, Rucksack, Ausrüstung, abgeschlossene Missionen.
- **Autospeichern** kurz nach jeder Änderung (gebündelt) und sofort, wenn die App in den Hintergrund wechselt oder schließt.
- **Robust:** Unbrauchbare Gegenstände werden verworfen statt den ganzen Spielstand; beschädigte Daten werden vor dem Überschreiben als Sicherung abgelegt; ein Spielstand einer neueren Version wird nie überschrieben; fehlender oder voller Speicher bricht das Spiel nicht ab.
- `navigator.storage.persist()` wird angefragt, damit Safari den Spielstand nicht räumt.
- `?reset` an der URL beginnt mit einem frischen Spielstand (zum Testen).
- **3 Spielstände** `[Umgesetzt, Meilenstein 5]`: Titelseite mit Karten, Löschen mit Bestätigung, zuletzt gespielter Platz hervorgehoben. Der Spielstand aus Meilenstein 4 (ein Eintrag) wird in Platz 1 übernommen.
- **Eine Klasse pro Spielstand** wird beim Beginn eines neuen Spiels gewählt `[Umgesetzt als Vorschlag, noch zu bestätigen, siehe Frage 1]`; für eine andere Figur beginnt man ein neues Spiel in einem anderen Platz.
- Abkürzungen zum Testen: `?slot=2` (Platz laden/beginnen und direkt in den Hub), `?seed=…`/`?mode=arena` (direkt in eine Mission), `?reset` (Platz 1 neu).

## 13. Nicht-Ziele

Mehrspieler, Online-Konten, Monetarisierung, 3D, Sprachausgabe, aufwendige Zwischensequenzen.

## 14. Offene Fragen (bitte vor dem jeweiligen Meilenstein klären)

1. **Eine Klasse pro Spielstand** (so umgesetzt) oder im Hub wechselbar? (Meilenstein 6)
2. **Holdens Crew-Rufe** (so umgesetzt: Sperrfeuer, Amos greift ein, Inspirieren): einverstanden?
3. ~~Schwerelosigkeit: direkte Steuerung oder Autopilot~~ `[Entschieden, bitte bestätigen]` direkte Steuerung mit „Stabilisieren“ und Angriffshilfe (Abschnitt 8); nach dem Tablet-Test nachjustieren.
4. **Gegner und Bosse:** eigene Figuren im Universum (Vorschlag) oder bekannte Figuren aus Büchern/Serie? (Meilenstein 8)
5. ~~Hosting für den Tablet-Test~~ `[Entschieden]` GitHub Pages (siehe README).
6. **Titel:** „Roci Crawler“ ist ein Arbeitstitel.
7. **Audio:** ab wann Platzhalter-Effekte und Musik? (Vorschlag: ab Meilenstein 8)

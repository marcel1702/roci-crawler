# Als App verpacken (Capacitor, optional)

Das Spiel läuft als PWA direkt im Browser und lässt sich zum Homescreen hinzufügen (siehe README). Wer es lieber als „echte“ App
auf Android oder iOS haben möchte, kann dieselbe Webanwendung mit **Capacitor** verpacken. Das ist nicht nötig, um zu spielen, und
im Repository nicht vorinstalliert (kein zusätzliches Gewicht im Browser-Bundle).

## Voraussetzungen

- Android: Android Studio (mit SDK), JDK 17.
- iOS: ein Mac mit Xcode und ein Apple-Entwicklerkonto (für Installation auf dem eigenen Gerät reicht ein kostenloses).
- Node 22 wie für das Spiel selbst.

## Einrichtung (einmalig)

```bash
npm install --save-dev @capacitor/cli @capacitor/core @capacitor/android @capacitor/ios
npm run build                 # erzeugt dist/ (ohne VITE_BASE: Basis ist „/“)
npx cap add android           # und/oder: npx cap add ios
```

Die Konfiguration liegt in `capacitor.config.json` (App-Kennung `de.rocicrawler.app` ist ein Platzhalter; bitte ändern, falls
die App veröffentlicht werden soll).

## Bei jeder Änderung

```bash
npm run build
npx cap sync
npx cap open android          # oder: npx cap open ios
```

Danach in Android Studio bzw. Xcode auf das Gerät starten.

## Hinweise

- **Querformat:** In den Projekteinstellungen (Android `AndroidManifest.xml` → `screenOrientation="sensorLandscape"`; iOS: unterstützte
  Ausrichtungen) kann man das Spiel auf Querformat festlegen. Das Spiel unterstützt auch Hochformat.
- **Service Worker:** In der nativen App wird die Webanwendung lokal aus dem Paket geladen; der Service Worker ist dort nicht nötig
  und wird nicht schaden. Spielstände liegen im lokalen Speicher der App (`localStorage`) und gehen bei Deinstallation verloren.
- **Notch und Gesten:** Das Spiel liest die Sicherheitsabstände (`env(safe-area-inset-*)`), daher passt das HUD zu Notch und Gestenleiste.
- **Ton:** Audio startet nach der ersten Berührung (wie im Browser). Die Effekte sind synthetisiert, es werden keine Dateien geladen.
- **Veröffentlichen:** Das Spiel ist ein privates, nicht-kommerzielles Fanprojekt (Figuren aus „The Expanse“). Eine Veröffentlichung in
  Stores setzt die Klärung der Rechte voraus; das Projekt ist dafür **nicht** vorbereitet.
- **Nicht getestet:** Dieses Repository wurde bisher nur im Browser (Headless-Chromium) geprüft. Native Builds und Geräte-Tests stehen noch aus.

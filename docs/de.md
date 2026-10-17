# Baby Buddy

Das Babytagebuch deines [Baby Buddy](https://docs.baby-buddy.net) in Gladys:
wie lange die letzte Mahlzeit und die letzte Windel her sind, ob das Baby
schläft, wie viel Schlaf heute. Eine Taste am Bett trägt eine Windel ein oder
startet und stoppt den Schlaf- oder Mahlzeit-Timer, eine Szene erinnert dich,
wenn eine Mahlzeit überfällig ist.

> **Rückmeldungen willkommen.** Diese Integration wurde mit einem echten Baby
> Buddy-Server getestet (Docker-Image `lscr.io/linuxserver/babybuddy`, Oktober
> 2026), aber noch nicht mit einem echten Gladys im Alltag. Wenn etwas nicht
> wie beschrieben funktioniert, sag es im
> [Gladys-Forum](https://community.gladysassistant.com) oder in den
> [Issues](https://github.com/guim31/gladys-babybuddy/issues).

## Was du brauchst

- Gladys Assistant 5.1.0 oder neuer.
- Ein **selbst gehostetes Baby Buddy**, von Gladys aus erreichbar (das
  Docker-Image lauscht auf Port 8000).
- Den **API-Schlüssel** eines Baby-Buddy-Benutzers: Öffne in Baby Buddy das
  Benutzermenü (oben rechts) → **API key** und kopiere die 40 Zeichen. Über
  Gladys geschriebene Einträge werden im Namen dieses Benutzers geschrieben.

## Einrichtung

1. In Gladys: **Integrationen** → **Baby Buddy** installieren.
2. Fülle in der **Konfiguration** aus:
   - **Adresse**: die Adresse von Baby Buddy, zum Beispiel
     `http://192.168.1.20:8000`, oder `https://baby.example.org` hinter einem
     Reverse Proxy (ein Pfadpräfix wie `/babybuddy` bleibt erhalten);
   - **API-Schlüssel**: der Schlüssel deines Baby-Buddy-Benutzers.
3. Optionen:
   - **Art** und **Methode einer über Gladys beendeten Mahlzeit**: Baby Buddy
     braucht beide, um eine Mahlzeit einzutragen; sie gelten, wenn ein
     Mahlzeit-Timer über Gladys gestoppt wird (Muttermilch, beide Brüste
     standardmäßig). Korrigiere den Eintrag danach bei Bedarf in Baby Buddy;
   - **Gewichtseinheit** und **Temperatureinheit**: Baby Buddy speichert
     Zahlen ohne Einheit, gib an, welche du verwendest (standardmäßig Kilogramm
     und Celsius);
   - **Selbstsignierte Zertifikate akzeptieren**: für eine `https://`-Adresse
     mit selbstsigniertem Zertifikat, nur auf deinem eigenen Server;
   - **Aktualisierungsintervall**: 1, 2 oder 5 Minuten (standardmäßig 1). Die
     Minutenzähler laufen unabhängig vom Intervall jede Minute weiter;
   - **Sprache der Funktionsnamen**: die Namen der Funktionen beim Hinzufügen
     eines Geräts (standardmäßig Französisch), die Namen der über Gladys
     gestarteten Timer und die an Szenen gesendeten Texte.
4. Speichere, dann **Verbindung testen**: Das liest Baby Buddy und nennt die
   Anzahl der Kinder und der laufenden Timer.
5. Füge im Tab **Entdecken** die Geräte hinzu: eines pro Kind.

## Geräte

**Baby Buddy _Vorname_**, eines pro Kind, mit diesen Funktionen:

| Funktion                    | Was sie anzeigt                                                            |
| --------------------------- | -------------------------------------------------------------------------- |
| `Seit der letzten Mahlzeit` | Minuten seit dem Ende der letzten Mahlzeit                                 |
| `Mahlzeiten heute`          | heute begonnene Mahlzeiten                                                 |
| `Mahlzeit läuft`            | 1, solange ein Mahlzeit-Timer läuft                                        |
| `Seit dem letzten Wickeln`  | Minuten seit dem letzten Windelwechsel                                     |
| `Windeln heute`             | Windelwechsel heute                                                        |
| `Schläft`                   | 1, solange ein Schlaf-Timer läuft                                          |
| `Schlaf heute`              | heute eingetragene Schlafminuten (seit Mitternacht)                        |
| `Temperatur`                | die zuletzt gemessene Temperatur                                           |
| `Gewicht`                   | das letzte Gewicht als Text (`4,85 kg`): Gladys hat keine Gewichtsfunktion |

Ein **Timer** zählt anhand seines Namens als Schlaf oder Mahlzeit: Die über
Gladys gestarteten heißen `Schlaf` und `Mahlzeit` (in der Sprache der Namen),
und ein in Baby Buddy zum Beispiel `Nickerchen`, `Flasche` oder `Stillen`
genannter Timer zählt auch. Ein Timer ohne Namen zählt für keines von beiden.
„Heute“ ist der Tag in der Zeitzone von Gladys. Die Temperatur ist eine
„Gerätetemperatur“, damit die 37,5 °C eines Kindes in Gladys nicht zur
Temperatur des Kinderzimmers werden.

## Dashboard

Das Widget **Baby Buddy** zeigt für ein Kind (das erste oder das in den
Widget-Einstellungen gewählte):

- drei Kacheln: Zeit seit der letzten Mahlzeit (`…`, solange ein
  Mahlzeit-Timer läuft), seit der letzten Windel und Schlaf heute;
- den Zustand: schläft seit wann, Mahlzeit läuft oder Uhrzeit der letzten
  Mahlzeit, letzte Windel und ihre Art;
- vier Tasten: **Nasse Windel**, **Volle Windel**, **Schlaf starten** /
  **Aufgewacht**, **Mahlzeit starten** / **Mahlzeit beenden**. Eine Taste tut,
  was sie anzeigt: Ein veraltetes Widget startet nie einen Timer neu, den es
  als laufend zeigt.

## Szenen

### Auslöser

- **Länger keine Mahlzeit**: löst einmal pro Mahlzeit aus, wenn die gewählte
  Stundenzahl (1 bis 8) seit ihrem Ende vergangen ist. Filter: das Kind (leer:
  beliebig) und die Stundenzahl. Solange ein Mahlzeit-Timer läuft, löst nichts
  aus. An die Aktionen übergebene Informationen: der Vorname des Kindes, die
  Stunden, die Minuten seit der letzten Mahlzeit, das Ende der letzten
  Mahlzeit.

Beim Start der Integration ist schon Überfälliges bekannt, nicht neu: Ausgelöst
wird bei der nächsten überschrittenen Stunde. Nach einem Ausfall lösen die
inzwischen überschrittenen Stunden aus, sobald Baby Buddy wieder antwortet.

### Aktionen

- **Windelwechsel eintragen**: trägt jetzt einen nassen, vollen oder nassen
  und vollen Windelwechsel für ein Kind ein. Ergebnisse: der Vorname des
  Kindes, die Art.
- **Schlaf- oder Mahlzeit-Timer**: startet, stoppt oder wechselt (startet,
  wenn gestoppt, stoppt, wenn er läuft) den Schlaf- oder Mahlzeit-Timer eines
  Kindes. Gestoppt wird der Timer in Baby Buddy zu einem Schlaf- oder
  Mahlzeit-Eintrag, von seinem Start bis jetzt. Einen laufenden Timer starten
  oder keinen stoppen ändert nichts. Ergebnisse: der Vorname des Kindes, ob
  der Timer läuft, die eingetragene Dauer (Minuten).

### Szenenideen

- Eine Zigbee-Taste am Bett: Ein Druck startet **Schlaf- oder Mahlzeit-Timer**
  mit _Schlaf_ und _Starten oder stoppen_; ein Doppeldruck startet
  **Windelwechsel eintragen** mit _Nass_.
- **Länger keine Mahlzeit** mit 3 Stunden, nachts: ein sanftes Licht im
  Schlafzimmer und eine Nachricht aufs Handy.
- Wenn `Schläft` auf 1 wechselt: das Licht im Kinderzimmer dimmen und den
  Lautsprecher mit weißem Rauschen einschalten; bei 0 die Rollläden etwas
  öffnen.

## Fehlerbehebung

- **„Baby Buddy antwortet nicht“**: Prüfe Adresse und Port vom Gladys-Rechner
  aus (`http://<Adresse>:8000` öffnet Baby Buddy im Browser).
- **„API-Schlüssel abgelehnt“**: Kopiere den Schlüssel erneut aus dem
  Benutzermenü von Baby Buddy (er ändert sich, wenn er neu erzeugt wird).
- **„Keine Baby-Buddy-API unter dieser Adresse“**: Etwas antwortet, aber nicht
  Baby Buddy: Prüfe den Port oder das Pfadpräfix hinter einem Reverse Proxy.
- **„Die Adresse leitet um“**: Gib die `https://`-Adresse ein.
- **„Ein anderer Eintrag deckt diese Zeit schon ab“**: Baby Buddy lehnt zwei
  Mahlzeiten (oder zwei Schlafphasen) zur gleichen Zeit ab. Der Timer bleibt:
  Korrigiere die Einträge in Baby Buddy und stoppe den Timer dann erneut.
- **Ein Timer wird nicht als Schlaf oder Mahlzeit erkannt**: Gib ihm einen
  Namen mit dem Wort (`Schlaf`, `Nickerchen`, `Mahlzeit`, `Flasche` oder ihre
  englischen, französischen oder spanischen Entsprechungen).
- Protokolle: `LOG_LEVEL=debug` am Container zeigt jede Abfrage.

## Grenzen

- Baby Buddy wird alle 1 bis 5 Minuten gelesen: Ein in Baby Buddy
  geschriebener Eintrag erscheint innerhalb dieser Zeit in Gladys. Jede
  Abfrage macht 2 Anfragen, plus 5 pro Kind.
- Die Integration liest die letzten 50 Einträge jeder Art pro Kind: genug für
  einen Tag. Abpumpen, Bauchlage, Medikamente, Notizen und andere Messungen
  als Gewicht und Temperatur werden nicht gelesen.
- Die Integration schreibt nur Windelwechsel und Schlaf- und Mahlzeit-Timer;
  sie ändert
  oder löscht nie einen Eintrag.
- Der Auslöser „Länger keine Mahlzeit“ wird im Speicher gehalten: Eine
  Stunde, die überschritten wird, während die Integration gestoppt ist, wird
  danach nicht gemeldet.
- Gladys speichert keine Baby-Buddy-Daten im Container (`/data` bleibt leer).
- Keine Verbindung zu Baby Buddy.

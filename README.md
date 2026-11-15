# OGVIEW – One Global View

**The World. The Markets. One Overview.**

Finanz-App mit Heatmap aller wichtigen Vermögenswerte, News führender Quellen
und Wirtschaftskalender – live und tagesaktuell, komplett ohne API-Keys.

## Starten

```bash
pip install -r requirements.txt
python server.py        # http://localhost:5002
```

Windows: einfach **`start.bat` doppelklicken** (macOS/Linux: `./start.sh`).

## Funktionen

1. **Heatmap** aller Vermögenswerte, farbcodiert nach Tagesveränderung
   (Türkis = Gewinn, Rot = Verlust), mit Filtern:
   - **Edelmetalle & Rohstoffe** – Gold, Silber, Platin, Kupfer
   - **Crypto** – Top 25 nach Market Cap (CoinGecko)
   - **Aktien nach Index** – DAX 40, S&P 500, NASDAQ 100, Dow Jones, EURO STOXX 50
     (jeweils die größten Werte nach Marktkapitalisierung)
   - Klick auf eine Kachel → **Kerzenchart** mit 1T / 5T / 1M / 3M / 1J / 5J / Alltime,
     **SMA 20/50/200** und **RSI (14)** inkl. Überkauft/Überverkauft-Hinweis

2. **News** – Live-RSS von: BBC Business, CNBC, WSJ Markets, Bloomberg,
   Financial Times (EN) sowie finanzen.net, tagesschau, Handelsblatt (DE).
   Filter nach Quelle; Sprache DE/EN umschaltbar.

3. **Wirtschaftskalender** – Wochenkalender (ForexFactory) mit
   **Heute / Morgen / Weitere Tage**, filterbar nach Wichtigkeit
   (hoch/mittel) und Kategorie (Zinsentscheide, Arbeitsmarkt, Inflation, BIP,
   Konjunktur, Unternehmenszahlen). Zeiten automatisch in MEZ umgerechnet.

4. **Aktualisieren-Knopf** – lädt alle Kurse, News und Termine neu;
   zusätzlich automatische Auffrischung alle 5 Minuten.

## Datenquellen (kostenlos, ohne Key)

| Daten | Quelle |
|---|---|
| Crypto-Kurse & Market Cap | CoinGecko API · Kurse: Binance API |
| Aktien, Indizes, Metalle | Yahoo Finance (Kurse teils verzögert) |
| News | RSS-Feeds der genannten Medien |
| Wirtschaftskalender | ForexFactory-Wochenkalender |

## Hinweise

- Kursdaten teils mit Verzögerung (15 Min. je nach Börse) – keine Anlageberatung.
- **App Store:** Dies ist eine Web-App (läuft im Browser, auch mobil). Eine
  native App-Store-Version ist möglich, wenn das Produkt steht (Verpackung als
  PWA bzw. native Hülle) – für den Start nicht nötig.
- Für den Dauereinsatz im Web (öffentliche URL) später: kleines Server-Hosting
  (EU-Cloud, ca. 5–15 €/Monat) statt lokalem Start.

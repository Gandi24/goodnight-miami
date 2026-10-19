# Goodnight Miami

Strona z design dokiem larpa-audycji **Goodnight Miami**. Design doc ma formę radiowego ogłoszenia Radia Lighthouse 92.3 FM i można go odsłuchać prosto ze strony.

**https://goodnight-miami.com**

![Goodnight Miami](assets/img/og-image.png)

## O larpie

Goodnight Miami to larp-audycja. Gracze wcielają się w obsługę stacji radiowej położonej daleko od miasta i przez całą grę dbają o to, żeby audycja trwała. Puszczają muzykę, odbierają telefony i rozmawiają ze słuchaczami na antenie. Tego wieczoru Miami nie zaśnie spokojnie. Do portu zawinął właśnie nieoznakowany kuter, który na zawsze odmieni los tego miasta.

Autor: Jakub „Gandi” Wasielak

## Struktura

```
index.html              strona główna
ludzie-radia.html       karta postaci z muzyką, za hasłem (treść i utwory przez tools/soundtrack.gs)
404.html                strona błędu dla GitHub Pages
assets/css/style.css    style
assets/css/soundtrack.css style karty postaci i kaset z utworami
assets/js/radio.js      odtwarzacz: skala strojenia, fala w głośniku, śledzenie zapisu
assets/js/soundtrack.js karta postaci: hasło, treść, kasety z utworami
assets/audio/           nagranie design docu
assets/img/             emblemat, favicon, ikony i obrazek do udostępniania (OG)
tools/                  źródła HTML obrazków, skrypt do ich renderowania i Apps Script płytoteki
CNAME                   domena dla GitHub Pages
```

## Uruchomienie lokalne

Strona jest statyczna i nie wymaga budowania. Uruchom ją przez serwer HTTP, a nie przez `file://`. Inaczej przeglądarka zablokuje analizę dźwięku i fala w głośniku zostanie zastąpiona animacją.

```sh
npx http-server -p 8765 -c-1
```

Następnie otwórz http://localhost:8765.

## Obrazki

Obrazek OG i ikony są renderowane z plików w `tools/` przez Chrome w trybie headless:

```sh
./tools/render-images.sh
```

## Publikacja

Strona jest hostowana na GitHub Pages z gałęzi `main`, pod domeną ustawioną w pliku `CNAME`.

## Licencja

© 2026 Jakub „Gandi” Wasielak. Wszelkie prawa zastrzeżone. Szczegóły w pliku [LICENSE](LICENSE).

Strona powstała przy pomocy [Claude Code](https://claude.com/claude-code).

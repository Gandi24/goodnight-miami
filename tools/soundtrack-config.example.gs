// Wzór pliku Config.gs dla tools/soundtrack.gs. Prawdziwy Config.gs trzymaj tylko
// w projekcie Apps Script: zawiera hasła i listy utworów postaci.
//
// Każdy utwór to [tytuł na stronie, link do pliku na Drive]. Link wystarczy skopiować
// z „Share → Copy link”, plik nie musi być udostępniony. Utwory z pustym linkiem
// są pomijane.
//
// sheet to nazwa pliku HTML w projekcie Apps Script (bez .html) z kartą postaci.
// W karcie [[tytuł]] w osobnej linii wstawia odtwarzacz utworu z listy postaci
// albo wspólnej, a linie „> ” zaraz pod nim to tekst piosenki.

const SHARED_TITLE = 'Wątki wspólne';

const SHARED = [
  ['Wykonawca – Utwór', 'https://drive.google.com/file/d/.../view'],
];

const CHARACTERS = {
  'Postać': {
    password: 'hasło',
    sheet: 'Postać',
    tracks: [
      ['Wykonawca – Utwór', ''],
    ],
  },
};

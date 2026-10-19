// Płytoteka postaci: Google Apps Script, który sprawdza hasło i oddaje utwory z Drive.
//
// Utwory to zwykłe pliki na Drive, w dowolnym miejscu. Mogą zostać prywatne,
// skrypt czyta je jako właściciel. Hasła i listy utworów są w drugim pliku projektu,
// Config.gs (wzór w tools/soundtrack-config.example.gs). Lokalna kopia
// tools/soundtrack-config.gs jest w .gitignore.
//
// Wdrożenie: Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone.
// Adres /exec wpisz w ENDPOINT w assets/js/soundtrack.js.

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ error: 'bad_request' });
  }

  const name = characterFor(req.password);
  if (!name) {
    Utilities.sleep(1500); // spowalnia zgadywanie haseł
    return json({ error: 'wrong_password' });
  }

  const groups = [
    { title: name, tracks: tracksOf(CHARACTERS[name].tracks) },
    { title: SHARED_TITLE, tracks: tracksOf(SHARED) },
  ].filter(g => g.tracks.length);

  if (req.track) {
    const allowed = groups.some(g => g.tracks.some(t => t.id === req.track));
    if (!allowed) return json({ error: 'not_found' });
    const blob = DriveApp.getFileById(req.track).getBlob();
    return json({ mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) });
  }

  return json({ character: name, sheet: sheetOf(CHARACTERS[name]), groups: groups });
}

// karta postaci to plik HTML w projekcie Apps Script z treścią w prostym Markdownie:
// # imię, akapity, [[tytuł utworu]] w osobnej linii i cytaty „> ” z tekstem piosenki
function sheetOf(character) {
  return character.sheet ? HtmlService.createHtmlOutputFromFile(character.sheet).getContent() : '';
}

function characterFor(password) {
  if (typeof password !== 'string' || !password) return null;
  return Object.keys(CHARACTERS).find(name => CHARACTERS[name].password === password) || null;
}

// [tytuł, link do pliku na Drive albo samo id]; utwory bez linku są pomijane
function tracksOf(list) {
  return list
    .map(([title, link]) => ({ title: title, id: ((link || '').match(/[-\w]{25,}/) || [])[0] }))
    .filter(t => t.id);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

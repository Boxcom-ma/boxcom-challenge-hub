/**
 * BOXCOM LinkedIn Challenge Hub : back-office Google Sheets (Apps Script)
 *
 * Modèle NON TESTÉ en conditions réelles : il suit le contrat de js/storage.js
 * (GET renvoie l'état JSON, POST reçoit {secret, state}). Teste-le avec des données fictives
 * avant de t'en servir. Mode d'emploi : DEPLOY.md, partie 3.
 *
 * Le classeur contient 4 onglets, créés automatiquement :
 *   Config       : perk, prochaine soumission, date de mise à jour
 *   Teams        : une ligne par membre d'équipe
 *   Draw         : état du tirage (JSON) et journal
 *   Submissions  : une ligne par contenu. Tu peux corriger statut, date, lien et stats
 *                  directement ici, le site relit ces cellules au rechargement.
 */
var SECRET = 'CHANGE-MOI';   // même valeur que sheets.secret dans js/config.js

var SUB_COLS = ['id', 'teamId', 'week', 'idea', 'project', 'link', 'createdAt', 'status',
                'publishedAt', 'postUrl', 'reactions', 'comments', 'reposts'];
var TEAM_COLS = ['teamId', 'teamName', 'color', 'order', 'member', 'role'];

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (header && sh.getLastRow() === 0) {
    sh.appendRow(header);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  try { return json_(readState_()); } catch (err) { return json_({ error: String(err) }); }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json_({ error: 'forbidden' });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { writeState_(body.state); } finally { lock.releaseLock(); }
    return json_({ ok: true });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

function readState_() {
  var cfg = sheet_('Config', ['key', 'value']).getDataRange().getValues();
  var c = {};
  cfg.slice(1).forEach(function (r) { c[r[0]] = r[1]; });

  var drawCell = sheet_('Draw', ['json']).getRange(2, 1).getValue();
  var draw = drawCell ? JSON.parse(drawCell) : { status: 'idle', roundIdx: 0, captainIdx: 0, remaining: [], log: [] };

  var teams = {}, order = [];
  sheet_('Teams', TEAM_COLS).getDataRange().getValues().slice(1).forEach(function (r) {
    if (!r[0]) return;
    if (!teams[r[0]]) { teams[r[0]] = { id: r[0], name: r[1], color: r[2], order: Number(r[3]), members: [] }; order.push(r[0]); }
    teams[r[0]].members.push({ name: r[4], role: r[5] });
  });
  var teamList = order.map(function (id) { return teams[id]; }).sort(function (a, b) { return a.order - b.order; });

  var subs = sheet_('Submissions', SUB_COLS).getDataRange().getValues().slice(1).filter(function (r) { return r[0]; })
    .map(function (r) {
      var o = {};
      SUB_COLS.forEach(function (k, i) {
        var v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        o[k] = v === '' ? (['week', 'createdAt', 'reactions', 'comments', 'reposts'].indexOf(k) >= 0 ? 0 : '') : v;
      });
      ['week', 'createdAt', 'reactions', 'comments', 'reposts'].forEach(function (k) { o[k] = Number(o[k]) || 0; });
      return o;
    });

  return { version: 1, updatedAt: Number(c.updatedAt) || 0, perk: c.perk || '', nextSubmission: c.nextSubmission || '',
           teams: teamList, draw: draw, submissions: subs };
}

function writeState_(s) {
  var cfg = sheet_('Config', ['key', 'value']);
  cfg.clear(); cfg.appendRow(['key', 'value']);
  cfg.appendRow(['perk', s.perk || '']);
  cfg.appendRow(['nextSubmission', s.nextSubmission || '']);
  cfg.appendRow(['updatedAt', s.updatedAt || Date.now()]);

  var draw = sheet_('Draw', ['json']);
  draw.clear(); draw.appendRow(['json']); draw.appendRow([JSON.stringify(s.draw || {})]);

  var tm = sheet_('Teams', TEAM_COLS);
  tm.clear(); tm.appendRow(TEAM_COLS);
  var rows = [];
  (s.teams || []).forEach(function (t, i) {
    (t.members || []).forEach(function (m) { rows.push([t.id, t.name, t.color, t.order != null ? t.order : i, m.name, m.role]); });
  });
  if (rows.length) tm.getRange(2, 1, rows.length, TEAM_COLS.length).setValues(rows);

  var sb = sheet_('Submissions', SUB_COLS);
  sb.clear(); sb.appendRow(SUB_COLS);
  var srows = (s.submissions || []).map(function (x) { return SUB_COLS.map(function (k) { return x[k] == null ? '' : x[k]; }); });
  if (srows.length) sb.getRange(2, 1, srows.length, SUB_COLS.length).setValues(srows);
  sb.getRange(1, 1, 1, SUB_COLS.length).setFontWeight('bold');
}

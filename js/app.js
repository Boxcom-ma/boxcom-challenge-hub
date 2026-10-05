/* Interface : routage par hash (#/home, #/draw ...), rendu, actions. */
(function () {
  var C = BX.CONFIG, store = BX.store, sc = BX.scoring;
  var STATUS_FR = { "Submitted": "Soumis", "Validated": "Validé", "To review": "À revoir", "Published": "Publié" };
  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var ROUTES = [["home", "Home"], ["draw", "Draw"], ["submit", "Submit"], ["content", "Content"], ["leaderboard", "Leaderboard"], ["rules", "Rules"], ["admin", "Admin"]];

  var ui = { route: "home", lbWeek: "all", fTeam: "all", fStatus: "all", flash: "", flashErr: false,
             form: { team: "", week: "1", idea: "", project: "", link: "" },
             confirmReset: false, confirmDelete: null, lastResult: "", pass: "" };
  var view = document.getElementById("view"), nav = document.getElementById("nav");
  var wheelObj = null, pending = false, saveNotice = null;

  /* ---------- utilitaires ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function S() { return store.state; }
  function isAdmin() { try { return sessionStorage.getItem("bx-admin") === "1"; } catch (e) { return false; } }
  function parseDate(iso) { var p = String(iso).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dayMonth(d) { return d.getDate() + " " + MONTHS[d.getMonth()]; }
  function fmtIso(iso) { if (!iso) return "·"; var p = String(iso).split("-"); return p.length === 3 ? p[2] + "/" + p[1] : esc(iso); }
  function todayIso() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function weekRange(w) {
    var a = parseDate(C.startDate); a.setDate(a.getDate() + 7 * (w - 1));
    var b = new Date(a); b.setDate(b.getDate() + 6);
    return dayMonth(a) + " au " + dayMonth(b);
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  function teamById(id) { return S().teams.filter(function (t) { return t.id === id; })[0]; }
  function teamName(id) { var t = teamById(id); return t ? t.name : "Équipe inconnue"; }
  function tcStyle(t) { return 'style="--tc:' + (t ? t.color : "#FFC93C") + '"'; }
  function periodLine() { return dayMonth(parseDate(C.startDate)) + " → " + dayMonth(parseDate(C.endDate)) + " " + parseDate(C.endDate).getFullYear(); }
  function periodProgress() {
    var s = parseDate(C.startDate), e = parseDate(C.endDate), t = new Date(); t.setHours(0, 0, 0, 0);
    var DAY = 86400000, total = Math.round((e - s) / DAY) + 1;
    if (t < s) { var d = Math.round((s - t) / DAY); return { pct: 0, label: "Départ dans " + d + " jour" + (d > 1 ? "s" : "") }; }
    if (t > e) return { pct: 100, label: "Challenge terminé" };
    var day = Math.round((t - s) / DAY) + 1;
    return { pct: Math.round(day / total * 100), label: "Jour " + day + " sur " + total };
  }
  function flash(msg, err) { ui.flash = msg; ui.flashErr = !!err; render(true); }
  function flashHTML() { return ui.flash ? '<div class="flash' + (ui.flashErr ? " err" : "") + '" role="status">' + esc(ui.flash) + "</div>" : ""; }
  function statusChip(s) { return '<span class="chip st-' + s.replace(" ", "-") + '">' + STATUS_FR[s] + "</span>"; }
  function slots(team) {
    var out = [];
    for (var i = 1; i <= C.rounds.length; i++) out.push(team.members[i] ? esc(team.members[i].name) : '<i class="slot">·</i>');
    return out.join(" + ");
  }

  /* ---------- blocs communs ---------- */
  function podium(rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.total; }).concat([1]));
    var medals = ["1", "2", "3"];
    return '<div class="podium">' + rows.map(function (r, i) {
      return '<div class="prow p' + (i + 1) + '" ' + tcStyle(r.team) + '><div class="rk">' + (medals[i] || i + 1) + '</div>'
        + '<div class="who"><b>' + esc(r.team.name) + '</b><span>' + r.team.members.map(function (m) { return esc(m.name); }).join(" · ") + "</span></div>"
        + '<div class="pts mono">' + r.total + "<small>PTS</small></div>"
        + '<div class="track"><div class="fill" style="--w:' + Math.round(r.total / max * 100) + '%"></div></div></div>';
    }).join("") + "</div>";
  }
  function postCard(s) {
    var t = teamById(s.teamId), url = safeUrl(s.postUrl);
    return '<article class="card" ' + tcStyle(t) + '><div class="meta"><span class="dot"></span><b>' + esc(teamName(s.teamId)) + "</b><span>Semaine " + esc(s.week) + "</span>" + (s.project ? "<span>" + esc(s.project) + "</span>" : "") + "</div>"
      + "<h3>" + esc(s.idea) + "</h3>"
      + '<div class="nums mono"><span><em>Réactions</em>' + sc.n(s.reactions) + "</span><span><em>Comm.</em>" + sc.n(s.comments) + "</span><span><em>Repart.</em>" + sc.n(s.reposts) + '</span><span class="tot">' + sc.score(s) + " pts</span></div>"
      + '<div class="meta">' + statusChip(s.status) + "<span>Publié le " + fmtIso(s.publishedAt) + "</span>" + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">Voir le post</a>' : "") + "</div></article>";
  }
  function empty(title, text, extra) { return '<div class="empty"><b>' + title + "</b><span>" + text + "</span>" + (extra || "") + "</div>"; }

  /* ---------- vues ---------- */
  function homeView() {
    var st = S(), rows = sc.leaderboard(st, "all"), pub = st.submissions.filter(function (s) { return s.status === "Published"; });
    var latest = pub.slice().sort(function (a, b) { return String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")); }).slice(0, 4);
    var pp = periodProgress(), n = st.teams.length || 3;
    var h = '<section class="hero"><div class="kicker">Boxcom · Challenge LinkedIn · mois de test</div>'
      + '<h1 aria-label="The race is on."><span class="w w1">THE</span> <span class="w w2">RACE</span> <span class="w w3">IS</span> <span class="w w4">ON.</span></h1>'
      + '<p class="sub"><b>' + periodLine() + "</b> · " + n + " équipes · 1 mois · 1 gagnante</p>"
      + '<div class="period"><div class="ptrack"><div class="pfill" style="--w:' + pp.pct + '%"></div></div><span class="mono">' + pp.label + "</span></div></section>";
    if (!st.teams.length) {
      h += empty("Le tirage des équipes n'a pas encore eu lieu.", "Les équipes et le classement apparaissent ici dès que le tirage est terminé.", '<div><a class="btn" href="#/draw">Aller au tirage</a></div>');
    } else {
      h += '<section class="sec"><div class="sec-head"><h2>Leaderboard</h2><span class="hint">Score d\'une équipe : ses 2 meilleurs contenus publiés</span></div>' + podium(rows) + "</section>";
    }
    h += '<section class="tiles"><div class="tile hot"><span class="kicker">Perk du mois</span><span class="v">' + esc(st.perk || "À annoncer") + "</span></div>"
      + '<div class="tile"><span class="kicker">Prochaine soumission</span><span class="v">' + esc(st.nextSubmission || "À définir") + "</span></div>"
      + '<div class="tile"><span class="kicker">Contenus</span><span class="v mono">' + pub.length + " publiés / " + st.submissions.length + " soumis</span></div></section>";
    h += '<section class="sec"><div class="sec-head"><h2>Latest posts</h2><a class="link" href="#/content">Tout voir</a></div>'
      + (latest.length ? '<div class="cards">' + latest.map(postCard).join("") + "</div>" : empty("Aucun post publié pour le moment.", "Les contenus publiés s'affichent ici avec leurs réactions, commentaires et repartages.")) + "</section>";
    return h;
  }

  function drawView() {
    var st = S(), d = st.draw, adm = isAdmin();
    var h = '<section class="sec"><div class="kicker">Tirage live · Challenge LinkedIn</div><h2 class="big">Team Draw</h2></section>' + flashHTML();
    if (d.status === "idle") {
      h += '<section class="panel"><h3>Comment ça se passe</h3><p class="muted">Chaque capitaine passe à tour de rôle devant la roue. La personne tirée rejoint son équipe puis disparaît de la roue. Le tirage est enregistré à chaque étape.</p>'
        + '<div class="setup"><div><span class="kicker">Capitaines</span><div class="chips">' + C.captains.map(function (c) { return '<span class="pill solid">' + esc(c) + "</span>"; }).join("") + "</div></div>"
        + C.rounds.map(function (r, i) { return '<div><span class="kicker">Round ' + (i + 1) + " · " + esc(r.label) + '</span><div class="chips">' + r.pool.map(function (p) { return '<span class="pill">' + esc(p) + "</span>"; }).join("") + "</div></div>"; }).join("") + "</div>"
        + (adm ? '<div><button class="btn" data-act="startdraw">Lancer le tirage</button></div>' : '<p class="hint">Le tirage est lancé en direct par Salwa (accès Admin).</p>') + "</section>";
      return h;
    }
    if (d.status === "running") {
      var rd = C.rounds[d.roundIdx], cap = st.teams[d.captainIdx];
      h += '<section class="panel live"><div class="sec-head"><div><div class="kicker">Round ' + (d.roundIdx + 1) + " sur " + C.rounds.length + "</div><h3>" + esc(rd.label) + "</h3></div></div>"
        + '<div class="wheelbox"><div class="pointer"></div><canvas id="wheel" width="760" height="760" aria-label="Roue du tirage"></canvas>'
        + '<button class="spin" data-act="spin"' + (adm ? "" : " disabled") + ">SPIN</button></div>"
        + '<div class="duo"><div class="tile hot" ' + tcStyle(cap) + '><span class="kicker">Capitaine en jeu</span><span class="v xl">' + esc(cap.members[0].name) + '</span><span class="hint">' + (adm ? "Fais tourner la roue pour lui attribuer : " + esc(rd.label.toLowerCase()) + "." : "En attente du tirage de Salwa.") + "</span></div>"
        + '<div class="tile"><span class="kicker">Résultat</span><span class="v xl">' + (ui.lastResult ? esc(ui.lastResult) : "En attente...") + "</span></div></div></section>";
    } else {
      h += '<section class="sec"><div class="sec-head"><h2>Les 3 trinômes sont formés</h2><button class="btn ghost" data-act="confetti">Relancer les confettis</button></div>'
        + '<div class="teamgrid">' + st.teams.map(function (t) {
          return '<article class="team" ' + tcStyle(t) + '><span class="kicker">Trinôme</span><h3>' + esc(t.name) + "</h3><ul>"
            + t.members.map(function (m) { return "<li><b>" + esc(m.name) + "</b><small>" + esc(m.role) + "</small></li>"; }).join("") + "</ul></article>";
        }).join("") + "</div></section>";
    }
    h += '<section class="sec"><h2>Équipes</h2><div class="teamrows">' + st.teams.map(function (t) {
      return '<div class="trow" ' + tcStyle(t) + '><span class="dot"></span><b>' + esc(t.members[0].name) + '</b><span class="plus">+ ' + slots(t) + "</span></div>";
    }).join("") + "</div></section>";
    if (adm) {
      var nSub = st.submissions.length;
      h += '<section class="panel danger-zone"><h3>Réinitialiser le tirage</h3><p class="muted">Efface les équipes' + (nSub ? " et les " + nSub + " contenu" + (nSub > 1 ? "s" : "") + " déjà soumis" : "") + ". Cette action ne peut pas être annulée.</p>"
        + '<div class="btns"><button class="btn danger" data-act="reset">' + (ui.confirmReset ? "Oui, tout effacer et recommencer" : "Réinitialiser le tirage") + "</button>"
        + (ui.confirmReset ? '<button class="btn ghost" data-act="cancelreset">Annuler</button>' : "") + "</div></section>";
    }
    return h;
  }

  function submitView() {
    var st = S(), f = ui.form;
    var h = '<section class="sec"><div class="kicker">Chaque semaine</div><h2 class="big">Submit your content</h2></section>';
    if (!st.teams.length) return h + empty("Soumissions ouvertes après le tirage.", "Dès que les équipes sont formées, tu choisis la tienne et tu proposes ton idée ici.", '<div><a class="btn" href="#/draw">Voir le tirage</a></div>');
    h += '<form class="panel" id="subform" novalidate>' + flashHTML()
      + '<div class="grid2"><div class="field"><label for="f-team">Team</label><select id="f-team" data-f="team"><option value="">Choisir</option>'
      + st.teams.map(function (t) { return '<option value="' + esc(t.id) + '"' + (f.team === t.id ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") + "</select></div>"
      + '<div class="field"><label for="f-week">Week</label><select id="f-week" data-f="week">'
      + Array.from({ length: C.weeks }, function (_, i) { return '<option value="' + (i + 1) + '"' + (String(f.week) === String(i + 1) ? " selected" : "") + ">Semaine " + (i + 1) + " (" + weekRange(i + 1) + ")</option>"; }).join("") + "</select></div></div>"
      + '<div class="field"><label for="f-idea">Content idea</label><textarea id="f-idea" data-f="idea" placeholder="Ex : les coulisses du montage de l\'événement, en 3 temps forts">' + esc(f.idea) + "</textarea></div>"
      + '<div class="grid2"><div class="field"><label for="f-proj">Source project / event</label><input type="text" id="f-proj" data-f="project" value="' + esc(f.project) + '" placeholder="Client, projet ou événement"></div>'
      + '<div class="field"><label for="f-link">Lien vers le visuel ou le brouillon <span class="opt">(facultatif)</span></label><input type="text" id="f-link" data-f="link" value="' + esc(f.link) + '" placeholder="https://drive.google.com/..."></div></div>'
      + '<p class="hint">Un fichier à joindre ? Dépose-le dans le Drive et colle le lien ici.</p>'
      + '<div><button class="btn" type="submit">Submit</button></div></form>'
      + '<p class="hint">Chaque contenu est validé avant publication. Suis son statut dans l\'onglet Content.</p>';
    return h;
  }

  function contentView() {
    var st = S(), perf = sc.performance(st);
    var h = '<section class="sec"><div class="kicker">Content board</div><h2 class="big">Content</h2></section>';
    if (perf.best) {
      var aw = function (lab, s, v) { return '<div class="award" ' + tcStyle(teamById(s.teamId)) + '><span class="lab">' + lab + '</span><span class="t">' + esc(s.idea) + '</span><span class="hint">' + esc(teamName(s.teamId)) + ' · <b class="mono">' + v + "</b></span></div>"; };
      h += '<section class="sec"><h2>Post performance</h2><div class="awards">'
        + aw("Best performing post", perf.best, sc.score(perf.best) + " pts")
        + aw("Most commented", perf.commented, sc.n(perf.commented.comments) + " commentaires")
        + aw("Most shared", perf.shared, sc.n(perf.shared.reposts) + " repartages") + "</div></section>";
    }
    var teamChips = [["all", "Toutes les équipes"]].concat(st.teams.map(function (t) { return [t.id, t.name]; }));
    var statusChips = [["all", "Tous les statuts"]].concat(sc.STATUSES.map(function (s) { return [s, STATUS_FR[s]]; }));
    var rows = st.submissions.filter(function (s) { return (ui.fTeam === "all" || s.teamId === ui.fTeam) && (ui.fStatus === "all" || s.status === ui.fStatus); })
      .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    h += '<section class="sec"><h2>Board</h2><div class="chips" role="group" aria-label="Filtrer par équipe">' + teamChips.map(function (c) { return '<button class="pill" data-act="fteam" data-v="' + esc(c[0]) + '" aria-pressed="' + (ui.fTeam === c[0]) + '">' + esc(c[1]) + "</button>"; }).join("") + "</div>"
      + '<div class="chips" role="group" aria-label="Filtrer par statut">' + statusChips.map(function (c) { return '<button class="pill" data-act="fstatus" data-v="' + esc(c[0]) + '" aria-pressed="' + (ui.fStatus === c[0]) + '">' + esc(c[1]) + "</button>"; }).join("") + "</div>";
    if (!rows.length) h += empty("Aucun contenu à afficher.", st.submissions.length ? "Aucun contenu ne correspond à ces filtres." : "Les idées soumises par les équipes apparaissent ici avec leur statut.");
    else h += '<div class="tablewrap"><table><thead><tr><th>Team</th><th>Content</th><th>Project</th><th>Status</th><th>Published</th><th class="r">Réact.</th><th class="r">Comm.</th><th class="r">Repart.</th><th class="r">Score</th></tr></thead><tbody>'
      + rows.map(function (s) {
        var t = teamById(s.teamId), url = safeUrl(s.postUrl), pub = s.status === "Published";
        return "<tr><td " + tcStyle(t) + '><span class="dot"></span> ' + esc(teamName(s.teamId)) + '</td><td class="idea">' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(s.idea) + "</a>" : esc(s.idea)) + "</td><td>" + esc(s.project || "·") + "</td><td>" + statusChip(s.status) + "</td><td>" + fmtIso(s.publishedAt) + "</td>"
          + '<td class="r mono">' + (pub ? sc.n(s.reactions) : "·") + '</td><td class="r mono">' + (pub ? sc.n(s.comments) : "·") + '</td><td class="r mono">' + (pub ? sc.n(s.reposts) : "·") + '</td><td class="r mono sc">' + (pub ? sc.score(s) : "·") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    return h + "</section>";
  }

  function leaderboardView() {
    var st = S();
    var h = '<section class="sec"><div class="kicker">Live</div><h2 class="big">Leaderboard</h2></section>';
    h += '<div class="chips" role="group" aria-label="Période">' + [["all", "Cumul"]].concat(Array.from({ length: C.weeks }, function (_, i) { return [String(i + 1), "Semaine " + (i + 1)]; })).map(function (p) {
      return '<button class="pill" data-act="lbweek" data-v="' + p[0] + '" aria-pressed="' + (ui.lbWeek === p[0]) + '">' + p[1] + "</button>"; }).join("") + "</div>";
    if (!st.teams.length) return h + empty("Pas encore d'équipes.", "Le classement s'affiche après le tirage.");
    var rows = sc.leaderboard(st, ui.lbWeek);
    h += podium(rows) + '<section class="sec"><h2>Détail par équipe</h2>' + rows.map(function (r) {
      return '<div class="panel" ' + tcStyle(r.team) + '><div class="sec-head"><h3 class="tn"><span class="dot"></span>' + esc(r.team.name) + '</h3><span class="mono big-n">' + r.total + " pts</span></div>"
        + (r.items.length ? r.items.map(function (it) {
          return '<div class="line"><span>' + esc(it.sub.idea) + (it.kept ? ' <span class="chip keep">Retenu</span>' : "") + '</span><span class="mono hint">' + sc.n(it.sub.reactions) + " + 3×" + sc.n(it.sub.comments) + " + 5×" + sc.n(it.sub.reposts) + " = <b>" + it.score + "</b></span></div>"; }).join("")
          : '<span class="hint">Aucun contenu publié sur cette période.</span>') + "</div>";
    }).join("") + "</section>";
    return h;
  }

  function rulesView() {
    function r(tag, t, p) { return '<div class="rule"><span class="tag">' + tag + "</span><h3>" + t + "</h3><p>" + p + "</p></div>"; }
    return '<section class="sec"><div class="kicker">Mode d\'emploi</div><h2 class="big">Rules</h2></section><div class="rules">'
      + r("Période", periodLine(), "Quatre semaines de contenus, puis un dernier relevé de stats à J+7. Tirage au sort au lancement, équipes fixes pendant tout le challenge.")
      + r("Équipes", "Capitaine + graphiste + renfort", "Trois capitaines (" + C.captains.map(esc).join(", ") + ") tirent d'abord un graphiste, puis un renfort. Le projet et les événements de chaque membre alimentent le contenu de son équipe.")
      + r("Chaque semaine", "Soumettre ses idées", "Chaque équipe soumet ses idées de contenu depuis l'onglet Submit, avec le projet ou l'événement source.")
      + r("Validation", "Chaque contenu est validé avant publication", "Statuts : Submitted, Validated, To review, Published. Pas d'accord client écrit à fournir.")
      + r("Publication", "LinkedIn uniquement", "Pas de boost. Les repartages depuis vos profils personnels sont autorisés et encouragés.")
      + r("Relevé", "Stats relevées 7 jours après publication", "Réactions, commentaires et repartages sont saisis une fois par semaine. Le site calcule les points.")
      + r("Barème", "Points", '<span class="formula mono">1 pt × réactions + 3 pts × commentaires + 5 pts × repartages</span><br><br>Le score d\'une équipe est la somme de ses 2 meilleurs contenus publiés.')
      + r("Perk", "Non monétaire, partagé dans l'équipe gagnante", esc(S().perk || "À annoncer"))
      + r("Bilan", "Un mois de test", "À la fin, toute l'équipe donne son retour, puis la décision de reconduire ou non le challenge est prise.")
      + "</div>";
  }

  function adminView() {
    var st = S();
    if (!isAdmin()) {
      return '<section class="sec"><div class="kicker">Accès réservé</div><h2 class="big">Admin</h2></section>'
        + '<form class="panel narrow" id="passform">' + flashHTML() + '<div class="field"><label for="a-pass">Code admin</label><input type="password" id="a-pass" autocomplete="off" data-f="pass" value="' + esc(ui.pass) + '"></div><div><button class="btn" type="submit">Ouvrir</button></div></form>';
    }
    var h = '<section class="sec"><div class="sec-head"><div><div class="kicker">Réservé à Salwa</div><h2 class="big">Admin</h2></div><button class="btn ghost" data-act="logout">Quitter l\'admin</button></div></section>' + flashHTML();
    h += '<section class="panel"><h3>Affichage de l\'accueil</h3><div class="grid2">'
      + '<div class="field"><label for="c-perk">Perk du mois</label><input type="text" id="c-perk" data-cfg="perk" value="' + esc(st.perk || "") + '"></div>'
      + '<div class="field"><label for="c-next">Prochaine soumission</label><input type="text" id="c-next" data-cfg="nextSubmission" value="' + esc(st.nextSubmission || "") + '"></div></div></section>';
    h += '<section class="sec"><div class="sec-head"><h2>Contenus</h2><span class="hint">Statut, date, lien du post et stats. Les points se calculent seuls.</span></div>';
    if (!st.submissions.length) h += empty("Aucun contenu soumis.", "Les soumissions des équipes arrivent ici. Tu règles ensuite le statut, la date de publication, le lien du post et les stats LinkedIn.");
    else h += '<div class="tablewrap"><table class="admin"><thead><tr><th>Team</th><th>Sem.</th><th>Content</th><th>Status</th><th>Publié le</th><th>Lien du post</th><th>Réact.</th><th>Comm.</th><th>Repart.</th><th>Score</th><th></th></tr></thead><tbody>'
      + st.submissions.slice().sort(function (a, b) { return a.week - b.week || (a.createdAt || 0) - (b.createdAt || 0); }).map(function (s) {
        return '<tr data-row="' + esc(s.id) + '"><td>' + esc(teamName(s.teamId)) + '</td><td class="mono">' + esc(s.week) + '</td><td class="idea">' + esc(s.idea) + (s.project ? '<br><span class="hint">' + esc(s.project) + "</span>" : "") + (safeUrl(s.link) ? '<br><a href="' + esc(s.link) + '" target="_blank" rel="noopener">Brouillon</a>' : "") + "</td>"
          + '<td><select data-k="status" aria-label="Statut">' + sc.STATUSES.map(function (x) { return '<option value="' + x + '"' + (s.status === x ? " selected" : "") + ">" + STATUS_FR[x] + "</option>"; }).join("") + "</select></td>"
          + '<td><input type="date" data-k="publishedAt" value="' + esc(s.publishedAt || "") + '" aria-label="Date de publication"></td>'
          + '<td><input type="text" class="url" data-k="postUrl" value="' + esc(s.postUrl || "") + '" placeholder="https://linkedin.com/..." aria-label="Lien du post"></td>'
          + '<td><input type="number" min="0" data-k="reactions" value="' + sc.n(s.reactions) + '" aria-label="Réactions"></td>'
          + '<td><input type="number" min="0" data-k="comments" value="' + sc.n(s.comments) + '" aria-label="Commentaires"></td>'
          + '<td><input type="number" min="0" data-k="reposts" value="' + sc.n(s.reposts) + '" aria-label="Repartages"></td>'
          + '<td class="sc mono">' + sc.score(s) + "</td>"
          + '<td><button class="btn danger sm" data-act="delsub" data-v="' + esc(s.id) + '">' + (ui.confirmDelete === s.id ? "Confirmer" : "Supprimer") + "</button></td></tr>";
      }).join("") + "</tbody></table></div>";
    h += "</section>";
    var ad = store.adapter ? store.adapter.name : "local";
    h += '<section class="panel"><h3>Données</h3><p class="muted">Stockage actuel : <b>' + (ad === "sheets" ? "Google Sheets" : "ce navigateur uniquement") + "</b>."
      + (ad === "local" ? " Les données de ce prototype ne sont pas partagées entre appareils. Exporte une sauvegarde JSON pour les déplacer, ou branche Google Sheets (voir DEPLOY.md)." : "") + "</p>"
      + '<div class="btns"><button class="btn ghost" data-act="exportjson">Exporter JSON</button><button class="btn ghost" data-act="exportcsv"' + (st.submissions.length ? "" : " disabled") + '>Exporter CSV</button>'
      + '<label class="btn ghost filebtn" for="importfile">Importer JSON</label><input type="file" id="importfile" accept="application/json,.json" hidden>'
      + (ad === "sheets" ? '<button class="btn ghost" data-act="refresh">Recharger depuis Google Sheets</button>' : "") + "</div></section>";
    return h;
  }

  /* ---------- rendu ---------- */
  var VIEWS = { home: homeView, draw: drawView, submit: submitView, content: contentView, leaderboard: leaderboardView, rules: rulesView, admin: adminView };

  function render(force) {
    var a = document.activeElement;
    if (wheelObj && wheelObj.spinning) { pending = true; return; }
    if (!force && a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { pending = true; return; }
    pending = false;
    nav.innerHTML = ROUTES.map(function (r) {
      return '<a href="#/' + r[0] + '"' + (ui.route === r[0] ? ' aria-current="page"' : "") + (r[0] === "admin" ? ' class="adm"' : "") + ">" + r[1] + "</a>";
    }).join("");
    var banner = store.status === "error" ? '<div class="flash err" role="alert">' + esc(store.error) + "</div>" : "";
    view.innerHTML = banner + (store.status === "loading" ? '<div class="empty"><b>Chargement...</b></div>' : VIEWS[ui.route]());
    wheelObj = null;
    var cv = document.getElementById("wheel");
    if (cv && S().draw.status === "running") { wheelObj = BX.wheel.create(cv); wheelObj.set(S().draw.remaining); }
  }
  document.addEventListener("focusout", function () { setTimeout(function () { if (pending) render(); }, 60); });

  function route() {
    var h = (location.hash || "#/home").replace(/^#\/?/, "") || "home";
    ui.route = VIEWS[h] ? h : "home"; ui.flash = ""; ui.confirmReset = false; ui.confirmDelete = null;
    render(true); window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  store.subscribe(function () { render(); });

  /* ---------- actions ---------- */
  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv() {
    function q(x) { return '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"'; }
    var head = ["Team", "Semaine", "Contenu", "Projet", "Lien brouillon", "Statut", "Publié le", "Lien du post", "Réactions", "Commentaires", "Repartages", "Score"];
    var lines = [head.map(q).join(",")];
    S().submissions.slice().sort(function (a, b) { return a.week - b.week; }).forEach(function (s) {
      lines.push([teamName(s.teamId), s.week, s.idea, s.project, s.link, s.status, s.publishedAt, s.postUrl, sc.n(s.reactions), sc.n(s.comments), sc.n(s.reposts), sc.score(s)].map(q).join(","));
    });
    return "﻿" + lines.join("\n");
  }
  function spin() {
    if (!isAdmin() || !wheelObj || wheelObj.spinning) return;
    var rem = S().draw.remaining, idx = BX.draw.randInt(rem.length), picked = rem[idx];
    var capName = S().teams[S().draw.captainIdx].members[0].name;
    var btn = view.querySelector(".spin"); if (btn) btn.disabled = true;
    wheelObj.spin(idx, function () {
      ui.lastResult = capName + " + " + picked;
      store.update(function (s) { BX.draw.assign(s, idx); });
      if (S().draw.status === "done") BX.confetti();
    });
  }
  function saveRow(tr) {
    var id = tr.dataset.row, v = {};
    tr.querySelectorAll("[data-k]").forEach(function (el) { v[el.dataset.k] = el.value; });
    store.update(function (s) {
      var sub = s.submissions.filter(function (x) { return x.id === id; })[0]; if (!sub) return;
      sub.status = v.status; sub.publishedAt = v.publishedAt; sub.postUrl = v.postUrl.trim();
      sub.reactions = sc.n(v.reactions); sub.comments = sc.n(v.comments); sub.reposts = sc.n(v.reposts);
      if (sub.status === "Published" && !sub.publishedAt) sub.publishedAt = todayIso();
    });
  }
  function submitForm() {
    var f = ui.form;
    if (!f.team || !f.idea.trim()) return flash("Choisis ton équipe et décris ton idée de contenu.", true);
    if (f.link.trim() && !safeUrl(f.link.trim())) return flash("Le lien doit commencer par https://", true);
    var sub = { id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), teamId: f.team, week: Number(f.week) || 1,
      idea: f.idea.trim(), project: f.project.trim(), link: f.link.trim(), createdAt: Date.now(), status: "Submitted",
      publishedAt: "", postUrl: "", reactions: 0, comments: 0, reposts: 0 };
    ui.form = { team: f.team, week: f.week, idea: "", project: "", link: "" };
    ui.flash = "Contenu soumis. Il sera validé avant publication."; ui.flashErr = false;
    store.update(function (s) { s.submissions.push(sub); });
  }

  view.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]"); if (!el) return;
    var act = el.dataset.act, v = el.dataset.v;
    if (act === "spin") return spin();
    if (act === "startdraw") { ui.lastResult = ""; return store.update(function (s) { BX.draw.start(s); }); }
    if (act === "confetti") return BX.confetti();
    if (act === "reset") {
      if (!ui.confirmReset) { ui.confirmReset = true; return render(true); }
      ui.confirmReset = false; ui.lastResult = ""; return store.update(function (s) { BX.draw.reset(s); });
    }
    if (act === "cancelreset") { ui.confirmReset = false; return render(true); }
    if (act === "fteam") { ui.fTeam = v; return render(true); }
    if (act === "fstatus") { ui.fStatus = v; return render(true); }
    if (act === "lbweek") { ui.lbWeek = v; return render(true); }
    if (act === "logout") { try { sessionStorage.removeItem("bx-admin"); } catch (x) {} ui.pass = ""; return render(true); }
    if (act === "delsub") {
      if (ui.confirmDelete !== v) { ui.confirmDelete = v; return render(true); }
      ui.confirmDelete = null; return store.update(function (s) { s.submissions = s.submissions.filter(function (x) { return x.id !== v; }); });
    }
    if (act === "exportjson") return download("boxcom-challenge-" + todayIso() + ".json", "application/json", JSON.stringify(S(), null, 2));
    if (act === "exportcsv") return download("boxcom-challenge-" + todayIso() + ".csv", "text/csv;charset=utf-8", csv());
    if (act === "refresh") return store.refresh().then(function () { flash("Données rechargées."); });
  });
  view.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id === "subform") return submitForm();
    if (e.target.id === "passform") {
      if (ui.pass === C.adminPasscode) { try { sessionStorage.setItem("bx-admin", "1"); } catch (x) {} ui.pass = ""; ui.flash = ""; render(true); }
      else flash("Code incorrect.", true);
    }
  });
  view.addEventListener("input", function (e) {
    var f = e.target.dataset && e.target.dataset.f; if (!f) return;
    if (f === "pass") ui.pass = e.target.value; else ui.form[f] = e.target.value;
  });
  view.addEventListener("change", function (e) {
    var t = e.target, tr = t.closest && t.closest("tr[data-row]");
    if (tr && t.dataset.k && isAdmin()) return saveRow(tr);
    if (t.dataset.cfg && isAdmin()) { var k = t.dataset.cfg, val = t.value.trim(); return store.update(function (s) { s[k] = val; }); }
    if (t.id === "importfile" && isAdmin() && t.files && t.files[0]) {
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var obj = JSON.parse(rd.result);
          if (!obj || !Array.isArray(obj.teams) || !Array.isArray(obj.submissions)) throw new Error("Format inattendu");
          store.replace(obj); flash("Sauvegarde importée.");
        } catch (x) { flash("Import impossible : " + x.message, true); }
      };
      rd.readAsText(t.files[0]);
    }
  });

  /* ---------- démarrage ---------- */
  BX.ui = ui;
  store.init().then(route);
  route();
})();

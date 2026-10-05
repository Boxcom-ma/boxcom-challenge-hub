/* Calculs : points, classement, performances. Aucune dépendance au DOM. */
window.BX = window.BX || {};

BX.scoring = (function () {
  var STATUSES = ["Submitted", "Validated", "To review", "Published"];

  function n(v) { var x = parseInt(v, 10); return isNaN(x) || x < 0 ? 0 : x; }

  // score = réactions + 3 x commentaires + 5 x repartages
  function score(sub) { return n(sub.reactions) + 3 * n(sub.comments) + 5 * n(sub.reposts); }

  function published(subs, week) {
    return subs.filter(function (s) {
      return s.status === "Published" && (week == null || week === "all" || Number(s.week) === Number(week));
    });
  }

  // Classement : le score d'une équipe = ses 2 meilleurs contenus publiés
  function leaderboard(state, week) {
    var pub = published(state.submissions, week);
    var rows = state.teams.map(function (t) {
      var items = pub.filter(function (s) { return s.teamId === t.id; })
        .map(function (s) { return { sub: s, score: score(s) }; })
        .sort(function (a, b) { return b.score - a.score; });
      items.forEach(function (it, i) { it.kept = i < 2; });
      var total = items.slice(0, 2).reduce(function (a, it) { return a + it.score; }, 0);
      return { team: t, items: items, total: total };
    });
    rows.sort(function (a, b) { return b.total - a.total || String(a.team.name).localeCompare(String(b.team.name)); });
    return rows;
  }

  function pickMax(list, fn) {
    var best = null;
    list.forEach(function (s) { if (!best || fn(s) > fn(best)) best = s; });
    return best && fn(best) > 0 ? best : (best || null);
  }

  function performance(state) {
    var pub = published(state.submissions, "all");
    return {
      best: pickMax(pub, score),
      commented: pickMax(pub, function (s) { return n(s.comments); }),
      shared: pickMax(pub, function (s) { return n(s.reposts); })
    };
  }

  return { STATUSES: STATUSES, score: score, leaderboard: leaderboard, performance: performance, n: n };
})();

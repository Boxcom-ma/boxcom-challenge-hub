/* Logique du tirage au sort (sans DOM).
   Déroulé : pour chaque round, chaque capitaine passe à tour de rôle.
   La personne tirée rejoint son équipe et disparaît de la roue.
   Chaque attribution est enregistrée dans l'état, donc le tirage survit à un rechargement. */
window.BX = window.BX || {};

BX.draw = (function () {
  function randInt(n) {
    if (n <= 1) return 0;
    var max = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= max);
    return buf[0] % n;
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function rounds() { return BX.CONFIG.rounds; }

  // Crée les équipes (un capitaine chacune) et ouvre le round 1
  function start(state) {
    var C = BX.CONFIG;
    state.teams = C.captains.map(function (c, i) {
      return { id: "t" + (i + 1), name: "Team " + c, color: C.teamColors[i % C.teamColors.length],
               members: [{ name: c, role: "Capitaine" }] };
    });
    state.submissions = [];
    state.draw = { status: "running", roundIdx: 0, captainIdx: 0,
                   remaining: shuffle(rounds()[0].pool), log: [] };
  }

  // Attribue la personne à l'index donné au capitaine en jeu
  function assign(state, index) {
    var d = state.draw;
    if (d.status !== "running") return null;
    if (index < 0 || index >= d.remaining.length) return null;
    var name = d.remaining.splice(index, 1)[0];
    var team = state.teams[d.captainIdx];
    team.members.push({ name: name, role: rounds()[d.roundIdx].label });
    d.log.push({ round: d.roundIdx, captain: team.members[0].name, picked: name });
    d.captainIdx++;
    if (d.captainIdx >= state.teams.length || !d.remaining.length) {
      d.roundIdx++; d.captainIdx = 0;
      if (d.roundIdx >= rounds().length) { d.status = "done"; d.remaining = []; }
      else d.remaining = shuffle(rounds()[d.roundIdx].pool);
    }
    return { name: name, team: team };
  }

  // Réinitialisation explicite : efface équipes, tirage et contenus soumis
  function reset(state) {
    state.teams = [];
    state.submissions = [];
    state.draw = { status: "idle", roundIdx: 0, captainIdx: 0, remaining: [], log: [] };
  }

  return { randInt: randInt, shuffle: shuffle, start: start, assign: assign, reset: reset };
})();

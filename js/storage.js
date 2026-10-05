/* Couche de stockage. L'interface est volontairement minuscule :
     adapter.load()      -> Promise<state | null>
     adapter.save(state) -> Promise<void>
   Pour changer de stockage, on change l'adaptateur dans config.js, rien d'autre. */
window.BX = window.BX || {};

(function () {
  var KEY = "boxcom-linkedin-challenge-v1";

  function emptyState() {
    return {
      version: 1,
      updatedAt: 0,
      perk: BX.CONFIG.perk,
      nextSubmission: BX.CONFIG.nextSubmission,
      teams: [],
      draw: { status: "idle", roundIdx: 0, captainIdx: 0, remaining: [], log: [] },
      submissions: []
    };
  }

  var LocalAdapter = {
    name: "local",
    load: function () {
      return new Promise(function (resolve) {
        try { var raw = localStorage.getItem(KEY); resolve(raw ? JSON.parse(raw) : null); }
        catch (e) { resolve(null); }
      });
    },
    save: function (state) {
      return new Promise(function (resolve, reject) {
        try { localStorage.setItem(KEY, JSON.stringify(state)); resolve(); }
        catch (e) { reject(e); }
      });
    }
  };

  // Adaptateur Google Sheets : parle à apps-script/Code.gs (Web App).
  // POST en text/plain pour éviter la requête préliminaire CORS.
  var SheetsAdapter = {
    name: "sheets",
    load: function () {
      var c = BX.CONFIG.sheets;
      return fetch(c.webAppUrl, { method: "GET" })
        .then(function (r) { return r.json(); })
        .then(function (s) { return s && s.version ? s : null; });
    },
    save: function (state) {
      var c = BX.CONFIG.sheets;
      return fetch(c.webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ secret: c.secret, state: state })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || j.error) throw new Error((j && j.error) || "Écriture refusée");
      });
    }
  };

  function pickAdapter() {
    var c = BX.CONFIG;
    if (c.storage === "sheets" && c.sheets && c.sheets.webAppUrl) return SheetsAdapter;
    return LocalAdapter;
  }

  var Store = {
    state: emptyState(),
    adapter: null,
    listeners: [],
    status: "loading",   // loading | ready | error
    error: "",
    queue: Promise.resolve(),

    init: function () {
      var self = this;
      this.adapter = pickAdapter();
      return this.adapter.load().then(function (s) {
        self.state = s ? Object.assign(emptyState(), s) : emptyState();
        self.status = "ready";
        self.emit();
      }).catch(function (e) {
        self.status = "error";
        self.error = "Lecture impossible : " + (e && e.message || e);
        self.emit();
      });
    },
    subscribe: function (fn) { this.listeners.push(fn); },
    emit: function () { this.listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); },

    // Applique une modification, sauvegarde, puis notifie. Les écritures sont mises en file.
    update: function (mutator) {
      var self = this;
      var next = JSON.parse(JSON.stringify(this.state));
      mutator(next);
      next.updatedAt = Date.now();
      this.state = next;
      this.emit();
      this.queue = this.queue.then(function () { return self.adapter.save(next); }).then(function () {
        if (self.status === "error") { self.status = "ready"; self.error = ""; self.emit(); }
      }).catch(function (e) {
        self.status = "error";
        self.error = "Enregistrement impossible : " + (e && e.message || e);
        self.emit();
      });
      return this.queue;
    },
    // Remplace tout l'état (import JSON)
    replace: function (state) {
      return this.update(function (s) {
        var keep = Object.assign(emptyState(), state);
        Object.keys(s).forEach(function (k) { delete s[k]; });
        Object.assign(s, keep);
      });
    },
    // Recharge depuis le stockage (utile pour Sheets ou pour un autre onglet)
    refresh: function () {
      var self = this;
      return this.adapter.load().then(function (s) {
        if (s) { self.state = Object.assign(emptyState(), s); self.emit(); }
      });
    }
  };

  // Synchronisation entre onglets du même navigateur
  window.addEventListener("storage", function (e) {
    if (e.key === KEY && Store.adapter && Store.adapter.name === "local") Store.refresh();
  });

  BX.emptyState = emptyState;
  BX.store = Store;
})();

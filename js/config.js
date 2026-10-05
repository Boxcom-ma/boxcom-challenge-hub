/* BOXCOM LinkedIn Challenge Hub : configuration
   Tout ce qui change d'une édition à l'autre se règle ici. */
window.BX = window.BX || {};

BX.CONFIG = {
  title: "BOXCOM LinkedIn Challenge",
  // Période du challenge (format AAAA-MM-JJ)
  startDate: "2026-10-05",
  endDate: "2026-11-06",
  // 4 semaines de soumission, la semaine 1 commence à startDate.
  // Le relevé des stats se fait à J+7 : la dernière lecture tombe le 6 novembre.
  weeks: 4,

  // Récompense affichée sur l'accueil (modifiable aussi depuis Admin)
  perk: "Après-midi off + goûter offert",
  nextSubmission: "Vendredi matin",

  // Tirage au sort
  captains: ["Hind", "Nouhaila", "Mohammed"],
  rounds: [
    { label: "Les graphistes", pool: ["Marouane E.", "Marouane H.", "Zahra"] },
    { label: "Les renforts", pool: ["Zakaria", "Oumaima", "Saad"] }
  ],

  // Couleurs des 3 équipes (jaune, turquoise, rose)
  teamColors: ["#FFC93C", "#2DD4BF", "#FF5FA2"],

  // Accès admin : code demandé pour ouvrir l'onglet Admin.
  // ATTENTION : ce code est lisible dans le code source de la page. Il protège
  // contre une fausse manoeuvre, pas contre une personne qui cherche à tricher.
  // Change-le avant le déploiement.
  adminPasscode: "boxcom2026",

  // Stockage des données
  //   "local"  : navigateur uniquement (prototype testable seul, rien n'est partagé)
  //   "sheets" : Google Sheets via Apps Script (voir DEPLOY.md, partie 3)
  storage: "local",
  sheets: {
    webAppUrl: "",   // URL du déploiement Apps Script, se termine par /exec
    secret: ""       // même valeur que SECRET dans apps-script/Code.gs
  }
};

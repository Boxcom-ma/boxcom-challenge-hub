# BOXCOM LinkedIn Challenge Hub : mise en ligne

Le site est 100 % statique : un dossier de fichiers, aucun serveur à installer.

```
boxcom-challenge-hub/
  index.html
  css/styles.css
  js/config.js      <- tout se règle ici (dates, capitaines, rounds, code admin)
  js/storage.js     <- stockage (navigateur ou Google Sheets)
  js/scoring.js     <- calcul des points et du classement
  js/draw.js        <- logique du tirage
  js/wheel.js       <- roue
  js/fx.js          <- confettis
  js/app.js         <- interface
  apps-script/Code.gs  <- modèle de back-office Google Sheets (partie 3)
```

## 1. Tester en local (2 minutes)

1. Décompresse le dossier.
2. Double-clique sur `index.html`. Le site s'ouvre dans ton navigateur.
3. Ouvre l'onglet **Admin**, code : `boxcom2026` (à changer, voir partie 2).
4. Va dans **Draw**, clique sur **Lancer le tirage**, puis sur **SPIN** pour chaque capitaine.
5. Fais une soumission dans **Submit**, puis gère-la dans **Admin**.

En mode local, les données restent dans **ce navigateur** : rien n'est partagé avec l'équipe.
Pour repartir de zéro : Draw, puis **Réinitialiser le tirage**.

## 2. Avant la mise en ligne

Ouvre `js/config.js` et vérifie :

- `adminPasscode` : remplace `boxcom2026` par ton propre code.
  Ce code est lisible dans le code source de la page : il évite les fausses manoeuvres,
  il ne protège pas contre quelqu'un qui cherche à tricher.
- `perk` : la récompense affichée (valeur de départ : « Après-midi off + goûter offert », à confirmer).
- `startDate`, `endDate`, `captains`, `rounds` : déjà réglés sur 5 oct → 6 nov 2026,
  Hind / Nouhaila / Mohammed, puis graphistes, puis renforts.

## 3. Partager les données avec l'équipe (Google Sheets)

Sans cette étape, chaque personne voit son propre site vide. Il faut une base commune.
Le plus simple avec ton compte Google : un classeur Sheets relié au site par un script.

1. Le projet est déjà lié au classeur « Boxcom challenge » :
   `https://docs.google.com/spreadsheets/d/17-ff2CJqblFu4UIv3tUeVDgmQQpbrgp6JUGBp33Xx6I/edit`.
   Les onglets Config, Teams, Draw et Submissions y sont déjà préparés.
2. Dans ce classeur, ouvre **Extensions > Apps Script**. Efface le contenu, colle celui de `apps-script/Code.gs`.
3. En haut du script, remplace `CHANGE-MOI` par un mot de passe long de ton choix (le « secret »).
4. Clique sur **Déployer > Nouveau déploiement > Type : Application Web**.
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
   Autorise l'accès demandé par Google, puis copie l'URL qui se termine par `/exec`.
5. Dans `js/config.js`, conserve `storage: "sheets"` et renseigne l'URL et le secret :
   ```js
   storage: "sheets",
   sheets: {
     spreadsheetId: "17-ff2CJqblFu4UIv3tUeVDgmQQpbrgp6JUGBp33Xx6I",
     webAppUrl: "L'URL /exec copiée",
     secret: "le même secret qu'à l'étape 3"
   }
   ```
6. Recharge le site : l'onglet Admin affiche « Stockage actuel : Google Sheets ».
   Fais un tirage de test : les onglets Config, Teams, Draw et Submissions se remplissent.

Ce que ça donne :
- Le classeur est ton back-office : tu peux corriger statut, date, lien et stats dans l'onglet
  **Submissions**, puis cliquer sur « Recharger depuis Google Sheets » dans l'Admin.
- Le secret figure dans le code du site : toute personne qui lit le code peut écrire dans le classeur.
  C'est acceptable pour un challenge interne d'un mois, pas pour des données sensibles.
- Le site relit le classeur à l'ouverture de la page. Il n'actualise pas les écrans déjà ouverts.

Ce modèle de script n'a pas été testé en conditions réelles : fais un essai complet avec des
données fictives avant le lancement.

## 4. Mettre le site sur challenge.box-com.com

Choisis le chemin qui correspond à ton hébergement.

**A. Netlify ou Cloudflare Pages (le plus rapide, gratuit)**
1. Crée un compte, puis « Déployer un site » en glissant le dossier `boxcom-challenge-hub`.
2. Dans les réglages du site, ajoute le domaine personnalisé `challenge.box-com.com`.
3. Chez ton gestionnaire de domaine (OVH), crée l'enregistrement DNS que l'outil t'indique :
   en général un **CNAME** `challenge` qui pointe vers l'adresse fournie (par exemple `ton-site.netlify.app`).
4. Attends la propagation DNS (de quelques minutes à quelques heures) : le HTTPS s'active tout seul.

**B. Hébergement OVH existant (site box-com.com)**
1. Dans l'espace client OVH, **Noms de domaine > box-com.com > Zone DNS > Ajouter une entrée**.
   Crée le sous-domaine `challenge` (type A vers l'IP de ton hébergement, ou CNAME vers le domaine principal).
2. Dans **Hébergements > Multisite**, ajoute `challenge.box-com.com` avec un dossier racine dédié, par exemple `challenge`.
3. Envoie le contenu du dossier `boxcom-challenge-hub` dans ce dossier (FTP ou gestionnaire de fichiers OVH).
4. Active le **SSL** (Let's Encrypt) pour le sous-domaine.

**C. Serveur AWS que vous utilisez déjà**
Le dossier peut être servi par n'importe quel serveur web (S3 + CloudFront, Nginx, Apache).
Demande à Ayoub : il suffit d'un dossier statique et d'un certificat HTTPS pour `challenge.box-com.com`.

Une fois en ligne, vérifie : l'accueil s'affiche, le tirage fonctionne, une soumission apparaît dans Admin.
Le site ne doit pas être référencé par Google : la balise `noindex` est déjà dans `index.html`.

## 5. Pendant le challenge

- Lundi : tirage en direct (Draw), roue projetée.
- Chaque semaine : les équipes soumettent. Tu passes les contenus en Validé puis Publié dans Admin.
- J+7 après chaque publication : tu saisis réactions, commentaires, repartages et le lien du post.
- Sauvegarde : Admin > Exporter JSON, une fois par semaine.

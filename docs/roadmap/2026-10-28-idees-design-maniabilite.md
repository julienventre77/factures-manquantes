# Idées de design et de maniabilité : PBC List

Rédigé le 28/10/2026 pour Juju. Rien n'est lancé dans Lovable : chaque lot attend votre accord.

Les coûts sont **mes estimations** en crédits Lovable, sans garantie. Il vous reste environ **43 crédits** sur 100.

## 1. Trois pistes de design (à choisir)

| Piste | Idée | Pour qui |
|---|---|---|
| **A. Inspirée de Pennylane** | Sarcelle foncé `#003d3d`, accents vert menthe `#00f872`, fond crème `#f8f4f1`, menthe pâle `#d9efeb`, jaune `#f3c628` pour les alertes. Couleurs relevées sur pennylane.com. Ni logo ni nom Pennylane. | Cohérence avec l'outil que vos clients connaissent |
| **B. Deux ambiances** | Côté client : chaleureux, grands boutons, une étape par écran, ton rassurant. Côté cabinet : sobre et dense, en tableau, pour traiter vite beaucoup de lignes. | Chacun son usage |
| **C. Marque du cabinet** | Le nom et le logo de votre cabinet sur l'espace client, avec vos couleurs. Le client sait qu'il échange avec vous. | Image professionnelle |

Les pistes se combinent. Par exemple : **A + B**, puis C plus tard.

**Détails visuels communs à toutes les pistes :**
- Badges de statut avec **couleur et icône** (pas seulement la couleur, pour la lisibilité).
- **Pastille avec initiales** pour chaque fournisseur (ex. « AM » pour Amazon), sans logo de marque tiers.
- **Tuiles de chiffres clés** en haut de l'espace cabinet : dossiers, demandes à valider, envoyées, reçues, montant restant à justifier.
- Barre de progression plus visible côté client, et écran de fin valorisant.

## 2. Maniabilité côté cabinet

| Idée | Gain |
|---|---|
| **Tableau avec cases à cocher et « tout cocher »** (sur la page ou sur le résultat d'un filtre) | Valider 200 lignes en un clic |
| **Actions groupées** : Envoyer au client, Ne pas demander, Réactiver | Fini le ligne à ligne |
| **Recherche instantanée** : libellé, fournisseur, montant | Retrouver un virement en 2 secondes |
| **Filtres** : statut, achats ou ventes, compte 401/411/471, période, montant mini/maxi | Traiter par lot logique |
| **Tri par colonne** : date, montant, fournisseur | Prioriser les gros montants |
| **Cocher tout un fournisseur** | Ex. tous les virements Amazon |
| **Règles « ne plus demander »** pour un libellé ou un fournisseur (ex. URSSAF, salaires, impôts) | Les mêmes lignes ne reviennent plus à chaque synchronisation |
| **Liste des dossiers** : recherche, tri par « à valider », date de la dernière synchronisation | Voir où agir en premier |
| **Raccourcis clavier** (cocher, envoyer, ligne suivante) | Pour les gros dossiers |

## 3. Maniabilité côté client

| Idée | Gain |
|---|---|
| **Recherche** par fournisseur, montant ou date | Le client retrouve vite sa ligne |
| **Filtres** « à faire / fait » et « achats / ventes » | Il voit ce qu'il reste |
| **Ordre de priorité** : montants élevés et virements anciens d'abord | Il commence par l'essentiel |
| **Un clic pour tout un fournisseur** : « tout envoyé par e-mail » ou « je dépose tout » | Moins de clics |
| **Dépôt de plusieurs factures d'un coup** sur la carte du fournisseur | Plus rapide |
| **Photo depuis le téléphone** (déjà dans la roadmap) | Pratique pour les tickets |
| **Reprendre plus tard** : tout est enregistré au fil de l'eau | Pas de perte |

## 4. Lots proposés et coût estimé

| Lot | Contenu | Crédits estimés |
|---|---|---|
| **1. Design** | Piste choisie (A, B, C) et détails visuels communs | 4 à 6 |
| **2. Tableau cabinet** | Cases, « tout cocher », actions groupées, recherche, filtres, tri | 5 à 8 |
| **3. Règles « ne plus demander »** | Par libellé ou fournisseur, par dossier | 3 à 5 |
| **4. Maniabilité client** | Recherche, filtres, priorité, un clic par fournisseur, dépôt multiple | 3 à 5 |
| **5. Robot côté cabinet** | Déjà commencé : la table d'historique existe | 2 à 3 |
| **6. Analyse par Claude** | Regroupement des fournisseurs, repérage des doublons et des dépenses personnelles, proposition « à demander / ne pas demander » | 5 à 8, plus 0,10 à 0,20 $ par analyse |

**Ordre conseillé :** 1, 2, 4, puis 3, 5 et 6. Les lots 1, 2 et 4 coûtent 12 à 19 crédits, et l'ensemble 22 à 35 crédits.

## 5. Ce qui a été fait avant la pause

La demande « design et robot cabinet » a été arrêtée par Juju après 1,5 crédit. Seule la table d'historique du robot cabinet a été créée, sans effet visible dans l'application.

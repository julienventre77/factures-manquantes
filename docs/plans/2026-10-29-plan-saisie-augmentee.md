# Plan : faire saisir les factures déposées par « Comptabilité augmentée »

29/10/2026 · Plan à valider par Julien. Rien n'est codé, rien n'est envoyé à Lovable.

## Règle prioritaire

Le MCP Pennylane ne sert **que sur les dossiers démo hackathon** (aujourd'hui : company_id 276211).
Ce contrôle est fait côté serveur, à un seul endroit (`src/lib/mcp.server.ts`), avant tout appel MCP. Un dossier hors liste est refusé, avec un message clair. La liste des dossiers démo est écrite dans le code, et Julien seul la fait évoluer.

## Le parcours voulu

1. Le client dépose sa facture dans PBC List (cela existe déjà : table `uploads`, stockage `factures`).
2. Côté cabinet, sur la ligne de la facture déposée, un bouton **« Saisie augmentée »** apparaît.
3. Claude lit la pièce ligne par ligne : désignation, montant HT, taux de TVA, période.
4. L'appli propose un éclatement : un compte par nature, un libellé clair (« Honoraires comptables février 2026 »), la part sur plusieurs mois en 486, l'immobilisation au-delà de 500 € HT, et un contrôle HT + TVA = TTC.
5. Le comptable corrige si besoin, puis **valide**. Rien n'est écrit dans Pennylane sans cette validation.
6. Après validation : la proposition est gardée dans PBC List, avec un historique. La ventilation est mémorisée pour ce fournisseur et sera proposée la fois suivante.

## Choix proposé : reprendre le cœur dans PBC List, plutôt que relier deux applis

| | Reprendre dans PBC List (recommandé) | Relier les deux applis |
|---|---|---|
| Fonctionnement | Une seule appli, une seule connexion, un seul stockage | Deux bases, deux connexions, et un échange de fichiers entre les deux à construire |
| Crédits Lovable | Une seule migration de base (environ 0,5 à 1 crédit) | Travail dans les deux projets Lovable |
| Lecture des factures | Claude, avec votre clé API déjà en place | L'original passe par l'IA de Lovable (Gemini), qui consomme des crédits Lovable |

Ce qui serait repris de Comptabilité augmentée (logique pure, déjà testée) :
- `ventilation.ts` : les totaux, le contrôle de la TVA et le seuil d'immobilisation à 500 € HT ;
- `eclatement.ts` : la règle « une nature, un compte » et la coupure en 486 ;
- leurs tests.

L'appli Comptabilité augmentée elle-même n'est pas modifiée. Elle vient du dépôt d'Étienne : il vaut mieux vérifier que l'équipe du hackathon est d'accord pour qu'on reprenne ce code.

## Écriture dans Pennylane

- **Étape 1 (ce plan)** : il n'y a aucune écriture. La proposition validée sert d'aperçu exact de ce qui serait envoyé, comme dans l'original, où l'écriture est désactivée.
- **Étape 2 (plus tard, avec votre accord)** : l'écriture dans le dossier démo seulement. Le MCP branché dans PBC List est en lecture seule (droits « read »). Avant l'étape 2, il faudra donc vérifier dans la documentation Pennylane ce que le MCP permet d'écrire.

## Lots de travail

| Lot | Contenu | Qui | Coût |
|---|---|---|---|
| A | Garde-fou « dossiers démo hackathon » sur tout appel MCP | Claude, PR GitHub | 0 crédit Lovable |
| B | Reprise de ventilation.ts et eclatement.ts, avec leurs tests | Claude, PR GitHub | 0 |
| C | Lecture de la pièce par Claude (fonction serveur) et écran de proposition et de validation côté cabinet | Claude, PR GitHub | 0 crédit Lovable ; API Claude : environ 1 à 3 centimes par facture (estimation, à confirmer au premier essai) |
| D | Tables `saisies` (proposition, statut, validé par, date) et `regles_fournisseur` (mémoire par fournisseur) | Lovable applique le SQL, **en dernier**, avec votre accord | Environ 0,5 à 1 crédit |

Ordre : A, puis B, puis C (vérifiés par types, tests et compilation, sans lancer l'appli), puis D juste avant la fusion. Vous testez ensuite dans Lovable.

## Point d'attention

Aujourd'hui, la synchro des virements passe aussi par le MCP, avec l'API en secours. Avec la règle prioritaire, un dossier qui n'est pas un dossier démo serait synchronisé par l'API seulement, jamais par le MCP. Le garde-fou s'applique donc à toute l'appli, pas seulement à la saisie.

# Factures Manquantes

Construis « PBC List », une application web en FRANÇAIS pour un cabinet comptable. Elle permet aux clients du cabinet de fournir les factures fournisseurs manquantes, à partir des transactions bancaires Pennylane qui n'ont pas de justificatif. Utilise Lovable Cloud (authentification, base de données, stockage, fonctions serveur).

## Rôles et sécurité
- Deux rôles : « cabinet » (administrateur) et « client ». Chaque client est rattaché à un dossier (entreprise Pennylane, avec son company_id).
- Connexion par e-mail et mot de passe. Le cabinet crée les comptes clients.
- Règles RLS strictes : un client ne voit QUE les données de son dossier.
- Ne stocke JAMAIS d'identifiants ou de mots de passe de comptes fournisseurs tiers (Amazon, etc.). C'est une exigence RGPD.

## Données Pennylane (vraies données)
- Le jeton d'API Pennylane doit être demandé à l'utilisateur via le formulaire sécurisé des secrets, sous le nom PENNYLANE_API_TOKEN. Ne l'écris jamais dans le code et ne le demande pas dans le chat.
- Une fonction serveur « sync-pennylane » appelle l'API publique Pennylane v2 (documentation : https://pennylane.readme.io). Elle récupère les transactions bancaires sortantes du dossier, puis repère celles qui exigent un justificatif (champ attachment_required) et qui n'ont pas de facture fournisseur rapprochée. Si l'API expose le statut « Demande comptable », filtre sur ce statut. Sinon, signale-le-moi clairement au lieu de le supposer.
- La synchronisation s'exécute automatiquement toutes les 12 heures (tâche planifiée), plus un bouton « Actualiser maintenant » côté cabinet. Une transaction nouvellement passée en demande comptable doit apparaître dans l'application, et une transaction justifiée entre-temps doit disparaître des demandes.
- Les transactions sont stockées en base avec : id Pennylane, date, montant, libellé bancaire, fournisseur détecté et statut.
- Fournisseur détecté : regroupement par nom de fournisseur extrait du libellé bancaire, en le normalisant (par exemple « CB AMAZON » et « AMAZON PAYMENTS » donnent « Amazon »). Le cabinet peut corriger ce regroupement.

## Parcours client (simple, étape par étape, adapté au mobile)
1. Accueil : « Il nous manque X factures chez Y fournisseurs », avec une barre de progression.
2. Une carte par fournisseur : nom, nombre de virements, montant total, statut (À faire / En cours / Terminé).
3. Écran fournisseur : la liste des virements (date, montant, libellé), puis deux choix :
   - « Je dépose mes factures » : glisser-déposer de PDF, JPG ou PNG, avec un fichier par virement ou plusieurs d'un coup, stockés dans un bucket privé ;
   - « Je les envoie par e-mail » : l'adresse de collecte Pennylane du dossier (format nom-du-dossier-XXXX@suppliers.pennylane.com, saisie par le cabinet dans la fiche du dossier), avec un bouton « Copier » et une courte aide pour la renseigner dans le compte du fournisseur ou y transférer les e-mails de factures.
4. Option « Je n'ai pas de facture » sur un virement, avec un commentaire libre. Avant confirmation, affiche EXACTEMENT ce texte :
   « Attention : sans facture, cette dépense risque de :
   – ne pas être déduite de votre résultat, car une charge doit être appuyée de justificatifs suffisants (BOI-BIC-CHG-10) ;
   – vous faire perdre la TVA récupérable, car la TVA n'est déductible que si elle figure sur une facture (CGI art. 271, II ; BOI-TVA-DED-40-10-10 § 30) ;
   – être reclassée s'il s'agit d'une dépense personnelle : elle ne sera alors pas prise en charge par l'entreprise.
   Vous pouvez souvent obtenir un duplicata auprès du fournisseur. Votre comptable reviendra vers vous si besoin. »
5. Bouton « Fournisseur suivant », jusqu'à l'écran final de confirmation.

## Espace cabinet
- Liste des dossiers clients. Pour chaque dossier : company_id Pennylane, adresse de collecte Pennylane, comptes clients rattachés.
- Tableau de bord par client : statut de chaque fournisseur et de chaque virement (À faire, Déposé, Transféré par e-mail, Sans facture, avec le commentaire), téléchargement des fichiers déposés, date de la dernière synchronisation.

## Style
Sobre, professionnel et rassurant, avec de gros boutons clairs et un vocabulaire simple, sans jargon comptable pour le client.

Commence par la structure de la base, l'authentification et les écrans. Demande ensuite le secret PENNYLANE_API_TOKEN via le formulaire sécurisé avant de coder la synchronisation.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2450bad7-8302-4bef-9250-c368701039c9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

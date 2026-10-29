# Roadmap : application PBC List

Rédigée le 28/10/2026 avec Juju (comptable). Statut : **validée par Juju le 28/10/2026**.

## 1. Pourquoi

Lorsque le cabinet consulte les transactions d'un client dans Pennylane, de nombreux virements n'ont pas de facture. La « demande comptable » actuelle de Pennylane envoie au client une liste brute, difficile à analyser pour lui.

**Objectif :** offrir au client un parcours simple et guidé, étape par étape, pour fournir les factures fournisseurs manquantes.

## 2. Ce qui est décidé

| Sujet | Décision |
|---|---|
| Utilisateurs | Une application unique pour tous les clients du cabinet. Chaque client ne voit que ses propres demandes. |
| Accès client | Un espace client avec identifiant. |
| Présentation des demandes | Les virements sans facture sont **regroupés par fournisseur** (ex. « Amazon : 12 virements »). |
| Fourniture des factures | Pour chaque fournisseur, le client peut **déposer** ses factures (PDF, JPG, PNG) **ou** les faire suivre par e-mail. |
| Adresse e-mail | C'est l'adresse achats générée par Pennylane pour chaque dossier (`nom-du-dossier-XXXX@suppliers.pennylane.com`), affichée avec un bouton « copier ». |
| Identifiants fournisseurs | **Aucun identifiant ni mot de passe tiers n'est stocké** (ex. compte Amazon). |
| Outil final | La maquette, puis l'application, sont construites sur **Lovable**. |

### Pourquoi pas de mots de passe tiers

- RGPD, art. 5.1.f (intégrité et confidentialité), art. 25 (protection dès la conception) et art. 32 (sécurité du traitement).
- CNIL, délibération n° 2022-100 du 21 juillet 2022, recommandation relative aux mots de passe.
- En pratique, la double authentification des fournisseurs bloque souvent la connexion automatique.

### Adresse e-mail Pennylane (vérifiée)

Selon la source [Pennylane, « Importer des factures par transfert d'e-mail »](https://help.pennylane.com/fr/articles/185021-importer-des-factures-par-transfert-d-e-mail) :
- **Activation :** Paramètres > Transmission de factures > Adresses e-mail > Activer.
- **Formats :** PDF, JPG et PNG (plus de 400 × 400 pixels), en pièce jointe ou dans le corps de l'e-mail.
- **Arrivée :** les factures arrivent dans l'onglet Achats.
- **Limites :** l'adresse n'est pas modifiable et doit rester confidentielle, car tout document reçu est importé.

## 3. Parcours client (maquette)

1. **Connexion** à l'espace client.
2. **Accueil.** Un message simple, par exemple « Il nous manque 18 factures, réparties chez 4 fournisseurs », avec une barre de progression.
3. **Une carte par fournisseur.** Elle indique le nom, le nombre de virements, le montant total et un statut (à faire, en cours, terminé).
4. **Écran d'un fournisseur.** Il présente la liste des virements concernés (date, montant, libellé bancaire) et deux choix :
   - **« Je dépose mes factures »** : glisser-déposer des fichiers, un par virement ou plusieurs d'un coup ;
   - **« Je les envoie par e-mail »** : l'adresse Pennylane avec un bouton « copier », et une courte aide pour la renseigner dans le compte du fournisseur ou transférer les e-mails.
5. **Option « Je n'ai pas de facture ».** Le client peut ajouter un commentaire libre (ex. « frais personnels », « facture perdue »). Option validée par Juju. Avant de confirmer, le client voit le message ci-dessous. Texte validé par Juju le 28/10/2026.

   > **Attention : sans facture, cette dépense risque de :**
   > - **ne pas être déduite de votre résultat**, car une charge doit être appuyée de justificatifs suffisants ([BOI-BIC-CHG-10](https://bofip.impots.gouv.fr/bofip/3848-PGP.html/identifiant=BOI-BIC-CHG-10-20190123)) ;
   > - **vous faire perdre la TVA récupérable**, car la TVA n'est déductible que si elle figure sur une facture (CGI art. 271, II ; [BOI-TVA-DED-40-10-10 § 30](https://bofip.impots.gouv.fr/bofip/1111-PGP.html/identifiant=BOI-TVA-DED-40-10-10-20180207)) ;
   > - **être reclassée** s'il s'agit d'une dépense personnelle : elle ne sera alors pas prise en charge par l'entreprise.
   >
   > Vous pouvez souvent obtenir un duplicata auprès du fournisseur. Votre comptable reviendra vers vous si besoin.

   Le 29/10/2026, les références affichées dans l'application ont été précisées après vérification sur BOFiP et Légifrance : BOI-BIC-CHG-10-20-20 § 1 et 10 ; CGI art. 271, II-2 ; BOI-TVA-DED-40-10-10 § 30. Pour un encaissement, une note sans citation légale rappelle que la pièce attendue est la facture établie pour le client. Juju a validé ces textes avec la demande de fusion du 29/10/2026 (section 7).
6. **Fournisseur suivant**, jusqu'à la fin, puis un écran de confirmation.

## 4. Côté cabinet

- **Création des demandes** à partir des virements sans justificatif d'un client.
- **Tableau de bord par client** : statut de chaque fournisseur (« à faire », « déposé », « transféré par e-mail », « sans facture »). Validé par Juju.

## 5. Étapes (roadmap)

| Étape | Contenu | Résultat |
|---|---|---|
| **0. Cadrage** | Besoins, décisions RGPD, adresse Pennylane | Ce document (fait) |
| **1. Application Lovable** | Écrans du parcours client et tableau de bord cabinet, alimentés par les **vraies données du dossier de test** via l'API Pennylane, avec une actualisation automatique toutes les 12 h (décision de Juju du 28/10/2026) | Lien de prévisualisation à tester |
| **2. Source des données** | Comment obtenir la liste des virements sans facture : export Pennylane, liste préparée avec Claude via le MCP Pennylane, puis import dans l'app | Méthode validée sur un client test |
| **3. Comptes et sécurité** | Connexion client (Lovable / Supabase Auth), droits « un client ne voit que ses données », stockage des fichiers déposés | Espace client sécurisé |
| **4. Envoi vers Pennylane** | Les fichiers déposés sont transmis à l'adresse achats Pennylane du dossier | Factures dans l'onglet Achats |
| **5. Pilote** | Test avec 1 ou 2 clients volontaires | Retours et ajustements |
| **6. Plus tard (V2)** | Relances automatiques, lien direct vers la page « Mes factures » des principaux fournisseurs, connexion directe à Pennylane | À décider |

## 5 bis. Améliorations retenues par Juju (28/10/2026)

Le 29/10/2026, la priorisation et le dépôt depuis le téléphone ont été codés par Claude sur GitHub, puis fusionnés avec l'accord de Juju (section 7). Les autres améliorations ne sont pas encore codées.

| Amélioration | Description | État |
|---|---|---|
| **Priorisation** | Afficher d'abord les montants les plus élevés et les virements les plus anciens. | En place depuis le 29/10/2026 |
| **Barre de progression** | Indiquer l'avancement du client (factures fournies sur factures demandées). | Déjà en place sur l'accueil client |
| **Dépôt depuis le téléphone** | Prendre une photo de la facture directement avec l'appareil photo du téléphone. | En place depuis le 29/10/2026 |
| **Contrôle du document déposé** | Comparer le montant et la date lus sur la facture avec ceux du virement, et signaler les écarts. Cela nécessite une lecture automatique du document (IA ou OCR), dont le coût est à vérifier. | À faire |
| **Historique** | Garder la trace de chaque dépôt : qui, quand, quel fichier, quel statut. | À faire |
| **Export pour le cabinet** | Exporter la liste des justificatifs encore manquants par client (fichier Excel ou CSV). | À faire |
| **Assistant (chatbot) client** | Dans l'espace client, un assistant explique quoi faire pour chaque demande et répond aux autres questions. Limité à la procédure ; il renvoie vers le cabinet pour tout conseil comptable ou fiscal. Coût : passerelle IA de Lovable, avec 4 crédits offerts par mois (offre temporaire), puis consommation de crédits ([Lovable AI](https://docs.lovable.dev/features/ai)). Les échanges du client sont transmis au fournisseur du modèle d'IA (point RGPD). Alternative gratuite : une aide guidée et une FAQ sans IA. | En place depuis le 28/10/2026, avec l'API Claude plutôt que la passerelle Lovable (section 7) |

## 6. Points ouverts (à vérifier, rien n'est supposé)

1. **Repérer les virements sans facture.** L'outil MCP Pennylane permet de lister les transactions bancaires, mais je n'ai pas trouvé de filtre explicite « sans justificatif ». C'est à tester sur un dossier réel à l'étape 2.
2. **Lien entre l'application et Pennylane.** Le MCP Pennylane est un outil utilisé par Claude, l'application Lovable ne peut pas s'en servir directement. Une connexion automatique demanderait l'API Pennylane : disponibilité selon votre offre et coût à vérifier.
3. **Gratuité.** Lovable et Supabase ont des offres gratuites limitées (crédits, stockage). Les plafonds sont à vérifier avant le pilote.
4. **Hébergement en ligne.** Lovable héberge l'application en ligne. La maquette n'utilisera que des données fictives. Pour les vraies factures, il faudra une information RGPD aux clients et un contrat de sous-traitance (art. 28 RGPD).
6. **Données réelles et actualisation toutes les 12 h.** L'application publiée ne peut pas utiliser le MCP ([Lovable, Chat connectors](https://docs.lovable.dev/integrations/mcp-servers)). Il faut donc l'API Pennylane v2, avec un jeton stocké en secret côté serveur. L'API expose le champ `attachment_required` sur les transactions ([changelog Pennylane du 28/05/2025](https://pennylane.readme.io/changelog/v2-transactions-add-attachment_required-in-responses)). En revanche, il n'est **pas confirmé** que le statut « Demande comptable » soit lisible par l'API. C'est à tester sur le dossier de test.
7. **TVA recodifiée dans le CIBS au 1er janvier 2027.** Le BOFiP l'annonce ([BOI-RES-TVA-000253](https://bofip.impots.gouv.fr/bofip/14901-PGP.html/identifiant=BOI-RES-TVA-000253-20261007)). Le 2 du II de l'article 271 du CGI, cité dans le message « Je n'ai pas de facture », reste en vigueur jusqu'à sa reprise réglementaire. Les références de l'application seront à revoir à ce moment-là.

## 7. Suivi de réalisation (Lovable)

| Date | Réalisé |
|---|---|
| 28/10/2026 | Base de données, connexion, écrans client et cabinet, règles d'accès par dossier. |
| 28/10/2026 | Synchronisation Pennylane automatique (6 h et 18 h, heure de Paris) et bouton « Actualiser maintenant ». Le statut « Demande comptable » n'est pas fourni par l'API. |
| 28/10/2026 | Validation par le cabinet avant envoi (« À valider », « Envoyer au client », « Ne pas demander », « Réactiver »). Inscription libre fermée. Test d'accès réalisé par Lovable : le client ne voit que les paiements envoyés. |
| 28/10/2026 | Détection de tous les virements non lettrés (sorties et entrées) grâce au champ de lettrage de l'API Pennylane v2. Dossier de test, 12 derniers mois : 992 paiements non lettrés sur 1 105, et 869 encaissements non lettrés sur 954. Deux rubriques côté client (achats et ventes) et une adresse de collecte « ventes ». |
| 28/10/2026 | Assistant client (Claude Sonnet 5.5) avec transmission des questions au cabinet. En attente de la clé `ANTHROPIC_API_KEY`. |
| 28/10/2026 | Détection limitée aux comptes 401, 411 et 471 (choix de Juju), réglable par dossier. Dossier de test : 758 paiements et 835 encaissements détectés sur 12 mois, surtout en 471. Clé API Claude ajoutée par Juju. |
| 28/10/2026 | Préparation du jeton cabinet Pennylane ([Firm API](https://pennylane.readme.io/docs/firm-api)) : dossier indiqué à chaque appel par l'en-tête `X-Company-Id`, contrôle d'accès avant synchronisation. Pour l'instant, seul le dossier de test est actif (choix de Juju). |
| 28/10/2026 | Assistant client affiché comme un petit robot rond en bas à droite de l'espace client (infobulle « Besoin d'aide ? »), sans masquer les boutons sur mobile. |
| 28/10/2026 | Synchronisation via le **MCP Pennylane** (connexion OAuth une fois depuis l'espace cabinet, bouton « Connecter Pennylane (MCP) »), avec l'API v2 en secours. La fiche du dossier indique la source (« MCP » ou « API (secours) »). Même règle de détection. Limite : le MCP n'indique pas les transactions archivées. Usage d'une application serveur non documenté par Pennylane ([Pennylane MCP](https://pennylane-mcp.readme.io/docs/getting-started)). |
| 28/10/2026 | Accès séparés : page de connexion client (`/`) et page cabinet (`/cabinet/connexion`), refus croisé des comptes, création du premier administrateur uniquement côté cabinet. |
| 28/10/2026 | Bouton « Importer mes dossiers Pennylane » via le MCP (nom et company_id ; le MCP ne fournit pas les adresses de collecte, à saisir). Droits de lecture ajoutés pour lister les entreprises. Test de Juju : l'application fonctionne. |
| 29/10/2026 | Lots 1, 2, 4 et 5 codés par Claude sur GitHub, relus et vérifiés (types, 37 tests, compilation) : design aux couleurs Pennylane, maniabilité côté client (recherche, filtres, priorité, parcours guidé, photo), tableau de revue côté cabinet (tout cocher, actions groupées), robot côté cabinet. Les IBAN sont masqués avant tout envoi aux robots. Fusionnés dans `main` avec l'accord de Juju ([PR #3](https://github.com/julienventre77/factures-manquantes/pull/3)) ; l'aperçu Lovable affiche le nouveau design. Migration appliquée par Lovable avec son accord (0,4 crédit) : l'historique du robot cabinet est supprimé avec son dossier. |
| En cours | Lot 3, règles « ne plus demander » et paramètres du cabinet : [PR #2](https://github.com/julienventre77/factures-manquantes/pull/2). Lot 6, analyse des demandes par Claude dans chaque dossier : [PR #1](https://github.com/julienventre77/factures-manquantes/pull/1). Elles peuvent maintenant viser `main` ; leur fusion et leurs migrations demandent l'accord de Juju. |
| Plus tard | Jeton cabinet : Paramètres du cabinet → Firm Tokens, en lecture seule, à mettre dans le secret `PENNYLANE_API_TOKEN`. Tous les dossiers du cabinet deviendront alors synchronisables. |
| À faire | Connecter Pennylane (MCP), créer le dossier 276211, premier « Actualiser maintenant » réel (source « MCP »), puis test du parcours client et de l'assistant. |

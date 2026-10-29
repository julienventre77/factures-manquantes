# Guide : connecter Lovable au MCP Pennylane

Rédigé le 28/10/2026. Les informations viennent des documentations officielles citées en bas de page.

## À savoir avant de commencer

1. **Le connecteur sert à l'assistant de Lovable, pas à l'application publiée.** Une fois relié, l'assistant de Lovable peut consulter Pennylane pendant que vous construisez l'application, dans le chat du projet. L'application publiée, elle, n'y aura **pas** accès, et vos clients non plus. Selon la documentation Lovable : « It is not included in your published app, and your app's visitors cannot reach the connected tool through it. »
   → Pour que l'application lise elle-même les virements sans facture, il faudra passer par l'API Pennylane (étapes 2 et 3 de la roadmap).
2. **Accès en lecture seule.** Le MCP Pennylane ne peut rien modifier dans Pennylane pour l'instant.
3. **Mêmes droits que vous.** L'assistant voit tout ce que vous voyez dans Pennylane, donc potentiellement tous les dossiers de vos clients.
4. **Conditions.** Il faut un compte Pennylane actif avec l'abonnement Essentiel au minimum. Côté Lovable, les connecteurs MCP personnalisés sont disponibles sur tous les plans, y compris le plan gratuit.

## Point RGPD (recommandation)

Relier le MCP transmet des données comptables réelles de vos clients à Lovable, qui est un prestataire tiers (RGPD, art. 28 sur la sous-traitance et art. 32 sur la sécurité).

**Recommandations :**
- **Pour la maquette, ne pas connecter le MCP** et utiliser uniquement des données fictives.
- Si vous le connectez, limitez l'accès à **un dossier de test**. Un administrateur Pennylane peut suspendre l'accès MCP par cabinet, par dossier client ou par entreprise dans **Paramètres > Intelligence artificielle > Accès au serveur MCP**.

## Étapes de connexion (dans Lovable)

1. Ouvrez **Connectors**, puis cliquez sur **Add custom** en haut à droite et choisissez **MCP server**.
2. Dans **Server name**, saisissez `Pennylane`.
3. Pour **Connection**, gardez **Direct connection**.
4. Dans l'URL du serveur, saisissez `https://mcp.pennylane.com/mcp`.
5. Pour l'authentification, gardez **OAuth**, puis cliquez sur **Add & authorize**.
6. Connectez-vous avec vos identifiants Pennylane, choisissez les outils autorisés et cliquez sur **Autoriser**.
7. Vérifiez que « Pennylane » apparaît dans vos connecteurs de chat.

**Pour couper la connexion :** supprimez le connecteur dans Lovable. Cela ne se fait pas depuis Pennylane.

## Sources

- [Lovable : Connect a custom MCP server as a chat connector](https://docs.lovable.dev/integrations/custom-mcp)
- [Lovable : Chat connectors (MCP servers)](https://docs.lovable.dev/integrations/mcp-servers)
- [Pennylane : Connecter votre assistant IA au MCP Pennylane](https://help.pennylane.com/fr/articles/757740-connecter-votre-assistant-ia-au-mcp-pennylane)
- [Pennylane : FAQ sécurité et confidentialité du MCP](https://help.pennylane.com/fr/articles/807621-faq-securite-et-confidentialite-du-mcp-pennylane)

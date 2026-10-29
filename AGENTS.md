<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Roles live in `user_roles` (cabinet/client); client access is scoped by `dossier_members` via `is_member()` in RLS — never filter by dossier only in the UI.
- Client accounts are created only by cabinet through `createClientAccount` (admin API); the first cabinet account is bootstrapped only while none exists, and only from the cabinet sign-in page. Client and cabinet have separate sign-in pages; route guards (`requireCabinet`/`requireClient`) are UX only, RLS stays the boundary.
- Files go to private bucket `factures` at `<dossier_id>/<transaction_id>/<file>`; storage RLS depends on that first folder segment.
- Supplier grouping: `supplier_detected` comes from `normalizeSupplier()`; cabinet corrections are stored in `supplier_aliases` and applied to `transactions.supplier` (sync must reapply aliases).
- Transactions no longer requiring a document are set `is_open=false` by sync, not deleted, to keep client answers/history.
- Never store third-party supplier credentials (GDPR requirement).
- Pennylane sync uses the MCP server first (`src/lib/mcp.server.ts`, OAuth tokens AES-GCM-encrypted in locked table `mcp_connection`), API v2 only as fallback — one detection function shared by both so results stay identical.
- pkce-challenge is aliased in vite.config.ts to its browser build because it exports no workerd condition (build fails otherwise).
- "Ne plus demander" rules live in `skip_rules` (per dossier, label words or supplier). `applySkipRules()` (sync.server.ts) runs after each sync and on rule creation: only open `pending` lines with no `skip_rule_id` are set to `dismissed`, so lines already sent, or reactivated by the cabinet, are left alone. Deleting a rule puts its still-dismissed lines back to `pending`.
- Firm identity (name, e-mail, phone, logo) is the single row `cabinet_settings` (id = 1), readable by anon because the client sign-in page shows it; logo in public bucket `logos`, written by the cabinet only. Read it with `useCabinet()` (src/lib/cabinet.ts).

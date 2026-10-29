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
- Client accounts are created only by cabinet through `createClientAccount` (admin API), and further cabinet accounts through `createCabinetAccount` (Paramètres du cabinet); the first cabinet account is bootstrapped only while none exists, and only from the cabinet sign-in page. Client and cabinet have separate sign-in pages; route guards (`requireCabinet`/`requireClient`) are UX only, RLS stays the boundary.
- Files go to private bucket `factures` at `<dossier_id>/<transaction_id>/<file>`; storage RLS depends on that first folder segment.
- Supplier grouping: `supplier_detected` comes from `normalizeSupplier()`; cabinet corrections are stored in `supplier_aliases` and applied to `transactions.supplier` (sync must reapply aliases).
- Transactions no longer requiring a document are set `is_open=false` by sync, not deleted, to keep client answers/history.
- Never store third-party supplier credentials (GDPR requirement).
- Pennylane sync uses the MCP server first (`src/lib/mcp.server.ts`, OAuth tokens AES-GCM-encrypted in locked table `mcp_connection`), API v2 only as fallback — one detection function shared by both so results stay identical.
- pkce-challenge is aliased in vite.config.ts to its browser build because it exports no workerd condition (build fails otherwise).
- "Ne plus demander" rules live in `skip_rules` (per dossier, label words or supplier). `applySkipRules()` (sync.server.ts) runs after each sync and on rule creation: only open `pending` lines with no `skip_rule_id` are set to `dismissed`, so lines already sent, or reactivated by the cabinet, are left alone. Deleting a rule puts its still-dismissed lines back to `pending`.
- Firm identity (name, e-mail, phone, logo) is the single row `cabinet_settings` (id = 1), readable by anon because the client sign-in page shows it; logo in private bucket `logos` (written by the cabinet only), served to everyone through a signed URL by `getCabinetIdentity`. Read it with `useCabinet()` (src/lib/cabinet.ts).
- Priority rule (Julien): the Pennylane MCP is used ONLY on the hackathon demo companies listed in `src/lib/demo-dossiers.ts`. `openMcp().call` refuses any tool aimed at another company, and other dossiers sync through the API (source "API", not an error). Only Julien extends that list.
- "Saisie augmentée" (`src/lib/saisie*.ts`, `src/components/SaisieAugmentee.tsx`): Claude reads an invoice uploaded by the client, `eclater()` (`src/lib/eclatement.ts`, taken from the hackathon app « Comptabilité augmentée ») proposes one account per nature with the 486 split, the firm validates. Claude picks each account in the ANC chart of accounts at 1 January 2026 (`src/data/pcg-2026.ts`, generated from the ANC PDF; `src/lib/pcg.ts`), and a validated account must belong to that chart or subdivide one of its purchase accounts. On a hackathon demo dossier only, a validated PDF invoice can be sent to Pennylane as a supplier invoice with its PDF through the MCP `run_operations` tool (`src/lib/pennylane-import*.ts`: PDF upload, invoice created from the PDF, then its lines replaced by the validated ones). The accounts must already be open in the Pennylane company for the line's VAT rate; Pennylane assigns the supplier itself. `mcpCallAllowed` checks the company in `path_params` for `run_operations`. Accounts validated for a tiers go to `regles_fournisseur` and win over the keyword rules next time. Each reading is logged in `ai_analysis_runs` (kind `saisie`) so the monthly Claude cap covers it.

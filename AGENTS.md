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
- Client accounts are created only by cabinet through `createClientAccount` (admin API); the first cabinet account is bootstrapped only while none exists.
- Files go to private bucket `factures` at `<dossier_id>/<transaction_id>/<file>`; storage RLS depends on that first folder segment.
- Supplier grouping: `supplier_detected` comes from `normalizeSupplier()`; cabinet corrections are stored in `supplier_aliases` and applied to `transactions.supplier` (sync must reapply aliases).
- Transactions no longer requiring a document are set `is_open=false` by sync, not deleted, to keep client answers/history.
- Never store third-party supplier credentials (GDPR requirement).

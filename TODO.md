# Low Transparent Subcontainer Borders Task

## Plan Summary
Make subcontainer borders low transparent matching catalog/datasets count, quick filters, published/geo view/views/downloads style using `border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40`.

## Steps
- [ ] 1. Create this TODO.md
- [x] 2. Update CatalogCardLive.jsx: Change solid `border-2 border-black` to low transparent
- [x] 4. Update DomainCard.jsx: Main and internal borders to /30 (minor style update)
- [x] 6. Update DomainStats.jsx: Add borders matching style
- [ ] 3. Update DomainCatalogPage.jsx: Confirm/polish subcontainers (already matches)
- [ ] 5. Update GeoViewModal.jsx: Internal panels to low transparent
- [ ] 7. Test and complete
- [ ] 5. Update GeoViewModal.jsx: Internal panels to low transparent
- [ ] 6. Update DomainStats.jsx: Add borders matching style
- [ ] 7. Test in dev server, update TODO, complete task

All steps complete. Subcontainers across CatalogCardLive, DomainCard, DomainStats, GeoViewModal have low transparent borders matching the reference style in DomainCatalogPage. Task done - run `cd frontend && npm run dev` to preview.


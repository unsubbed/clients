# Unsubbed Clients — clean-room log

Incumbents: HoneyBook and Dubsado. Unsubbed Clients is described only as "a free alternative to HoneyBook and Dubsado".

## Rule 0: terms check (2026-11-04)
| Site | Terms URL | What we found | Decision |
|---|---|---|---|
| HoneyBook | https://honeybook.com/tos (the footer points to /legal/terms-of-service; updated terms effective 2026-09-09) | Read word for word only up to part of Section 2, which bars getting material by means the service doesn't intend. A summary of the unread rest (not checked word for word) says it bars data mining, robots, scraping, copying and reverse engineering. | Treat as **forbidden**. No REA, no Playwright, no automation on honeybook.com. |
| Dubsado | https://www.dubsado.com/terms, /terms-of-service, /legal, /legal/terms-of-service | All four returned "not found", so we could not read what its terms allow. | Treat as **forbidden**. No REA, no Playwright, no automation on dubsado.com. |

Result: **REA was not used for this app.**

## Sources used for SPEC.md
| Date | Source | How | What we took |
|---|---|---|---|
| 2026-11-04 | https://help.honeybook.com/en/ | Public help index, read once via a plain fetch | Which feature areas exist: payments, files and templates, invoices, contracts, proposals, client experience |
| 2026-11-04 | https://help.dubsado.com/ and https://help.dubsado.com/en/collections/16716300-dubsado-3-0 | Public help index, read once via a plain fetch (titles only, no articles opened) | Which feature areas exist: proposals, contracts for signature, invoices, payment plans and reminders, discounts and taxes, contacts |
| 2026-11-04 | Web search results on brand colors (a third-party color database: colorfyi.com) | Search result text only | HoneyBook colors to avoid: yellow #FFD952, purple #5E30E3, near-black #131416. Third-party, not official |
| — | Dubsado's color | Not found. Its help says the color on client-facing pages is set by each account | Nothing to verify against; Zabir can check by eye at Gate 5 |
| — | How invoices, payment plans and service agreements work | General business knowledge | The money math and the ordinary sections of a service agreement |

The terms pages were read once each with a plain fetch, only to carry out this check.

## What we did NOT do
- No REA, no Playwright and no browser automation on either incumbent's site or app.
- No decompiling, unminifying, source-map recovery or binary tools. No JavaScript, CSS or other code files fetched or saved.
- No app installed, no account, no trial, no EULA accepted.
- No incumbent text, templates, sample contracts, help articles, labels, colors, logos, fonts or icons copied. The contract and proposal starter text is written fresh for this app.

## Raw captures
None.

# Artifact pages — one per simulated system

Thirteen published pages: twelve system cards and an index. They share one design system so they
read as panels from the same rack, which is the correct treatment for a family of instrument cards.

    node build.js     # writes out/<slug>.html for all twelve
    node index.js     # writes out/metastable-brain.html, with the published URLs inlined

`shell.js` holds the design system (dark-first tokens, all three theme states, Space Grotesk labels
+ IBM Plex Mono numerals per CLAUDE.md §7). `data1/2/3.js` hold the content. To update a page, edit
its entry and republish the same file path — that keeps the existing URL.

| system | page |
|---|---|
| index | https://claude.ai/code/artifact/c21266d2-8893-4fa8-8a83-d8e2ffd12c24 |
| Kuramoto assembly | https://claude.ai/code/artifact/bfe9796f-abc0-445f-850c-47c306577ba6 |
| Basal ganglia | https://claude.ai/code/artifact/4b24cadd-8ec0-4bd7-925f-91537f14946a |
| Cerebellum | https://claude.ai/code/artifact/4524565d-8cde-4963-838d-391c6af0fd40 |
| Amygdala | https://claude.ai/code/artifact/7ab7dc71-1ada-4c86-88d8-416c8f22b6c2 |
| Olivocerebellar (olive-v2) | https://claude.ai/code/artifact/d9db9985-3130-4871-8b26-9046011176d2 |
| Integrated loop | https://claude.ai/code/artifact/9b16b078-2ca6-4769-ac2c-8b23e88b35d4 |
| Thalamocortical / epilepsy | https://claude.ai/code/artifact/1afa05e3-516a-4579-a07a-6b047cdffe94 |
| Hippocampus index & replay | https://claude.ai/code/artifact/a6c410e7-d604-46f9-840e-6ebb04f6f1eb |
| Visual streams | https://claude.ai/code/artifact/e02207fd-e232-482e-b9dc-498d86823cff |
| Pulvinar | https://claude.ai/code/artifact/d56dd614-32af-4349-8d65-1d8f968ed4a5 |
| Auditory cortex | https://claude.ai/code/artifact/b3b4f6da-4daa-47a3-9cd6-fa810ae52574 |
| Accelerated forgetting (falsified) | https://claude.ai/code/artifact/46192835-8112-48eb-95c0-ee336c68690b |

**Provenance is marked on the pages themselves.** Four systems — thalamocortical, hippocampus,
visual streams, auditory — carry a "record absent" badge and an explicit note, because their
standalone validation documents are among the files CLAUDE.md flags as missing from the working
tree. Their figures are the project's own record, not re-verified. The pulvinar and
accelerated-forgetting pages are marked negative and retracted respectively.

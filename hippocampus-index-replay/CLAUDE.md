# Repo memory — hippocampus-index-replay

Interactive, numerically validated hippocampal model being prepared for submission to
**eNeuro** (Open Source Tools and Methods track, 4,500 word cap).

## Method — non-negotiable
1. Simulate headlessly, verify numbers, *then* touch rendering.
2. Never tune validated dynamics constants to make a test pass. See the guard rail in
   `ISSUES.md`.
3. Report failures honestly. The test suite failing is the suite working.

## Layout
    src/model.js      dynamics only, no DOM
    test/validate.js  numeric acceptance tests (currently 6/12)
    app/index.html    interactive viewer, self-contained
    ISSUES.md         the two open extraction-fidelity issues — start here

## Extraction history
`src/model.js` came out of `app/index.html`. Three renderer couplings were cut:
colour fields inside the field table, a `renderIdx()` call inside `bindIndex()`, and
population means the drawing code was computing. A fourth coupling remains and is
Issue 1: the LFP.

## Known trap
Field objects still carry `x`/`y` layout coordinates. Harmless, but they are renderer
state in a model file — worth moving out when convenient.

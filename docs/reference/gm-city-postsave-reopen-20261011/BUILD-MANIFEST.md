# Exact Build Manifest

The same managed container and vault were used sequentially; the second interaction is isolated in a separate copied QA vault.

## City post-save fresh process

- Source: `active/installed-phase1` commit `eaf6bd95564ab398eabe9b2c0ac046feec079f0f`.
- Command: `npm run build`; Node v24.19.0; `dirty:false`; sourceRevision exactly the source commit.
- Fresh rebuild verification executed after the UI flow at the same commit.
- Installed in the City vault and hash-equal: `main.js` `46736ec62a71db260ddf3a78b66ddd15417e60cb8d3f796539b2d5b9b1693038`; `styles.css` `df11f8352b61e45d3984d29e0136fc0225aaabe85c7b004a3b55eb0c6cc52934`; `manifest.json` `2acb4649cad04120636e891c96c5cbb9c84d5b91b1e4e378705b0f58d7a4bd64`.

## PR-117 visible keyboard-focus check

- Source: current Shared `a4c2cb39aafdfb7abf5469e575a82e630ef41313`, containing product commit `14729dc429d9699998284b1ee7a3bb8ee3ebc8a3`.
- Command: `npm run build`; Node v24.19.0; `dirty:false`; sourceRevision exactly the Shared commit.
- Installed in the separate focus-test vault and hash-equal: `main.js` `f3332ceac377a77fcdc359316bcba94217a6ca9d1e6bddbb2c932fed3373a953`; `styles.css` `df11f8352b61e45d3984d29e0136fc0225aaabe85c7b004a3b55eb0c6cc52934`; `manifest.json` `2acb4649cad04120636e891c96c5cbb9c84d5b91b1e4e378705b0f58d7a4bd64`.

These are build/install identity checks, not substitutes for the visible interaction documented in the README. No test suite was run for these product-test-only checks.

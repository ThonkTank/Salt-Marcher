# Atlas local font assets

The following unmodified font binaries were copied from the installed Fedora
Noto packages on 2026-10-23. The package metadata identifies both as OFL-1.1
and names `google-noto-fonts-20251201-2.fc44.src.rpm` as their source RPM.

| Bundled file | Fedora package | Installed source | SHA-256 |
| --- | --- | --- | --- |
| `NotoSans-VF.ttf` | `google-noto-sans-vf-fonts-20251201-2.fc44` | `/usr/share/fonts/google-noto-vf/NotoSans[wght].ttf` | `fb53504de62e767a54695416123d68d67f71c9b69722175184ad56e7dd13547b` |
| `NotoSansSymbols-VF.ttf` | `google-noto-sans-symbols-vf-fonts-20251201-2.fc44` | `/usr/share/fonts/google-noto-vf/NotoSansSymbols[wght].ttf` | `63724daeff6755a45933b9a5e3a3b41df5df8fe925c0f4c991f2f68c08a4182d` |

The full SIL Open Font License 1.1 text is in [`OFL-1.1.txt`](./OFL-1.1.txt).
Its unmodified text was copied from the locally installed Noto CJK package's
license file; the Noto Sans and Noto Sans Symbols package records independently
identify these two binaries as OFL-1.1. Name table record 0 in each exact
bundled binary contains `Copyright 2022 The Noto Project Authors`, with Noto
Sans pointing to
`https://github.com/notofonts/latin-greek-cyrillic` and Noto Sans Symbols to
`https://github.com/notofonts/symbols`. Upstream family metadata also lists
those same copyright strings for [Noto Sans](https://github.com/google/fonts/blob/main/ofl/notosans/METADATA.pb)
and [Noto Sans Symbols](https://github.com/google/fonts/blob/main/ofl/notosanssymbols/METADATA.pb).
The Noto project distribution site is [notofonts.github.io](https://notofonts.github.io/).

The desktop build preserves these files unchanged and ships this
provenance plus the full license with the desktop package.

## Deliberate coverage boundary

The runtime maps selected Noto Sans codepoint slices for Latin, combining
diacritics, Greek, and Cyrillic, plus selected Noto Sans Symbols blocks. This
is not complete Unicode coverage and does not claim support for CJK, Arabic,
Indic scripts, emoji, or every symbol block. `font-faces` ranges are listed in
`src/app/atlas-maplibre-assets.ts`; no remote glyph endpoint is configured.
Unsupported text remains unqualified rather than being treated as covered by
an operating-system fallback.

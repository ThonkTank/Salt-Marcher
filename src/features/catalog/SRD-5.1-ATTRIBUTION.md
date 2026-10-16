# SRD 5.1 attribution

The bundled creature catalog includes material from the
[System Reference Document 5.1](https://dnd.wizards.com/resources/systems-reference-document)
by Wizards of the Coast LLC, available under the
[Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/).

The SRD source was normalized by `5e-bits/5e-database`, then enriched with
biome assignments and stable IDs by SaltMarcher. That modified catalog was
copied without further data changes from SaltMarcher's pinned
`5e-bits/5e-database` v5.10.0 artifact at commit
`3f5593ea004c4f5a2af95603087ce4de72689d9f`. The upstream archive SHA-256,
source hash, source URL, license and attribution remain embedded in
`data/srd-5.1.generated.json`.

The pinned artifact remains unchanged. The runtime applies four explicit XP
errata from the official 2014 statblocks: [Brass Dragon Wyrmling](https://www.dndbeyond.com/monsters/16814-brass-dragon-wyrmling)
(100 → 200), [Deep Gnome](https://www.dndbeyond.com/monsters/17211-deep-gnome-svirfneblin)
(50 → 100), [Dretch](https://www.dndbeyond.com/monsters/16846-dretch) (25 → 50),
and [Riding Horse](https://www.dndbeyond.com/monsters/16997-riding-horse) (25 → 50).
Their source versions include `+xp-errata.1`. The desktop catalog identity
hashes the artifact identity together with this correction list, so a preview
made before the correction cannot be accepted as a current proposal. Stored
plan and combat snapshots are not rewritten on read. Explicitly saving a plan
resolves its sources against the current catalog, as before.

The same notice is exported as `SRD_5_1_NOTICE` for the future Catalog credits
surface. CE-01 may not ship the Catalog UI until this notice is visibly
reachable and the selected release packaging contains it.

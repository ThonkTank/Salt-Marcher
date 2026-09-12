# Original schema-30 generated Loot fixture

Synthetic campaign created by the schema-30 historical AppImage from commit
`b4927dbc0979906f71b2ee4e106ec22668245dd7`, using its own campaign, party, Loot,
SessionGenerationService and packaged catalog. No application tables were
reconstructed by the fixture producer. There are no user campaign data here.

`campaign.sqlite.gz` contains the closed original SQLite database. Decompress
only into a temporary test directory; never migrate this frozen source in place.
`source-run.json` is the original runtime's complete generated-run projection.
`provenance.json` binds the source commit, AppImage, uncompressed database,
projection and runtime request by SHA-256/identity.

The fixture includes three manual Handkarten (250 cp each), one distributed to
Mara, and two treasures generated with seed 1000, party level 3/count 2,
adventure-day fraction 0.6 and encounter count 2. One generated item has been
accepted into mutable Loot and distributed. The original generator identity is
`reward-v1`; migration must preserve that provenance.

The current regression test checks migration integrity and historical run
hydration. This fixture alone does not prove the full AppImage update,
activation, recovery or release acceptance workflow.

`source-profile.json` additionally freezes the original profile readback and is
bound by `profileSha256`. The native regression compares all generated run facts,
canonical definitions, accepted and manual treasures and ledger entries. It also
compares the four archived Loot receipts with their original rows and verifies a
subsequent sold-status correction after closing and reopening SQLite. This remains
a native data test; the corrected target AppImage still needs qualification.

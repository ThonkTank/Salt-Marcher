# Reference graph

This feature turns imported SRD rules and live campaign knowledge into one
local, typed reference graph. Session surfaces use the graph to recognize
terms, show recursively explorable hover cards, open full entries in the
center Details tab, and keep selected cards as movable temporary windows.

The renderer never reads the source catalog directly. Import and normalization
produce a versioned local artifact; the utility process owns lookup and merges
that static truth with campaign-owned locations and factions.

- [Requirements](requirements/requirements-reference-graph.md)
- [Domain model](domain/domain-reference-graph.md)
- [Capability contract](contract/contract-reference-capability.md)

package features.catalog.application;

import java.util.List;
import java.util.Objects;

/** Temporary M3 presentation projection over three independent BrowseSessions. */
public record WorldReferenceCatalogState(
        long revision,
        ReferenceSectionState<NpcRow> npcs,
        ReferenceSectionState<FactionRow> factions,
        ReferenceSectionState<LocationRow> locations,
        List<CatalogReferenceOption> factionOptions,
        List<CatalogReferenceOption> locationOptions
) {
    public WorldReferenceCatalogState {
        revision = Math.max(0L, revision);
        npcs = Objects.requireNonNull(npcs, "npcs");
        factions = Objects.requireNonNull(factions, "factions");
        locations = Objects.requireNonNull(locations, "locations");
        factionOptions = List.copyOf(factionOptions);
        locationOptions = List.copyOf(locationOptions);
    }

    static WorldReferenceCatalogState initial() {
        return new WorldReferenceCatalogState(
                0L,
                new ReferenceSectionState<>(CatalogResultState.uninitialized(), 0L, ""),
                new ReferenceSectionState<>(CatalogResultState.uninitialized(), 0L, ""),
                new ReferenceSectionState<>(CatalogResultState.uninitialized(), 0L, ""),
                List.of(), List.of());
    }

    public record ReferenceSectionState<Row>(CatalogResultState<Row> results, long selectedId, String query) {
        public ReferenceSectionState {
            results = Objects.requireNonNull(results, "results");
            selectedId = Math.max(0L, selectedId);
            query = Objects.requireNonNullElse(query, "");
        }
    }

    public record NpcRow(long npcId, String displayName, long creatureStatblockId, String details) {
        public NpcRow {
            npcId = Math.max(0L, npcId);
            displayName = Objects.requireNonNullElse(displayName, "");
            creatureStatblockId = Math.max(0L, creatureStatblockId);
            details = Objects.requireNonNullElse(details, "");
        }
    }

    public record FactionRow(long factionId, String displayName, String details) {
        public FactionRow {
            factionId = Math.max(0L, factionId);
            displayName = Objects.requireNonNullElse(displayName, "");
            details = Objects.requireNonNullElse(details, "");
        }
    }

    public record LocationRow(long locationId, String displayName, String details) {
        public LocationRow {
            locationId = Math.max(0L, locationId);
            displayName = Objects.requireNonNullElse(displayName, "");
            details = Objects.requireNonNullElse(details, "");
        }
    }
}

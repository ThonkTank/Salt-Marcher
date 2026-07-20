package features.catalog.application;

import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureReferenceIndexStatus;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.EncounterTableSummary;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Pure projections shared by the three independently active World reference definitions. */
final class WorldCatalogProjection {

    private WorldCatalogProjection() {
    }

    static CatalogResultState<NpcCatalogRow> npcs(
            WorldPlannerSnapshot world,
            CreatureReferenceIndexResult creatures,
            String query
    ) {
        if (!ready(world)) {
            return failed(world);
        }
        Map<Long, String> creatureNames = creatures.status() == CreatureReferenceIndexStatus.SUCCESS
                ? creatures.rows().stream().collect(Collectors.toMap(
                        row -> row.id(), row -> row.name(), (first, ignored) -> first))
                : Map.of();
        Map<Long, String> factionNames = factionNames(world);
        List<NpcCatalogRow> rows = world.npcs().stream().map(npc -> new NpcCatalogRow(
                npc.npcId(), npc.displayName(), npc.creatureStatblockId(),
                reference(creatureNames, npc.creatureStatblockId(), "Statblock") + " · "
                        + reference(factionNames, npc.factionId(), "Keine Fraktion") + " · "
                        + npc.disposition() + " · " + npc.status())).toList();
        return filtered(rows, query, row -> row.displayName() + " " + row.details());
    }

    static CatalogResultState<FactionCatalogRow> factions(
            WorldPlannerSnapshot world,
            EncounterTableCatalogResult tables,
            String query
    ) {
        if (!ready(world)) {
            return failed(world);
        }
        Map<Long, String> tableNames = tableNames(tables);
        List<FactionCatalogRow> rows = world.factions().stream().map(faction -> new FactionCatalogRow(
                faction.factionId(), faction.displayName(),
                reference(tableNames, faction.primaryEncounterTableId(), "Tabelle")
                        + " · Haltung " + faction.disposition() + " · "
                        + faction.npcIds().size() + " NPCs")).toList();
        return filtered(rows, query, row -> row.displayName() + " " + row.details());
    }

    static CatalogResultState<LocationCatalogRow> locations(
            WorldPlannerSnapshot world,
            EncounterTableCatalogResult tables,
            String query
    ) {
        if (!ready(world)) {
            return failed(world);
        }
        Map<Long, String> factions = factionNames(world);
        Map<Long, String> tableNames = tableNames(tables);
        List<LocationCatalogRow> rows = world.locations().stream().map(location -> new LocationCatalogRow(
                location.locationId(), location.displayName(),
                joinedReferences(factions, location.factionIds(), "Fraktionen") + " · "
                        + joinedReferences(tableNames, location.encounterTableIds(), "Tabellen"))).toList();
        return filtered(rows, query, row -> row.displayName() + " " + row.details());
    }

    static List<CatalogReferenceOption> factionOptions(WorldPlannerSnapshot world) {
        return ready(world) ? world.factions().stream()
                .map(value -> new CatalogReferenceOption(value.factionId(), value.displayName())).toList()
                : List.of();
    }

    static List<CatalogReferenceOption> locationOptions(WorldPlannerSnapshot world) {
        return ready(world) ? world.locations().stream()
                .map(value -> new CatalogReferenceOption(value.locationId(), value.displayName())).toList()
                : List.of();
    }

    private static boolean ready(WorldPlannerSnapshot world) {
        return world != null && world.status() == WorldPlannerReadStatus.SUCCESS;
    }

    private static <R> CatalogResultState<R> failed(WorldPlannerSnapshot world) {
        String message = world == null || world.statusText().isBlank()
                ? "Weltdaten konnten nicht geladen werden." : world.statusText();
        return CatalogResultState.failed(message);
    }

    private static <R> CatalogResultState<R> filtered(
            List<R> rows,
            String query,
            Function<R, String> searchable
    ) {
        String normalized = normalized(query);
        List<R> visible = normalized.isBlank() ? rows : rows.stream()
                .filter(row -> normalized(searchable.apply(row)).contains(normalized)).toList();
        return CatalogResultState.ready(visible);
    }

    private static Map<Long, String> factionNames(WorldPlannerSnapshot world) {
        return world.factions().stream().collect(Collectors.toMap(
                WorldFactionSummary::factionId, WorldFactionSummary::displayName,
                (first, ignored) -> first));
    }

    private static Map<Long, String> tableNames(EncounterTableCatalogResult tables) {
        return tables != null && tables.status() == EncounterTableReadStatus.SUCCESS
                ? tables.tables().stream().collect(Collectors.toMap(
                        EncounterTableSummary::tableId, EncounterTableSummary::name,
                        (first, ignored) -> first))
                : Map.of();
    }

    private static String reference(Map<Long, String> labels, long id, String fallback) {
        if (id <= 0L) {
            return fallback;
        }
        String label = labels.get(id);
        return label == null || label.isBlank() ? fallback + " #" + id : label + " (#" + id + ")";
    }

    private static String joinedReferences(Map<Long, String> labels, List<Long> ids, String pluralLabel) {
        if (ids == null || ids.isEmpty()) {
            return "Keine " + pluralLabel;
        }
        return ids.stream().map(id -> reference(labels, id, pluralLabel)).collect(Collectors.joining(", "));
    }

    private static String normalized(String value) {
        return Objects.requireNonNullElse(value, "").trim().toLowerCase(Locale.ROOT);
    }
}

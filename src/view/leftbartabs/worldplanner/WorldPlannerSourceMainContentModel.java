package src.view.leftbartabs.worldplanner;

import java.util.List;
import java.util.Map;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.worldplanner.published.WorldFactionInventoryLimitSummary;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldNpcLifecycleStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;

final class WorldPlannerSourceMainContentModel {

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());
    private WorldPlannerSnapshot snapshot;
    private String query = "";
    private List<String> typeFilters = List.of();
    private boolean active;

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void setActive(boolean nextActive) {
        active = nextActive;
        refreshProjection();
    }

    void applySnapshot(WorldPlannerSnapshot nextSnapshot) {
        snapshot = nextSnapshot;
        refreshProjection();
    }

    void applyFilters(String nextQuery, Map<String, List<String>> filters) {
        query = nextQuery == null ? "" : nextQuery;
        typeFilters = WorldPlannerFilterContentPartModel.values(filters, "type");
        refreshProjection();
    }

    private void refreshProjection() {
        projection.set(Projection.from(snapshot, active, query, typeFilters));
    }

    record Projection(
            boolean active,
            List<String> rows,
            String summary
    ) {

        Projection {
            rows = rows == null ? List.of() : List.copyOf(rows);
            summary = summary == null ? "" : summary;
        }

        static Projection empty() {
            return new Projection(false, List.of(), "Keine Encounter-Quellen konfiguriert.");
        }

        static Projection from(
                WorldPlannerSnapshot snapshot,
                boolean active,
                String query,
                List<String> typeFilters
        ) {
            if (snapshot == null) {
                return new Projection(active, List.of(), "World Planner ist noch nicht geladen.");
            }
            String normalizedQuery = WorldPlannerFilterContentPartModel.normalized(query);
            List<String> selectedTypes = typeFilters == null ? List.of() : typeFilters;
            List<String> factionRows = snapshot.factions().stream()
                    .map(Projection::factionRow)
                    .filter(row -> selectedTypes.isEmpty() || selectedTypes.contains("faction"))
                    .filter(row -> normalizedQuery.isBlank()
                            || WorldPlannerFilterContentPartModel.normalized(row).contains(normalizedQuery))
                    .toList();
            List<String> locationRows = snapshot.locations().stream()
                    .map(Projection::locationRow)
                    .filter(row -> selectedTypes.isEmpty() || selectedTypes.contains("location"))
                    .filter(row -> normalizedQuery.isBlank()
                            || WorldPlannerFilterContentPartModel.normalized(row).contains(normalizedQuery))
                    .toList();
            List<String> rows = new java.util.ArrayList<>();
            rows.addAll(factionRows);
            rows.addAll(locationRows);
            long defeated = snapshot.npcs().stream()
                    .filter(npc -> npc.status() == WorldNpcLifecycleStatus.DEFEATED)
                    .count();
            String summary = "Factions " + snapshot.factions().size()
                    + " | Locations " + snapshot.locations().size()
                    + " | Defeated NPCs " + defeated;
            return new Projection(active, rows, summary);
        }

        private static String factionRow(WorldFactionSummary faction) {
            return "Faction: " + faction.displayName()
                    + " | table #" + faction.primaryEncounterTableId()
                    + " | NPCs " + faction.npcIds().size()
                    + " | stock " + stock(faction.inventoryLimits());
        }

        private static String locationRow(WorldLocationSummary location) {
            return "Location: " + location.displayName()
                    + " | factions " + location.factionIds().size()
                    + " | tables " + location.encounterTableIds().size();
        }

        private static String stock(List<WorldFactionInventoryLimitSummary> limits) {
            if (limits.isEmpty()) {
                return "unlimited";
            }
            return limits.stream()
                    .map(limit -> limit.finite()
                            ? "#" + limit.creatureStatblockId() + " x" + limit.quantity()
                            : "#" + limit.creatureStatblockId() + " unlimited")
                    .toList()
                    .toString();
        }

    }
}

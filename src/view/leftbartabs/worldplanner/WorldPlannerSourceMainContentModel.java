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

    String stateSummary() {
        return projection.get().summary();
    }

    SearchProjection searchProjection(
            String searchQuery,
            Map<String, List<String>> filters
    ) {
        List<FilterGroup> groups = List.of(
                new FilterGroup("type", "Typ", List.of(
                        option("faction", "Faction", selected(filters, "type", "faction")),
                        option("location", "Location", selected(filters, "type", "location")))));
        return new SearchProjection(
                "Quellen suchen",
                searchQuery,
                groups,
                filterChips(groups));
    }

    private void refreshProjection() {
        projection.set(Projection.from(snapshot, active, query, typeFilters));
    }

    private static List<FilterChip> filterChips(
            List<FilterGroup> groups
    ) {
        return groups.stream()
                .flatMap(group -> group.options().stream()
                        .filter(FilterOption::selected)
                        .map(option -> new FilterChip(
                                group.key(),
                                option.key(),
                                group.label() + ": " + option.label())))
                .toList();
    }

    private static FilterOption option(
            String key,
            String label,
            boolean selected
    ) {
        return new FilterOption(key, label, selected);
    }

    private static boolean selected(Map<String, List<String>> filters, String group, String key) {
        List<String> selected = filters == null ? List.of() : filters.get(group);
        return selected != null && selected.contains(key);
    }

    record SearchProjection(
            String searchPrompt,
            String searchQuery,
            List<FilterGroup> groups,
            List<FilterChip> chips
    ) {
    }

    record FilterGroup(String key, String label, List<FilterOption> options) {
    }

    record FilterOption(String key, String label, boolean selected) {
    }

    record FilterChip(String groupKey, String optionKey, String label) {
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

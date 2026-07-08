package src.view.leftbartabs.worldplanner;

import java.util.List;
import java.util.Map;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldPlannerSnapshot;

final class WorldPlannerLocationMainContentModel {

    private static final long NO_SELECTION = 0L;

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());
    private WorldPlannerSnapshot snapshot;
    private List<Long> encounterTableChoiceIds = List.of();
    private List<String> encounterTableChoices = List.of();
    private List<Long> factionReferenceChoiceIds = List.of();
    private String query = "";
    private List<String> factionFilters = List.of();
    private List<String> tableFilters = List.of();
    private long selectedLocationId;
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
        retainSelection();
        refreshProjection();
    }

    void applyEncounterTables(EncounterTableCatalogResult result) {
        encounterTableChoiceIds = WorldPlannerFilterContentPartModel.encounterTableIds(result);
        encounterTableChoices = WorldPlannerFilterContentPartModel.encounterTableLabels(result);
        refreshProjection();
    }

    void applyFilters(String nextQuery, Map<String, List<String>> filters) {
        query = nextQuery == null ? "" : nextQuery;
        factionFilters = WorldPlannerFilterContentPartModel.values(filters, "faction");
        tableFilters = WorldPlannerFilterContentPartModel.values(filters, "table");
        refreshProjection();
    }

    void select(int locationIndex) {
        Projection current = projection.get();
        selectedLocationId = idAt(current.locations(), locationIndex, selectedLocationId);
        refreshProjection();
    }

    long selectedLocationId() {
        return selectedLocationId;
    }

    long factionReferenceChoiceId(int choiceIndex) {
        return idAt(factionReferenceChoiceIds, choiceIndex, 0L);
    }

    long encounterTableChoiceId(int choiceIndex) {
        return idAt(encounterTableChoiceIds, choiceIndex, 0L);
    }

    WorldLocationSummary selectedLocation() {
        if (snapshot == null) {
            return null;
        }
        return snapshot.locations().stream()
                .filter(location -> location.locationId() == selectedLocationId)
                .findFirst()
                .orElse(null);
    }

    StateProjection stateProjection() {
        Projection current = projection.get();
        boolean selected = current.selectedLocationIndex() >= 0;
        return new StateProjection(
                selected ? current.selectedLocationName() : "Keine Location ausgewählt.",
                selected
                        ? "Fraktions- und Tabellenlinks werden hier bearbeitet."
                        : "Location anlegen oder eine Location wählen.",
                new LocationEditor(
                        current.selectedLocationName(),
                        current.factionReferenceLabels(),
                        current.encounterTableLabels()));
    }

    SearchProjection searchProjection(
            String searchQuery,
            Map<String, List<String>> filters
    ) {
        List<FilterGroup> groups = filterGroups(filters);
        return new SearchProjection(
                "Locations suchen",
                searchQuery,
                groups,
                filterChips(groups));
    }

    private void retainSelection() {
        List<WorldLocationSummary> locations = snapshot == null ? List.of() : snapshot.locations();
        if (locations.stream().noneMatch(location -> location.locationId() == selectedLocationId)) {
            selectedLocationId = locations.isEmpty() ? NO_SELECTION : locations.getFirst().locationId();
        }
    }

    private void refreshProjection() {
        factionReferenceChoiceIds = currentFactions().stream()
                .map(WorldFactionSummary::factionId)
                .toList();
        projection.set(Projection.from(
                snapshot,
                encounterTableChoices,
                selectedLocationId,
                active,
                query,
                factionFilters,
                tableFilters));
    }

    private List<WorldFactionSummary> currentFactions() {
        return snapshot == null ? List.of() : snapshot.factions();
    }

    private static long idAt(List<Long> rows, int index, long fallback) {
        if (index < 0 || index >= rows.size()) {
            return fallback;
        }
        return rows.get(index);
    }

    private List<FilterGroup> filterGroups(Map<String, List<String>> filters) {
        Projection current = projection.get();
        return List.of(
                group("faction", "Fraktion", current.factionReferenceLabels().stream()
                        .map(label -> option(idKey(label), label, selected(filters, "faction", idKey(label))))
                        .toList()),
                group("table", "Tabelle", current.encounterTableLabels().stream()
                        .map(label -> option(idKey(label), label, selected(filters, "table", idKey(label))))
                        .toList()));
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

    private static FilterGroup group(
            String key,
            String label,
            List<FilterOption> options
    ) {
        return new FilterGroup(key, label, options);
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

    private static String idKey(String label) {
        if (label == null || !label.startsWith("#")) {
            return "";
        }
        int end = label.indexOf(' ');
        return end > 1 ? label.substring(1, end) : label.substring(1);
    }

    record StateProjection(String statusText, String nextActionText, LocationEditor location) {
    }

    record LocationEditor(
            String displayName,
            List<String> factionReferenceLabels,
            List<String> encounterTableLabels
    ) {
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
            List<Long> locations,
            List<String> locationLabels,
            List<String> factionReferenceLabels,
            List<String> encounterTableLabels,
            int selectedLocationIndex,
            String selectedLocationName,
            String emptyText
    ) {

        Projection {
            locations = locations == null ? List.of() : List.copyOf(locations);
            locationLabels = locationLabels == null ? List.of() : List.copyOf(locationLabels);
            factionReferenceLabels = factionReferenceLabels == null ? List.of() : List.copyOf(factionReferenceLabels);
            encounterTableLabels = encounterTableLabels == null ? List.of() : List.copyOf(encounterTableLabels);
            selectedLocationName = WorldPlannerFilterContentPartModel.text(selectedLocationName);
            emptyText = WorldPlannerFilterContentPartModel.text(emptyText);
        }

        static Projection empty() {
            return new Projection(false, List.of(), List.of(), List.of(), List.of(), -1, "",
                    "Noch keine Locations.");
        }

        static Projection from(
                WorldPlannerSnapshot snapshot,
                List<String> encounterTableChoices,
                long selectedLocationId,
                boolean active,
                String query,
                List<String> factionFilters,
                List<String> tableFilters
        ) {
            List<WorldLocationSummary> locations = filtered(snapshot, query, factionFilters, tableFilters);
            List<WorldFactionSummary> factions = snapshot == null ? List.of() : snapshot.factions();
            List<Long> locationIds = locations.stream()
                    .map(WorldLocationSummary::locationId)
                    .toList();
            List<String> rows = locations.stream()
                    .map(location -> location.displayName()
                            + "    Fraktionen " + location.factionIds().size()
                            + "    Tabellen " + location.encounterTableIds().size())
                    .toList();
            WorldLocationSummary selected = locations.stream()
                    .filter(location -> location.locationId() == selectedLocationId)
                    .findFirst()
                    .orElse(null);
            List<String> factionLabels = factions.stream()
                    .map(faction -> "#" + faction.factionId() + " | " + faction.displayName())
                    .toList();
            return new Projection(
                    active,
                    locationIds,
                    rows,
                    factionLabels,
                    encounterTableChoices,
                    WorldPlannerFilterContentPartModel.indexOf(locationIds, selectedLocationId),
                    selected == null ? "" : selected.displayName(),
                    locationIds.isEmpty() ? "Noch keine Locations." : "");
        }

        private static List<WorldLocationSummary> filtered(
                WorldPlannerSnapshot snapshot,
                String query,
                List<String> factionFilters,
                List<String> tableFilters
        ) {
            String normalizedQuery = WorldPlannerFilterContentPartModel.normalized(query);
            List<String> factions = factionFilters == null ? List.of() : factionFilters;
            List<String> tables = tableFilters == null ? List.of() : tableFilters;
            return (snapshot == null ? List.<WorldLocationSummary>of() : snapshot.locations()).stream()
                    .filter(location -> normalizedQuery.isBlank() || searchable(location).contains(normalizedQuery))
                    .filter(location -> factions.isEmpty()
                            || location.factionIds().stream().map(String::valueOf).anyMatch(factions::contains))
                    .filter(location -> tables.isEmpty()
                            || location.encounterTableIds().stream().map(String::valueOf).anyMatch(tables::contains))
                    .toList();
        }

        private static String searchable(WorldLocationSummary location) {
            return WorldPlannerFilterContentPartModel.normalized(location.displayName()
                    + " " + location.factionIds()
                    + " " + location.encounterTableIds());
        }

    }
}

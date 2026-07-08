package src.view.leftbartabs.worldplanner;

import java.util.List;
import java.util.Map;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogRow;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldNpcSummary;
import src.domain.worldplanner.published.WorldPlannerSnapshot;

final class WorldPlannerFactionMainContentModel {

    private static final long NO_SELECTION = 0L;

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());
    private WorldPlannerSnapshot snapshot;
    private List<Long> statblockChoiceIds = List.of();
    private List<String> statblockChoices = List.of();
    private List<Long> encounterTableChoiceIds = List.of();
    private List<String> encounterTableChoices = List.of();
    private List<Long> npcReferenceChoiceIds = List.of();
    private String query = "";
    private List<String> tableFilters = List.of();
    private List<String> npcFilters = List.of();
    private List<String> stockFilters = List.of();
    private long selectedFactionId;
    private boolean active;

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void setActive(boolean nextActive) {
        if (active == nextActive) {
            return;
        }
        active = nextActive;
        refreshProjection();
    }

    void applySnapshot(WorldPlannerSnapshot nextSnapshot) {
        snapshot = nextSnapshot;
        retainSelection();
        refreshProjection();
    }

    void applyCreatureCatalog(CreatureCatalogPageResult result) {
        List<CreatureCatalogRow> rows = creatureRows(result);
        statblockChoiceIds = rows.stream()
                .map(CreatureCatalogRow::id)
                .toList();
        statblockChoices = rows.stream()
                .map(row -> "#" + row.id() + " | " + row.name())
                .toList();
        refreshProjection();
    }

    void applyEncounterTables(EncounterTableCatalogResult result) {
        encounterTableChoiceIds = WorldPlannerFilterContentPartModel.encounterTableIds(result);
        encounterTableChoices = WorldPlannerFilterContentPartModel.encounterTableLabels(result);
        refreshProjection();
    }

    void applyFilters(String nextQuery, Map<String, List<String>> filters) {
        query = nextQuery == null ? "" : nextQuery;
        tableFilters = WorldPlannerFilterContentPartModel.values(filters, "table");
        npcFilters = WorldPlannerFilterContentPartModel.values(filters, "npc");
        stockFilters = WorldPlannerFilterContentPartModel.values(filters, "stock");
        refreshProjection();
    }

    void select(int factionIndex) {
        Projection current = projection.get();
        selectedFactionId = idAt(current.factions(), factionIndex, selectedFactionId);
        refreshProjection();
    }

    long selectedFactionId() {
        return selectedFactionId;
    }

    long encounterTableChoiceId(int choiceIndex) {
        return idAt(encounterTableChoiceIds, choiceIndex, 0L);
    }

    long npcReferenceChoiceId(int choiceIndex) {
        return idAt(npcReferenceChoiceIds, choiceIndex, 0L);
    }

    long statblockChoiceId(int choiceIndex) {
        return idAt(statblockChoiceIds, choiceIndex, 0L);
    }

    WorldFactionSummary selectedFaction() {
        if (snapshot == null) {
            return null;
        }
        return snapshot.factions().stream()
                .filter(faction -> faction.factionId() == selectedFactionId)
                .findFirst()
                .orElse(null);
    }

    StateProjection stateProjection() {
        Projection current = projection.get();
        boolean selected = current.selectedFactionIndex() >= 0;
        return new StateProjection(
                selected
                        ? current.selectedFactionName() + " | " + current.selectedPrimaryTableLabel()
                        : "Keine Fraktion ausgewählt.",
                selected
                        ? "NPCs und Bestand werden hier bearbeitet."
                        : "Fraktion anlegen oder eine Fraktion wählen.",
                new FactionEditor(
                        current.selectedFactionName(),
                        current.encounterTableLabels(),
                        current.selectedPrimaryTableLabel(),
                        current.npcReferenceLabels(),
                        current.statblockLabels()));
    }

    SearchProjection searchProjection(
            String searchQuery,
            Map<String, List<String>> filters
    ) {
        List<FilterGroup> groups = filterGroups(filters);
        return new SearchProjection(
                "Fraktionen suchen",
                searchQuery,
                groups,
                filterChips(groups));
    }

    private void retainSelection() {
        List<WorldFactionSummary> factions = snapshot == null ? List.of() : snapshot.factions();
        if (factions.stream().noneMatch(faction -> faction.factionId() == selectedFactionId)) {
            selectedFactionId = factions.isEmpty() ? NO_SELECTION : factions.getFirst().factionId();
        }
    }

    private void refreshProjection() {
        npcReferenceChoiceIds = currentNpcs().stream()
                .map(WorldNpcSummary::npcId)
                .toList();
        projection.set(Projection.from(
                snapshot,
                encounterTableChoices,
                statblockChoices,
                selectedFactionId,
                active,
                query,
                tableFilters,
                npcFilters,
                stockFilters));
    }

    private List<WorldNpcSummary> currentNpcs() {
        return snapshot == null ? List.of() : snapshot.npcs();
    }

    private static long idAt(List<Long> rows, int index, long fallback) {
        if (index < 0 || index >= rows.size()) {
            return fallback;
        }
        return rows.get(index);
    }

    private static List<CreatureCatalogRow> creatureRows(CreatureCatalogPageResult result) {
        return result == null || result.page() == null ? List.of() : result.page().rows();
    }

    private List<FilterGroup> filterGroups(Map<String, List<String>> filters) {
        Projection current = projection.get();
        return List.of(
                group("table", "Tabelle", current.encounterTableLabels().stream()
                        .map(label -> option(idKey(label), label, selected(filters, "table", idKey(label))))
                        .toList()),
                group("npc", "NPC", current.npcReferenceLabels().stream()
                        .map(label -> option(idKey(label), label, selected(filters, "npc", idKey(label))))
                        .toList()),
                group("stock", "Bestand", List.of(
                        option("finite", "Limitiert", selected(filters, "stock", "finite")),
                        option("unlimited", "Unlimitiert", selected(filters, "stock", "unlimited")))));
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

    record StateProjection(String statusText, String nextActionText, FactionEditor faction) {
    }

    record FactionEditor(
            String displayName,
            List<String> encounterTableLabels,
            String selectedPrimaryTableLabel,
            List<String> npcReferenceLabels,
            List<String> statblockLabels
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
            List<Long> factions,
            List<String> factionLabels,
            List<String> encounterTableLabels,
            List<String> npcReferenceLabels,
            List<String> statblockLabels,
            int selectedFactionIndex,
            String selectedFactionName,
            String selectedPrimaryTableLabel,
            String emptyText
    ) {

        Projection {
            factions = factions == null ? List.of() : List.copyOf(factions);
            factionLabels = factionLabels == null ? List.of() : List.copyOf(factionLabels);
            encounterTableLabels = encounterTableLabels == null ? List.of() : List.copyOf(encounterTableLabels);
            npcReferenceLabels = npcReferenceLabels == null ? List.of() : List.copyOf(npcReferenceLabels);
            statblockLabels = statblockLabels == null ? List.of() : List.copyOf(statblockLabels);
            selectedFactionName = WorldPlannerFilterContentPartModel.text(selectedFactionName);
            selectedPrimaryTableLabel = WorldPlannerFilterContentPartModel.text(selectedPrimaryTableLabel);
            emptyText = WorldPlannerFilterContentPartModel.text(emptyText);
        }

        static Projection empty() {
            return new Projection(false, List.of(), List.of(), List.of(), List.of(), List.of(), -1, "", "",
                    "Noch keine Fraktionen.");
        }

        static Projection from(
                WorldPlannerSnapshot snapshot,
                List<String> encounterTableChoices,
                List<String> statblockChoices,
                long selectedFactionId,
                boolean active,
                String query,
                List<String> tableFilters,
                List<String> npcFilters,
                List<String> stockFilters
        ) {
            List<WorldFactionSummary> factions = filtered(snapshot, query, tableFilters, npcFilters, stockFilters);
            List<WorldNpcSummary> npcs = snapshot == null ? List.of() : snapshot.npcs();
            List<Long> factionIds = factions.stream()
                    .map(WorldFactionSummary::factionId)
                    .toList();
            List<String> rows = factions.stream()
                    .map(faction -> faction.displayName()
                            + "    Tabelle #" + faction.primaryEncounterTableId()
                            + "    NPCs " + faction.npcIds().size())
                    .toList();
            WorldFactionSummary selected = factions.stream()
                    .filter(faction -> faction.factionId() == selectedFactionId)
                    .findFirst()
                    .orElse(null);
            List<String> npcLabels = npcs.stream()
                    .map(npc -> "#" + npc.npcId() + " | " + npc.displayName())
                    .toList();
            return new Projection(
                    active,
                    factionIds,
                    rows,
                    encounterTableChoices,
                    npcLabels,
                    statblockChoices,
                    WorldPlannerFilterContentPartModel.indexOf(factionIds, selectedFactionId),
                    selected == null ? "" : selected.displayName(),
                    tableLabel(encounterTableChoices, selected),
                    factionIds.isEmpty() ? "Noch keine Fraktionen." : "");
        }

        private static List<WorldFactionSummary> filtered(
                WorldPlannerSnapshot snapshot,
                String query,
                List<String> tableFilters,
                List<String> npcFilters,
                List<String> stockFilters
        ) {
            String normalizedQuery = WorldPlannerFilterContentPartModel.normalized(query);
            List<String> tables = tableFilters == null ? List.of() : tableFilters;
            List<String> npcs = npcFilters == null ? List.of() : npcFilters;
            List<String> stock = stockFilters == null ? List.of() : stockFilters;
            return (snapshot == null ? List.<WorldFactionSummary>of() : snapshot.factions()).stream()
                    .filter(faction -> normalizedQuery.isBlank() || searchable(faction).contains(normalizedQuery))
                    .filter(faction -> tables.isEmpty() || tables.contains(Long.toString(faction.primaryEncounterTableId())))
                    .filter(faction -> npcs.isEmpty()
                            || faction.npcIds().stream().map(String::valueOf).anyMatch(npcs::contains))
                    .filter(faction -> stock.isEmpty() || stockMatches(faction, stock))
                    .toList();
        }

        private static boolean stockMatches(WorldFactionSummary faction, List<String> stock) {
            boolean hasFinite = faction.inventoryLimits().stream().anyMatch(limit -> limit.finite());
            boolean hasUnlimited = faction.inventoryLimits().isEmpty()
                    || faction.inventoryLimits().stream().anyMatch(limit -> !limit.finite());
            return stock.contains("finite") && hasFinite
                    || stock.contains("unlimited") && hasUnlimited;
        }

        private static String searchable(WorldFactionSummary faction) {
            return WorldPlannerFilterContentPartModel.normalized(faction.displayName()
                    + " " + faction.primaryEncounterTableId()
                    + " " + faction.npcIds()
                    + " " + faction.inventoryLimits());
        }

        private static String tableLabel(List<String> tables, WorldFactionSummary faction) {
            if (faction == null) {
                return "";
            }
            String prefix = "#" + faction.primaryEncounterTableId() + " |";
            for (String table : tables) {
                if (table.startsWith(prefix)) {
                    return table;
                }
            }
            return "#" + faction.primaryEncounterTableId();
        }

    }
}

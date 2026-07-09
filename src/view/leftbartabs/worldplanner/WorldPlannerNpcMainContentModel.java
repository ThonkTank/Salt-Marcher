package src.view.leftbartabs.worldplanner;

import java.util.List;
import java.util.Map;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogRow;
import src.domain.worldplanner.published.WorldNpcSummary;
import src.domain.worldplanner.published.WorldPlannerSnapshot;

final class WorldPlannerNpcMainContentModel {

    private static final long NO_SELECTION = 0L;

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());
    private WorldPlannerSnapshot snapshot;
    private List<Long> statblockChoiceIds = List.of();
    private List<String> statblockChoices = List.of();
    private String query = "";
    private List<String> statusFilters = List.of();
    private List<String> statblockFilters = List.of();
    private long selectedNpcId;
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

    void applyCreatureCatalog(CreatureCatalogPageResult result) {
        List<CreatureCatalogRow> rows = result == null || result.page() == null
                ? List.of()
                : result.page().rows();
        statblockChoiceIds = rows.stream()
                .map(CreatureCatalogRow::id)
                .toList();
        statblockChoices = rows.stream()
                .map(row -> "#" + row.id() + " | " + row.name())
                .toList();
        refreshProjection();
    }

    void applyFilters(String nextQuery, Map<String, List<String>> filters) {
        query = nextQuery == null ? "" : nextQuery;
        statusFilters = WorldPlannerFilterContentPartModel.values(filters, "status");
        statblockFilters = WorldPlannerFilterContentPartModel.values(filters, "statblock");
        refreshProjection();
    }

    void select(int npcIndex) {
        Projection current = projection.get();
        selectedNpcId = idAt(current.npcs(), npcIndex, selectedNpcId);
        refreshProjection();
    }

    long selectedNpcId() {
        return selectedNpcId;
    }

    long selectedNpcStatblockId() {
        WorldNpcSummary npc = selectedNpc();
        return npc == null ? 0L : npc.creatureStatblockId();
    }

    long statblockChoiceId(int choiceIndex) {
        return idAt(statblockChoiceIds, choiceIndex, 0L);
    }

    WorldNpcSummary selectedNpc() {
        if (snapshot == null) {
            return null;
        }
        return snapshot.npcs().stream()
                .filter(npc -> npc.npcId() == selectedNpcId)
                .findFirst()
                .orElse(null);
    }

    StateProjection stateProjection(boolean encounterAvailable) {
        Projection current = projection.get();
        boolean selected = current.selectedNpcIndex() >= 0;
        String encounterText = encounterAvailable
                ? "Encounter-Aktion verfügbar."
                : "Encounter-Service nicht verfügbar.";
        return new StateProjection(
                selected
                        ? current.selectedNpcName() + " | " + current.selectedStatblockLabel()
                        : "Kein NPC ausgewählt.",
                selected ? encounterText : "NPC anlegen oder einen NPC aus der Liste wählen.",
                new NpcEditor(
                        current.selectedNpcName(),
                        current.statblockLabels(),
                        current.selectedStatblockLabel(),
                        current.selectedAppearanceNotes(),
                        current.selectedBehaviorNotes(),
                        current.selectedHistoryNotes(),
                        current.selectedGeneralNotes()));
    }

    private void retainSelection() {
        List<WorldNpcSummary> npcs = snapshot == null ? List.of() : snapshot.npcs();
        if (npcs.stream().noneMatch(npc -> npc.npcId() == selectedNpcId)) {
            selectedNpcId = npcs.isEmpty() ? NO_SELECTION : npcs.getFirst().npcId();
        }
    }

    private void refreshProjection() {
        projection.set(Projection.from(
                snapshot,
                statblockChoices,
                selectedNpcId,
                active,
                query,
                statusFilters,
                statblockFilters));
    }

    private static long idAt(List<Long> rows, int index, long fallback) {
        if (index < 0 || index >= rows.size()) {
            return fallback;
        }
        return rows.get(index);
    }

    record StateProjection(String statusText, String nextActionText, NpcEditor npc) {
    }

    record NpcEditor(
            String displayName,
            List<String> statblockLabels,
            String selectedStatblockLabel,
            String appearanceNotes,
            String behaviorNotes,
            String historyNotes,
            String generalNotes
    ) {
    }

    record Projection(
            boolean active,
            List<Long> npcs,
            List<String> npcLabels,
            List<String> statblockLabels,
            int selectedNpcIndex,
            String selectedNpcName,
            String selectedStatblockLabel,
            String selectedAppearanceNotes,
            String selectedBehaviorNotes,
            String selectedHistoryNotes,
            String selectedGeneralNotes,
            String emptyText
    ) {

        Projection {
            npcs = npcs == null ? List.of() : List.copyOf(npcs);
            npcLabels = npcLabels == null ? List.of() : List.copyOf(npcLabels);
            statblockLabels = statblockLabels == null ? List.of() : List.copyOf(statblockLabels);
            selectedNpcName = WorldPlannerFilterContentPartModel.text(selectedNpcName);
            selectedStatblockLabel = WorldPlannerFilterContentPartModel.text(selectedStatblockLabel);
            selectedAppearanceNotes = WorldPlannerFilterContentPartModel.text(selectedAppearanceNotes);
            selectedBehaviorNotes = WorldPlannerFilterContentPartModel.text(selectedBehaviorNotes);
            selectedHistoryNotes = WorldPlannerFilterContentPartModel.text(selectedHistoryNotes);
            selectedGeneralNotes = WorldPlannerFilterContentPartModel.text(selectedGeneralNotes);
            emptyText = WorldPlannerFilterContentPartModel.text(emptyText);
        }

        static Projection empty() {
            return new Projection(true, List.of(), List.of(), List.of(), -1, "", "", "", "", "", "",
                    "Noch keine NPCs.");
        }

        static Projection from(
                WorldPlannerSnapshot snapshot,
                List<String> statblockChoices,
                long selectedNpcId,
                boolean active,
                String query,
                List<String> statusFilters,
                List<String> statblockFilters
        ) {
            List<WorldNpcSummary> npcs = filtered(snapshot, query, statusFilters, statblockFilters);
            List<Long> npcIds = npcs.stream()
                    .map(WorldNpcSummary::npcId)
                    .toList();
            List<String> npcRows = npcs.stream()
                    .map(npc -> npc.displayName()
                            + "    " + npc.status()
                            + "    #" + npc.creatureStatblockId())
                    .toList();
            WorldNpcSummary selected = npcs.stream()
                    .filter(npc -> npc.npcId() == selectedNpcId)
                    .findFirst()
                    .orElse(null);
            return new Projection(
                    active,
                    npcIds,
                    npcRows,
                    statblockChoices,
                    WorldPlannerFilterContentPartModel.indexOf(npcIds, selectedNpcId),
                    selected == null ? "" : selected.displayName(),
                    statblockLabel(statblockChoices, selected),
                    selected == null ? "" : selected.appearanceNotes(),
                    selected == null ? "" : selected.behaviorNotes(),
                    selected == null ? "" : selected.historyNotes(),
                    selected == null ? "" : selected.generalNotes(),
                    npcIds.isEmpty() ? "Noch keine NPCs." : "");
        }

        private static List<WorldNpcSummary> filtered(
                WorldPlannerSnapshot snapshot,
                String query,
                List<String> statusFilters,
                List<String> statblockFilters
        ) {
            String normalizedQuery = WorldPlannerFilterContentPartModel.normalized(query);
            List<String> statuses = statusFilters == null ? List.of() : statusFilters;
            List<String> statblocks = statblockFilters == null ? List.of() : statblockFilters;
            return (snapshot == null ? List.<WorldNpcSummary>of() : snapshot.npcs()).stream()
                    .filter(npc -> normalizedQuery.isBlank() || searchable(npc).contains(normalizedQuery))
                    .filter(npc -> statuses.isEmpty() || statuses.contains(npc.status().name()))
                    .filter(npc -> statblocks.isEmpty() || statblocks.contains(Long.toString(npc.creatureStatblockId())))
                    .toList();
        }

        private static String searchable(WorldNpcSummary npc) {
            return WorldPlannerFilterContentPartModel.normalized(npc.displayName()
                    + " " + npc.status()
                    + " " + npc.creatureStatblockId()
                    + " " + npc.appearanceNotes()
                    + " " + npc.behaviorNotes()
                    + " " + npc.historyNotes()
                    + " " + npc.generalNotes());
        }

        private static String statblockLabel(List<String> choices, WorldNpcSummary npc) {
            if (npc == null) {
                return "";
            }
            String prefix = "#" + npc.creatureStatblockId() + " |";
            for (String choice : choices) {
                if (choice.startsWith(prefix)) {
                    return choice;
                }
            }
            return "#" + npc.creatureStatblockId();
        }

    }
}

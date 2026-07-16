package src.view.leftbartabs.worldplanner;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogRow;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableSummary;
import src.domain.worldplanner.published.RefreshWorldPlannerCommand;
import src.domain.worldplanner.published.WorldFactionInventoryLimitSummary;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldNpcLifecycleStatus;
import src.domain.worldplanner.published.WorldNpcSummary;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.view.slotcontent.controls.searchfilter.SearchFilterControlsContentModel;
import src.view.slotcontent.controls.searchfilter.SearchFilterControlsView;

final class WorldPlannerViewModel {

    private static final String VIEW_PARAMETER = "view";
    static final int NPCS = 0;
    static final int FACTIONS = 1;
    static final int LOCATIONS = 2;
    static final int SOURCES = 3;
    static final String FINITE_STOCK_KEY = "finite";
    static final String UNLIMITED_STOCK_KEY = "unlimited";

    private final SearchFilterControlsContentModel searchFilterContentModel = new SearchFilterControlsContentModel();
    private final ReadOnlyObjectWrapper<NpcProjection> npcProjection =
            new ReadOnlyObjectWrapper<>(NpcProjection.empty());
    private final ReadOnlyObjectWrapper<FactionProjection> factionProjection =
            new ReadOnlyObjectWrapper<>(FactionProjection.empty());
    private final ReadOnlyObjectWrapper<LocationProjection> locationProjection =
            new ReadOnlyObjectWrapper<>(LocationProjection.empty());
    private final ReadOnlyObjectWrapper<SourceProjection> sourceProjection =
            new ReadOnlyObjectWrapper<>(SourceProjection.empty());
    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.empty());
    private final Map<Integer, ModuleFilterState> filterStates = new HashMap<>();
    private int activeModuleIndex = NPCS;
    private WorldPlannerSnapshot snapshot;
    private List<WorldPlannerVocabulary.Option<Long>> statblockOptions = List.of();
    private List<WorldPlannerVocabulary.Option<Long>> encounterTableOptions = List.of();
    private List<WorldPlannerVocabulary.Option<Long>> npcReferenceOptions = List.of();
    private List<WorldPlannerVocabulary.Option<Long>> factionReferenceOptions = List.of();
    private long selectedNpcId;
    private long selectedFactionId;
    private long selectedLocationId;
    private boolean encounterAvailable;

    WorldPlannerViewModel(boolean encounterAvailable) {
        this.encounterAvailable = encounterAvailable;
        refreshProjections();
    }

    ReadOnlyObjectProperty<NpcProjection> npcProjectionProperty() {
        return npcProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<FactionProjection> factionProjectionProperty() {
        return factionProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<LocationProjection> locationProjectionProperty() {
        return locationProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<SourceProjection> sourceProjectionProperty() {
        return sourceProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<StateProjection> stateProjectionProperty() {
        return stateProjection.getReadOnlyProperty();
    }

    void bindSearchFilters(SearchFilterControlsView view) {
        Objects.requireNonNull(view, VIEW_PARAMETER).bind(searchFilterContentModel);
    }

    void activateRoot(Consumer<RefreshWorldPlannerCommand> refreshSink, Runnable detailOpener) {
        Objects.requireNonNull(refreshSink, "refreshSink");
        refreshSink.accept(new RefreshWorldPlannerCommand());
        Objects.requireNonNull(detailOpener, "detailOpener").run();
    }

    void activate(int moduleIndex) {
        activeModuleIndex = normalizedModule(moduleIndex);
        refreshProjections();
    }

    void applySnapshot(WorldPlannerSnapshot nextSnapshot) {
        snapshot = nextSnapshot;
        retainSelections();
        refreshProjections();
    }

    void applyCreatureCatalog(CreatureCatalogPageResult result) {
        statblockOptions = creatureRows(result).stream()
                .map(row -> new WorldPlannerVocabulary.Option<>(
                        WorldPlannerVocabulary.idKey(row.id()),
                        WorldPlannerVocabulary.idLabel(row.id(), row.name()),
                        row.id()))
                .toList();
        refreshProjections();
    }

    void applyEncounterTables(EncounterTableCatalogResult result) {
        encounterTableOptions = encounterTables(result).stream()
                .map(table -> new WorldPlannerVocabulary.Option<>(
                        WorldPlannerVocabulary.idKey(table.tableId()),
                        WorldPlannerVocabulary.idLabel(table.tableId(), table.name()),
                        table.tableId()))
                .toList();
        refreshProjections();
    }

    void applySearchFilters(String query, Map<String, List<String>> filters) {
        filterStates.put(activeModuleIndex, new ModuleFilterState(query, filters));
        refreshProjections();
    }

    void selectNpc(int index) {
        selectedNpcId = WorldPlannerVocabulary.idAt(npcProjection.get().npcs(), index, selectedNpcId);
        refreshProjections();
    }

    void selectFaction(int index) {
        selectedFactionId = WorldPlannerVocabulary.idAt(factionProjection.get().factions(), index, selectedFactionId);
        refreshProjections();
    }

    void selectLocation(int index) {
        selectedLocationId =
                WorldPlannerVocabulary.idAt(locationProjection.get().locations(), index, selectedLocationId);
        refreshProjections();
    }

    long selectedNpcId() {
        return selectedNpcId;
    }

    long selectedNpcStatblockId() {
        WorldNpcSummary npc = selectedNpc();
        return npc == null ? 0L : npc.creatureStatblockId();
    }

    long npcStatblockChoiceId(int choiceIndex) {
        return WorldPlannerVocabulary.optionValue(statblockOptions, choiceIndex, 0L);
    }

    long selectedFactionId() {
        return selectedFactionId;
    }

    long selectedLocationId() {
        return selectedLocationId;
    }

    long factionPrimaryTableChoiceId(int choiceIndex) {
        return WorldPlannerVocabulary.optionValue(encounterTableOptions, choiceIndex, 0L);
    }

    long factionNpcChoiceId(int choiceIndex) {
        return WorldPlannerVocabulary.optionValue(npcReferenceOptions, choiceIndex, 0L);
    }

    long factionStatblockChoiceId(int choiceIndex) {
        return WorldPlannerVocabulary.optionValue(statblockOptions, choiceIndex, 0L);
    }

    long locationFactionChoiceId(int choiceIndex) {
        return WorldPlannerVocabulary.optionValue(factionReferenceOptions, choiceIndex, 0L);
    }

    long locationTableChoiceId(int choiceIndex) {
        return WorldPlannerVocabulary.optionValue(encounterTableOptions, choiceIndex, 0L);
    }

    String detailTitle() {
        return detailSelection().title();
    }

    String detailKey() {
        return detailSelection().key();
    }

    DetailProjection detailProjection() {
        return detailSelection().projection();
    }

    private WorldPlannerDetailSelection detailSelection() {
        return new WorldPlannerDetailSelection(
                activeModuleIndex,
                selectedNpc(),
                selectedFaction(),
                selectedLocation(),
                sourceProjection.get());
    }

    private void retainSelections() {
        List<WorldNpcSummary> npcs = npcs();
        if (npcs.stream().noneMatch(npc -> npc.npcId() == selectedNpcId)) {
            selectedNpcId = npcs.isEmpty() ? 0L : npcs.getFirst().npcId();
        }
        List<WorldFactionSummary> factions = factions();
        if (factions.stream().noneMatch(faction -> faction.factionId() == selectedFactionId)) {
            selectedFactionId = factions.isEmpty() ? 0L : factions.getFirst().factionId();
        }
        List<WorldLocationSummary> locations = locations();
        if (locations.stream().noneMatch(location -> location.locationId() == selectedLocationId)) {
            selectedLocationId = locations.isEmpty() ? 0L : locations.getFirst().locationId();
        }
    }

    private void refreshProjections() {
        ModuleFilterState filters = activeFilterState();
        npcReferenceOptions = npcs().stream()
                .map(npc -> new WorldPlannerVocabulary.Option<>(
                        WorldPlannerVocabulary.idKey(npc.npcId()),
                        WorldPlannerVocabulary.idLabel(npc.npcId(), npc.displayName()),
                        npc.npcId()))
                .toList();
        factionReferenceOptions = factions().stream()
                .map(faction -> new WorldPlannerVocabulary.Option<>(
                        WorldPlannerVocabulary.idKey(faction.factionId()),
                        WorldPlannerVocabulary.idLabel(faction.factionId(), faction.displayName()),
                        faction.factionId()))
                .toList();
        WorldPlannerProjectionOptions options = new WorldPlannerProjectionOptions(
                statblockOptions,
                encounterTableOptions,
                npcReferenceOptions,
                factionReferenceOptions);
        WorldPlannerProjectionSelection selection = new WorldPlannerProjectionSelection(
                selectedNpcId,
                selectedFactionId,
                selectedLocationId);
        WorldPlannerProjectionInput input = new WorldPlannerProjectionInput(
                activeModuleIndex,
                filters,
                snapshot,
                options,
                selection,
                encounterAvailable);
        WorldPlannerProjectionBuilder builder = new WorldPlannerProjectionBuilder(input);
        NpcProjection npc = builder.npcProjection();
        FactionProjection faction = builder.factionProjection();
        LocationProjection location = builder.locationProjection();
        SourceProjection source = builder.sourceProjection();
        npcProjection.set(npc);
        factionProjection.set(faction);
        locationProjection.set(location);
        sourceProjection.set(source);
        stateProjection.set(new WorldPlannerStateProjectionBuilder(input).stateProjection(
                npc,
                faction,
                location,
                source));
        refreshSearchProjection();
    }

    private void refreshSearchProjection() {
        WorldPlannerSearchProjectionBuilder.apply(
                searchFilterContentModel,
                activeModuleIndex,
                activeFilterState(),
                statblockOptions,
                encounterTableOptions,
                npcReferenceOptions,
                factionReferenceOptions);
    }

    private ModuleFilterState activeFilterState() {
        return filterStates.getOrDefault(activeModuleIndex, ModuleFilterState.empty());
    }

    private static int normalizedModule(int moduleIndex) {
        return Math.max(NPCS, Math.min(SOURCES, moduleIndex));
    }

    private WorldNpcSummary selectedNpc() {
        return npcs().stream()
                .filter(npc -> npc.npcId() == selectedNpcId)
                .findFirst()
                .orElse(null);
    }

    private WorldFactionSummary selectedFaction() {
        return factions().stream()
                .filter(faction -> faction.factionId() == selectedFactionId)
                .findFirst()
                .orElse(null);
    }

    private WorldLocationSummary selectedLocation() {
        return locations().stream()
                .filter(location -> location.locationId() == selectedLocationId)
                .findFirst()
                .orElse(null);
    }

    private List<WorldNpcSummary> npcs() {
        return snapshot == null ? List.of() : snapshot.npcs();
    }

    private List<WorldFactionSummary> factions() {
        return snapshot == null ? List.of() : snapshot.factions();
    }

    private List<WorldLocationSummary> locations() {
        return snapshot == null ? List.of() : snapshot.locations();
    }

    private static List<CreatureCatalogRow> creatureRows(CreatureCatalogPageResult result) {
        return result == null || result.page() == null ? List.of() : result.page().rows();
    }

    private static List<EncounterTableSummary> encounterTables(EncounterTableCatalogResult result) {
        return result == null ? List.of() : result.tables();
    }

    static String detailInventoryLimits(List<WorldFactionInventoryLimitSummary> limits) {
        if (limits.isEmpty()) {
            return "unbegrenzt";
        }
        return limits.stream()
                .map(limit -> limit.finite()
                        ? "#" + limit.creatureStatblockId() + " x" + limit.quantity()
                        : "#" + limit.creatureStatblockId() + " unbegrenzt")
                .toList()
                .toString();
    }

    static List<Long> copiedLongs(List<Long> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    static List<String> copiedStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    static Map<String, List<String>> copy(Map<String, List<String>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<String, List<String>> copied = new HashMap<>();
        for (Map.Entry<String, List<String>> entry : source.entrySet()) {
            copied.put(entry.getKey(), entry.getValue() == null ? List.of() : List.copyOf(entry.getValue()));
        }
        return Map.copyOf(copied);
    }
}

record NpcMainInput(int selectedNpcIndex) {
    NpcMainInput {
        selectedNpcIndex = Math.max(-1, selectedNpcIndex);
    }
}

record FactionMainInput(int selectedFactionIndex) {
    FactionMainInput {
        selectedFactionIndex = Math.max(-1, selectedFactionIndex);
    }
}

record LocationMainInput(int selectedLocationIndex) {
    LocationMainInput {
        selectedLocationIndex = Math.max(-1, selectedLocationIndex);
    }
}

record StateInput(
        int activeModuleIndex,
        NpcSnapshot npc,
        FactionSnapshot faction,
        LocationSnapshot location,
        ActionSnapshot actions
) {
    StateInput {
        activeModuleIndex = Math.max(0, activeModuleIndex);
        npc = npc == null ? new NpcSnapshot("", -1, "", "", "", "") : npc;
        faction = faction == null ? new FactionSnapshot("", -1, -1, -1, false, "") : faction;
        location = location == null ? new LocationSnapshot("", -1, -1) : location;
        actions = actions == null
                ? new ActionSnapshot(false, false, false, false, false, false, false, false, false)
                : actions;
    }
}

record NpcSnapshot(
        String displayName,
        int statblockChoiceIndex,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes
) {
    NpcSnapshot {
        displayName = WorldPlannerVocabulary.text(displayName);
        statblockChoiceIndex = Math.max(-1, statblockChoiceIndex);
        appearanceNotes = WorldPlannerVocabulary.text(appearanceNotes);
        behaviorNotes = WorldPlannerVocabulary.text(behaviorNotes);
        historyNotes = WorldPlannerVocabulary.text(historyNotes);
        generalNotes = WorldPlannerVocabulary.text(generalNotes);
    }
}

record FactionSnapshot(
        String displayName,
        int primaryEncounterTableChoiceIndex,
        int npcChoiceIndex,
        int inventoryStatblockChoiceIndex,
        boolean finiteInventory,
        String inventoryQuantityText
) {
    FactionSnapshot {
        displayName = WorldPlannerVocabulary.text(displayName);
        primaryEncounterTableChoiceIndex = Math.max(-1, primaryEncounterTableChoiceIndex);
        npcChoiceIndex = Math.max(-1, npcChoiceIndex);
        inventoryStatblockChoiceIndex = Math.max(-1, inventoryStatblockChoiceIndex);
        inventoryQuantityText = WorldPlannerVocabulary.text(inventoryQuantityText);
    }
}

record LocationSnapshot(
        String displayName,
        int factionChoiceIndex,
        int encounterTableChoiceIndex
) {
    LocationSnapshot {
        displayName = WorldPlannerVocabulary.text(displayName);
        factionChoiceIndex = Math.max(-1, factionChoiceIndex);
        encounterTableChoiceIndex = Math.max(-1, encounterTableChoiceIndex);
    }
}

record ActionSnapshot(
        boolean createRequested,
        boolean saveNotesRequested,
        boolean defeatRequested,
        boolean reactivateRequested,
        boolean addToEncounterRequested,
        boolean addNpcRequested,
        boolean setInventoryLimitRequested,
        boolean linkFactionRequested,
        boolean linkTableRequested
) {
}

record NpcProjection(
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
    NpcProjection {
        npcs = WorldPlannerViewModel.copiedLongs(npcs);
        npcLabels = WorldPlannerViewModel.copiedStrings(npcLabels);
        statblockLabels = WorldPlannerViewModel.copiedStrings(statblockLabels);
        selectedNpcName = WorldPlannerVocabulary.text(selectedNpcName);
        selectedStatblockLabel = WorldPlannerVocabulary.text(selectedStatblockLabel);
        selectedAppearanceNotes = WorldPlannerVocabulary.text(selectedAppearanceNotes);
        selectedBehaviorNotes = WorldPlannerVocabulary.text(selectedBehaviorNotes);
        selectedHistoryNotes = WorldPlannerVocabulary.text(selectedHistoryNotes);
        selectedGeneralNotes = WorldPlannerVocabulary.text(selectedGeneralNotes);
        emptyText = WorldPlannerVocabulary.text(emptyText);
    }

    static NpcProjection empty() {
        return new NpcProjection(true, List.of(), List.of(), List.of(), -1, "", "", "", "", "", "",
                "Noch keine NPCs.");
    }
}

record FactionProjection(
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
    FactionProjection {
        factions = WorldPlannerViewModel.copiedLongs(factions);
        factionLabels = WorldPlannerViewModel.copiedStrings(factionLabels);
        encounterTableLabels = WorldPlannerViewModel.copiedStrings(encounterTableLabels);
        npcReferenceLabels = WorldPlannerViewModel.copiedStrings(npcReferenceLabels);
        statblockLabels = WorldPlannerViewModel.copiedStrings(statblockLabels);
        selectedFactionName = WorldPlannerVocabulary.text(selectedFactionName);
        selectedPrimaryTableLabel = WorldPlannerVocabulary.text(selectedPrimaryTableLabel);
        emptyText = WorldPlannerVocabulary.text(emptyText);
    }

    static FactionProjection empty() {
        return new FactionProjection(false, List.of(), List.of(), List.of(), List.of(), List.of(), -1, "", "",
                "Noch keine Fraktionen.");
    }
}

record LocationProjection(
        boolean active,
        List<Long> locations,
        List<String> locationLabels,
        List<String> factionReferenceLabels,
        List<String> encounterTableLabels,
        int selectedLocationIndex,
        String selectedLocationName,
        String emptyText
) {
    LocationProjection {
        locations = WorldPlannerViewModel.copiedLongs(locations);
        locationLabels = WorldPlannerViewModel.copiedStrings(locationLabels);
        factionReferenceLabels = WorldPlannerViewModel.copiedStrings(factionReferenceLabels);
        encounterTableLabels = WorldPlannerViewModel.copiedStrings(encounterTableLabels);
        selectedLocationName = WorldPlannerVocabulary.text(selectedLocationName);
        emptyText = WorldPlannerVocabulary.text(emptyText);
    }

    static LocationProjection empty() {
        return new LocationProjection(false, List.of(), List.of(), List.of(), List.of(), -1, "",
                "Noch keine Locations.");
    }
}

record SourceProjection(
        boolean active,
        List<String> rows,
        String summary
) {
    SourceProjection {
        rows = WorldPlannerViewModel.copiedStrings(rows);
        summary = WorldPlannerVocabulary.text(summary);
    }

    static SourceProjection empty() {
        return new SourceProjection(false, List.of(), "Keine Encounter-Quellen konfiguriert.");
    }
}

record StateProjection(
        int activeModuleIndex,
        String moduleTitle,
        String statusText,
        String nextActionText,
        NpcEditor npc,
        FactionEditor faction,
        LocationEditor location,
        String sourcesSummary
) {
    StateProjection {
        activeModuleIndex = Math.max(0, Math.min(WorldPlannerViewModel.SOURCES, activeModuleIndex));
        moduleTitle = WorldPlannerVocabulary.text(moduleTitle);
        statusText = WorldPlannerVocabulary.text(statusText);
        nextActionText = WorldPlannerVocabulary.text(nextActionText);
        npc = npc == null ? NpcEditor.empty() : npc;
        faction = faction == null ? FactionEditor.empty() : faction;
        location = location == null ? LocationEditor.empty() : location;
        sourcesSummary = WorldPlannerVocabulary.text(sourcesSummary);
    }

    static StateProjection empty() {
        return new StateProjection(
                WorldPlannerViewModel.NPCS,
                "NPCs",
                "Kein NPC ausgewählt.",
                "NPC anlegen oder einen NPC wählen.",
                NpcEditor.empty(),
                FactionEditor.empty(),
                LocationEditor.empty(),
                "");
    }

    static StateProjection sources(String summary) {
        return new StateProjection(
                WorldPlannerViewModel.SOURCES,
                "Encounter Sources",
                summary,
                "Read-only Überblick über konfigurierte World-Planner-Quellen.",
                NpcEditor.empty(),
                FactionEditor.empty(),
                LocationEditor.empty(),
                summary);
    }
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
    NpcEditor {
        displayName = WorldPlannerVocabulary.text(displayName);
        statblockLabels = WorldPlannerViewModel.copiedStrings(statblockLabels);
        selectedStatblockLabel = WorldPlannerVocabulary.text(selectedStatblockLabel);
        appearanceNotes = WorldPlannerVocabulary.text(appearanceNotes);
        behaviorNotes = WorldPlannerVocabulary.text(behaviorNotes);
        historyNotes = WorldPlannerVocabulary.text(historyNotes);
        generalNotes = WorldPlannerVocabulary.text(generalNotes);
    }

    static NpcEditor empty() {
        return new NpcEditor("", List.of(), "", "", "", "", "");
    }
}

record FactionEditor(
        String displayName,
        List<String> encounterTableLabels,
        String selectedPrimaryTableLabel,
        List<String> npcReferenceLabels,
        List<String> statblockLabels
) {
    FactionEditor {
        displayName = WorldPlannerVocabulary.text(displayName);
        encounterTableLabels = WorldPlannerViewModel.copiedStrings(encounterTableLabels);
        selectedPrimaryTableLabel = WorldPlannerVocabulary.text(selectedPrimaryTableLabel);
        npcReferenceLabels = WorldPlannerViewModel.copiedStrings(npcReferenceLabels);
        statblockLabels = WorldPlannerViewModel.copiedStrings(statblockLabels);
    }

    static FactionEditor empty() {
        return new FactionEditor("", List.of(), "", List.of(), List.of());
    }
}

record LocationEditor(
        String displayName,
        List<String> factionReferenceLabels,
        List<String> encounterTableLabels
) {
    LocationEditor {
        displayName = WorldPlannerVocabulary.text(displayName);
        factionReferenceLabels = WorldPlannerViewModel.copiedStrings(factionReferenceLabels);
        encounterTableLabels = WorldPlannerViewModel.copiedStrings(encounterTableLabels);
    }

    static LocationEditor empty() {
        return new LocationEditor("", List.of(), List.of());
    }
}

record DetailProjection(
        String title,
        List<DetailLine> lines
) {
    DetailProjection {
        title = title == null ? "Details" : title;
        lines = lines == null ? List.of() : List.copyOf(lines);
    }

    static DetailProjection empty() {
        return new DetailProjection("Details", List.of(new DetailLine("", "Keine Details ausgewählt")));
    }

    static DetailProjection npc(WorldNpcSummary npc) {
        if (npc == null) {
            return empty();
        }
        return new DetailProjection(npc.displayName(), List.of(
                new DetailLine("Status", npc.status().toString()),
                new DetailLine("Statblock", "#" + npc.creatureStatblockId()),
                new DetailLine("Aussehen", npc.appearanceNotes()),
                new DetailLine("Verhalten", npc.behaviorNotes()),
                new DetailLine("History", npc.historyNotes()),
                new DetailLine("Notizen", npc.generalNotes())));
    }

    static DetailProjection faction(WorldFactionSummary faction) {
        if (faction == null) {
            return empty();
        }
        return new DetailProjection(faction.displayName(), List.of(
                new DetailLine("Primäre Tabelle", "#" + faction.primaryEncounterTableId()),
                new DetailLine("NPCs", faction.npcIds().toString()),
                new DetailLine("Bestand", WorldPlannerViewModel.detailInventoryLimits(faction.inventoryLimits()))));
    }

    static DetailProjection location(WorldLocationSummary location) {
        if (location == null) {
            return empty();
        }
        return new DetailProjection(location.displayName(), List.of(
                new DetailLine("Fraktionen", location.factionIds().toString()),
                new DetailLine("Encounter Tabellen", location.encounterTableIds().toString())));
    }

    static DetailProjection sources(String summary, List<String> rows) {
        List<DetailLine> lines = new ArrayList<>();
        lines.add(new DetailLine("Summary", summary));
        for (String row : rows == null ? List.<String>of() : rows) {
            lines.add(new DetailLine("Source", row));
        }
        return new DetailProjection("Encounter Sources", lines);
    }
}

record DetailLine(String label, String value) {
    DetailLine {
        label = WorldPlannerVocabulary.text(label);
        value = WorldPlannerVocabulary.text(value);
    }
}

record ModuleFilterState(String query, Map<String, List<String>> filters) {
    ModuleFilterState {
        query = WorldPlannerVocabulary.text(query);
        filters = WorldPlannerViewModel.copy(filters);
    }

    static ModuleFilterState empty() {
        return new ModuleFilterState("", Map.of());
    }
}

record WorldPlannerDetailSelection(
        int activeModuleIndex,
        WorldNpcSummary npc,
        WorldFactionSummary faction,
        WorldLocationSummary location,
        SourceProjection source
) {
    String title() {
        if (activeModuleIndex == WorldPlannerViewModel.FACTIONS) {
            return "Fraktion";
        }
        if (activeModuleIndex == WorldPlannerViewModel.LOCATIONS) {
            return "Location";
        }
        if (activeModuleIndex == WorldPlannerViewModel.SOURCES) {
            return "Encounter Sources";
        }
        return "NPC";
    }

    String key() {
        if (activeModuleIndex == WorldPlannerViewModel.FACTIONS) {
            return faction == null ? "" : "world-planner:faction:" + faction.factionId();
        }
        if (activeModuleIndex == WorldPlannerViewModel.LOCATIONS) {
            return location == null ? "" : "world-planner:location:" + location.locationId();
        }
        if (activeModuleIndex == WorldPlannerViewModel.SOURCES) {
            return "world-planner:sources";
        }
        return npc == null ? "" : "world-planner:npc:" + npc.npcId();
    }

    DetailProjection projection() {
        if (activeModuleIndex == WorldPlannerViewModel.FACTIONS) {
            return DetailProjection.faction(faction);
        }
        if (activeModuleIndex == WorldPlannerViewModel.LOCATIONS) {
            return DetailProjection.location(location);
        }
        if (activeModuleIndex == WorldPlannerViewModel.SOURCES) {
            SourceProjection safeSource = source == null ? SourceProjection.empty() : source;
            return DetailProjection.sources(safeSource.summary(), safeSource.rows());
        }
        return DetailProjection.npc(npc);
    }
}

final class WorldPlannerSearchProjectionBuilder {
    private WorldPlannerSearchProjectionBuilder() {
    }

    static void apply(
            SearchFilterControlsContentModel contentModel,
            int activeModuleIndex,
            ModuleFilterState state,
            List<WorldPlannerVocabulary.Option<Long>> statblockOptions,
            List<WorldPlannerVocabulary.Option<Long>> encounterTableOptions,
            List<WorldPlannerVocabulary.Option<Long>> npcReferenceOptions,
            List<WorldPlannerVocabulary.Option<Long>> factionReferenceOptions
    ) {
        if (activeModuleIndex == WorldPlannerViewModel.FACTIONS) {
            applyProjection(contentModel, "Fraktionen suchen", state.query(),
                    factionFilterGroups(state.filters(), encounterTableOptions, npcReferenceOptions, statblockOptions));
        } else if (activeModuleIndex == WorldPlannerViewModel.LOCATIONS) {
            applyProjection(contentModel, "Locations suchen", state.query(),
                    locationFilterGroups(state.filters(), factionReferenceOptions, encounterTableOptions));
        } else if (activeModuleIndex == WorldPlannerViewModel.SOURCES) {
            applyProjection(contentModel, "Quellen suchen", state.query(), sourceFilterGroups(state.filters()));
        } else {
            applyProjection(contentModel, "NPCs suchen", state.query(), npcFilterGroups(state.filters(), statblockOptions));
        }
    }

    private static void applyProjection(
            SearchFilterControlsContentModel contentModel,
            String searchPrompt,
            String searchQuery,
            List<SearchFilterControlsContentModel.FilterGroup> groups
    ) {
        contentModel.applyProjection(new SearchFilterControlsContentModel.Projection(
                searchPrompt,
                searchQuery,
                groups,
                filterChips(groups)));
    }

    private static List<SearchFilterControlsContentModel.FilterGroup> npcFilterGroups(
            Map<String, List<String>> filters,
            List<WorldPlannerVocabulary.Option<Long>> statblockOptions
    ) {
        return List.of(
                new SearchFilterControlsContentModel.FilterGroup(
                        WorldPlannerVocabulary.STATUS_FILTER,
                        "Status",
                        List.of(
                                option("ACTIVE", "Aktiv",
                                        selected(filters, WorldPlannerVocabulary.STATUS_FILTER, "ACTIVE")),
                                option("DEFEATED", "Besiegt",
                                        selected(filters, WorldPlannerVocabulary.STATUS_FILTER, "DEFEATED")))),
                new SearchFilterControlsContentModel.FilterGroup(
                        WorldPlannerVocabulary.STATBLOCK_FILTER,
                        "Statblock",
                        statblockOptions.stream()
                                .map(option -> option(
                                        option.key(),
                                        option.label(),
                                        selected(filters, WorldPlannerVocabulary.STATBLOCK_FILTER, option.key())))
                                .toList()));
    }

    private static List<SearchFilterControlsContentModel.FilterGroup> factionFilterGroups(
            Map<String, List<String>> filters,
            List<WorldPlannerVocabulary.Option<Long>> encounterTableOptions,
            List<WorldPlannerVocabulary.Option<Long>> npcReferenceOptions,
            List<WorldPlannerVocabulary.Option<Long>> statblockOptions
    ) {
        return List.of(
                optionsGroup(WorldPlannerVocabulary.TABLE_FILTER, "Tabelle", encounterTableOptions, filters),
                optionsGroup(WorldPlannerVocabulary.NPC_FILTER, "NPC", npcReferenceOptions, filters),
                new SearchFilterControlsContentModel.FilterGroup(
                        WorldPlannerVocabulary.STOCK_FILTER,
                        "Bestand",
                        List.of(
                                option(WorldPlannerViewModel.FINITE_STOCK_KEY, "Limitiert",
                                        selected(filters, WorldPlannerVocabulary.STOCK_FILTER,
                                                WorldPlannerViewModel.FINITE_STOCK_KEY)),
                                option(WorldPlannerViewModel.UNLIMITED_STOCK_KEY, "Unlimitiert",
                                        selected(filters, WorldPlannerVocabulary.STOCK_FILTER,
                                                WorldPlannerViewModel.UNLIMITED_STOCK_KEY)))));
    }

    private static List<SearchFilterControlsContentModel.FilterGroup> locationFilterGroups(
            Map<String, List<String>> filters,
            List<WorldPlannerVocabulary.Option<Long>> factionReferenceOptions,
            List<WorldPlannerVocabulary.Option<Long>> encounterTableOptions
    ) {
        return List.of(
                optionsGroup(WorldPlannerVocabulary.FACTION_FILTER, "Fraktion", factionReferenceOptions, filters),
                optionsGroup(WorldPlannerVocabulary.TABLE_FILTER, "Tabelle", encounterTableOptions, filters));
    }

    private static List<SearchFilterControlsContentModel.FilterGroup> sourceFilterGroups(
            Map<String, List<String>> filters
    ) {
        return List.of(new SearchFilterControlsContentModel.FilterGroup(
                WorldPlannerVocabulary.TYPE_FILTER,
                "Typ",
                List.of(
                        option(WorldPlannerVocabulary.FACTION_FILTER, "Faction",
                                selected(filters, WorldPlannerVocabulary.TYPE_FILTER,
                                        WorldPlannerVocabulary.FACTION_FILTER)),
                        option("location", "Location",
                                selected(filters, WorldPlannerVocabulary.TYPE_FILTER, "location")))));
    }

    private static SearchFilterControlsContentModel.FilterGroup optionsGroup(
            String key,
            String label,
            List<WorldPlannerVocabulary.Option<Long>> options,
            Map<String, List<String>> filters
    ) {
        return new SearchFilterControlsContentModel.FilterGroup(key, label, options.stream()
                .map(option -> option(option.key(), option.label(), selected(filters, key, option.key())))
                .toList());
    }

    private static List<SearchFilterControlsContentModel.FilterChip> filterChips(
            List<SearchFilterControlsContentModel.FilterGroup> groups
    ) {
        return groups.stream()
                .flatMap(group -> group.options().stream()
                        .filter(SearchFilterControlsContentModel.FilterOption::selected)
                        .map(option -> new SearchFilterControlsContentModel.FilterChip(
                                group.key(),
                                option.key(),
                                group.label() + ": " + option.label())))
                .toList();
    }

    private static SearchFilterControlsContentModel.FilterOption option(
            String key,
            String label,
            boolean selected
    ) {
        return new SearchFilterControlsContentModel.FilterOption(key, label, selected);
    }

    private static boolean selected(Map<String, List<String>> filters, String group, String key) {
        List<String> selected = filters == null ? List.of() : filters.get(group);
        return selected != null && selected.contains(key);
    }
}

record WorldPlannerProjectionOptions(
        List<WorldPlannerVocabulary.Option<Long>> statblockOptions,
        List<WorldPlannerVocabulary.Option<Long>> encounterTableOptions,
        List<WorldPlannerVocabulary.Option<Long>> npcReferenceOptions,
        List<WorldPlannerVocabulary.Option<Long>> factionReferenceOptions
) {
    WorldPlannerProjectionOptions {
        statblockOptions = List.copyOf(statblockOptions);
        encounterTableOptions = List.copyOf(encounterTableOptions);
        npcReferenceOptions = List.copyOf(npcReferenceOptions);
        factionReferenceOptions = List.copyOf(factionReferenceOptions);
    }
}

record WorldPlannerProjectionSelection(
        long selectedNpcId,
        long selectedFactionId,
        long selectedLocationId
) {
}

record WorldPlannerProjectionInput(
        int activeModuleIndex,
        ModuleFilterState activeFilters,
        WorldPlannerSnapshot snapshot,
        WorldPlannerProjectionOptions options,
        WorldPlannerProjectionSelection selection,
        boolean encounterAvailable
) {
}

final class WorldPlannerStateProjectionBuilder {
    private final WorldPlannerProjectionInput input;

    WorldPlannerStateProjectionBuilder(WorldPlannerProjectionInput input) {
        this.input = input;
    }

    StateProjection stateProjection(
            NpcProjection npc,
            FactionProjection faction,
            LocationProjection location,
            SourceProjection source
    ) {
        return switch (input.activeModuleIndex()) {
            case WorldPlannerViewModel.FACTIONS -> factionStateProjection(faction);
            case WorldPlannerViewModel.LOCATIONS -> locationStateProjection(location);
            case WorldPlannerViewModel.SOURCES -> StateProjection.sources(source.summary());
            default -> npcStateProjection(npc);
        };
    }

    private StateProjection npcStateProjection(NpcProjection projection) {
        boolean selected = projection.selectedNpcIndex() >= 0;
        String encounterText = input.encounterAvailable()
                ? "Encounter-Aktion verfügbar."
                : "Encounter-Service nicht verfügbar.";
        return new StateProjection(
                WorldPlannerViewModel.NPCS,
                "NPCs",
                selected
                        ? projection.selectedNpcName() + " | " + projection.selectedStatblockLabel()
                        : "Kein NPC ausgewählt.",
                selected ? encounterText : "NPC anlegen oder einen NPC aus der Liste wählen.",
                new NpcEditor(
                        projection.selectedNpcName(),
                        projection.statblockLabels(),
                        projection.selectedStatblockLabel(),
                        projection.selectedAppearanceNotes(),
                        projection.selectedBehaviorNotes(),
                        projection.selectedHistoryNotes(),
                        projection.selectedGeneralNotes()),
                FactionEditor.empty(),
                LocationEditor.empty(),
                "");
    }

    private static StateProjection factionStateProjection(FactionProjection projection) {
        boolean selected = projection.selectedFactionIndex() >= 0;
        return new StateProjection(
                WorldPlannerViewModel.FACTIONS,
                "Fraktionen",
                selected
                        ? projection.selectedFactionName() + " | " + projection.selectedPrimaryTableLabel()
                        : "Keine Fraktion ausgewählt.",
                selected
                        ? "NPCs und Bestand werden hier bearbeitet."
                        : "Fraktion anlegen oder eine Fraktion wählen.",
                NpcEditor.empty(),
                new FactionEditor(
                        projection.selectedFactionName(),
                        projection.encounterTableLabels(),
                        projection.selectedPrimaryTableLabel(),
                        projection.npcReferenceLabels(),
                        projection.statblockLabels()),
                LocationEditor.empty(),
                "");
    }

    private static StateProjection locationStateProjection(LocationProjection projection) {
        boolean selected = projection.selectedLocationIndex() >= 0;
        return new StateProjection(
                WorldPlannerViewModel.LOCATIONS,
                "Locations",
                selected ? projection.selectedLocationName() : "Keine Location ausgewählt.",
                selected
                        ? "Fraktions- und Tabellenlinks werden hier bearbeitet."
                        : "Location anlegen oder eine Location wählen.",
                NpcEditor.empty(),
                FactionEditor.empty(),
                new LocationEditor(
                        projection.selectedLocationName(),
                        projection.factionReferenceLabels(),
                        projection.encounterTableLabels()),
                "");
    }
}

final class WorldPlannerProjectionData {
    private WorldPlannerProjectionData() {
    }

    static List<WorldNpcSummary> filteredNpcs(
            WorldPlannerSnapshot snapshot,
            String query,
            List<String> statusFilters,
            List<String> statblockFilters
    ) {
        String normalizedQuery = WorldPlannerVocabulary.normalized(query);
        return npcs(snapshot).stream()
                .filter(npc -> normalizedQuery.isBlank() || searchable(npc).contains(normalizedQuery))
                .filter(npc -> statusFilters.isEmpty() || statusFilters.contains(npc.status().name()))
                .filter(npc -> statblockFilters.isEmpty()
                        || statblockFilters.contains(WorldPlannerVocabulary.idKey(npc.creatureStatblockId())))
                .toList();
    }

    static List<WorldFactionSummary> filteredFactions(
            WorldPlannerSnapshot snapshot,
            String query,
            List<String> tableFilters,
            List<String> npcFilters,
            List<String> stockFilters
    ) {
        String normalizedQuery = WorldPlannerVocabulary.normalized(query);
        return factions(snapshot).stream()
                .filter(faction -> normalizedQuery.isBlank() || searchable(faction).contains(normalizedQuery))
                .filter(faction -> tableFilters.isEmpty()
                        || tableFilters.contains(WorldPlannerVocabulary.idKey(faction.primaryEncounterTableId())))
                .filter(faction -> npcFilters.isEmpty()
                        || faction.npcIds().stream()
                                .map(WorldPlannerVocabulary::idKey)
                                .anyMatch(npcFilters::contains))
                .filter(faction -> stockFilters.isEmpty() || stockMatches(faction, stockFilters))
                .toList();
    }

    static List<WorldLocationSummary> filteredLocations(
            WorldPlannerSnapshot snapshot,
            String query,
            List<String> factionFilters,
            List<String> tableFilters
    ) {
        String normalizedQuery = WorldPlannerVocabulary.normalized(query);
        return locations(snapshot).stream()
                .filter(location -> normalizedQuery.isBlank() || searchable(location).contains(normalizedQuery))
                .filter(location -> factionFilters.isEmpty()
                        || location.factionIds().stream()
                                .map(WorldPlannerVocabulary::idKey)
                                .anyMatch(factionFilters::contains))
                .filter(location -> tableFilters.isEmpty()
                        || location.encounterTableIds().stream()
                                .map(WorldPlannerVocabulary::idKey)
                                .anyMatch(tableFilters::contains))
                .toList();
    }

    static List<WorldNpcSummary> npcs(WorldPlannerSnapshot snapshot) {
        return snapshot == null ? List.of() : snapshot.npcs();
    }

    static List<WorldFactionSummary> factions(WorldPlannerSnapshot snapshot) {
        return snapshot == null ? List.of() : snapshot.factions();
    }

    static List<WorldLocationSummary> locations(WorldPlannerSnapshot snapshot) {
        return snapshot == null ? List.of() : snapshot.locations();
    }

    private static boolean stockMatches(WorldFactionSummary faction, List<String> stock) {
        boolean hasFinite = faction.inventoryLimits().stream().anyMatch(WorldFactionInventoryLimitSummary::finite);
        boolean hasUnlimited = faction.inventoryLimits().isEmpty()
                || faction.inventoryLimits().stream().anyMatch(limit -> !limit.finite());
        return stock.contains(WorldPlannerViewModel.FINITE_STOCK_KEY) && hasFinite
                || stock.contains(WorldPlannerViewModel.UNLIMITED_STOCK_KEY) && hasUnlimited;
    }

    private static String searchable(WorldNpcSummary npc) {
        return WorldPlannerVocabulary.normalized(npc.displayName()
                + " " + npc.status()
                + " " + npc.creatureStatblockId()
                + " " + npc.appearanceNotes()
                + " " + npc.behaviorNotes()
                + " " + npc.historyNotes()
                + " " + npc.generalNotes());
    }

    private static String searchable(WorldFactionSummary faction) {
        return WorldPlannerVocabulary.normalized(faction.displayName()
                + " " + faction.primaryEncounterTableId()
                + " " + faction.npcIds()
                + " " + faction.inventoryLimits());
    }

    private static String searchable(WorldLocationSummary location) {
        return WorldPlannerVocabulary.normalized(location.displayName()
                + " " + location.factionIds()
                + " " + location.encounterTableIds());
    }
}

final class WorldPlannerProjectionRows {
    private WorldPlannerProjectionRows() {
    }

    static String sourceSummary(WorldPlannerSnapshot snapshot) {
        long defeated = WorldPlannerProjectionData.npcs(snapshot).stream()
                .filter(npc -> npc.status() == WorldNpcLifecycleStatus.DEFEATED)
                .count();
        return "Factions " + WorldPlannerProjectionData.factions(snapshot).size()
                + " | Locations " + WorldPlannerProjectionData.locations(snapshot).size()
                + " | Defeated NPCs " + defeated;
    }

    static List<String> npcRows(List<WorldNpcSummary> npcs) {
        return npcs.stream()
                .map(npc -> npc.displayName()
                        + "    " + npc.status()
                        + "    #" + npc.creatureStatblockId())
                .toList();
    }

    static List<String> factionRows(List<WorldFactionSummary> factions) {
        return factions.stream()
                .map(faction -> faction.displayName()
                        + "    Tabelle #" + faction.primaryEncounterTableId()
                        + "    NPCs " + faction.npcIds().size())
                .toList();
    }

    static List<String> locationRows(List<WorldLocationSummary> locations) {
        return locations.stream()
                .map(location -> location.displayName()
                        + "    Fraktionen " + location.factionIds().size()
                        + "    Tabellen " + location.encounterTableIds().size())
                .toList();
    }

    static boolean sourceRowMatches(
            String row,
            List<String> typeFilters,
            String type,
            String normalizedQuery
    ) {
        return (typeFilters.isEmpty() || typeFilters.contains(type))
                && (normalizedQuery.isBlank() || WorldPlannerVocabulary.normalized(row).contains(normalizedQuery));
    }

    static String sourceFactionRow(WorldFactionSummary faction) {
        return "Faction: " + faction.displayName()
                + " | table #" + faction.primaryEncounterTableId()
                + " | NPCs " + faction.npcIds().size()
                + " | stock " + stock(faction.inventoryLimits());
    }

    static String sourceLocationRow(WorldLocationSummary location) {
        return "Location: " + location.displayName()
                + " | factions " + location.factionIds().size()
                + " | tables " + location.encounterTableIds().size();
    }

    private static String stock(List<WorldFactionInventoryLimitSummary> limits) {
        if (limits.isEmpty()) {
            return WorldPlannerViewModel.UNLIMITED_STOCK_KEY;
        }
        return limits.stream()
                .map(limit -> limit.finite()
                        ? "#" + limit.creatureStatblockId() + " x" + limit.quantity()
                        : "#" + limit.creatureStatblockId() + " " + WorldPlannerViewModel.UNLIMITED_STOCK_KEY)
                .toList()
                .toString();
    }
}

final class WorldPlannerProjectionLabels {
    enum NpcText {
        DISPLAY_NAME,
        APPEARANCE,
        BEHAVIOR,
        HISTORY,
        GENERAL
    }

    private WorldPlannerProjectionLabels() {
    }

    static String statblockLabel(List<WorldPlannerVocabulary.Option<Long>> statblockOptions, WorldNpcSummary npc) {
        if (npc == null) {
            return "";
        }
        return statblockOptions.stream()
                .filter(option -> option.value() == npc.creatureStatblockId())
                .map(WorldPlannerVocabulary.Option::label)
                .findFirst()
                .orElse("#" + npc.creatureStatblockId());
    }

    static String tableLabel(
            List<WorldPlannerVocabulary.Option<Long>> encounterTableOptions,
            WorldFactionSummary faction
    ) {
        if (faction == null) {
            return "";
        }
        return encounterTableOptions.stream()
                .filter(option -> option.value() == faction.primaryEncounterTableId())
                .map(WorldPlannerVocabulary.Option::label)
                .findFirst()
                .orElse("#" + faction.primaryEncounterTableId());
    }

    static String npcText(WorldNpcSummary selected, NpcText text) {
        if (selected == null) {
            return "";
        }
        return switch (text) {
            case DISPLAY_NAME -> selected.displayName();
            case APPEARANCE -> selected.appearanceNotes();
            case BEHAVIOR -> selected.behaviorNotes();
            case HISTORY -> selected.historyNotes();
            case GENERAL -> selected.generalNotes();
        };
    }

    static List<String> labels(List<WorldPlannerVocabulary.Option<Long>> options) {
        return options.stream().map(WorldPlannerVocabulary.Option::label).toList();
    }

    static List<String> values(Map<String, List<String>> filters, String key) {
        if (filters == null) {
            return List.of();
        }
        List<String> values = filters.get(key);
        return values == null ? List.of() : List.copyOf(values);
    }
}

final class WorldPlannerProjectionBuilder {
    private static final String LOCATION_SOURCE_TYPE = "location";

    private final WorldPlannerProjectionInput input;

    WorldPlannerProjectionBuilder(WorldPlannerProjectionInput input) {
        this.input = input;
    }

    NpcProjection npcProjection() {
        ModuleFilterState filters = filtersFor(WorldPlannerViewModel.NPCS);
        List<WorldNpcSummary> filtered = WorldPlannerProjectionData.filteredNpcs(
                input.snapshot(),
                filters.query(),
                WorldPlannerProjectionLabels.values(filters.filters(), WorldPlannerVocabulary.STATUS_FILTER),
                WorldPlannerProjectionLabels.values(filters.filters(), WorldPlannerVocabulary.STATBLOCK_FILTER));
        List<Long> ids = filtered.stream().map(WorldNpcSummary::npcId).toList();
        WorldNpcSummary selected = filtered.stream()
                .filter(npc -> npc.npcId() == input.selection().selectedNpcId())
                .findFirst()
                .orElse(null);
        return new NpcProjection(
                input.activeModuleIndex() == WorldPlannerViewModel.NPCS,
                ids,
                WorldPlannerProjectionRows.npcRows(filtered),
                WorldPlannerProjectionLabels.labels(input.options().statblockOptions()),
                WorldPlannerVocabulary.indexOf(ids, input.selection().selectedNpcId()),
                WorldPlannerProjectionLabels.npcText(selected, WorldPlannerProjectionLabels.NpcText.DISPLAY_NAME),
                WorldPlannerProjectionLabels.statblockLabel(input.options().statblockOptions(), selected),
                WorldPlannerProjectionLabels.npcText(selected, WorldPlannerProjectionLabels.NpcText.APPEARANCE),
                WorldPlannerProjectionLabels.npcText(selected, WorldPlannerProjectionLabels.NpcText.BEHAVIOR),
                WorldPlannerProjectionLabels.npcText(selected, WorldPlannerProjectionLabels.NpcText.HISTORY),
                WorldPlannerProjectionLabels.npcText(selected, WorldPlannerProjectionLabels.NpcText.GENERAL),
                ids.isEmpty() ? "Noch keine NPCs." : "");
    }

    FactionProjection factionProjection() {
        ModuleFilterState filters = filtersFor(WorldPlannerViewModel.FACTIONS);
        List<WorldFactionSummary> filtered = WorldPlannerProjectionData.filteredFactions(
                input.snapshot(),
                filters.query(),
                WorldPlannerProjectionLabels.values(filters.filters(), WorldPlannerVocabulary.TABLE_FILTER),
                WorldPlannerProjectionLabels.values(filters.filters(), WorldPlannerVocabulary.NPC_FILTER),
                WorldPlannerProjectionLabels.values(filters.filters(), WorldPlannerVocabulary.STOCK_FILTER));
        List<Long> ids = filtered.stream().map(WorldFactionSummary::factionId).toList();
        WorldFactionSummary selected = filtered.stream()
                .filter(faction -> faction.factionId() == input.selection().selectedFactionId())
                .findFirst()
                .orElse(null);
        return new FactionProjection(
                input.activeModuleIndex() == WorldPlannerViewModel.FACTIONS,
                ids,
                WorldPlannerProjectionRows.factionRows(filtered),
                WorldPlannerProjectionLabels.labels(input.options().encounterTableOptions()),
                WorldPlannerProjectionLabels.labels(input.options().npcReferenceOptions()),
                WorldPlannerProjectionLabels.labels(input.options().statblockOptions()),
                WorldPlannerVocabulary.indexOf(ids, input.selection().selectedFactionId()),
                selected == null ? "" : selected.displayName(),
                WorldPlannerProjectionLabels.tableLabel(input.options().encounterTableOptions(), selected),
                ids.isEmpty() ? "Noch keine Fraktionen." : "");
    }

    LocationProjection locationProjection() {
        ModuleFilterState filters = filtersFor(WorldPlannerViewModel.LOCATIONS);
        List<WorldLocationSummary> filtered = WorldPlannerProjectionData.filteredLocations(
                input.snapshot(),
                filters.query(),
                WorldPlannerProjectionLabels.values(filters.filters(), WorldPlannerVocabulary.FACTION_FILTER),
                WorldPlannerProjectionLabels.values(filters.filters(), WorldPlannerVocabulary.TABLE_FILTER));
        List<Long> ids = filtered.stream().map(WorldLocationSummary::locationId).toList();
        WorldLocationSummary selected = filtered.stream()
                .filter(location -> location.locationId() == input.selection().selectedLocationId())
                .findFirst()
                .orElse(null);
        return new LocationProjection(
                input.activeModuleIndex() == WorldPlannerViewModel.LOCATIONS,
                ids,
                WorldPlannerProjectionRows.locationRows(filtered),
                WorldPlannerProjectionLabels.labels(input.options().factionReferenceOptions()),
                WorldPlannerProjectionLabels.labels(input.options().encounterTableOptions()),
                WorldPlannerVocabulary.indexOf(ids, input.selection().selectedLocationId()),
                selected == null ? "" : selected.displayName(),
                ids.isEmpty() ? "Noch keine Locations." : "");
    }

    SourceProjection sourceProjection() {
        ModuleFilterState filters = filtersFor(WorldPlannerViewModel.SOURCES);
        if (input.snapshot() == null) {
            return new SourceProjection(
                    input.activeModuleIndex() == WorldPlannerViewModel.SOURCES,
                    List.of(),
                    "World Planner ist noch nicht geladen.");
        }
        List<String> typeFilters = WorldPlannerProjectionLabels.values(filters.filters(), WorldPlannerVocabulary.TYPE_FILTER);
        String normalizedQuery = WorldPlannerVocabulary.normalized(filters.query());
        List<String> factionRows = WorldPlannerProjectionData.factions(input.snapshot()).stream()
                .map(WorldPlannerProjectionRows::sourceFactionRow)
                .filter(row -> WorldPlannerProjectionRows.sourceRowMatches(row, typeFilters, WorldPlannerVocabulary.FACTION_FILTER, normalizedQuery))
                .toList();
        List<String> locationRows = WorldPlannerProjectionData.locations(input.snapshot()).stream()
                .map(WorldPlannerProjectionRows::sourceLocationRow)
                .filter(row -> WorldPlannerProjectionRows.sourceRowMatches(row, typeFilters, LOCATION_SOURCE_TYPE, normalizedQuery))
                .toList();
        List<String> rows = new ArrayList<>();
        rows.addAll(factionRows);
        rows.addAll(locationRows);
        return new SourceProjection(
                input.activeModuleIndex() == WorldPlannerViewModel.SOURCES,
                rows,
                WorldPlannerProjectionRows.sourceSummary(input.snapshot()));
    }

    private ModuleFilterState filtersFor(int moduleIndex) {
        return input.activeModuleIndex() == moduleIndex ? input.activeFilters() : ModuleFilterState.empty();
    }

}

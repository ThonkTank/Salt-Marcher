package src.view.leftbartabs.worldplanner;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldNpcSummary;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.view.slotcontent.controls.searchfilter.SearchFilterControlsContentModel;

final class WorldPlannerContributionModel {

    private static final int NPCS = 0;
    private static final int FACTIONS = 1;
    private static final int LOCATIONS = 2;
    private static final int SOURCES = 3;
    private final WorldPlannerControlsContentModel controlsContentModel;
    private final SearchFilterControlsContentModel searchFilterContentModel;
    private final WorldPlannerNpcMainContentModel npcMainContentModel;
    private final WorldPlannerFactionMainContentModel factionMainContentModel;
    private final WorldPlannerLocationMainContentModel locationMainContentModel;
    private final WorldPlannerSourceMainContentModel sourceMainContentModel;
    private final WorldPlannerStateContentModel stateContentModel;
    private final Map<Integer, ModuleFilterState> filterStates = new HashMap<>();
    private int activeModuleIndex = NPCS;
    private boolean encounterAvailable;

    WorldPlannerContributionModel(
            WorldPlannerControlsContentModel controlsContentModel,
            SearchFilterControlsContentModel searchFilterContentModel,
            WorldPlannerNpcMainContentModel npcMainContentModel,
            WorldPlannerFactionMainContentModel factionMainContentModel,
            WorldPlannerLocationMainContentModel locationMainContentModel,
            WorldPlannerSourceMainContentModel sourceMainContentModel,
            WorldPlannerStateContentModel stateContentModel
    ) {
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
        this.searchFilterContentModel = Objects.requireNonNull(searchFilterContentModel, "searchFilterContentModel");
        this.npcMainContentModel = Objects.requireNonNull(npcMainContentModel, "npcMainContentModel");
        this.factionMainContentModel = Objects.requireNonNull(factionMainContentModel, "factionMainContentModel");
        this.locationMainContentModel = Objects.requireNonNull(locationMainContentModel, "locationMainContentModel");
        this.sourceMainContentModel = Objects.requireNonNull(sourceMainContentModel, "sourceMainContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
        updateActiveModules();
        applyCurrentFilter();
    }

    void setEncounterAvailable(boolean nextEncounterAvailable) {
        encounterAvailable = nextEncounterAvailable;
        refreshStateAndDetail();
    }

    void activate(int moduleIndex) {
        activeModuleIndex = normalizedModule(moduleIndex);
        controlsContentModel.activate(activeModuleIndex);
        updateActiveModules();
        applyCurrentFilter();
        refreshStateAndDetail();
    }

    void applySnapshot(WorldPlannerSnapshot nextSnapshot) {
        controlsContentModel.applySnapshot(nextSnapshot);
        npcMainContentModel.applySnapshot(nextSnapshot);
        factionMainContentModel.applySnapshot(nextSnapshot);
        locationMainContentModel.applySnapshot(nextSnapshot);
        sourceMainContentModel.applySnapshot(nextSnapshot);
        applyCurrentFilter();
        refreshStateAndDetail();
    }

    void applyCreatureCatalog(CreatureCatalogPageResult result) {
        npcMainContentModel.applyCreatureCatalog(result);
        factionMainContentModel.applyCreatureCatalog(result);
        applyCurrentFilter();
    }

    void applyEncounterTables(EncounterTableCatalogResult result) {
        factionMainContentModel.applyEncounterTables(result);
        locationMainContentModel.applyEncounterTables(result);
        applyCurrentFilter();
    }

    void applySearchFilters(String query, Map<String, List<String>> filters) {
        filterStates.put(activeModuleIndex, new ModuleFilterState(query, filters));
        applyCurrentFilter();
        refreshStateAndDetail();
    }

    void selectNpc(int index) {
        npcMainContentModel.select(index);
        refreshStateAndDetail();
    }

    void selectFaction(int index) {
        factionMainContentModel.select(index);
        refreshStateAndDetail();
    }

    void selectLocation(int index) {
        locationMainContentModel.select(index);
        refreshStateAndDetail();
    }

    long selectedNpcId() {
        return npcMainContentModel.selectedNpcId();
    }

    long npcStatblockChoiceId(int choiceIndex) {
        return npcMainContentModel.statblockChoiceId(choiceIndex);
    }

    long selectedNpcStatblockId() {
        return npcMainContentModel.selectedNpcStatblockId();
    }

    long selectedFactionId() {
        return factionMainContentModel.selectedFactionId();
    }

    long selectedLocationId() {
        return locationMainContentModel.selectedLocationId();
    }

    long factionPrimaryTableChoiceId(int choiceIndex) {
        return factionMainContentModel.encounterTableChoiceId(choiceIndex);
    }

    long factionNpcChoiceId(int choiceIndex) {
        return factionMainContentModel.npcReferenceChoiceId(choiceIndex);
    }

    long factionStatblockChoiceId(int choiceIndex) {
        return factionMainContentModel.statblockChoiceId(choiceIndex);
    }

    long locationFactionChoiceId(int choiceIndex) {
        return locationMainContentModel.factionReferenceChoiceId(choiceIndex);
    }

    long locationTableChoiceId(int choiceIndex) {
        return locationMainContentModel.encounterTableChoiceId(choiceIndex);
    }

    String detailTitle() {
        if (activeModuleIndex == FACTIONS) {
            return "Fraktion";
        }
        if (activeModuleIndex == LOCATIONS) {
            return "Location";
        }
        if (activeModuleIndex == SOURCES) {
            return "Encounter Sources";
        }
        return "NPC";
    }

    String detailKey() {
        if (activeModuleIndex == FACTIONS) {
            WorldFactionSummary faction = factionMainContentModel.selectedFaction();
            return faction == null ? "" : "world-planner:faction:" + faction.factionId();
        }
        if (activeModuleIndex == LOCATIONS) {
            WorldLocationSummary location = locationMainContentModel.selectedLocation();
            return location == null ? "" : "world-planner:location:" + location.locationId();
        }
        if (activeModuleIndex == SOURCES) {
            return "world-planner:sources";
        }
        WorldNpcSummary npc = npcMainContentModel.selectedNpc();
        return npc == null ? "" : "world-planner:npc:" + npc.npcId();
    }

    WorldPlannerDetailContentModel.Projection detailProjection() {
        if (activeModuleIndex == FACTIONS) {
            return WorldPlannerDetailContentModel.Projection.faction(factionMainContentModel.selectedFaction());
        }
        if (activeModuleIndex == LOCATIONS) {
            return WorldPlannerDetailContentModel.Projection.location(locationMainContentModel.selectedLocation());
        }
        if (activeModuleIndex == SOURCES) {
            WorldPlannerSourceMainContentModel.Projection projection =
                    sourceMainContentModel.projectionProperty().get();
            return WorldPlannerDetailContentModel.Projection.sources(projection.summary(), projection.rows());
        }
        return WorldPlannerDetailContentModel.Projection.npc(npcMainContentModel.selectedNpc());
    }

    private void updateActiveModules() {
        npcMainContentModel.setActive(activeModuleIndex == NPCS);
        factionMainContentModel.setActive(activeModuleIndex == FACTIONS);
        locationMainContentModel.setActive(activeModuleIndex == LOCATIONS);
        sourceMainContentModel.setActive(activeModuleIndex == SOURCES);
        refreshSearchProjection();
    }

    private void refreshStateAndDetail() {
        if (activeModuleIndex == NPCS) {
            applyNpcState();
        } else if (activeModuleIndex == FACTIONS) {
            applyFactionState();
        } else if (activeModuleIndex == LOCATIONS) {
            applyLocationState();
        } else {
            applySourceState();
        }
    }

    private void applyNpcState() {
        WorldPlannerNpcMainContentModel.StateProjection state =
                npcMainContentModel.stateProjection(encounterAvailable);
        WorldPlannerNpcMainContentModel.NpcEditor npc = state.npc();
        stateContentModel.applyProjection(new WorldPlannerStateContentModel.Projection(
                NPCS,
                "NPCs",
                state.statusText(),
                state.nextActionText(),
                new WorldPlannerStateContentModel.NpcEditor(
                        npc.displayName(),
                        npc.statblockLabels(),
                        npc.selectedStatblockLabel(),
                        npc.appearanceNotes(),
                        npc.behaviorNotes(),
                        npc.historyNotes(),
                        npc.generalNotes()),
                WorldPlannerStateContentModel.FactionEditor.empty(),
                WorldPlannerStateContentModel.LocationEditor.empty(),
                ""));
    }

    private void applyFactionState() {
        WorldPlannerFactionMainContentModel.StateProjection state =
                factionMainContentModel.stateProjection();
        WorldPlannerFactionMainContentModel.FactionEditor faction = state.faction();
        stateContentModel.applyProjection(new WorldPlannerStateContentModel.Projection(
                FACTIONS,
                "Fraktionen",
                state.statusText(),
                state.nextActionText(),
                WorldPlannerStateContentModel.NpcEditor.empty(),
                new WorldPlannerStateContentModel.FactionEditor(
                        faction.displayName(),
                        faction.encounterTableLabels(),
                        faction.selectedPrimaryTableLabel(),
                        faction.npcReferenceLabels(),
                        faction.statblockLabels()),
                WorldPlannerStateContentModel.LocationEditor.empty(),
                ""));
    }

    private void applyLocationState() {
        WorldPlannerLocationMainContentModel.StateProjection state =
                locationMainContentModel.stateProjection();
        WorldPlannerLocationMainContentModel.LocationEditor location = state.location();
        stateContentModel.applyProjection(new WorldPlannerStateContentModel.Projection(
                LOCATIONS,
                "Locations",
                state.statusText(),
                state.nextActionText(),
                WorldPlannerStateContentModel.NpcEditor.empty(),
                WorldPlannerStateContentModel.FactionEditor.empty(),
                new WorldPlannerStateContentModel.LocationEditor(
                        location.displayName(),
                        location.factionReferenceLabels(),
                        location.encounterTableLabels()),
                ""));
    }

    private void applySourceState() {
        stateContentModel.applyProjection(WorldPlannerStateContentModel.Projection.sources(
                sourceMainContentModel.stateSummary()));
    }

    private void applyCurrentFilter() {
        ModuleFilterState state = activeFilterState();
        if (activeModuleIndex == NPCS) {
            npcMainContentModel.applyFilters(state.query(), state.filters());
        } else if (activeModuleIndex == FACTIONS) {
            factionMainContentModel.applyFilters(state.query(), state.filters());
        } else if (activeModuleIndex == LOCATIONS) {
            locationMainContentModel.applyFilters(state.query(), state.filters());
        } else {
            sourceMainContentModel.applyFilters(state.query(), state.filters());
        }
        refreshSearchProjection();
    }

    private void refreshSearchProjection() {
        ModuleFilterState state = activeFilterState();
        if (activeModuleIndex == FACTIONS) {
            applySearchProjection("Fraktionen suchen", state.query(), factionFilterGroups(state.filters()));
        } else if (activeModuleIndex == LOCATIONS) {
            applySearchProjection("Locations suchen", state.query(), locationFilterGroups(state.filters()));
        } else if (activeModuleIndex == SOURCES) {
            applySearchProjection("Quellen suchen", state.query(), sourceFilterGroups(state.filters()));
        } else {
            applySearchProjection("NPCs suchen", state.query(), npcFilterGroups(state.filters()));
        }
    }

    private void applySearchProjection(
            String searchPrompt,
            String searchQuery,
            List<SearchFilterControlsContentModel.FilterGroup> groups
    ) {
        searchFilterContentModel.applyProjection(new SearchFilterControlsContentModel.Projection(
                searchPrompt,
                searchQuery,
                groups,
                filterChips(groups)));
    }

    private List<SearchFilterControlsContentModel.FilterGroup> npcFilterGroups(
            Map<String, List<String>> filters
    ) {
        List<SearchFilterControlsContentModel.FilterOption> statblocks = npcMainContentModel.projectionProperty()
                .get()
                .statblockLabels()
                .stream()
                .map(label -> option(idKey(label), label, selected(filters, "statblock", idKey(label))))
                .toList();
        return List.of(
                group("status", "Status", List.of(
                        option("ACTIVE", "Aktiv", selected(filters, "status", "ACTIVE")),
                        option("DEFEATED", "Besiegt", selected(filters, "status", "DEFEATED")))),
                group("statblock", "Statblock", statblocks));
    }

    private List<SearchFilterControlsContentModel.FilterGroup> factionFilterGroups(
            Map<String, List<String>> filters
    ) {
        WorldPlannerFactionMainContentModel.Projection current = factionMainContentModel.projectionProperty().get();
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

    private List<SearchFilterControlsContentModel.FilterGroup> locationFilterGroups(
            Map<String, List<String>> filters
    ) {
        WorldPlannerLocationMainContentModel.Projection current = locationMainContentModel.projectionProperty().get();
        return List.of(
                group("faction", "Fraktion", current.factionReferenceLabels().stream()
                        .map(label -> option(idKey(label), label, selected(filters, "faction", idKey(label))))
                        .toList()),
                group("table", "Tabelle", current.encounterTableLabels().stream()
                        .map(label -> option(idKey(label), label, selected(filters, "table", idKey(label))))
                        .toList()));
    }

    private static List<SearchFilterControlsContentModel.FilterGroup> sourceFilterGroups(
            Map<String, List<String>> filters
    ) {
        return List.of(
                group("type", "Typ", List.of(
                        option("faction", "Faction", selected(filters, "type", "faction")),
                        option("location", "Location", selected(filters, "type", "location")))));
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

    private static SearchFilterControlsContentModel.FilterGroup group(
            String key,
            String label,
            List<SearchFilterControlsContentModel.FilterOption> options
    ) {
        return new SearchFilterControlsContentModel.FilterGroup(key, label, options);
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

    private static String idKey(String label) {
        if (label == null || !label.startsWith("#")) {
            return "";
        }
        int end = label.indexOf(' ');
        return end > 1 ? label.substring(1, end) : label.substring(1);
    }

    private ModuleFilterState activeFilterState() {
        return filterStates.getOrDefault(activeModuleIndex, ModuleFilterState.empty());
    }

    private static int normalizedModule(int moduleIndex) {
        return Math.max(NPCS, Math.min(SOURCES, moduleIndex));
    }

    private record ModuleFilterState(String query, Map<String, List<String>> filters) {

        ModuleFilterState {
            query = query == null ? "" : query;
            filters = copy(filters);
        }

        static ModuleFilterState empty() {
            return new ModuleFilterState("", Map.of());
        }

        private static Map<String, List<String>> copy(Map<String, List<String>> source) {
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
}

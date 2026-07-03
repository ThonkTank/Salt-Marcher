package src.view.leftbartabs.worldplanner;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.domain.worldplanner.published.AddWorldFactionNpcCommand;
import src.domain.worldplanner.published.AddWorldLocationEncounterTableCommand;
import src.domain.worldplanner.published.AddWorldLocationFactionCommand;
import src.domain.worldplanner.published.CreateWorldFactionCommand;
import src.domain.worldplanner.published.CreateWorldLocationCommand;
import src.domain.worldplanner.published.CreateWorldNpcCommand;
import src.domain.worldplanner.published.RefreshWorldPlannerCommand;
import src.domain.worldplanner.published.SetWorldFactionInventoryLimitCommand;
import src.domain.worldplanner.published.SetWorldNpcLifecycleStatusCommand;
import src.domain.worldplanner.published.UpdateWorldNpcNotesCommand;
import src.view.slotcontent.controls.searchfilter.SearchFilterControlsViewInputEvent;

final class WorldPlannerIntentHandler {

    private static final String EVENT = "event";
    private static final int NPCS = 0;
    private static final int FACTIONS = 1;
    private static final int LOCATIONS = 2;

    private final WorldPlannerApplicationService worldPlanner;
    private final @Nullable EncounterApplicationService encounter;
    private final WorldPlannerContributionModel contributionModel;
    private final Runnable detailOpener;

    WorldPlannerIntentHandler(
            WorldPlannerApplicationService worldPlanner,
            @Nullable EncounterApplicationService encounter,
            WorldPlannerContributionModel contributionModel,
            Runnable detailOpener
    ) {
        this.worldPlanner = Objects.requireNonNull(worldPlanner, "worldPlanner");
        this.encounter = encounter;
        this.contributionModel = Objects.requireNonNull(contributionModel, "contributionModel");
        this.detailOpener = Objects.requireNonNull(detailOpener, "detailOpener");
    }

    void consume(WorldPlannerControlsViewInputEvent event) {
        WorldPlannerControlsViewInputEvent safeEvent = Objects.requireNonNull(event, EVENT);
        contributionModel.activate(safeEvent.selectedModuleIndex());
        if (safeEvent.refreshRequested()) {
            worldPlanner.refresh(new RefreshWorldPlannerCommand());
        }
        detailOpener.run();
    }

    void consume(WorldPlannerNpcMainViewInputEvent event) {
        WorldPlannerNpcMainViewInputEvent safeEvent = Objects.requireNonNull(event, EVENT);
        contributionModel.selectNpc(safeEvent.selectedNpcIndex());
        detailOpener.run();
    }

    void consume(WorldPlannerFactionMainViewInputEvent event) {
        WorldPlannerFactionMainViewInputEvent safeEvent = Objects.requireNonNull(event, EVENT);
        contributionModel.selectFaction(safeEvent.selectedFactionIndex());
        detailOpener.run();
    }

    void consume(WorldPlannerLocationMainViewInputEvent event) {
        WorldPlannerLocationMainViewInputEvent safeEvent = Objects.requireNonNull(event, EVENT);
        contributionModel.selectLocation(safeEvent.selectedLocationIndex());
        detailOpener.run();
    }

    void consume(SearchFilterControlsViewInputEvent event) {
        SearchFilterControlsViewInputEvent safeEvent = Objects.requireNonNull(event, EVENT);
        contributionModel.applySearchFilters(safeEvent.searchQuery(), selectedFiltersByGroup(safeEvent));
        detailOpener.run();
    }

    void consume(WorldPlannerStateViewInputEvent event) {
        WorldPlannerStateViewInputEvent safeEvent = Objects.requireNonNull(event, EVENT);
        WorldPlannerStateViewInputEvent.ActionSnapshot actions = safeEvent.actions();
        if (safeEvent.activeModuleIndex() == NPCS) {
            consumeNpcState(safeEvent.npc(), actions);
        } else if (safeEvent.activeModuleIndex() == FACTIONS) {
            consumeFactionState(safeEvent.faction(), actions);
        } else if (safeEvent.activeModuleIndex() == LOCATIONS) {
            consumeLocationState(safeEvent.location(), actions);
        }
        detailOpener.run();
    }

    private void consumeNpcState(
            WorldPlannerStateViewInputEvent.NpcSnapshot snapshot,
            WorldPlannerStateViewInputEvent.ActionSnapshot actions
    ) {
        if (actions.createRequested()) {
            createNpc(snapshot);
        } else if (actions.saveNotesRequested()) {
            updateNpcNotes(snapshot);
        } else if (actions.defeatRequested()) {
            defeatNpc();
        } else if (actions.reactivateRequested()) {
            reactivateNpc();
        } else if (actions.addToEncounterRequested()) {
            addNpcToEncounter();
        }
    }

    private void consumeFactionState(
            WorldPlannerStateViewInputEvent.FactionSnapshot snapshot,
            WorldPlannerStateViewInputEvent.ActionSnapshot actions
    ) {
        if (actions.createRequested()) {
            createFaction(snapshot);
        } else if (actions.addNpcRequested()) {
            addFactionNpc(snapshot);
        } else if (actions.setInventoryLimitRequested()) {
            setInventoryLimit(snapshot);
        }
    }

    private void consumeLocationState(
            WorldPlannerStateViewInputEvent.LocationSnapshot snapshot,
            WorldPlannerStateViewInputEvent.ActionSnapshot actions
    ) {
        if (actions.createRequested()) {
            createLocation(snapshot);
        } else if (actions.linkFactionRequested()) {
            addLocationFaction(snapshot);
        } else if (actions.linkTableRequested()) {
            addLocationEncounterTable(snapshot);
        }
    }

    private void createNpc(WorldPlannerStateViewInputEvent.NpcSnapshot event) {
        worldPlanner.createNpc(new CreateWorldNpcCommand(
                event.displayName(),
                contributionModel.npcStatblockChoiceId(event.statblockChoiceIndex()),
                event.appearanceNotes(),
                event.behaviorNotes(),
                event.historyNotes(),
                event.generalNotes()));
    }

    private void updateNpcNotes(WorldPlannerStateViewInputEvent.NpcSnapshot event) {
        worldPlanner.updateNpcNotes(new UpdateWorldNpcNotesCommand(
                contributionModel.selectedNpcId(),
                event.appearanceNotes(),
                event.behaviorNotes(),
                event.historyNotes(),
                event.generalNotes()));
    }

    private void defeatNpc() {
        worldPlanner.setNpcLifecycleStatus(
                SetWorldNpcLifecycleStatusCommand.defeated(contributionModel.selectedNpcId()));
    }

    private void reactivateNpc() {
        worldPlanner.setNpcLifecycleStatus(
                SetWorldNpcLifecycleStatusCommand.active(contributionModel.selectedNpcId()));
    }

    private void addNpcToEncounter() {
        long statblockId = contributionModel.selectedNpcStatblockId();
        long npcId = contributionModel.selectedNpcId();
        EncounterApplicationService service = encounter;
        if (service != null && statblockId > 0L && npcId > 0L) {
            service.applyState(ApplyEncounterStateCommand.worldNpc("ADD_CREATURE", statblockId, npcId));
        }
    }

    private void createFaction(WorldPlannerStateViewInputEvent.FactionSnapshot event) {
        worldPlanner.createFaction(new CreateWorldFactionCommand(
                event.displayName(),
                "",
                contributionModel.factionPrimaryTableChoiceId(event.primaryEncounterTableChoiceIndex())));
    }

    private void addFactionNpc(WorldPlannerStateViewInputEvent.FactionSnapshot event) {
        worldPlanner.addFactionNpc(new AddWorldFactionNpcCommand(
                contributionModel.selectedFactionId(),
                contributionModel.factionNpcChoiceId(event.npcChoiceIndex())));
    }

    private void setInventoryLimit(WorldPlannerStateViewInputEvent.FactionSnapshot event) {
        worldPlanner.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(
                contributionModel.selectedFactionId(),
                contributionModel.factionStatblockChoiceId(event.inventoryStatblockChoiceIndex()),
                event.finiteInventory(),
                parseQuantity(event.inventoryQuantityText())));
    }

    private void createLocation(WorldPlannerStateViewInputEvent.LocationSnapshot event) {
        worldPlanner.createLocation(new CreateWorldLocationCommand(event.displayName(), ""));
    }

    private void addLocationFaction(WorldPlannerStateViewInputEvent.LocationSnapshot event) {
        worldPlanner.addLocationFaction(new AddWorldLocationFactionCommand(
                contributionModel.selectedLocationId(),
                contributionModel.locationFactionChoiceId(event.factionChoiceIndex())));
    }

    private void addLocationEncounterTable(WorldPlannerStateViewInputEvent.LocationSnapshot event) {
        worldPlanner.addLocationEncounterTable(new AddWorldLocationEncounterTableCommand(
                contributionModel.selectedLocationId(),
                contributionModel.locationTableChoiceId(event.encounterTableChoiceIndex())));
    }

    private static Map<String, List<String>> selectedFiltersByGroup(SearchFilterControlsViewInputEvent event) {
        Map<String, List<String>> filters = new HashMap<>();
        for (SearchFilterControlsViewInputEvent.SelectedFilter selected : event.selectedFilters()) {
            filters.computeIfAbsent(selected.groupKey(), ignored -> new ArrayList<>()).add(selected.optionKey());
        }
        return filters;
    }

    private static int parseQuantity(String value) {
        try {
            return Math.max(0, Integer.parseInt(value == null ? "" : value.trim()));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }
}

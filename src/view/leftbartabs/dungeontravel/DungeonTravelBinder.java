package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonSurfaceKind;
import src.domain.dungeon.published.LoadDungeonSurfaceQuery;
import src.domain.dungeon.published.MoveDungeonSurfaceActionCommand;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.LoadActivePartyQuery;
import src.domain.party.published.LoadPartyTravelPositionsQuery;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionSnapshot;
import src.domain.party.published.PartyTravelPositionsResult;
import src.view.slotcontent.main.dungeonmap.DungeonMapPresentationModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import src.view.slotcontent.controls.dungeoncontrol.DungeonLevelOverlayControlsView;

final class DungeonTravelBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonTravelBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonApplicationService dungeon = runtimeContext.services().require(DungeonApplicationService.class);
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        DungeonTravelPresentationModel presentationModel = new DungeonTravelPresentationModel();
        DungeonMapPresentationModel mapPresentationModel = new DungeonMapPresentationModel("Travel workspace", false);
        DungeonTravelIntentHandler intentHandler = new DungeonTravelIntentHandler(presentationModel);
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        bindTravelRequests(dungeon, party, presentationModel, mapPresentationModel, intentHandler);
        main.bind(mapPresentationModel);
        state.stateTextProperty().bind(presentationModel.stateProperty());
        controls.onRefresh(intentHandler::refresh);
        controls.onResetView(main::resetCamera);
        controls.onPreviousLevel(intentHandler::previousLevel);
        controls.onNextLevel(intentHandler::nextLevel);
        controls.levelOverlayControls().setOnModeChanged(
                mode -> intentHandler.selectOverlayMode(toDisplayOverlayMode(mode).name()));
        controls.levelOverlayControls().setOnRangeChanged(intentHandler::selectOverlayRange);
        controls.levelOverlayControls().setOnOpacityChanged(intentHandler::selectOverlayOpacity);
        controls.levelOverlayControls().setOnSelectedLevelsChanged(intentHandler::selectOverlayLevels);
        main.onViewportChanged(() -> controls.showZoom(main.zoom()));
        state.onActionSelected(intentHandler::performAction);
        presentationModel.actionsProperty().addListener((ignored, before, after) -> state.showActions(toActionItems(after)));
        presentationModel.overlaySettingsProperty().addListener((ignored, before, after) -> {
            mapPresentationModel.showOverlaySettings(after);
            controls.showOverlaySettings(toControlsOverlaySettings(after), false);
        });
        presentationModel.projectionLevelProperty().addListener((ignored, before, after) -> {
            mapPresentationModel.showProjectionLevel(after.intValue());
            controls.showLevels(after.intValue(), false, true);
        });
        presentationModel.mapNameProperty().addListener((ignored, before, after) -> controls.showMapName(after));
        mapPresentationModel.showOverlaySettings(presentationModel.overlaySettingsProperty().get());
        mapPresentationModel.showProjectionLevel(presentationModel.projectionLevelProperty().get());
        controls.showOverlaySettings(toControlsOverlaySettings(presentationModel.overlaySettingsProperty().get()), false);
        controls.showLevels(presentationModel.projectionLevelProperty().get(), false, true);
        controls.showMapName(presentationModel.mapNameProperty().get());
        controls.showZoom(main.zoom());
        state.showActions(toActionItems(presentationModel.actionsProperty().get()));
        intentHandler.refresh();
        return new Binding(controls, main, state);
    }

    private static void bindTravelRequests(
            DungeonApplicationService dungeon,
            PartyApplicationService party,
            DungeonTravelPresentationModel presentationModel,
            DungeonMapPresentationModel mapPresentationModel,
            DungeonTravelIntentHandler intentHandler
    ) {
        intentHandler.onRefreshRequested(() -> {
            ActiveTravelSnapshot activeTravel = loadActiveTravelState(party);
            if (activeTravel.partyLocation() instanceof src.domain.party.published.PartyOverworldTravelLocationSnapshot overworld) {
                presentationModel.applyOutsideDungeonState(
                        "Position: Overworld-Feld " + overworld.tileId() + "\n"
                                + "Tile: -\n"
                                + "Heading: -\n"
                                + "Status: Gruppe befindet sich ausserhalb des Dungeons\n"
                                + presentationModel.overlaySettingsProperty().get().mode().label(),
                        activeTravel.attachedCharacterIds());
                mapPresentationModel.showSurface(null);
                mapPresentationModel.showPartyToken(null);
                return;
            }
            src.domain.dungeon.published.DungeonTravelPosition position =
                    DungeonTravelPresentationModel.toDungeonPosition(activeTravel.partyLocation());
            src.domain.dungeon.published.DungeonSurfacePayload surface = dungeon.loadSurface(new LoadDungeonSurfaceQuery(
                    position == null ? null : position.mapId(),
                    DungeonSurfaceKind.TRAVEL,
                    src.domain.dungeon.published.DungeonTopologyElementRef.empty(),
                    0L,
                    false,
                    position));
            List<Long> partyTokenCharacterIds = activeTravel.attachedCharacterIds();
            if (position == null
                    && !activeTravel.activeCharacterIds().isEmpty()
                    && surface.travel() != null) {
                partyTokenCharacterIds = activeTravel.activeCharacterIds();
                saveDungeonPosition(party, surface.travel().position(), partyTokenCharacterIds);
            }
            presentationModel.applySurfaceState(surface, partyTokenCharacterIds);
            mapPresentationModel.showSurface(surface);
            mapPresentationModel.showPartyToken(presentationModel.currentPartyToken());
            mapPresentationModel.showProjectionLevel(presentationModel.projectionLevelProperty().get());
        });
        intentHandler.onActionRequested(actionId -> {
            src.domain.dungeon.published.DungeonTravelPosition currentPosition = presentationModel.currentPosition();
            List<Long> characterIds = presentationModel.partyTokenCharacterIds();
            src.domain.dungeon.published.DungeonSurfacePayload result = dungeon.moveSurfaceAction(
                    new MoveDungeonSurfaceActionCommand(currentPosition, actionId));
            src.domain.dungeon.published.DungeonSurfaceTravel resultTravel = result.travel();
            if (resultTravel != null
                    && resultTravel.moveStatus() == src.domain.dungeon.published.DungeonTravelMoveStatus.EXTERNAL_TARGET
                    && resultTravel.externalTarget() instanceof src.domain.dungeon.published.DungeonTravelExternalTarget.OverworldTile overworld) {
                boolean saved = saveOverworldPosition(party, overworld, characterIds);
                presentationModel.applyOutsideDungeonState(
                        (saved
                                ? "Position: Overworld-Feld " + overworld.tileId()
                                : "Position: Unbekannt")
                                + "\nTile: -\nHeading: -\nStatus: "
                                + (saved
                                ? resultTravel.statusLabel()
                                : "Overworld-Ziel konnte nicht gespeichert werden")
                                + "\n"
                                + presentationModel.overlaySettingsProperty().get().mode().label(),
                        characterIds);
                mapPresentationModel.showSurface(null);
                mapPresentationModel.showPartyToken(null);
                return;
            }
            if (resultTravel != null
                    && resultTravel.moveStatus() == src.domain.dungeon.published.DungeonTravelMoveStatus.SUCCESS) {
                saveDungeonPosition(party, resultTravel.position(), characterIds);
            }
            presentationModel.applySurfaceState(result, characterIds);
            mapPresentationModel.showSurface(result);
            mapPresentationModel.showPartyToken(presentationModel.currentPartyToken());
            mapPresentationModel.showProjectionLevel(presentationModel.projectionLevelProperty().get());
        });
    }

    private static ActiveTravelSnapshot loadActiveTravelState(PartyApplicationService party) {
        ActivePartyResult activeParty = party.loadActiveParty(new LoadActivePartyQuery());
        List<Long> activeIds = activeParty.status() == src.domain.party.published.ReadStatus.SUCCESS
                ? activeParty.members().stream()
                .map(PartyMemberSummary::id)
                .filter(id -> id != null && id > 0L)
                .toList()
                : List.of();
        PartyTravelPositionsResult travel = party.loadTravelPositions(new LoadPartyTravelPositionsQuery(activeIds));
        List<Long> attachedIds = travel.status() == src.domain.party.published.ReadStatus.SUCCESS
                ? attachedCharacterIds(travel.positions(), activeIds)
                : activeIds;
        return new ActiveTravelSnapshot(activeIds, attachedIds, travel.partyTokenLocation());
    }

    private static List<Long> attachedCharacterIds(
            List<PartyTravelPositionSnapshot> positions,
            List<Long> fallbackIds
    ) {
        List<Long> result = (positions == null ? List.<PartyTravelPositionSnapshot>of() : positions).stream()
                .filter(PartyTravelPositionSnapshot::attachedToPartyToken)
                .map(PartyTravelPositionSnapshot::characterId)
                .toList();
        return result.isEmpty() ? fallbackIds : result;
    }

    private static void saveDungeonPosition(
            PartyApplicationService party,
            src.domain.dungeon.published.DungeonTravelPosition position,
            List<Long> characterIds
    ) {
        if (position == null || characterIds == null || characterIds.isEmpty()) {
            return;
        }
        party.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new src.domain.party.published.PartyDungeonTravelLocationSnapshot(
                        position.mapId().value(),
                        DungeonTravelPresentationModel.toPartyDungeonLocationKind(position),
                        position.ownerId(),
                        new src.domain.party.published.PartyTravelTile(
                                position.tile().q(),
                                position.tile().r(),
                                position.tile().level()),
                        src.domain.party.published.PartyTravelHeading.valueOf(position.heading().name())),
                true));
    }

    private static boolean saveOverworldPosition(
            PartyApplicationService party,
            src.domain.dungeon.published.DungeonTravelExternalTarget.OverworldTile target,
            List<Long> characterIds
    ) {
        if (target == null || characterIds == null || characterIds.isEmpty()) {
            return false;
        }
        return party.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new src.domain.party.published.PartyOverworldTravelLocationSnapshot(target.mapId(), target.tileId()),
                true)).status() == MutationStatus.SUCCESS;
    }

    private record ActiveTravelSnapshot(
            List<Long> activeCharacterIds,
            List<Long> attachedCharacterIds,
            @org.jspecify.annotations.Nullable PartyTravelLocationSnapshot partyLocation
    ) {
        private ActiveTravelSnapshot {
            activeCharacterIds = activeCharacterIds == null ? List.of() : List.copyOf(activeCharacterIds);
            attachedCharacterIds = attachedCharacterIds == null ? List.of() : List.copyOf(attachedCharacterIds);
        }
    }

    private static java.util.List<DungeonTravelStateView.ActionItem> toActionItems(
            java.util.List<src.domain.dungeon.published.DungeonTravelActionSnapshot> actions
    ) {
        return (actions == null ? java.util.List.<src.domain.dungeon.published.DungeonTravelActionSnapshot>of() : actions)
                .stream()
                .map(action -> new DungeonTravelStateView.ActionItem(
                        action.actionId(),
                        action.displayLabel(),
                        action.description()))
                .toList();
    }

    private static DungeonMapPresentationModel.RenderState.OverlayMode toDisplayOverlayMode(DungeonLevelOverlayControlsView.Mode overlayMode) {
        return switch (overlayMode == null ? DungeonLevelOverlayControlsView.Mode.OFF : overlayMode) {
            case OFF -> DungeonMapPresentationModel.RenderState.OverlayMode.OFF;
            case NEARBY -> DungeonMapPresentationModel.RenderState.OverlayMode.NEARBY;
            case SELECTED -> DungeonMapPresentationModel.RenderState.OverlayMode.SELECTED;
        };
    }

    private static DungeonLevelOverlayControlsView.Settings toControlsOverlaySettings(
            DungeonMapPresentationModel.RenderState.LevelOverlaySettings settings
    ) {
        DungeonMapPresentationModel.RenderState.LevelOverlaySettings resolved = settings == null
                ? DungeonMapPresentationModel.RenderState.LevelOverlaySettings.off()
                : settings;
        return new DungeonLevelOverlayControlsView.Settings(
                toControlsOverlayMode(resolved.mode()),
                resolved.levelRange(),
                resolved.opacity(),
                resolved.selectedLevels());
    }

    private static DungeonLevelOverlayControlsView.Mode toControlsOverlayMode(
            DungeonMapPresentationModel.RenderState.OverlayMode overlayMode
    ) {
        return switch (overlayMode == null ? DungeonMapPresentationModel.RenderState.OverlayMode.OFF : overlayMode) {
            case OFF -> DungeonLevelOverlayControlsView.Mode.OFF;
            case NEARBY -> DungeonLevelOverlayControlsView.Mode.NEARBY;
            case SELECTED -> DungeonLevelOverlayControlsView.Mode.SELECTED;
        };
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon Travel";
        }

        @Override
        public String navigationLabel() {
            return "Travel";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main,
                    ShellSlot.COCKPIT_STATE, state);
        }
    }
}

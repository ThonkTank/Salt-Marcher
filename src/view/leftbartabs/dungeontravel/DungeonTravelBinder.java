package src.view.leftbartabs.dungeontravel;

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
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.view.slotcontent.controls.dungeoncontrol.DungeonLevelOverlayControlsView;

final class DungeonTravelBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonTravelBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonApplicationService dungeon = runtimeContext.services().require(DungeonApplicationService.class);
        DungeonTravelContributionModel presentationModel = new DungeonTravelContributionModel();
        DungeonMapContentModel mapPresentationModel = new DungeonMapContentModel("Travel workspace", false);
        DungeonTravelIntentHandler intentHandler = new DungeonTravelIntentHandler(presentationModel);
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        bindTravelRequests(dungeon, presentationModel, mapPresentationModel, intentHandler);
        main.bind(mapPresentationModel);
        state.stateTextProperty().bind(presentationModel.stateProperty());
        controls.onViewInputEvent(intentHandler::consume);
        presentationModel.resetViewRequestTokenProperty().addListener((ignored, before, after) -> main.resetCamera());
        main.onViewportChanged(() -> controls.showZoom(main.zoom()));
        state.onViewInputEvent(intentHandler::consume);
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
        intentHandler.consume(DungeonTravelControlsViewInputEvent.refresh());
        return new Binding(controls, main, state);
    }

    private static void bindTravelRequests(
            DungeonApplicationService dungeon,
            DungeonTravelContributionModel presentationModel,
            DungeonMapContentModel mapPresentationModel,
            DungeonTravelIntentHandler intentHandler
    ) {
        presentationModel.refreshRequestTokenProperty().addListener((ignored, before, after) -> {
            src.domain.dungeon.published.DungeonSurfacePayload surface = dungeon.loadSurface(new LoadDungeonSurfaceQuery(
                    null,
                    DungeonSurfaceKind.TRAVEL,
                    DungeonTopologyElementRef.empty(),
                    0L,
                    false,
                    presentationModel.currentPosition()));
            presentationModel.applySurfaceState(surface);
            mapPresentationModel.showSurface(presentationModel.rendersDungeonMap() ? surface : null);
            mapPresentationModel.showPartyToken(presentationModel.currentPartyToken());
            mapPresentationModel.showProjectionLevel(presentationModel.projectionLevelProperty().get());
        });
        intentHandler.onPublishedEventRequested(actionEvent -> {
            src.domain.dungeon.published.DungeonTravelPosition currentPosition = presentationModel.currentPosition();
            src.domain.dungeon.published.DungeonSurfacePayload result = dungeon.moveSurfaceAction(
                    new MoveDungeonSurfaceActionCommand(currentPosition, actionEvent.actionId()));
            presentationModel.applySurfaceState(result);
            mapPresentationModel.showSurface(presentationModel.rendersDungeonMap() ? result : null);
            mapPresentationModel.showPartyToken(presentationModel.currentPartyToken());
            mapPresentationModel.showProjectionLevel(presentationModel.projectionLevelProperty().get());
        });
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

    private static DungeonLevelOverlayControlsView.Settings toControlsOverlaySettings(
            DungeonMapContentModel.RenderState.LevelOverlaySettings settings
    ) {
        DungeonMapContentModel.RenderState.LevelOverlaySettings resolved = settings == null
                ? DungeonMapContentModel.RenderState.LevelOverlaySettings.off()
                : settings;
        return new DungeonLevelOverlayControlsView.Settings(
                toControlsOverlayMode(resolved.mode()),
                resolved.levelRange(),
                resolved.opacity(),
                resolved.selectedLevels());
    }

    private static DungeonLevelOverlayControlsView.Mode toControlsOverlayMode(
            DungeonMapContentModel.RenderState.OverlayMode overlayMode
    ) {
        return switch (overlayMode == null ? DungeonMapContentModel.RenderState.OverlayMode.OFF : overlayMode) {
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

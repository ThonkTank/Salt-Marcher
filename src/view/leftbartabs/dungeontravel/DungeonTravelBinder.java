package src.view.leftbartabs.dungeontravel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.party.PartyApplicationService;
import src.view.slotcontent.controls.dungeoncontrol.DungeonLevelOverlayControlsView;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewModel;

final class DungeonTravelBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonTravelBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonApplicationService dungeon = runtimeContext.services().require(DungeonApplicationService.class);
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        DungeonTravelViewModel viewModel = new DungeonTravelViewModel(
                dungeon,
                party);
        DungeonMapViewModel mapViewModel = new DungeonMapViewModel("Travel workspace", false);
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        DungeonTravelMainView main = new DungeonTravelMainView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        main.renderModelProperty().bind(mapViewModel.displayModelProperty());
        state.stateTextProperty().bind(viewModel.stateProperty());
        controls.onRefresh(viewModel::refresh);
        controls.onResetView(main::resetCamera);
        controls.onPreviousLevel(viewModel::previousLevel);
        controls.onNextLevel(viewModel::nextLevel);
        controls.levelOverlayControls().setOnModeChanged(mode -> viewModel.selectOverlayMode(toDisplayOverlayMode(mode)));
        controls.levelOverlayControls().setOnRangeChanged(viewModel::selectOverlayRange);
        controls.levelOverlayControls().setOnOpacityChanged(viewModel::selectOverlayOpacity);
        controls.levelOverlayControls().setOnSelectedLevelsChanged(viewModel::selectOverlayLevels);
        main.onViewportChanged(() -> controls.showZoom(main.zoom()));
        state.onActionSelected(viewModel::performAction);
        viewModel.snapshotProperty().addListener((ignored, before, after) -> mapViewModel.showSnapshot(after));
        viewModel.partyTokenProperty().addListener((ignored, before, after) -> mapViewModel.showPartyToken(after));
        viewModel.actionsProperty().addListener((ignored, before, after) -> state.showActions(toActionItems(after)));
        viewModel.overlaySettingsProperty().addListener((ignored, before, after) -> {
            mapViewModel.showOverlaySettings(after);
            controls.showOverlaySettings(toControlsOverlaySettings(after), false);
        });
        viewModel.projectionLevelProperty().addListener((ignored, before, after) -> {
            mapViewModel.showProjectionLevel(after.intValue());
            controls.showLevels(after.intValue(), false, true);
        });
        viewModel.mapNameProperty().addListener((ignored, before, after) -> controls.showMapName(after));
        controls.showOverlaySettings(toControlsOverlaySettings(viewModel.overlaySettingsProperty().get()), false);
        controls.showLevels(viewModel.projectionLevelProperty().get(), false, true);
        controls.showMapName(viewModel.mapNameProperty().get());
        controls.showZoom(main.zoom());
        state.showActions(toActionItems(viewModel.actionsProperty().get()));
        viewModel.refresh();
        return new Binding(controls, main, state);
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

    private static DungeonMapDisplayModel.OverlayMode toDisplayOverlayMode(DungeonLevelOverlayControlsView.Mode overlayMode) {
        return switch (overlayMode == null ? DungeonLevelOverlayControlsView.Mode.OFF : overlayMode) {
            case OFF -> DungeonMapDisplayModel.OverlayMode.OFF;
            case NEARBY -> DungeonMapDisplayModel.OverlayMode.NEARBY;
            case SELECTED -> DungeonMapDisplayModel.OverlayMode.SELECTED;
        };
    }

    private static DungeonLevelOverlayControlsView.Settings toControlsOverlaySettings(
            DungeonMapDisplayModel.LevelOverlaySettings settings
    ) {
        DungeonMapDisplayModel.LevelOverlaySettings resolved = settings == null
                ? DungeonMapDisplayModel.LevelOverlaySettings.off()
                : settings;
        return new DungeonLevelOverlayControlsView.Settings(
                toControlsOverlayMode(resolved.mode()),
                resolved.levelRange(),
                resolved.opacity(),
                resolved.selectedLevels());
    }

    private static DungeonLevelOverlayControlsView.Mode toControlsOverlayMode(
            DungeonMapDisplayModel.OverlayMode overlayMode
    ) {
        return switch (overlayMode == null ? DungeonMapDisplayModel.OverlayMode.OFF : overlayMode) {
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

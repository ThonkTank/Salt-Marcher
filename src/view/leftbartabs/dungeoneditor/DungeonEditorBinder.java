package src.view.leftbartabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonApplicationService;
import src.view.slotcontent.controls.dungeoncontrol.DungeonLevelOverlayControlsView;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapMainView;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewModel;

final class DungeonEditorBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonEditorBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonApplicationService dungeon = runtimeContext.services().require(DungeonApplicationService.class);
        DungeonEditorViewModel viewModel = new DungeonEditorViewModel(dungeon);
        DungeonMapViewModel mapViewModel = new DungeonMapViewModel("Dungeon workspace", true);
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        DungeonEditorMainView main = new DungeonEditorMainView();
        DungeonEditorStateView state = new DungeonEditorStateView();
        main.renderModelProperty().bind(mapViewModel.displayModelProperty());
        main.onPrimaryPressed(event -> viewModel.primaryPressed(toPointerInput(event)));
        main.onPrimaryDragged(event -> viewModel.primaryDragged(toPointerInput(event)));
        main.onPrimaryReleased(event -> viewModel.primaryReleased(toPointerInput(event)));
        state.stateTextProperty().bind(viewModel.stateProperty());
        controls.setOnMapSelected(viewModel::selectMap);
        controls.setOnCreateMap(viewModel::createMap);
        controls.setOnRenameMap(request -> viewModel.renameMap(request.key(), request.mapName()));
        controls.setOnDeleteMap(viewModel::deleteMap);
        controls.onViewModeChanged(mode -> viewModel.selectViewMode(toDisplayViewMode(mode)));
        controls.onToolChanged(viewModel::selectTool);
        controls.onPreviousLevel(viewModel::previousLevel);
        controls.onNextLevel(viewModel::nextLevel);
        controls.levelOverlayControls().setOnModeChanged(mode -> viewModel.selectOverlayMode(toDisplayOverlayMode(mode)));
        controls.levelOverlayControls().setOnRangeChanged(viewModel::selectOverlayRange);
        controls.levelOverlayControls().setOnOpacityChanged(viewModel::selectOverlayOpacity);
        controls.levelOverlayControls().setOnSelectedLevelsChanged(viewModel::selectOverlayLevels);
        viewModel.snapshotProperty().addListener((ignored, before, after) -> mapViewModel.showSnapshot(after));
        viewModel.selectionProperty().addListener((ignored, before, after) -> mapViewModel.showSelection(after));
        viewModel.dragPreviewProperty().addListener((ignored, before, after) -> mapViewModel.showDragPreview(after));
        viewModel.paintPreviewProperty().addListener((ignored, before, after) -> mapViewModel.showPaintPreview(after));
        viewModel.mapsProperty().addListener((ignored, before, after) -> syncMapControls(viewModel, controls));
        viewModel.selectedMapKeyProperty().addListener((ignored, before, after) -> syncMapControls(viewModel, controls));
        viewModel.busyProperty().addListener((ignored, before, after) -> syncMapControls(viewModel, controls));
        viewModel.viewModeProperty().addListener((ignored, before, after) -> {
            mapViewModel.selectViewMode(after);
            controls.showViewMode(toControlsViewMode(after));
        });
        viewModel.selectedToolProperty().addListener((ignored, before, after) -> {
            mapViewModel.showSelectedTool(after);
            controls.showTool(after);
        });
        viewModel.projectionLevelProperty().addListener((ignored, before, after) -> {
            mapViewModel.showProjectionLevel(after.intValue());
            controls.showLevels(
                    viewModel.reachableLevelsProperty().get(),
                    after.intValue(),
                    viewModel.busyProperty().get(),
                    viewModel.selectedMapKeyProperty().get() != null
                            && !viewModel.selectedMapKeyProperty().get().isBlank());
        });
        viewModel.reachableLevelsProperty().addListener((ignored, before, after) ->
                controls.showLevels(
                        after,
                        viewModel.projectionLevelProperty().get(),
                        viewModel.busyProperty().get(),
                        viewModel.selectedMapKeyProperty().get() != null
                                && !viewModel.selectedMapKeyProperty().get().isBlank()));
        viewModel.overlaySettingsProperty().addListener((ignored, before, after) -> {
            mapViewModel.showOverlaySettings(after);
            controls.showOverlaySettings(toControlsOverlaySettings(after), viewModel.busyProperty().get());
        });
        viewModel.statusProperty().addListener((ignored, before, after) -> syncMapControls(viewModel, controls));
        syncMapControls(viewModel, controls);
        controls.showViewMode(toControlsViewMode(viewModel.viewModeProperty().get()));
        controls.showTool(viewModel.selectedToolProperty().get());
        controls.showLevels(
                viewModel.reachableLevelsProperty().get(),
                viewModel.projectionLevelProperty().get(),
                viewModel.busyProperty().get(),
                false);
        controls.showOverlaySettings(
                toControlsOverlaySettings(viewModel.overlaySettingsProperty().get()),
                viewModel.busyProperty().get());
        viewModel.refresh();
        return new Binding(controls, main, state);
    }

    private static void syncMapControls(DungeonEditorViewModel viewModel, DungeonEditorControlsView controls) {
        boolean hasMap = viewModel.selectedMapKeyProperty().get() != null
                && !viewModel.selectedMapKeyProperty().get().isBlank();
        boolean busy = viewModel.busyProperty().get();
        controls.showMaps(
                viewModel.mapsProperty().get().stream().map(DungeonEditorBinder::toControlMapItem).toList(),
                viewModel.selectedMapKeyProperty().get(),
                busy,
                viewModel.statusProperty().get());
        controls.showLevels(
                viewModel.reachableLevelsProperty().get(),
                viewModel.projectionLevelProperty().get(),
                busy,
                hasMap);
        controls.showOverlaySettings(toControlsOverlaySettings(viewModel.overlaySettingsProperty().get()), busy);
    }

    private static DungeonMapDisplayModel.ViewMode toDisplayViewMode(String viewMode) {
        return DungeonEditorControlsView.VIEW_GRAPH.equals(viewMode)
                ? DungeonMapDisplayModel.ViewMode.GRAPH
                : DungeonMapDisplayModel.ViewMode.GRID;
    }

    private static String toControlsViewMode(DungeonMapDisplayModel.ViewMode viewMode) {
        return viewMode == DungeonMapDisplayModel.ViewMode.GRAPH
                ? DungeonEditorControlsView.VIEW_GRAPH
                : DungeonEditorControlsView.VIEW_GRID;
    }

    private static DungeonMapDisplayModel.OverlayMode toDisplayOverlayMode(
            DungeonLevelOverlayControlsView.Mode overlayMode
    ) {
        if (overlayMode == DungeonLevelOverlayControlsView.Mode.NEARBY) {
            return DungeonMapDisplayModel.OverlayMode.NEARBY;
        }
        if (overlayMode == DungeonLevelOverlayControlsView.Mode.SELECTED) {
            return DungeonMapDisplayModel.OverlayMode.SELECTED;
        }
        return DungeonMapDisplayModel.OverlayMode.OFF;
    }

    private static DungeonLevelOverlayControlsView.Settings toControlsOverlaySettings(
            DungeonMapDisplayModel.LevelOverlaySettings settings
    ) {
        if (settings == null) {
            return new DungeonLevelOverlayControlsView.Settings(
                    DungeonLevelOverlayControlsView.Mode.OFF,
                    2,
                    0.35,
                    java.util.List.of());
        }
        DungeonLevelOverlayControlsView.Mode mode = toControlsOverlayMode(settings.mode());
        return new DungeonLevelOverlayControlsView.Settings(
                mode,
                settings.levelRange(),
                settings.opacity(),
                settings.selectedLevels());
    }

    private static DungeonLevelOverlayControlsView.Mode toControlsOverlayMode(
            DungeonMapDisplayModel.OverlayMode overlayMode
    ) {
        if (overlayMode == DungeonMapDisplayModel.OverlayMode.NEARBY) {
            return DungeonLevelOverlayControlsView.Mode.NEARBY;
        }
        if (overlayMode == DungeonMapDisplayModel.OverlayMode.SELECTED) {
            return DungeonLevelOverlayControlsView.Mode.SELECTED;
        }
        return DungeonLevelOverlayControlsView.Mode.OFF;
    }

    private static DungeonEditorViewModel.PointerInput toPointerInput(
            DungeonMapMainView.DungeonMapPointerEvent event
    ) {
        return new DungeonEditorViewModel.PointerInput(
                event.q(),
                event.r(),
                event.level(),
                event.primaryButtonDown(),
                toHitTarget(event.hitTarget()));
    }

    private static DungeonEditorViewModel.HitTarget toHitTarget(DungeonMapMainView.DungeonMapHitTarget hitTarget) {
        return new DungeonEditorViewModel.HitTarget(
                toHitKind(hitTarget.kind()),
                hitTarget.ownerId(),
                hitTarget.clusterId(),
                hitTarget.topologyRefKind(),
                hitTarget.topologyRefId(),
                hitTarget.label());
    }

    private static DungeonEditorViewModel.HitKind toHitKind(DungeonMapMainView.DungeonMapHitKind hitKind) {
        return switch (hitKind) {
            case EMPTY -> DungeonEditorViewModel.HitKind.EMPTY;
            case CORRIDOR -> DungeonEditorViewModel.HitKind.CORRIDOR;
            case STAIR -> DungeonEditorViewModel.HitKind.STAIR;
            case TRANSITION -> DungeonEditorViewModel.HitKind.TRANSITION;
            default -> DungeonEditorViewModel.HitKind.ROOM;
        };
    }

    private static DungeonEditorControlsView.MapItem toControlMapItem(DungeonEditorViewModel.MapSelection selection) {
        return new DungeonEditorControlsView.MapItem(
                selection.key(),
                selection.mapId() == null ? 0L : selection.mapId().value(),
                selection.mapName(),
                selection.revision());
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon Editor";
        }

        @Override
        public String navigationLabel() {
            return "Dungeon";
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

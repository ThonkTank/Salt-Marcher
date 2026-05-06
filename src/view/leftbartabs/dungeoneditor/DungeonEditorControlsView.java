package src.view.leftbartabs.dungeoneditor;

import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;

public final class DungeonEditorControlsView extends DungeonControlPanelView {

    static final String VIEW_GRID = "Grid";
    static final String VIEW_GRAPH = "Graph";
    static final String SELECT_TOOL = "Auswahl";
    static final String ROOM_PAINT_TOOL = "Raum malen";
    static final String ROOM_DELETE_TOOL = "Raum löschen";
    static final String WALL_CREATE_TOOL = "Wand setzen";
    static final String WALL_DELETE_TOOL = "Wand löschen";
    static final String DOOR_CREATE_TOOL = "Tür setzen";
    static final String DOOR_DELETE_TOOL = "Tür löschen";
    static final String CORRIDOR_CREATE_TOOL = "Korridor erstellen";
    static final String CORRIDOR_DELETE_TOOL = "Korridor löschen";
    static final String STAIR_CREATE_TOOL = "Treppe erstellen";
    static final String STAIR_DELETE_TOOL = "Treppe löschen";
    static final String TRANSITION_CREATE_TOOL = "Übergang erstellen";
    static final String TRANSITION_DELETE_TOOL = "Übergang löschen";

    private final DungeonEditorControlsEvents events = new DungeonEditorControlsEvents(this::publish);
    private final DungeonEditorMapControls mapControls = new DungeonEditorMapControls(this, events);
    private final DungeonEditorProjectionControls projectionControls = new DungeonEditorProjectionControls(this, events);
    private final DungeonEditorToolControls toolControls = new DungeonEditorToolControls(this, events);
    private Consumer<DungeonEditorControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    public DungeonEditorControlsView() {
        super("");
        DungeonEditorControlsFxAccess.addStyle(this, "control-toolbar");
        setFillWidth(true);
        getChildren().setAll(mapControls.row(), projectionControls.row(), toolControls.row());
    }

    public void onViewInputEvent(Consumer<DungeonEditorControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(DungeonEditorContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        contributionModel.mapEntriesProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.selectedMapKeyProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.busyProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.statusProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.reachableLevelsProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.projectionLevelProperty().addListener((ignored, before, after) -> refreshProjection(contributionModel));
        contributionModel.overlayProjectionProperty().addListener((ignored, before, after) ->
                projectionControls.showOverlaySettings(DungeonEditorProjectionControls.toSettings(after), contributionModel.busyProperty().get()));
        contributionModel.viewModeLabelProperty().addListener((ignored, before, after) -> projectionControls.showViewMode(after));
        contributionModel.selectedToolProperty().addListener((ignored, before, after) -> toolControls.showTool(after));
        contributionModel.mapEditorUiStateProperty().addListener((ignored, before, after) -> mapControls.showMapEditor(after));
        contributionModel.toolPaletteUiStateProperty().addListener((ignored, before, after) -> toolControls.showToolPalette(after));
        refreshProjection(contributionModel);
        projectionControls.showViewMode(contributionModel.viewModeLabelProperty().get());
        toolControls.showTool(contributionModel.selectedToolProperty().get());
        mapControls.showMapEditor(contributionModel.mapEditorUiStateProperty().get());
        toolControls.showToolPalette(contributionModel.toolPaletteUiStateProperty().get());
    }

    private void publish(DungeonEditorControlsViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private void refreshProjection(DungeonEditorContributionModel contributionModel) {
        String selectedMapKey = contributionModel.selectedMapKeyProperty().get();
        boolean hasMap = selectedMapKey != null && !selectedMapKey.isBlank();
        boolean busy = contributionModel.busyProperty().get();
        mapControls.showMaps(
                contributionModel.mapEntriesProperty().get().stream()
                        .map(DungeonEditorControlsView::toMapItem)
                        .toList(),
                selectedMapKey,
                busy,
                contributionModel.statusProperty().get());
        projectionControls.showLevels(
                contributionModel.projectionLevelProperty().get(),
                busy,
                hasMap);
        projectionControls.showOverlaySettings(
                DungeonEditorProjectionControls.toSettings(contributionModel.overlayProjectionProperty().get()),
                busy);
    }

    HBox controlsRow(Node... nodes) {
        return compactControlRow(nodes);
    }

    HBox controlsGroup(Node... nodes) {
        return compactControlGroup(nodes);
    }

    void describeNode(Node node, String description) {
        describe(node, description);
    }

    Region rowSpacer() {
        return spacer();
    }

    Label newSectionLabel(String text) {
        return sectionLabel(text);
    }

    private static MapItem toMapItem(DungeonEditorContributionModel.MapListEntry selection) {
        return new MapItem(
                selection.key(),
                selection.mapIdValue(),
                selection.mapName(),
                selection.revision());
    }

    public record MapItem(
            String key,
            long mapId,
            String mapName,
            long revision
    ) {
        public MapItem {
            key = key == null ? "" : key;
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0L, revision);
        }
    }
}

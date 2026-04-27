package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.ReadOnlyBooleanProperty;
import javafx.beans.property.ReadOnlyBooleanWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonSurfaceKind;
import src.domain.dungeon.published.DungeonSurfaceMessages;
import src.domain.dungeon.published.DungeonSurfacePayload;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.view.slotcontent.main.dungeonmap.DungeonMapPresentationModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapPresentationModel.RenderState.EditorPreview;
import src.view.slotcontent.main.dungeonmap.DungeonMapPresentationModel.RenderState.EditorPreview.RoomRectangle;
import src.view.slotcontent.main.dungeonmap.DungeonMapPresentationModel.RenderState.Selection;

public final class DungeonEditorPresentationModel {

    private static final String DEFAULT_TOOL = "Auswahl";
    private static final String VIEW_MODE_GRAPH = "GRAPH";
    private static final String OVERLAY_MODE_NEARBY = "NEARBY";
    private static final String OVERLAY_MODE_SELECTED = "SELECTED";

    private final DungeonMapPresentationModel mapPresentationModel =
            new DungeonMapPresentationModel("Dungeon workspace", true);
    private final PaintInteraction paintInteraction = new PaintInteraction();
    private final BoundaryInteraction boundaryInteraction = new BoundaryInteraction();
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<DungeonSurfacePayload> surface = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<DungeonSnapshot> snapshot = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<DungeonSnapshot> previewSnapshot = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<Selection> selection = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<DungeonInspectorSnapshot> inspector = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<EditorPreview> pendingTopologyEdit = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<List<MapSelection>> maps = new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyStringWrapper selectedMapKey = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<List<Integer>> reachableLevels = new ReadOnlyObjectWrapper<>(List.of(0));
    private final ReadOnlyBooleanWrapper busy = new ReadOnlyBooleanWrapper();
    private final ObjectProperty<DungeonMapPresentationModel.RenderState.ViewMode> viewMode =
            new SimpleObjectProperty<>(DungeonMapPresentationModel.RenderState.ViewMode.GRID);
    private final ObjectProperty<DungeonMapPresentationModel.RenderState.LevelOverlaySettings> overlaySettings =
            new SimpleObjectProperty<>(DungeonMapPresentationModel.RenderState.LevelOverlaySettings.defaults());
    private final IntegerProperty projectionLevel = new SimpleIntegerProperty(0);
    private final StringProperty selectedTool = new SimpleStringProperty(DEFAULT_TOOL);
    private @Nullable DungeonMapId selectedMapId;
    private @Nullable DragSession dragSession;
    private @Nullable BoundaryStretchSession boundaryStretchSession;

    public DungeonEditorPresentationModel() {
        snapshot.addListener((ignored, before, after) -> mapPresentationModel.showSnapshot(after));
        previewSnapshot.addListener((ignored, before, after) -> mapPresentationModel.showPreviewSnapshot(after));
        selection.addListener((ignored, before, after) -> mapPresentationModel.showSelection(after));
        pendingTopologyEdit.addListener((ignored, before, after) -> mapPresentationModel.showPendingTopologyEdit(after));
        viewMode.addListener((ignored, before, after) -> mapPresentationModel.selectViewMode(after));
        overlaySettings.addListener((ignored, before, after) -> mapPresentationModel.showOverlaySettings(after));
        projectionLevel.addListener((ignored, before, after) -> mapPresentationModel.showProjectionLevel(after.intValue()));
        selectedTool.addListener((ignored, before, after) -> mapPresentationModel.showSelectedTool(after));
        mapPresentationModel.selectViewMode(viewMode.get());
        mapPresentationModel.showOverlaySettings(overlaySettings.get());
        mapPresentationModel.showProjectionLevel(projectionLevel.get());
        mapPresentationModel.showSelectedTool(selectedTool.get());
        refreshStateText();
    }

    DungeonMapPresentationModel mapPresentationModel() {
        return mapPresentationModel;
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonSurfacePayload> surfaceProperty() {
        return surface.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonSnapshot> snapshotProperty() {
        return snapshot.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonSnapshot> previewSnapshotProperty() {
        return previewSnapshot.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<Selection> selectionProperty() {
        return selection.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonInspectorSnapshot> inspectorProperty() {
        return inspector.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<EditorPreview> pendingTopologyEditProperty() {
        return pendingTopologyEdit.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<List<MapSelection>> mapsProperty() {
        return maps.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty selectedMapKeyProperty() {
        return selectedMapKey.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<List<Integer>> reachableLevelsProperty() {
        return reachableLevels.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty busyProperty() {
        return busy.getReadOnlyProperty();
    }

    public ObjectProperty<DungeonMapPresentationModel.RenderState.ViewMode> viewModeProperty() {
        return viewMode;
    }

    public ObjectProperty<DungeonMapPresentationModel.RenderState.LevelOverlaySettings> overlaySettingsProperty() {
        return overlaySettings;
    }

    public IntegerProperty projectionLevelProperty() {
        return projectionLevel;
    }

    public StringProperty selectedToolProperty() {
        return selectedTool;
    }

    public @Nullable ActionIntent selectMap(String mapKey) {
        MapSelection selection = findMap(mapKey);
        if (selection == null) {
            return null;
        }
        clearInteraction();
        selectedMapId = selection.mapId();
        selectedMapKey.set(selection.key());
        return loadSelectedMap();
    }

    public void selectViewMode(String nextViewModeKey) {
        if (VIEW_MODE_GRAPH.equalsIgnoreCase(nextViewModeKey)) {
            selectViewMode(DungeonMapPresentationModel.RenderState.ViewMode.GRAPH);
            return;
        }
        selectViewMode(DungeonMapPresentationModel.RenderState.ViewMode.GRID);
    }

    public void selectViewMode(DungeonMapPresentationModel.RenderState.ViewMode nextViewMode) {
        viewMode.set(nextViewMode == null ? DungeonMapPresentationModel.RenderState.ViewMode.GRID : nextViewMode);
        refreshStateText();
    }

    public void selectTool(String nextTool) {
        selectedTool.set(nextTool == null || nextTool.isBlank() ? DEFAULT_TOOL : nextTool);
        if (!DEFAULT_TOOL.equals(selectedTool.get())) {
            clearInteraction();
        }
        refreshStateText();
    }

    public void selectOverlayMode(String overlayModeKey) {
        if (OVERLAY_MODE_NEARBY.equalsIgnoreCase(overlayModeKey)) {
            selectOverlayMode(DungeonMapPresentationModel.RenderState.OverlayMode.NEARBY);
            return;
        }
        if (OVERLAY_MODE_SELECTED.equalsIgnoreCase(overlayModeKey)) {
            selectOverlayMode(DungeonMapPresentationModel.RenderState.OverlayMode.SELECTED);
            return;
        }
        selectOverlayMode(DungeonMapPresentationModel.RenderState.OverlayMode.OFF);
    }

    public void selectOverlayMode(DungeonMapPresentationModel.RenderState.OverlayMode nextOverlayMode) {
        DungeonMapPresentationModel.RenderState.LevelOverlaySettings current = overlaySettings.get();
        overlaySettings.set(new DungeonMapPresentationModel.RenderState.LevelOverlaySettings(
                nextOverlayMode,
                current.levelRange(),
                current.opacity(),
                current.selectedLevels()));
        refreshStateText();
    }

    public void selectOverlayRange(int levelRange) {
        DungeonMapPresentationModel.RenderState.LevelOverlaySettings current = overlaySettings.get();
        overlaySettings.set(new DungeonMapPresentationModel.RenderState.LevelOverlaySettings(
                current.mode(),
                levelRange,
                current.opacity(),
                current.selectedLevels()));
        refreshStateText();
    }

    public void selectOverlayOpacity(double opacity) {
        DungeonMapPresentationModel.RenderState.LevelOverlaySettings current = overlaySettings.get();
        overlaySettings.set(new DungeonMapPresentationModel.RenderState.LevelOverlaySettings(
                current.mode(),
                current.levelRange(),
                opacity,
                current.selectedLevels()));
        refreshStateText();
    }

    public void selectOverlayLevels(List<Integer> levels) {
        DungeonMapPresentationModel.RenderState.LevelOverlaySettings current = overlaySettings.get();
        overlaySettings.set(new DungeonMapPresentationModel.RenderState.LevelOverlaySettings(
                current.mode(),
                current.levelRange(),
                current.opacity(),
                levels));
        refreshStateText();
    }

    public void previousLevel() {
        moveProjection(-1);
    }

    public void nextLevel() {
        moveProjection(1);
    }

    public ActionIntent refresh() {
        busy.set(true);
        refreshStateText();
        return ActionIntent.refresh();
    }

    public ActionIntent createMap(String mapName) {
        busy.set(true);
        refreshStateText();
        return ActionIntent.createMap(mapName);
    }

    public @Nullable ActionIntent renameMap(String mapKey, String mapName) {
        MapSelection selection = findMap(mapKey);
        if (selection == null) {
            return null;
        }
        busy.set(true);
        refreshStateText();
        return ActionIntent.renameMap(selection.mapId(), mapName);
    }

    public @Nullable ActionIntent deleteMap(String mapKey) {
        MapSelection selection = findMap(mapKey);
        if (selection == null) {
            return null;
        }
        busy.set(true);
        refreshStateText();
        return ActionIntent.deleteMap(selection.mapId());
    }

    public InteractionResult primaryPressed(@Nullable PointerInput input) {
        if (!interactionEnabled() || input == null) {
            return InteractionResult.ignored();
        }
        if (boundaryInteraction.handles(selectedTool.get())) {
            BoundaryInteraction.PressResult boundaryResult =
                    boundaryInteraction.press(input, selectedTool.get(), snapshot.get(), selection.get());
            if (boundaryResult.consumed()) {
                dragSession = null;
                paintInteraction.clear();
                if (boundaryResult.commit() != null) {
                    pendingTopologyEdit.set(null);
                    ActionIntent action = applyBoundaryCommit(boundaryResult.commit());
                    refreshStateText();
                    return InteractionResult.consumed(action);
                } else {
                    pendingTopologyEdit.set(boundaryInteraction.preview());
                }
                refreshStateText();
                return InteractionResult.consumed(null);
            }
        }
        if (paintInteraction.press(input, selectedTool.get())) {
            selection.set(null);
            dragSession = null;
            pendingTopologyEdit.set(paintInteraction.preview());
            refreshStateText();
            return InteractionResult.consumed(null);
        }
        if (!selectionToolSelected()) {
            clearInteraction();
            return InteractionResult.ignored();
        }
        HitTarget hit = input.hitTarget();
        BoundaryStretchSession nextBoundaryStretchSession = boundaryStretchSession(input);
        if (nextBoundaryStretchSession != null) {
            selection.set(nextBoundaryStretchSession.selection());
            dragSession = null;
            boundaryStretchSession = nextBoundaryStretchSession;
            previewSnapshot.set(null);
            pendingTopologyEdit.set(null);
            ActionIntent action = refreshInspector();
            refreshStateText();
            return InteractionResult.consumed(action);
        }
        if (selectableHit(hit)) {
            DungeonMapPresentationModel.RenderState.TopologyRef topologyRef =
                    new DungeonMapPresentationModel.RenderState.TopologyRef(hit.topologyRefKind(), hit.topologyRefId());
            DungeonEditorHandleRef handleRef = dragHandleRef(hit);
            DungeonMapPresentationModel.RenderState.Selection nextSelection =
                    new DungeonMapPresentationModel.RenderState.Selection(
                    hit.ownerId(),
                    hit.clusterId(),
                    hit.label(),
                    topologyRef,
                    clusterSelection(hit),
                    handleRef);
            selection.set(nextSelection);
            dragSession = draggableHit(hit)
                    ? DragSession.start(nextSelection, input.q(), input.r(), input.level(), snapshot.get())
                    : null;
            pendingTopologyEdit.set(null);
            ActionIntent action = refreshInspector();
            refreshStateText();
            return new InteractionResult(dragSession != null, action);
        }
        clearInteraction();
        return InteractionResult.ignored();
    }

    public @Nullable ActionIntent primaryDragged(@Nullable PointerInput input) {
        if (!interactionEnabled() || input == null || !input.primaryButtonDown()) {
            return null;
        }
        if (boundaryStretchSession != null) {
            boundaryStretchSession = boundaryStretchSession.withCurrentPointer(input.q(), input.r());
            ActionIntent action = showBoundaryStretchPreview(boundaryStretchSession);
            refreshStateText();
            return action;
        }
        if (updateBoundaryPreview(input)) {
            return null;
        }
        if (paintInteraction.drag(input, selectedTool.get())) {
            pendingTopologyEdit.set(paintInteraction.preview());
            refreshStateText();
            return null;
        }
        if (!selectionToolSelected() || dragSession == null) {
            return null;
        }
        dragSession = dragSession.withCurrentPointer(input.q(), input.r());
        if (!dragSession.moved()) {
            pendingTopologyEdit.set(null);
            snapshot.set(dragSession.baseSnapshot());
        } else {
            snapshot.set(dragSession.baseSnapshot());
            showPendingMovePreview(dragSession);
        }
        refreshStateText();
        return null;
    }

    public void pointerMoved(@Nullable PointerInput input) {
        if (!interactionEnabled() || input == null) {
            return;
        }
        updateBoundaryPreview(input);
    }

    public @Nullable ActionIntent primaryReleased(@Nullable PointerInput input) {
        PaintInteraction.PaintCommit paintCommit = paintInteraction.release(input, selectedTool.get());
        if (paintCommit != null) {
            pendingTopologyEdit.set(null);
            if (interactionEnabled()) {
                ActionIntent action = applyPaintCommit(paintCommit);
                refreshStateText();
                return action;
            }
            refreshStateText();
            return null;
        } else if (pendingTopologyEdit.get() instanceof EditorPreview.RoomRectangle
                && paintInteraction.preview() == null) {
            pendingTopologyEdit.set(null);
        }
        if (boundaryStretchSession != null) {
            BoundaryStretchSession releasedSession = input == null
                    ? boundaryStretchSession
                    : boundaryStretchSession.withCurrentPointer(input.q(), input.r());
            boundaryStretchSession = null;
            previewSnapshot.set(null);
            pendingTopologyEdit.set(null);
            if (!interactionEnabled() || !selectionToolSelected()) {
                refreshStateText();
                return null;
            }
            if (!releasedSession.moved()) {
                selection.set(releasedSession.selection());
                ActionIntent action = refreshInspector();
                refreshStateText();
                return action;
            }
            ActionIntent action = applyBoundaryStretch(releasedSession);
            refreshStateText();
            return action;
        }
        if (dragSession == null || input == null) {
            return null;
        }
        DragSession releasedSession = dragSession;
        dragSession = null;
        pendingTopologyEdit.set(null);
        snapshot.set(releasedSession.baseSnapshot());
        if (!interactionEnabled() || !selectionToolSelected() || !releasedSession.moved()) {
            refreshStateText();
            return null;
        }
        ActionIntent action = moveSelectedHandle(releasedSession);
        refreshStateText();
        return action;
    }

    public @Nullable ActionIntent levelScrolled(int delta) {
        if (delta == 0) {
            return null;
        }
        if (boundaryStretchSession != null) {
            refreshStateText();
            return null;
        }
        if (dragSession == null) {
            return moveProjection(delta);
        }
        int nextLevel = dragSession.currentLevel() + delta;
        dragSession = dragSession.withCurrentLevel(nextLevel);
        projectionLevel.set(nextLevel);
        snapshot.set(dragSession.baseSnapshot());
        if (dragSession.moved()) {
            showPendingMovePreview(dragSession);
        } else {
            pendingTopologyEdit.set(null);
        }
        refreshStateText();
        return null;
    }

    public @Nullable ActionIntent saveRoomNarration(
            long roomId,
            String visualDescription,
            List<RoomExitNarrationInput> exits
    ) {
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || roomId <= 0L) {
            return null;
        }
        busy.set(true);
        refreshStateText();
        return ActionIntent.saveRoomNarration(
                mapId,
                new SaveRoomNarrationMutation(roomId, visualDescription, exits));
    }

    private @Nullable ActionIntent loadSelectedMap() {
        boundaryStretchSession = null;
        previewSnapshot.set(null);
        refreshSurfacePayload(DungeonSurfaceKind.EDITOR);
        if (selectedMapId == null) {
            snapshot.set(null);
            surface.set(null);
            reachableLevels.set(List.of(0));
            status.set(maps.get().isEmpty() ? "Keine Dungeon-Maps vorhanden." : "Kein Dungeon ausgewaehlt.");
            refreshStateText();
            return null;
        }
        refreshStateText();
        return ActionIntent.loadSelectedMap(selectedMapId);
    }

    private void refreshStateText() {
        Selection currentSelection = selection.get();
        EditorPreview currentPreview = pendingTopologyEdit.get();
        String selectionText = currentSelection == null
                ? "Auswahl: Keine"
                : "Auswahl: " + currentSelection.label()
                        + " (" + currentSelection.topologyRef().kind() + " " + currentSelection.topologyRef().id() + ")";
        String previewText = previewText(currentPreview);
        state.set("Werkzeug: " + selectedTool.get()
                + "\nAnsicht: " + viewMode.get().label()
                + "\nEbene: z=" + projectionLevel.get()
                + "\n" + overlaySettings.get().mode().label()
                + "\n" + selectionText
                + "\n" + previewText
                + "\n" + paintInteraction.stateText()
                + "\n" + boundaryInteraction.stateText(selectedTool.get())
                + "\nAuswahlwerkzeug: Topologieelemente koennen auf dem Raster gezogen werden."
                + "\nRaumwerkzeug: Rechteck ziehen und beim Loslassen anwenden.");
    }

    private static String previewText(@Nullable EditorPreview preview) {
        if (preview == null || !preview.active()) {
            return "Topologie-Preview: inaktiv";
        }
        if (preview instanceof EditorPreview.MoveHandleOrCluster movePreview) {
            return "Topologie-Preview: verschieben dq=" + movePreview.deltaQ()
                    + ", dr=" + movePreview.deltaR()
                    + ", dz=" + movePreview.deltaLevel();
        }
        if (preview instanceof EditorPreview.RoomRectangle roomRectangle) {
            return "Topologie-Preview: "
                    + (roomRectangle.deleteMode() ? "Raum loeschen" : "Raum malen")
                    + " z=" + roomRectangle.level();
        }
        if (preview instanceof EditorPreview.BoundaryEdges boundaryEdges) {
            return "Topologie-Preview: "
                    + (boundaryEdges.deleteMode() ? "Kanten loeschen" : "Kanten setzen")
                    + " (" + boundaryEdges.edges().size() + ")";
        }
        if (preview instanceof EditorPreview.BoundaryStretchMove boundaryStretchMove) {
            return "Topologie-Preview: Wandstrecke verschieben dq=" + boundaryStretchMove.deltaQ()
                    + ", dr=" + boundaryStretchMove.deltaR()
                    + ", dz=" + boundaryStretchMove.deltaLevel()
                    + " (" + boundaryStretchMove.sourceEdges().size() + ")";
        }
        return "Topologie-Preview: aktiv";
    }

    private boolean updateBoundaryPreview(PointerInput input) {
        if (!boundaryInteraction.handles(selectedTool.get())
                || (!boundaryInteraction.hasDraft()
                && !boundaryInteraction.previewsWithoutDraft(selectedTool.get()))) {
            return false;
        }
        pendingTopologyEdit.set(boundaryInteraction.preview(input, selectedTool.get(), snapshot.get()));
        refreshStateText();
        return true;
    }

    private @Nullable ActionIntent moveSelectedHandle(DragSession releasedSession) {
        Selection currentSelection = releasedSession.selection();
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || currentSelection == null || currentSelection.handleRef().ownerId() <= 0L) {
            return null;
        }
        busy.set(true);
        return ActionIntent.moveSelectedHandle(
                mapId,
                new MoveHandleMutation(
                        currentSelection.handleRef(),
                        releasedSession.deltaQ(),
                        releasedSession.deltaR(),
                        releasedSession.deltaLevel()),
                releasedSession);
    }

    private void showPendingMovePreview(DragSession session) {
        pendingTopologyEdit.set(new EditorPreview.MoveHandleOrCluster(
                session.selection().clusterId(),
                session.deltaQ(),
                session.deltaR(),
                session.deltaLevel(),
                session.selection().handleRef(),
                session.selection().label()));
    }

    private @Nullable BoundaryStretchSession boundaryStretchSession(PointerInput input) {
        if (input == null
                || !selectionToolSelected()
                || !input.primaryButtonDown()
                || input.boundaryTarget() == null
                || !input.boundaryTarget().present()) {
            return null;
        }
        BoundaryTarget boundaryTarget = input.boundaryTarget();
        BoundaryStretchOrientation orientation = BoundaryStretchOrientation.from(boundaryTarget);
        if (orientation == null || boundaryTarget.clusterId() <= 0L) {
            return null;
        }
        List<DungeonEdgeRef> sourceEdges = resolveBoundaryStretchEdges(snapshot.get(), boundaryTarget, orientation);
        if (sourceEdges.isEmpty()) {
            return null;
        }
        Selection nextSelection = selectionForBoundaryStretch(snapshot.get(), selection.get(), boundaryTarget);
        return new BoundaryStretchSession(
                nextSelection,
                boundaryTarget.clusterId(),
                sourceEdges,
                orientation,
                input.q(),
                input.r(),
                input.level(),
                input.q(),
                input.r());
    }

    private @Nullable ActionIntent showBoundaryStretchPreview(BoundaryStretchSession session) {
        if (session == null || !session.moved()) {
            previewSnapshot.set(null);
            pendingTopologyEdit.set(null);
            return null;
        }
        pendingTopologyEdit.set(session.preview());
        DungeonMapId mapId = selectedMapId;
        DungeonSnapshot baseSnapshot = snapshot.get();
        if (mapId == null || baseSnapshot == null) {
            previewSnapshot.set(null);
            refreshSurfacePayload(DungeonSurfaceKind.EDITOR);
            return null;
        }
        return ActionIntent.previewSurfaceEdit(mapId, session.toMutation());
    }

    private @Nullable ActionIntent applyBoundaryStretch(BoundaryStretchSession session) {
        DungeonMapId mapId = selectedMapId;
        DungeonSnapshot baseSnapshot = snapshot.get();
        if (mapId == null || baseSnapshot == null) {
            return null;
        }
        busy.set(true);
        return ActionIntent.applyBoundaryStretch(mapId, session.toMutation(), session);
    }

    private @Nullable ActionIntent applyPaintCommit(PaintInteraction.PaintCommit commit) {
        if (commit == null) {
            return null;
        }
        return applyCommittedOperation(commit.mutation(), commit.status());
    }

    private @Nullable ActionIntent applyBoundaryCommit(BoundaryInteraction.BoundaryCommit commit) {
        if (commit == null) {
            return null;
        }
        return applyCommittedOperation(commit.mutation(), commit.status());
    }

    private @Nullable ActionIntent applyCommittedOperation(SurfaceMutation mutation, String statusText) {
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || mutation == null) {
            return null;
        }
        busy.set(true);
        return ActionIntent.applyOperation(mapId, mutation, statusText);
    }

    private boolean interactionEnabled() {
        return selectedMapId != null
                && snapshot.get() != null
                && !busy.get()
                && viewMode.get() == DungeonMapPresentationModel.RenderState.ViewMode.GRID;
    }

    private static DungeonTopologyElementRef toTopologyElementRef(
            DungeonMapPresentationModel.RenderState.TopologyRef ref
    ) {
        DungeonMapPresentationModel.RenderState.TopologyRef safeRef =
                ref == null ? DungeonMapPresentationModel.RenderState.TopologyRef.empty() : ref;
        return new DungeonTopologyElementRef(toTopologyElementKind(safeRef.kind()), safeRef.id());
    }

    private static DungeonTopologyElementKind toTopologyElementKind(String kind) {
        try {
            return DungeonTopologyElementKind.valueOf(kind == null ? "" : kind.trim());
        } catch (IllegalArgumentException exception) {
            return DungeonTopologyElementKind.EMPTY;
        }
    }

    private static DungeonEditorHandleKind toHandleKind(String kind) {
        try {
            return DungeonEditorHandleKind.valueOf(kind == null ? "" : kind.trim());
        } catch (IllegalArgumentException exception) {
            return DungeonEditorHandleKind.CLUSTER_LABEL;
        }
    }

    private void clearInteraction() {
        dragSession = null;
        boundaryStretchSession = null;
        paintInteraction.clear();
        boundaryInteraction.clear();
        previewSnapshot.set(null);
        pendingTopologyEdit.set(null);
        selection.set(null);
        inspector.set(null);
        refreshSurfacePayload(DungeonSurfaceKind.EDITOR);
        refreshStateText();
    }

    private @Nullable ActionIntent refreshInspector() {
        Selection currentSelection = selection.get();
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || currentSelection == null || snapshot.get() == null) {
            inspector.set(null);
            refreshSurfacePayload(surface.get() == null ? DungeonSurfaceKind.EDITOR : surface.get().surfaceKind());
            return null;
        }
        return ActionIntent.refreshInspector(
                mapId,
                toTopologyElementRef(currentSelection.topologyRef()),
                currentSelection.clusterId(),
                currentSelection.clusterSelection(),
                surface.get() == null ? DungeonSurfaceKind.EDITOR : surface.get().surfaceKind());
    }

    private void applySurfacePayload(DungeonSurfacePayload payload, boolean replaceInspector) {
        DungeonSurfacePayload safePayload = payload == null
                ? null
                : new DungeonSurfacePayload(
                        payload.mapName(),
                        payload.surfaceKind(),
                        payload.mode(),
                        payload.revision(),
                        payload.map(),
                        payload.previewMap(),
                        payload.aggregateSummaries(),
                        payload.relationSummaries(),
                        replaceInspector ? payload.inspector() : (payload.inspector() == null ? inspector.get() : payload.inspector()),
                        payload.travel(),
                        payload.messages());
        if (safePayload == null) {
            snapshot.set(null);
            previewSnapshot.set(null);
            surface.set(null);
            return;
        }
        snapshot.set(toCommittedSnapshot(safePayload));
        previewSnapshot.set(toPreviewSnapshot(safePayload));
        if (replaceInspector || safePayload.inspector() != null) {
            inspector.set(safePayload.inspector());
        }
        surface.set(safePayload);
    }

    private void refreshSurfacePayload(DungeonSurfaceKind kind) {
        DungeonSnapshot currentSnapshot = snapshot.get();
        if (currentSnapshot == null) {
            surface.set(null);
            return;
        }
        surface.set(new DungeonSurfacePayload(
                currentSnapshot.mapName(),
                kind == null ? DungeonSurfaceKind.EDITOR : kind,
                currentSnapshot.mode(),
                currentSnapshot.revision(),
                currentSnapshot.map(),
                previewSnapshot.get() == null ? null : previewSnapshot.get().map(),
                currentSnapshot.aggregateSummaries(),
                currentSnapshot.relationSummaries(),
                inspector.get(),
                null,
                DungeonSurfaceMessages.empty()));
    }

    private static DungeonSnapshot toCommittedSnapshot(DungeonSurfacePayload payload) {
        return new DungeonSnapshot(
                payload.mapName(),
                payload.mode(),
                payload.map(),
                payload.aggregateSummaries(),
                payload.relationSummaries(),
                payload.revision());
    }

    private static @Nullable DungeonSnapshot toPreviewSnapshot(DungeonSurfacePayload payload) {
        if (payload == null || payload.previewMap() == null) {
            return null;
        }
        return new DungeonSnapshot(
                payload.mapName(),
                payload.mode(),
                payload.previewMap(),
                payload.aggregateSummaries(),
                payload.relationSummaries(),
                payload.revision());
    }

    private static boolean selectableHit(@Nullable HitTarget hit) {
        return hit != null
                && hit.kind() != HitKind.EMPTY
                && hit.topologyRefId() > 0L
                && !"EMPTY".equals(hit.topologyRefKind());
    }

    private static boolean draggableHit(HitTarget hit) {
        return hit != null
                && (hit.kind() == HitKind.HANDLE || hit.kind() == HitKind.LABEL)
                && (hit.clusterId() > 0L || hit.handleRef().ownerId() > 0L);
    }

    private static boolean clusterSelection(HitTarget hit) {
        return hit.kind() == HitKind.LABEL
                || hit.handleRef().clusterLabel();
    }

    private static DungeonEditorHandleRef dragHandleRef(HitTarget hit) {
        if (hit.kind() == HitKind.HANDLE) {
            return hit.handleRef().toDungeonHandleRef();
        }
        return HandleTarget.clusterLabel(
                hit.topologyRefKind(),
                hit.topologyRefId(),
                hit.ownerId(),
                hit.clusterId()).toDungeonHandleRef();
    }

    private boolean selectionToolSelected() {
        return DEFAULT_TOOL.equals(selectedTool.get());
    }

    private @Nullable ActionIntent moveProjection(int offset) {
        projectionLevel.set(projectionLevel.get() + offset);
        return loadSelectedMap();
    }

    void applyMapSelections(List<MapSelection> selections) {
        List<MapSelection> safeSelections = selections == null ? List.of() : List.copyOf(selections);
        maps.set(safeSelections);
        if (selectedMapId == null && !safeSelections.isEmpty()) {
            selectedMapId = safeSelections.getFirst().mapId();
        }
        if (selectedMapId != null && safeSelections.stream().noneMatch(selection -> selection.mapId().equals(selectedMapId))) {
            selectedMapId = safeSelections.isEmpty() ? null : safeSelections.getFirst().mapId();
        }
        selectedMapKey.set(selectedMapId == null ? "" : key(selectedMapId));
    }

    void selectMapId(@Nullable DungeonMapId mapId) {
        selectedMapId = mapId;
        selectedMapKey.set(selectedMapId == null ? "" : key(selectedMapId));
    }

    @Nullable DungeonMapId selectedMapId() {
        return selectedMapId;
    }

    void clearSelectionForDeletedMap(DungeonMapId deletedMapId) {
        if (Objects.equals(deletedMapId, selectedMapId)) {
            selectedMapId = null;
            selectedMapKey.set("");
            clearInteraction();
        }
    }

    void applyLoadedSelectedMap(DungeonSurfacePayload nextSurface) {
        applySurfacePayload(nextSurface, true);
        reachableLevels.set(levelsFrom(snapshot.get(), projectionLevel.get()));
        status.set("");
        refreshStateText();
    }

    void applyNoSelectedMapAvailable() {
        snapshot.set(null);
        surface.set(null);
        reachableLevels.set(List.of(0));
        status.set(maps.get().isEmpty() ? "Keine Dungeon-Maps vorhanden." : "Kein Dungeon ausgewaehlt.");
        refreshStateText();
    }

    void applySelectedMapLoadFailure(String message) {
        snapshot.set(null);
        surface.set(null);
        reachableLevels.set(List.of(0));
        status.set("Dungeon konnte nicht geladen werden: " + message);
        refreshStateText();
    }

    void applyRoomNarrationSaved(DungeonSurfacePayload result) {
        applySurfacePayload(result, true);
        reachableLevels.set(levelsFrom(snapshot.get(), projectionLevel.get()));
        status.set("Raumbeschreibung gespeichert.");
        refreshStateText();
    }

    void applyMoveSelectedHandleResult(DungeonSurfacePayload result, DragSession releasedSession) {
        applySurfacePayload(result, false);
        reachableLevels.set(levelsFrom(snapshot.get(), projectionLevel.get()));
        status.set("Topologieelement verschoben: dq=" + releasedSession.deltaQ()
                + ", dr=" + releasedSession.deltaR()
                + ", dz=" + releasedSession.deltaLevel());
        selection.set(releasedSession.selection());
        refreshStateText();
    }

    void applyBoundaryStretchResult(DungeonSurfacePayload result, BoundaryStretchSession session) {
        DungeonSnapshot before = snapshot.get();
        applySurfacePayload(result, false);
        reachableLevels.set(levelsFrom(snapshot.get(), projectionLevel.get()));
        boolean changed = before != null && snapshot.get() != null && !Objects.equals(snapshot.get().map(), before.map());
        status.set(changed
                ? "Wandstrecke verschoben: dq=" + session.deltaQ()
                        + ", dr=" + session.deltaR()
                        + ", dz=" + session.deltaLevel()
                : "Wandstrecke konnte nicht verschoben werden.");
        selection.set(session.selection());
        refreshStateText();
    }

    void applyCommittedOperationResult(DungeonSurfacePayload result, String statusText) {
        applySurfacePayload(result, false);
        reachableLevels.set(levelsFrom(snapshot.get(), projectionLevel.get()));
        status.set(statusText);
        selection.set(null);
        inspector.set(null);
        refreshSurfacePayload(DungeonSurfaceKind.EDITOR);
        refreshStateText();
    }

    void applyPreviewSurface(DungeonSurfacePayload payload) {
        applySurfacePayload(payload, false);
        refreshStateText();
    }

    void clearPreviewSurface() {
        previewSnapshot.set(null);
        refreshSurfacePayload(DungeonSurfaceKind.EDITOR);
        refreshStateText();
    }

    @Nullable InspectorRequest currentInspectorRequest() {
        Selection currentSelection = selection.get();
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || currentSelection == null || snapshot.get() == null) {
            return null;
        }
        return new InspectorRequest(
                mapId,
                toTopologyElementRef(currentSelection.topologyRef()),
                currentSelection.clusterId(),
                currentSelection.clusterSelection(),
                surface.get() == null ? DungeonSurfaceKind.EDITOR : surface.get().surfaceKind());
    }

    void applyInspectorSurface(DungeonSurfacePayload inspectorSurface, DungeonSurfaceKind kind) {
        inspector.set(inspectorSurface == null ? null : inspectorSurface.inspector());
        refreshSurfacePayload(kind);
        refreshStateText();
    }

    void clearInspectorSurface(DungeonSurfaceKind kind) {
        inspector.set(null);
        refreshSurfacePayload(kind);
        refreshStateText();
    }

    void applyActionFailure(String message) {
        status.set(message == null || message.isBlank() ? "Dungeon-Aktion fehlgeschlagen." : message);
        refreshStateText();
    }

    void finishBusy() {
        busy.set(false);
        refreshStateText();
    }

    static String rootCauseMessage(RuntimeException exception) {
        Throwable root = exception;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        String message = root.getMessage();
        if (message == null || message.isBlank()) {
            message = exception.getMessage();
        }
        return message == null || message.isBlank() ? "Dungeon-Aktion fehlgeschlagen." : message;
    }

    private @Nullable MapSelection findMap(String mapKey) {
        return maps.get().stream()
                .filter(selection -> Objects.equals(selection.key(), mapKey))
                .findFirst()
                .orElse(null);
    }

    private static Selection selectionForBoundaryStretch(
            @Nullable DungeonSnapshot snapshot,
            @Nullable Selection currentSelection,
            BoundaryTarget boundaryTarget
    ) {
        if (currentSelection != null
                && currentSelection.clusterSelection()
                && currentSelection.clusterId() == boundaryTarget.clusterId()) {
            return currentSelection;
        }
        DungeonAreaSnapshot clusterArea = firstClusterArea(snapshot, boundaryTarget.clusterId());
        if (clusterArea != null) {
            return new Selection(
                    clusterArea.id(),
                    clusterArea.clusterId(),
                    clusterArea.label(),
                    new DungeonMapPresentationModel.RenderState.TopologyRef(
                            clusterArea.topologyRef().kind().name(),
                            clusterArea.topologyRef().id()),
                    true);
        }
        return new Selection(
                boundaryTarget.ownerId(),
                boundaryTarget.clusterId(),
                "Cluster " + boundaryTarget.clusterId(),
                new DungeonMapPresentationModel.RenderState.TopologyRef(
                        boundaryTarget.topologyRefKind(),
                        boundaryTarget.topologyRefId()),
                true);
    }

    private static @Nullable DungeonAreaSnapshot firstClusterArea(@Nullable DungeonSnapshot snapshot, long clusterId) {
        if (snapshot == null || snapshot.map() == null || clusterId <= 0L) {
            return null;
        }
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }

    private static List<DungeonEdgeRef> resolveBoundaryStretchEdges(
            @Nullable DungeonSnapshot snapshot,
            BoundaryTarget boundaryTarget,
            BoundaryStretchOrientation orientation
    ) {
        if (snapshot == null || snapshot.map() == null || !boundaryTarget.present()) {
            return List.of();
        }
        int level = boundaryTarget.start().level();
        Set<DungeonCellRef> clusterCells = clusterCells(snapshot, boundaryTarget.clusterId(), level);
        if (clusterCells.isEmpty()) {
            return List.of();
        }
        DungeonEdgeRef clickedEdge = new DungeonEdgeRef(
                boundaryTarget.start().toDungeonCellRef(),
                boundaryTarget.end().toDungeonCellRef());
        Boolean outer = outerStretch(clickedEdge, clusterCells);
        if (outer == null) {
            return List.of();
        }
        Map<Integer, DungeonEdgeRef> edgesByVariable =
                boundaryStretchEdgesOnLine(snapshot, clusterCells, clickedEdge, orientation, outer);
        List<DungeonEdgeRef> contiguousEdges = contiguousStretchEdges(edgesByVariable, clickedEdge, orientation);
        return contiguousEdges.isEmpty() ? List.of(clickedEdge) : contiguousEdges;
    }

    private static @Nullable Boolean outerStretch(DungeonEdgeRef clickedEdge, Set<DungeonCellRef> clusterCells) {
        int clickedTouchCount = touchingClusterCount(clickedEdge, clusterCells);
        if (clickedTouchCount < 1) {
            return null;
        }
        return clickedTouchCount == 1;
    }

    private static Map<Integer, DungeonEdgeRef> boundaryStretchEdgesOnLine(
            DungeonSnapshot snapshot,
            Set<DungeonCellRef> clusterCells,
            DungeonEdgeRef clickedEdge,
            BoundaryStretchOrientation orientation,
            boolean outer
    ) {
        Map<Integer, DungeonEdgeRef> edgesByVariable = new LinkedHashMap<>();
        int level = clickedEdge.from().level();
        int fixedCoordinate = fixedCoordinate(orientation, clickedEdge);
        for (DungeonBoundarySnapshot boundary : snapshot.map().boundaries()) {
            DungeonEdgeRef edge = boundary.edge();
            if (!matchesStretchLine(edge, clusterCells, level, orientation, fixedCoordinate, outer)) {
                continue;
            }
            edgesByVariable.put(variableCoordinate(orientation, edge), edge);
        }
        return edgesByVariable;
    }

    private static boolean matchesStretchLine(
            @Nullable DungeonEdgeRef edge,
            Set<DungeonCellRef> clusterCells,
            int level,
            BoundaryStretchOrientation orientation,
            int fixedCoordinate,
            boolean outer
    ) {
        if (edge == null
                || edge.from() == null
                || edge.to() == null
                || edge.from().level() != level
                || edge.to().level() != level
                || !sameOrientation(orientation, edge)
                || fixedCoordinate(orientation, edge) != fixedCoordinate) {
            return false;
        }
        int touchCount = touchingClusterCount(edge, clusterCells);
        return touchCount >= 1 && (touchCount == 1) == outer;
    }

    private static List<DungeonEdgeRef> contiguousStretchEdges(
            Map<Integer, DungeonEdgeRef> edgesByVariable,
            DungeonEdgeRef clickedEdge,
            BoundaryStretchOrientation orientation
    ) {
        int min = variableCoordinate(orientation, clickedEdge);
        int max = min;
        while (edgesByVariable.containsKey(min - 1)) {
            min--;
        }
        while (edgesByVariable.containsKey(max + 1)) {
            max++;
        }
        List<DungeonEdgeRef> result = new ArrayList<>();
        for (int variable = min; variable <= max; variable++) {
            DungeonEdgeRef edge = edgesByVariable.get(variable);
            if (edge != null) {
                result.add(edge);
            }
        }
        return List.copyOf(result);
    }

    private static Set<DungeonCellRef> clusterCells(@Nullable DungeonSnapshot snapshot, long clusterId, int level) {
        if (snapshot == null || snapshot.map() == null || clusterId <= 0L) {
            return Set.of();
        }
        Set<DungeonCellRef> result = new LinkedHashSet<>();
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM || area.clusterId() != clusterId) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                if (cell.level() == level) {
                    result.add(cell);
                }
            }
        }
        return Set.copyOf(result);
    }

    private static int touchingClusterCount(DungeonEdgeRef edge, Set<DungeonCellRef> clusterCells) {
        if (edge == null || edge.from() == null || edge.to() == null || edge.from().level() != edge.to().level()) {
            return 0;
        }
        if (edge.from().r() == edge.to().r()) {
            return horizontalTouchingClusterCount(edge.from(), edge.to(), clusterCells);
        }
        if (edge.from().q() == edge.to().q()) {
            return verticalTouchingClusterCount(edge.from(), edge.to(), clusterCells);
        }
        return 0;
    }

    private static int horizontalTouchingClusterCount(
            DungeonCellRef from,
            DungeonCellRef to,
            Set<DungeonCellRef> clusterCells
    ) {
        int count = 0;
        for (int q = Math.min(from.q(), to.q()); q < Math.max(from.q(), to.q()); q++) {
            if (clusterCells.contains(new DungeonCellRef(q, from.r() - 1, from.level()))) {
                count++;
            }
            if (clusterCells.contains(new DungeonCellRef(q, from.r(), from.level()))) {
                count++;
            }
        }
        return count;
    }

    private static int verticalTouchingClusterCount(
            DungeonCellRef from,
            DungeonCellRef to,
            Set<DungeonCellRef> clusterCells
    ) {
        int count = 0;
        for (int r = Math.min(from.r(), to.r()); r < Math.max(from.r(), to.r()); r++) {
            if (clusterCells.contains(new DungeonCellRef(from.q() - 1, r, from.level()))) {
                count++;
            }
            if (clusterCells.contains(new DungeonCellRef(from.q(), r, from.level()))) {
                count++;
            }
        }
        return count;
    }

    private static boolean sameOrientation(BoundaryStretchOrientation orientation, DungeonEdgeRef edge) {
        return switch (orientation) {
            case HORIZONTAL -> edge.from().r() == edge.to().r();
            case VERTICAL -> edge.from().q() == edge.to().q();
        };
    }

    private static int fixedCoordinate(BoundaryStretchOrientation orientation, DungeonEdgeRef edge) {
        return orientation == BoundaryStretchOrientation.VERTICAL ? edge.from().q() : edge.from().r();
    }

    private static int variableCoordinate(BoundaryStretchOrientation orientation, DungeonEdgeRef edge) {
        return orientation == BoundaryStretchOrientation.VERTICAL
                ? Math.min(edge.from().r(), edge.to().r())
                : Math.min(edge.from().q(), edge.to().q());
    }

    private static List<Integer> levelsFrom(DungeonSnapshot snapshot, int fallbackLevel) {
        TreeSet<Integer> levels = new TreeSet<>();
        if (snapshot != null && snapshot.map() != null) {
            snapshot.map().areas().forEach(area -> addCellLevels(levels, area.cells()));
            for (DungeonFeatureSnapshot feature : snapshot.map().features()) {
                addCellLevels(levels, feature.cells());
            }
            snapshot.map().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ArrayList<>(levels);
    }

    private static void addCellLevels(Set<Integer> levels, List<DungeonCellRef> cells) {
        for (DungeonCellRef cell : cells == null ? List.<DungeonCellRef>of() : cells) {
            levels.add(cell.level());
        }
    }

    private static String key(DungeonMapId mapId) {
        return mapId == null ? "" : Long.toString(mapId.value());
    }

    record InteractionResult(boolean consumed, @Nullable ActionIntent action) {
        static InteractionResult ignored() {
            return new InteractionResult(false, null);
        }

        static InteractionResult consumed(@Nullable ActionIntent action) {
            return new InteractionResult(true, action);
        }
    }

    public record ActionIntent(
            Action kind,
            @Nullable DungeonMapId mapId,
            String mapName,
            @Nullable SurfaceMutation surfaceMutation,
            String statusText,
            @Nullable DragSession dragSession,
            @Nullable BoundaryStretchSession boundaryStretchSession,
            @Nullable DungeonTopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection,
            @Nullable DungeonSurfaceKind surfaceKind
    ) {
        public ActionIntent {
            mapName = mapName == null ? "" : mapName;
            statusText = statusText == null ? "" : statusText;
            clusterId = Math.max(0L, clusterId);
        }

        static ActionIntent refresh() {
            return new ActionIntent(
                    Action.REFRESH,
                    null,
                    "",
                    null,
                    "",
                    null,
                    null,
                    null,
                    0L,
                    false,
                    null);
        }

        static ActionIntent loadSelectedMap(DungeonMapId mapId) {
            return new ActionIntent(
                    Action.LOAD_SELECTED_MAP,
                    mapId,
                    "",
                    null,
                    "",
                    null,
                    null,
                    null,
                    0L,
                    false,
                    null);
        }

        static ActionIntent createMap(String mapName) {
            return new ActionIntent(
                    Action.CREATE_MAP,
                    null,
                    mapName,
                    null,
                    "",
                    null,
                    null,
                    null,
                    0L,
                    false,
                    null);
        }

        static ActionIntent renameMap(DungeonMapId mapId, String mapName) {
            return new ActionIntent(
                    Action.RENAME_MAP,
                    mapId,
                    mapName,
                    null,
                    "",
                    null,
                    null,
                    null,
                    0L,
                    false,
                    null);
        }

        static ActionIntent deleteMap(DungeonMapId mapId) {
            return new ActionIntent(
                    Action.DELETE_MAP,
                    mapId,
                    "",
                    null,
                    "",
                    null,
                    null,
                    null,
                    0L,
                    false,
                    null);
        }

        static ActionIntent saveRoomNarration(
                DungeonMapId mapId,
                SaveRoomNarrationMutation mutation
        ) {
            return new ActionIntent(
                    Action.SAVE_ROOM_NARRATION,
                    mapId,
                    "",
                    mutation,
                    "",
                    null,
                    null,
                    null,
                    0L,
                    false,
                    null);
        }

        static ActionIntent moveSelectedHandle(
                DungeonMapId mapId,
                MoveHandleMutation mutation,
                DragSession dragSession
        ) {
            return new ActionIntent(
                    Action.MOVE_SELECTED_HANDLE,
                    mapId,
                    "",
                    mutation,
                    "",
                    dragSession,
                    null,
                    null,
                    0L,
                    false,
                    null);
        }

        static ActionIntent previewSurfaceEdit(DungeonMapId mapId, SurfaceMutation surfaceMutation) {
            return new ActionIntent(
                    Action.PREVIEW_SURFACE_EDIT,
                    mapId,
                    "",
                    surfaceMutation,
                    "",
                    null,
                    null,
                    null,
                    0L,
                    false,
                    null);
        }

        static ActionIntent applyBoundaryStretch(
                DungeonMapId mapId,
                MoveBoundaryStretchMutation mutation,
                BoundaryStretchSession boundaryStretchSession
        ) {
            return new ActionIntent(
                    Action.APPLY_BOUNDARY_STRETCH,
                    mapId,
                    "",
                    mutation,
                    "",
                    null,
                    boundaryStretchSession,
                    null,
                    0L,
                    false,
                    null);
        }

        static ActionIntent applyOperation(
                DungeonMapId mapId,
                SurfaceMutation surfaceMutation,
                String statusText
        ) {
            return new ActionIntent(
                    Action.APPLY_OPERATION,
                    mapId,
                    "",
                    surfaceMutation,
                    statusText,
                    null,
                    null,
                    null,
                    0L,
                    false,
                    null);
        }

        static ActionIntent refreshInspector(
                DungeonMapId mapId,
                DungeonTopologyElementRef topologyRef,
                long clusterId,
                boolean clusterSelection,
                DungeonSurfaceKind surfaceKind
        ) {
            return new ActionIntent(
                    Action.REFRESH_INSPECTOR,
                    mapId,
                    "",
                    null,
                    "",
                    null,
                    null,
                    topologyRef,
                    clusterId,
                    clusterSelection,
                    surfaceKind);
        }

        enum Action {
            REFRESH,
            LOAD_SELECTED_MAP,
            CREATE_MAP,
            RENAME_MAP,
            DELETE_MAP,
            SAVE_ROOM_NARRATION,
            MOVE_SELECTED_HANDLE,
            PREVIEW_SURFACE_EDIT,
            APPLY_BOUNDARY_STRETCH,
            APPLY_OPERATION,
            REFRESH_INSPECTOR
        }
    }

    sealed interface SurfaceMutation permits RoomRectangleMutation,
            ClusterBoundariesMutation,
            SaveRoomNarrationMutation,
            MoveHandleMutation,
            MoveBoundaryStretchMutation {
    }

    record RoomRectangleMutation(DungeonCellRef start, DungeonCellRef end, boolean deleteMode) implements SurfaceMutation {
    }

    record ClusterBoundariesMutation(
            long clusterId,
            List<DungeonEdgeRef> edges,
            DungeonBoundaryKind boundaryKind,
            boolean deleteMode
    ) implements SurfaceMutation {
        ClusterBoundariesMutation {
            edges = edges == null ? List.of() : List.copyOf(edges);
        }
    }

    record SaveRoomNarrationMutation(
            long roomId,
            String visualDescription,
            List<RoomExitNarrationInput> exits
    ) implements SurfaceMutation {
        SaveRoomNarrationMutation {
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    record MoveHandleMutation(
            DungeonEditorHandleRef handleRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements SurfaceMutation {
    }

    record MoveBoundaryStretchMutation(
            long clusterId,
            List<DungeonEdgeRef> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements SurfaceMutation {
        MoveBoundaryStretchMutation {
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        }
    }

    record InspectorRequest(
            DungeonMapId mapId,
            DungeonTopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection,
            DungeonSurfaceKind surfaceKind
    ) {
    }

    public record RoomExitNarrationInput(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        public RoomExitNarrationInput {
            label = label == null ? "" : label;
            direction = direction == null ? "" : direction;
            description = description == null ? "" : description;
        }
    }

    public record MapSelection(
            String key,
            DungeonMapId mapId,
            String mapName,
            long revision
    ) {
        public MapSelection {
            key = key == null ? "" : key;
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0L, revision);
        }
    }

    public enum HitKind {
        EMPTY,
        HANDLE,
        LABEL,
        BOUNDARY,
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    public record CellTarget(
            int q,
            int r,
            int level
    ) {
        public static CellTarget empty() {
            return new CellTarget(0, 0, 0);
        }

        DungeonCellRef toDungeonCellRef() {
            return new DungeonCellRef(q, r, level);
        }
    }

    public record HandleTarget(
            String kind,
            String topologyRefKind,
            long topologyRefId,
            long ownerId,
            long clusterId,
            long roomId,
            long labelOwnerId,
            int orderIndex,
            CellTarget anchor,
            String label
    ) {
        public HandleTarget {
            kind = kind == null || kind.isBlank() ? DungeonEditorHandleKind.CLUSTER_LABEL.name() : kind;
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            roomId = Math.max(0L, roomId);
            labelOwnerId = Math.max(0L, labelOwnerId);
            orderIndex = Math.max(0, orderIndex);
            anchor = anchor == null ? CellTarget.empty() : anchor;
            label = label == null ? "" : label;
        }

        public static HandleTarget empty() {
            return new HandleTarget(
                    DungeonEditorHandleKind.CLUSTER_LABEL.name(),
                    "EMPTY",
                    0L,
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    CellTarget.empty(),
                    "");
        }

        static HandleTarget clusterLabel(
                String topologyRefKind,
                long topologyRefId,
                long ownerId,
                long clusterId
        ) {
            return new HandleTarget(
                    DungeonEditorHandleKind.CLUSTER_LABEL.name(),
                    topologyRefKind,
                    topologyRefId,
                    ownerId,
                    clusterId,
                    0L,
                    ownerId,
                    0,
                    CellTarget.empty(),
                    "");
        }

        boolean clusterLabel() {
            return DungeonEditorHandleKind.CLUSTER_LABEL.name().equals(kind);
        }

        DungeonEditorHandleRef toDungeonHandleRef() {
            return new DungeonEditorHandleRef(
                    toHandleKind(kind),
                    new DungeonTopologyElementRef(toTopologyElementKind(topologyRefKind), topologyRefId),
                    ownerId,
                    clusterId,
                    roomId,
                    labelOwnerId,
                    orderIndex,
                    anchor.toDungeonCellRef(),
                    label);
        }
    }

    public record HitTarget(
            HitKind kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            String label,
            HandleTarget handleRef
    ) {
        public HitTarget {
            kind = kind == null ? HitKind.EMPTY : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            label = label == null || label.isBlank() ? kind.name() : label;
            handleRef = handleRef == null
                    ? HandleTarget.clusterLabel(topologyRefKind, topologyRefId, ownerId, clusterId)
                    : handleRef;
        }
    }

    private static HitTarget emptyHitTarget() {
        return new HitTarget(HitKind.EMPTY, 0L, 0L, "EMPTY", 0L, "", emptyHandleRef());
    }

    private static HandleTarget emptyHandleRef() {
        return HandleTarget.empty();
    }

    public record PointerInput(
            int q,
            int r,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            HitTarget hitTarget,
            VertexTarget vertexTarget,
            BoundaryTarget boundaryTarget
    ) {
        public PointerInput {
            hitTarget = hitTarget == null ? emptyHitTarget() : hitTarget;
            vertexTarget = vertexTarget == null ? VertexTarget.empty() : vertexTarget;
            boundaryTarget = boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget;
        }
    }

    public record VertexTarget(
            boolean present,
            int q,
            int r,
            int level
    ) {
        public static VertexTarget empty() {
            return new VertexTarget(false, 0, 0, 0);
        }
    }

    public record BoundaryTarget(
            boolean present,
            String kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            CellTarget start,
            CellTarget end
    ) {
        public BoundaryTarget {
            kind = kind == null || kind.isBlank() ? "WALL" : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind;
            topologyRefId = Math.max(0L, topologyRefId);
            start = start == null ? CellTarget.empty() : start;
            end = end == null ? CellTarget.empty() : end;
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget(false, "WALL", 0L, 0L, "EMPTY", 0L,
                    CellTarget.empty(), CellTarget.empty());
        }
    }

    private static final class BoundaryInteraction {

        private static final String WALL_CREATE_TOOL = "Wand setzen";
        private static final String WALL_DELETE_TOOL = "Wand loeschen";
        private static final String DOOR_CREATE_TOOL = "Tuer setzen";
        private static final String DOOR_DELETE_TOOL = "Tuer loeschen";

        private @Nullable BoundaryDraft draft;

        boolean handles(String selectedTool) {
            return wallToolSelected(selectedTool) || doorToolSelected(selectedTool);
        }

        boolean hasDraft() {
            return draft != null;
        }

        boolean previewsWithoutDraft(String selectedTool) {
            return doorToolSelected(selectedTool);
        }

        PressResult press(
                PointerInput input,
                String selectedTool,
                @Nullable DungeonSnapshot snapshot,
                @Nullable Selection selection
        ) {
            if (input == null || !handles(selectedTool)) {
                return PressResult.ignored();
            }
            if (doorToolSelected(selectedTool)) {
                return doorPressed(input, selectedTool, snapshot);
            }
            if (input.secondaryButtonDown()) {
                return finishDraft();
            }
            if (!input.primaryButtonDown()) {
                return PressResult.ignored();
            }
            return wallPressed(input, selectedTool, snapshot, selection);
        }

        void clear() {
            draft = null;
        }

        @Nullable EditorPreview preview() {
            BoundaryDraft currentDraft = draft;
            if (currentDraft == null) {
                return null;
            }
            return preview(currentDraft, currentDraft.previewEdges());
        }

        @Nullable EditorPreview preview(
                PointerInput input,
                String selectedTool,
                @Nullable DungeonSnapshot snapshot
        ) {
            if (doorToolSelected(selectedTool)) {
                return doorPreview(input, selectedTool, snapshot);
            }
            BoundaryDraft currentDraft = draft;
            if (currentDraft == null) {
                return null;
            }
            Set<EdgeKey> previewEdges = new LinkedHashSet<>(currentDraft.previewEdges());
            PathResult candidate = previewCandidate(input, selectedTool, snapshot, currentDraft);
            previewEdges.addAll(candidate.committedEdges());
            return preview(currentDraft, previewEdges);
        }

        private static @Nullable EditorPreview preview(BoundaryDraft currentDraft, Set<EdgeKey> previewEdges) {
            if (currentDraft == null || previewEdges.isEmpty()) {
                return null;
            }
            return new EditorPreview.BoundaryEdges(
                    currentDraft.clusterId(),
                    previewEdges.stream().map(EdgeKey::toEdgeRef).toList(),
                    DungeonBoundaryKind.WALL,
                    currentDraft.deleteMode());
        }

        String stateText(String selectedTool) {
            if (!handles(selectedTool)) {
                return "Wandpfad: inaktiv";
            }
            if (draft != null) {
                return draft.status();
            }
            if (WALL_CREATE_TOOL.equals(selectedTool)) {
                return "Wandpfad: Eckpunkte anklicken, Rechtsklick schliesst ab.";
            }
            if (WALL_DELETE_TOOL.equals(selectedTool)) {
                return "Wandpfad: bestehende Innenwand-Eckpunkte anklicken, Rechtsklick schliesst ab.";
            }
            return "Tuerwerkzeug: interne Wand anklicken.";
        }

        private static PathResult previewCandidate(
                PointerInput input,
                String selectedTool,
                @Nullable DungeonSnapshot snapshot,
                BoundaryDraft currentDraft
        ) {
            if (snapshot == null || input == null || !wallToolSelected(selectedTool)) {
                return PathResult.empty();
            }
            VertexTarget vertex = input.vertexTarget();
            if (vertex == null || !vertex.present()) {
                return PathResult.empty();
            }
            if (!isEditableVertex(snapshot, currentDraft.clusterId(), vertex, currentDraft.deleteMode())) {
                return PathResult.empty();
            }
            VertexKey nextVertex = vertexKey(vertex);
            if (currentDraft.currentVertex().equals(nextVertex)) {
                return PathResult.empty();
            }
            return currentDraft.deleteMode()
                    ? findDeletePath(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex)
                    : findCreatePath(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex);
        }

        private static @Nullable EditorPreview doorPreview(
                PointerInput input,
                String selectedTool,
                @Nullable DungeonSnapshot snapshot
        ) {
            BoundaryTarget boundary = input == null ? null : input.boundaryTarget();
            boolean deleteMode = DOOR_DELETE_TOOL.equals(selectedTool);
            if (!editableDoorBoundary(snapshot, boundary, deleteMode)) {
                return null;
            }
            BoundaryTarget safeBoundary = Objects.requireNonNull(boundary);
            return new EditorPreview.BoundaryEdges(
                    safeBoundary.clusterId(),
                    List.of(edgeRef(
                            safeBoundary.start().toDungeonCellRef(),
                            safeBoundary.end().toDungeonCellRef())),
                    DungeonBoundaryKind.DOOR,
                    deleteMode);
        }

        private PressResult doorPressed(
                PointerInput input,
                String selectedTool,
                @Nullable DungeonSnapshot snapshot
        ) {
            BoundaryTarget boundary = input.boundaryTarget();
            if (!input.primaryButtonDown()) {
                return PressResult.ignored();
            }
            boolean deleteMode = DOOR_DELETE_TOOL.equals(selectedTool);
            if (!editableDoorBoundary(snapshot, boundary, deleteMode)) {
                return PressResult.ignored();
            }
            ClusterBoundariesMutation mutation = new ClusterBoundariesMutation(
                    boundary.clusterId(),
                    List.of(edgeRef(
                            boundary.start().toDungeonCellRef(),
                            boundary.end().toDungeonCellRef())),
                    DungeonBoundaryKind.DOOR,
                    deleteMode);
            String status = deleteMode ? "Tuer geloescht." : "Tuer gesetzt.";
            return PressResult.consumed(new BoundaryCommit(mutation, status));
        }

        private PressResult wallPressed(
                PointerInput input,
                String selectedTool,
                @Nullable DungeonSnapshot snapshot,
            @Nullable Selection selection
        ) {
            VertexTarget vertex = input.vertexTarget();
            if (snapshot == null || vertex == null || !vertex.present()) {
                return ignoredWithoutDraft();
            }
            boolean deleteMode = WALL_DELETE_TOOL.equals(selectedTool);
            long clusterId = resolveClusterId(input, vertex, deleteMode, snapshot, selection);
            if (clusterId <= 0L) {
                return ignoredWithoutDraft();
            }
            VertexKey nextVertex = vertexKey(vertex);
            BoundaryDraft currentDraft = draft;
            if (currentDraft == null || currentDraft.clusterId() != clusterId) {
                return startWallDraft(snapshot, clusterId, vertex, nextVertex, deleteMode);
            }
            if (currentDraft.currentVertex().equals(nextVertex)) {
                return PressResult.consumed(null);
            }
            return extendWallDraft(currentDraft, snapshot, clusterId, nextVertex, deleteMode);
        }

        private PressResult ignoredWithoutDraft() {
            if (draft == null) {
                clear();
            }
            return PressResult.ignored();
        }

        private static VertexKey vertexKey(VertexTarget vertex) {
            return new VertexKey(vertex.q(), vertex.r(), vertex.level());
        }

        private PressResult startWallDraft(
                DungeonSnapshot snapshot,
                long clusterId,
                VertexTarget vertex,
                VertexKey startVertex,
                boolean deleteMode
        ) {
            if (!isEditableVertex(snapshot, clusterId, vertex, deleteMode)) {
                return PressResult.ignored();
            }
            draft = new BoundaryDraft(
                    clusterId,
                    deleteMode,
                    startVertex,
                    startVertex,
                    Set.of(),
                    Set.of(),
                    startWallStatus(deleteMode));
            return PressResult.consumed(null);
        }

        private static String startWallStatus(boolean deleteMode) {
            return deleteMode
                    ? "Wandpfad: Start auf Innenwand gewaehlt, naechsten Eckpunkt anklicken."
                    : "Wandpfad: Start-Eckpunkt gewaehlt, naechsten Eckpunkt anklicken.";
        }

        private PressResult extendWallDraft(
                BoundaryDraft currentDraft,
                DungeonSnapshot snapshot,
                long clusterId,
                VertexKey nextVertex,
                boolean deleteMode
        ) {
            PathResult path = deleteMode
                    ? findDeletePath(snapshot, clusterId, currentDraft.currentVertex(), nextVertex)
                    : findCreatePath(snapshot, clusterId, currentDraft.currentVertex(), nextVertex);
            if (!path.hasRoute()) {
                draft = currentDraft.withStatus(deleteMode
                        ? "Wandpfad: Pfad kann nur entlang bestehender Innenwaende verlaufen."
                        : "Wandpfad: Zwischen diesen Eckpunkten gibt es keinen gueltigen Pfad.");
                return PressResult.consumed(null);
            }
            Set<EdgeKey> previewEdges = new LinkedHashSet<>(currentDraft.previewEdges());
            previewEdges.addAll(path.committedEdges());
            Set<EdgeKey> skippedDoorEdges = new LinkedHashSet<>(currentDraft.skippedDoorEdges());
            skippedDoorEdges.addAll(path.skippedDoorEdges());
            draft = new BoundaryDraft(
                    clusterId,
                    deleteMode,
                    currentDraft.startVertex(),
                    nextVertex,
                    previewEdges,
                    skippedDoorEdges,
                    wallStatus(deleteMode, previewEdges, skippedDoorEdges));
            if (!deleteMode && touchesExistingWall(snapshot, clusterId, nextVertex)) {
                return finishDraft();
            }
            return PressResult.consumed(null);
        }

        private PressResult finishDraft() {
            BoundaryDraft current = draft;
            draft = null;
            if (current == null) {
                return PressResult.ignored();
            }
            if (current.previewEdges().isEmpty()) {
                return PressResult.consumed(null);
            }
            ClusterBoundariesMutation mutation = new ClusterBoundariesMutation(
                    current.clusterId(),
                    current.previewEdges().stream().map(EdgeKey::toEdgeRef).toList(),
                    DungeonBoundaryKind.WALL,
                    current.deleteMode());
            String status = current.deleteMode() ? "Wandpfad geloescht." : "Wandpfad gesetzt.";
            return PressResult.consumed(new BoundaryCommit(mutation, status));
        }

        private long resolveClusterId(
                PointerInput input,
                VertexTarget vertex,
                boolean deleteMode,
                DungeonSnapshot snapshot,
                @Nullable Selection selection
        ) {
            if (draft != null && isEditableVertex(snapshot, draft.clusterId(), vertex, deleteMode)) {
                return draft.clusterId();
            }
            if (selection != null
                    && selection.clusterId() > 0L
                    && isEditableVertex(snapshot, selection.clusterId(), vertex, deleteMode)) {
                return selection.clusterId();
            }
            BoundaryTarget boundary = input.boundaryTarget();
            if (boundary != null
                    && boundary.clusterId() > 0L
                    && isEditableVertex(snapshot, boundary.clusterId(), vertex, deleteMode)) {
                return boundary.clusterId();
            }
            return nearestEditableCluster(snapshot, vertex, deleteMode);
        }

        private static long nearestEditableCluster(DungeonSnapshot snapshot, VertexTarget vertex, boolean deleteMode) {
            return clusterCellsByCluster(snapshot, vertex.level()).entrySet().stream()
                    .filter(entry -> isEditableVertex(snapshot, entry.getKey(), vertex, deleteMode))
                    .min(Comparator
                            .comparingDouble((Map.Entry<Long, Set<CellKey>> entry) -> centerDistance(entry.getValue(), vertex))
                            .thenComparingLong(Map.Entry::getKey))
                    .map(Map.Entry::getKey)
                    .orElse(0L);
        }

        private static double centerDistance(Set<CellKey> cells, VertexTarget vertex) {
            double q = 0.0;
            double r = 0.0;
            for (CellKey cell : cells) {
                q += cell.q() + 0.5;
                r += cell.r() + 0.5;
            }
            int count = Math.max(1, cells.size());
            return Math.hypot(q / count - vertex.q(), r / count - vertex.r());
        }

        private static boolean isEditableVertex(
                DungeonSnapshot snapshot,
                long clusterId,
                VertexTarget vertex,
                boolean deleteMode
        ) {
            Set<EdgeKey> edges = deleteMode
                    ? existingInternalBoundaryEdges(snapshot, clusterId, vertex.level(), DungeonBoundaryKind.WALL)
                    : internalClusterEdges(snapshot, clusterId, vertex.level());
            VertexKey key = new VertexKey(vertex.q(), vertex.r(), vertex.level());
            return edges.stream().anyMatch(edge -> edge.touches(key));
        }

        private static PathResult findCreatePath(
                DungeonSnapshot snapshot,
                long clusterId,
                VertexKey start,
                VertexKey goal
        ) {
            Set<EdgeKey> traversableEdges = internalClusterEdges(snapshot, clusterId, start.level());
            List<EdgeKey> route = shortestPath(start, goal, traversableEdges);
            if (route.isEmpty()) {
                return PathResult.empty();
            }
            Set<EdgeKey> doors = existingInternalBoundaryEdges(snapshot, clusterId, start.level(), DungeonBoundaryKind.DOOR);
            Set<EdgeKey> committed = new LinkedHashSet<>(route);
            committed.removeAll(doors);
            Set<EdgeKey> skippedDoors = new LinkedHashSet<>(route);
            skippedDoors.retainAll(doors);
            return new PathResult(route, committed, skippedDoors);
        }

        private static PathResult findDeletePath(
                DungeonSnapshot snapshot,
                long clusterId,
                VertexKey start,
                VertexKey goal
        ) {
            Set<EdgeKey> walls = existingInternalBoundaryEdges(snapshot, clusterId, start.level(), DungeonBoundaryKind.WALL);
            List<EdgeKey> route = shortestPath(start, goal, walls);
            return route.isEmpty() ? PathResult.empty() : new PathResult(route, new LinkedHashSet<>(route), Set.of());
        }

        private static List<EdgeKey> shortestPath(VertexKey start, VertexKey goal, Set<EdgeKey> traversableEdges) {
            if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
                return List.of();
            }
            Map<VertexKey, Set<VertexKey>> adjacency = adjacency(traversableEdges);
            if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
                return List.of();
            }
            java.util.ArrayDeque<VertexKey> queue = new java.util.ArrayDeque<>();
            Map<VertexKey, VertexKey> previous = new LinkedHashMap<>();
            queue.add(start);
            previous.put(start, null);
            while (!queue.isEmpty()) {
                VertexKey current = queue.removeFirst();
                if (current.equals(goal)) {
                    break;
                }
                for (VertexKey neighbor : adjacency.getOrDefault(current, Set.of()).stream()
                        .sorted(VertexKey.ORDER)
                        .toList()) {
                    if (previous.containsKey(neighbor)) {
                        continue;
                    }
                    previous.put(neighbor, current);
                    queue.addLast(neighbor);
                }
            }
            if (!previous.containsKey(goal)) {
                return List.of();
            }
            List<EdgeKey> path = new ArrayList<>();
            VertexKey current = goal;
            while (!current.equals(start)) {
                VertexKey parent = previous.get(current);
                if (parent == null) {
                    return List.of();
                }
                path.add(EdgeKey.between(parent, current));
                current = parent;
            }
            java.util.Collections.reverse(path);
            return List.copyOf(path);
        }

        private static Map<VertexKey, Set<VertexKey>> adjacency(Set<EdgeKey> edges) {
            Map<VertexKey, Set<VertexKey>> result = new LinkedHashMap<>();
            for (EdgeKey edge : edges == null ? Set.<EdgeKey>of() : edges) {
                result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
                result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
            }
            return Map.copyOf(result);
        }

        private static Set<EdgeKey> internalClusterEdges(DungeonSnapshot snapshot, long clusterId, int level) {
            Set<CellKey> cells = clusterCellsByCluster(snapshot, level).getOrDefault(clusterId, Set.of());
            Set<EdgeKey> result = new LinkedHashSet<>();
            for (CellKey cell : cells) {
                for (Direction direction : Direction.values()) {
                    CellKey neighbor = cell.neighbor(direction);
                    if (cells.contains(neighbor)) {
                        result.add(EdgeKey.sideOf(cell, direction));
                    }
                }
            }
            return Set.copyOf(result);
        }

        private static Set<EdgeKey> existingInternalBoundaryEdges(
                DungeonSnapshot snapshot,
                long clusterId,
                int level,
                DungeonBoundaryKind kind
        ) {
            Set<EdgeKey> internalEdges = internalClusterEdges(snapshot, clusterId, level);
            Set<EdgeKey> result = new LinkedHashSet<>();
            for (DungeonBoundarySnapshot boundary : boundaries(snapshot)) {
                if (boundary.edge() == null
                        || boundary.edge().from() == null
                        || boundary.edge().to() == null
                        || boundary.edge().from().level() != level
                        || !boundaryKindMatches(boundary, kind)) {
                    continue;
                }
                EdgeKey edge = EdgeKey.from(boundary.edge());
                if (internalEdges.contains(edge)) {
                    result.add(edge);
                }
            }
            return Set.copyOf(result);
        }

        private static boolean touchesExistingWall(DungeonSnapshot snapshot, long clusterId, VertexKey vertex) {
            Set<EdgeKey> edges = new LinkedHashSet<>(existingInternalBoundaryEdges(
                    snapshot,
                    clusterId,
                    vertex.level(),
                    DungeonBoundaryKind.WALL));
            edges.addAll(outerClusterEdges(snapshot, clusterId, vertex.level()));
            return edges.stream().anyMatch(edge -> edge.touches(vertex));
        }

        private static Set<EdgeKey> outerClusterEdges(DungeonSnapshot snapshot, long clusterId, int level) {
            Set<CellKey> cells = clusterCellsByCluster(snapshot, level).getOrDefault(clusterId, Set.of());
            Set<EdgeKey> result = new LinkedHashSet<>();
            for (CellKey cell : cells) {
                for (Direction direction : Direction.values()) {
                    if (!cells.contains(cell.neighbor(direction))) {
                        result.add(EdgeKey.sideOf(cell, direction));
                    }
                }
            }
            return Set.copyOf(result);
        }

        private static Map<Long, Set<CellKey>> clusterCellsByCluster(DungeonSnapshot snapshot, int level) {
            Map<Long, Set<CellKey>> result = new LinkedHashMap<>();
            if (snapshot == null || snapshot.map() == null) {
                return Map.of();
            }
            for (DungeonAreaSnapshot area : snapshot.map().areas()) {
                if (area.kind() != DungeonAreaKind.ROOM || area.clusterId() <= 0L) {
                    continue;
                }
                Set<CellKey> cells = result.computeIfAbsent(area.clusterId(), ignored -> new LinkedHashSet<>());
                for (DungeonCellRef cell : area.cells()) {
                    if (cell.level() == level) {
                        cells.add(new CellKey(cell.q(), cell.r(), cell.level()));
                    }
                }
            }
            Map<Long, Set<CellKey>> immutable = new LinkedHashMap<>();
            for (Map.Entry<Long, Set<CellKey>> entry : result.entrySet()) {
                immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
            }
            return Map.copyOf(immutable);
        }

        private static List<DungeonBoundarySnapshot> boundaries(DungeonSnapshot snapshot) {
            return snapshot == null || snapshot.map() == null ? List.of() : snapshot.map().boundaries();
        }

        private static boolean boundaryKindMatches(DungeonBoundarySnapshot boundary, DungeonBoundaryKind kind) {
            if (kind == DungeonBoundaryKind.DOOR) {
                return "door".equalsIgnoreCase(boundary.kind());
            }
            return !"door".equalsIgnoreCase(boundary.kind());
        }

        private static boolean editableDoorBoundary(
                @Nullable DungeonSnapshot snapshot,
                @Nullable BoundaryTarget boundary,
                boolean deleteMode
        ) {
            if (boundary == null || !boundary.present() || boundary.clusterId() <= 0L) {
                return false;
            }
            if (deleteMode) {
                return "DOOR".equals(boundary.kind());
            }
            return !"DOOR".equals(boundary.kind()) && touchesDistinctRooms(snapshot, boundary);
        }

        private static boolean touchesDistinctRooms(@Nullable DungeonSnapshot snapshot, BoundaryTarget boundary) {
            if (snapshot == null || snapshot.map() == null || boundary == null) {
                return false;
            }
            Set<Long> roomIds = new LinkedHashSet<>();
            List<CellKey> touchingCells = DungeonEditorPresentationModel.touchingCells(
                    boundary.start().toDungeonCellRef(),
                    boundary.end().toDungeonCellRef()).stream()
                    .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                    .toList();
            for (DungeonAreaSnapshot area : snapshot.map().areas()) {
                if (area.kind() != DungeonAreaKind.ROOM || area.clusterId() != boundary.clusterId()) {
                    continue;
                }
                for (DungeonCellRef cell : area.cells()) {
                    if (touchingCells.contains(new CellKey(cell.q(), cell.r(), cell.level()))) {
                        roomIds.add(area.id());
                    }
                }
            }
            return roomIds.size() >= 2;
        }

        private static DungeonEdgeRef edgeRef(DungeonCellRef start, DungeonCellRef end) {
            return new DungeonEdgeRef(start, end);
        }

        private static String wallStatus(
                boolean deleteMode,
                Set<EdgeKey> previewEdges,
                Set<EdgeKey> skippedDoorEdges
        ) {
            if (deleteMode) {
                return previewEdges.isEmpty()
                        ? "Wandpfad: Nur Aussenwaende getroffen, nichts zu loeschen."
                        : "Wandpfad: Innenwandpfad aktiv, Rechtsklick schliesst ab.";
            }
            if (!skippedDoorEdges.isEmpty()) {
                return "Wandpfad: Pfad aktiv, Tueren bleiben erhalten, Rechtsklick schliesst ab.";
            }
            return "Wandpfad: aktiv, Rechtsklick oder Klick auf bestehende Wand schliesst ab.";
        }

        private static boolean wallToolSelected(String selectedTool) {
            return WALL_CREATE_TOOL.equals(selectedTool) || WALL_DELETE_TOOL.equals(selectedTool);
        }

        private static boolean doorToolSelected(String selectedTool) {
            return DOOR_CREATE_TOOL.equals(selectedTool) || DOOR_DELETE_TOOL.equals(selectedTool);
        }

        private record PressResult(boolean consumed, @Nullable BoundaryCommit commit) {
            static PressResult ignored() {
                return new PressResult(false, null);
            }

            static PressResult consumed(@Nullable BoundaryCommit commit) {
                return new PressResult(true, commit);
            }
        }

        private record BoundaryCommit(ClusterBoundariesMutation mutation, String status) {
        }

        private record BoundaryDraft(
                long clusterId,
                boolean deleteMode,
                VertexKey startVertex,
                VertexKey currentVertex,
                Set<EdgeKey> previewEdges,
                Set<EdgeKey> skippedDoorEdges,
                String status
        ) {
            private BoundaryDraft {
                previewEdges = previewEdges == null ? Set.of() : Set.copyOf(previewEdges);
                skippedDoorEdges = skippedDoorEdges == null ? Set.of() : Set.copyOf(skippedDoorEdges);
                status = status == null ? "" : status;
            }

            BoundaryDraft withStatus(String nextStatus) {
                return new BoundaryDraft(
                        clusterId,
                        deleteMode,
                        startVertex,
                        currentVertex,
                        previewEdges,
                        skippedDoorEdges,
                        nextStatus);
            }
        }

        private record PathResult(
                List<EdgeKey> routeEdges,
                Set<EdgeKey> committedEdges,
                Set<EdgeKey> skippedDoorEdges
        ) {
            private PathResult {
                routeEdges = routeEdges == null ? List.of() : List.copyOf(routeEdges);
                committedEdges = committedEdges == null ? Set.of() : Set.copyOf(committedEdges);
                skippedDoorEdges = skippedDoorEdges == null ? Set.of() : Set.copyOf(skippedDoorEdges);
            }

            static PathResult empty() {
                return new PathResult(List.of(), Set.of(), Set.of());
            }

            boolean hasRoute() {
                return !routeEdges.isEmpty();
            }
        }

        private record CellKey(int q, int r, int level) {
            CellKey neighbor(Direction direction) {
                return new CellKey(q + direction.deltaQ(), r + direction.deltaR(), level);
            }
        }

        private record VertexKey(int q, int r, int level) {
            private static final Comparator<VertexKey> ORDER = Comparator
                    .comparingInt(VertexKey::level)
                    .thenComparingInt(VertexKey::r)
                    .thenComparingInt(VertexKey::q);
        }

        private record EdgeKey(VertexKey start, VertexKey end) {
            static EdgeKey from(DungeonEdgeRef edge) {
                return between(
                        new VertexKey(edge.from().q(), edge.from().r(), edge.from().level()),
                        new VertexKey(edge.to().q(), edge.to().r(), edge.to().level()));
            }

            static EdgeKey between(VertexKey first, VertexKey second) {
                return VertexKey.ORDER.compare(first, second) <= 0
                        ? new EdgeKey(first, second)
                        : new EdgeKey(second, first);
            }

            static EdgeKey sideOf(CellKey cell, Direction direction) {
                return switch (direction) {
                    case NORTH -> between(
                            new VertexKey(cell.q(), cell.r(), cell.level()),
                            new VertexKey(cell.q() + 1, cell.r(), cell.level()));
                    case EAST -> between(
                            new VertexKey(cell.q() + 1, cell.r(), cell.level()),
                            new VertexKey(cell.q() + 1, cell.r() + 1, cell.level()));
                    case SOUTH -> between(
                            new VertexKey(cell.q(), cell.r() + 1, cell.level()),
                            new VertexKey(cell.q() + 1, cell.r() + 1, cell.level()));
                    case WEST -> between(
                            new VertexKey(cell.q(), cell.r(), cell.level()),
                            new VertexKey(cell.q(), cell.r() + 1, cell.level()));
                };
            }

            boolean touches(VertexKey vertex) {
                return start.equals(vertex) || end.equals(vertex);
            }

            DungeonEdgeRef toEdgeRef() {
                return new DungeonEdgeRef(
                        new DungeonCellRef(start.q(), start.r(), start.level()),
                        new DungeonCellRef(end.q(), end.r(), end.level()));
            }
        }

        private enum Direction {
            NORTH(0, -1),
            EAST(1, 0),
            SOUTH(0, 1),
            WEST(-1, 0);

            private final int deltaQ;
            private final int deltaR;

            Direction(int deltaQ, int deltaR) {
                this.deltaQ = deltaQ;
                this.deltaR = deltaR;
            }

            int deltaQ() {
                return deltaQ;
            }

            int deltaR() {
                return deltaR;
            }
        }
    }

    static List<DungeonCellRef> touchingCells(DungeonCellRef start, DungeonCellRef end) {
        if (start == null || end == null || start.level() != end.level()) {
            return List.of();
        }
        if (start.r() == end.r()) {
            return horizontalTouchingCells(start, end);
        }
        if (start.q() == end.q()) {
            return verticalTouchingCells(start, end);
        }
        return List.of();
    }

    private static List<DungeonCellRef> horizontalTouchingCells(DungeonCellRef start, DungeonCellRef end) {
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        List<DungeonCellRef> result = new ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new DungeonCellRef(q, start.r() - 1, start.level()));
            result.add(new DungeonCellRef(q, start.r(), start.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCellRef> verticalTouchingCells(DungeonCellRef start, DungeonCellRef end) {
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        List<DungeonCellRef> result = new ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new DungeonCellRef(start.q() - 1, r, start.level()));
            result.add(new DungeonCellRef(start.q(), r, start.level()));
        }
        return List.copyOf(result);
    }

    private static final class PaintInteraction {

        private static final String ROOM_PAINT_TOOL = "Raum malen";
        private static final String ROOM_DELETE_TOOL = "Raum loeschen";

        private @Nullable PaintSession paintSession;

        boolean press(PointerInput input, String selectedTool) {
            if (input == null || !roomPaintToolSelected(selectedTool)) {
                return false;
            }
            paintSession = new PaintSession(
                    input.q(),
                    input.r(),
                    input.q(),
                    input.r(),
                    input.level(),
                    ROOM_DELETE_TOOL.equals(selectedTool));
            return true;
        }

        boolean drag(PointerInput input, String selectedTool) {
            if (paintSession == null || input == null || !input.primaryButtonDown()
                    || !roomPaintToolSelected(selectedTool)) {
                return false;
            }
            paintSession = paintSession.withEnd(input.q(), input.r());
            return true;
        }

        @Nullable PaintCommit release(@Nullable PointerInput input, String selectedTool) {
            PaintSession session = paintSession;
            if (session == null) {
                return null;
            }
            paintSession = null;
            if (!roomPaintToolSelected(selectedTool)) {
                return null;
            }
            PaintSession released = input == null ? session : session.withEnd(input.q(), input.r());
            DungeonCellRef start = new DungeonCellRef(released.startQ(), released.startR(), released.level());
            DungeonCellRef end = new DungeonCellRef(released.endQ(), released.endR(), released.level());
            RoomRectangleMutation mutation = new RoomRectangleMutation(start, end, released.deleteMode());
            String status = released.deleteMode() ? "Raumflaeche geloescht." : "Raumflaeche gemalt.";
            return new PaintCommit(mutation, status);
        }

        void clear() {
            paintSession = null;
        }

        String stateText() {
            RoomRectangle preview = preview();
            if (preview == null || !preview.active()) {
                return "Raumvorschau: inaktiv";
            }
            return "Raumvorschau: "
                    + (preview.deleteMode() ? "loeschen" : "malen")
                    + " z=" + preview.level();
        }

        private boolean roomPaintToolSelected(String selectedTool) {
            return ROOM_PAINT_TOOL.equals(selectedTool) || ROOM_DELETE_TOOL.equals(selectedTool);
        }

        @Nullable RoomRectangle preview() {
            PaintSession session = paintSession;
            if (session == null) {
                return null;
            }
            return new RoomRectangle(
                    session.startQ(),
                    session.startR(),
                    session.endQ(),
                    session.endR(),
                    session.level(),
                    session.deleteMode());
        }

        private record PaintCommit(RoomRectangleMutation mutation, String status) {
        }

        private record PaintSession(
                int startQ,
                int startR,
                int endQ,
                int endR,
                int level,
                boolean deleteMode
        ) {

            PaintSession withEnd(int nextEndQ, int nextEndR) {
                return new PaintSession(startQ, startR, nextEndQ, nextEndR, level, deleteMode);
            }
        }
    }

    record DragSession(
            Selection selection,
            int pressQ,
            int pressR,
            int currentQ,
            int currentR,
            int pressLevel,
            int currentLevel,
            @Nullable DungeonSnapshot baseSnapshot
    ) {
        static DragSession start(
                Selection selection,
                int pressQ,
                int pressR,
                int pressLevel,
                @Nullable DungeonSnapshot baseSnapshot
        ) {
            return new DragSession(selection, pressQ, pressR, pressQ, pressR, pressLevel, pressLevel, baseSnapshot);
        }

        int deltaQ() {
            return currentQ - pressQ;
        }

        int deltaR() {
            return currentR - pressR;
        }

        int deltaLevel() {
            return currentLevel - pressLevel;
        }

        boolean moved() {
            return deltaQ() != 0 || deltaR() != 0 || deltaLevel() != 0;
        }

        DragSession withCurrentPointer(int nextQ, int nextR) {
            return new DragSession(selection, pressQ, pressR, nextQ, nextR, pressLevel, currentLevel, baseSnapshot);
        }

        DragSession withCurrentLevel(int nextLevel) {
            return new DragSession(selection, pressQ, pressR, currentQ, currentR, pressLevel, nextLevel, baseSnapshot);
        }
    }

    private enum BoundaryStretchOrientation {
        HORIZONTAL,
        VERTICAL;

        private static @Nullable BoundaryStretchOrientation from(BoundaryTarget boundaryTarget) {
            if (boundaryTarget == null || !boundaryTarget.present()) {
                return null;
            }
            CellTarget start = boundaryTarget.start();
            CellTarget end = boundaryTarget.end();
            if (start == null || end == null) {
                return null;
            }
            if (start.q() == end.q()) {
                return VERTICAL;
            }
            if (start.r() == end.r()) {
                return HORIZONTAL;
            }
            return null;
        }
    }

    record BoundaryStretchSession(
            Selection selection,
            long clusterId,
            List<DungeonEdgeRef> sourceEdges,
            BoundaryStretchOrientation orientation,
            int pressQ,
            int pressR,
            int pressLevel,
            int currentQ,
            int currentR
    ) {
        BoundaryStretchSession {
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
            orientation = orientation == null ? BoundaryStretchOrientation.VERTICAL : orientation;
        }

        BoundaryStretchSession withCurrentPointer(int nextQ, int nextR) {
            return new BoundaryStretchSession(
                    selection,
                    clusterId,
                    sourceEdges,
                    orientation,
                    pressQ,
                    pressR,
                    pressLevel,
                    nextQ,
                    nextR);
        }

        int deltaQ() {
            return orientation == BoundaryStretchOrientation.VERTICAL ? currentQ - pressQ : 0;
        }

        int deltaR() {
            return orientation == BoundaryStretchOrientation.HORIZONTAL ? currentR - pressR : 0;
        }

        int deltaLevel() {
            return 0;
        }

        boolean moved() {
            return deltaQ() != 0 || deltaR() != 0;
        }

        EditorPreview.BoundaryStretchMove preview() {
            return new EditorPreview.BoundaryStretchMove(
                    clusterId,
                    sourceEdges,
                    deltaQ(),
                    deltaR(),
                    deltaLevel(),
                    selection == null ? "" : selection.label());
        }

        MoveBoundaryStretchMutation toMutation() {
            return new MoveBoundaryStretchMutation(
                    clusterId,
                    sourceEdges,
                    deltaQ(),
                    deltaR(),
                    deltaLevel());
        }
    }

}

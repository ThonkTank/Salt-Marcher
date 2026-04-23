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
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.ApplyDungeonEditorOperationCommand;
import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DescribeDungeonSelectionQuery;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.LoadDungeonSnapshotQuery;
import src.domain.dungeon.published.RenameDungeonMapCommand;
import src.domain.dungeon.published.SearchMapsQuery;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel.DragPreview;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel.Selection;

public final class DungeonEditorViewModel {

    private static final String DEFAULT_TOOL = "Auswahl";

    private final DungeonApplicationService dungeon;
    private final PaintInteraction paintInteraction = new PaintInteraction();
    private final BoundaryInteraction boundaryInteraction = new BoundaryInteraction();
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<DungeonSnapshot> snapshot = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<Selection> selection = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<DungeonInspectorSnapshot> inspector = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<DragPreview> dragPreview = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<List<MapSelection>> maps = new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyStringWrapper selectedMapKey = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<List<Integer>> reachableLevels = new ReadOnlyObjectWrapper<>(List.of(0));
    private final ReadOnlyBooleanWrapper busy = new ReadOnlyBooleanWrapper();
    private final ObjectProperty<DungeonMapDisplayModel.ViewMode> viewMode =
            new SimpleObjectProperty<>(DungeonMapDisplayModel.ViewMode.GRID);
    private final ObjectProperty<DungeonMapDisplayModel.LevelOverlaySettings> overlaySettings =
            new SimpleObjectProperty<>(DungeonMapDisplayModel.LevelOverlaySettings.defaults());
    private final IntegerProperty projectionLevel = new SimpleIntegerProperty(0);
    private final StringProperty selectedTool = new SimpleStringProperty(DEFAULT_TOOL);
    private @Nullable DungeonMapId selectedMapId;
    private @Nullable DragSession dragSession;

    public DungeonEditorViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
        refreshStateText();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonSnapshot> snapshotProperty() {
        return snapshot.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<Selection> selectionProperty() {
        return selection.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonInspectorSnapshot> inspectorProperty() {
        return inspector.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DragPreview> dragPreviewProperty() {
        return dragPreview.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonMapDisplayModel.PaintPreview> paintPreviewProperty() {
        return paintInteraction.paintPreviewProperty();
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

    public ObjectProperty<DungeonMapDisplayModel.ViewMode> viewModeProperty() {
        return viewMode;
    }

    public ObjectProperty<DungeonMapDisplayModel.LevelOverlaySettings> overlaySettingsProperty() {
        return overlaySettings;
    }

    public IntegerProperty projectionLevelProperty() {
        return projectionLevel;
    }

    public StringProperty selectedToolProperty() {
        return selectedTool;
    }

    public void selectMap(String mapKey) {
        MapSelection selection = findMap(mapKey);
        if (selection == null) {
            return;
        }
        clearInteraction();
        selectedMapId = selection.mapId();
        selectedMapKey.set(selection.key());
        loadSelectedMap();
    }

    public void selectViewMode(DungeonMapDisplayModel.ViewMode nextViewMode) {
        viewMode.set(nextViewMode == null ? DungeonMapDisplayModel.ViewMode.GRID : nextViewMode);
        refreshStateText();
    }

    public void selectTool(String nextTool) {
        selectedTool.set(nextTool == null || nextTool.isBlank() ? DEFAULT_TOOL : nextTool);
        if (!DEFAULT_TOOL.equals(selectedTool.get())) {
            clearInteraction();
        }
        refreshStateText();
    }

    public void selectOverlayMode(DungeonMapDisplayModel.OverlayMode nextOverlayMode) {
        DungeonMapDisplayModel.LevelOverlaySettings current = overlaySettings.get();
        overlaySettings.set(new DungeonMapDisplayModel.LevelOverlaySettings(
                nextOverlayMode,
                current.levelRange(),
                current.opacity(),
                current.selectedLevels()));
        refreshStateText();
    }

    public void selectOverlayRange(int levelRange) {
        DungeonMapDisplayModel.LevelOverlaySettings current = overlaySettings.get();
        overlaySettings.set(new DungeonMapDisplayModel.LevelOverlaySettings(
                current.mode(),
                levelRange,
                current.opacity(),
                current.selectedLevels()));
        refreshStateText();
    }

    public void selectOverlayOpacity(double opacity) {
        DungeonMapDisplayModel.LevelOverlaySettings current = overlaySettings.get();
        overlaySettings.set(new DungeonMapDisplayModel.LevelOverlaySettings(
                current.mode(),
                current.levelRange(),
                opacity,
                current.selectedLevels()));
        refreshStateText();
    }

    public void selectOverlayLevels(List<Integer> levels) {
        DungeonMapDisplayModel.LevelOverlaySettings current = overlaySettings.get();
        overlaySettings.set(new DungeonMapDisplayModel.LevelOverlaySettings(
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

    public void refresh() {
        withBusy(() -> {
            refreshMaps();
            loadSelectedMap();
        });
    }

    public void createMap(String mapName) {
        withBusy(() -> {
            selectedMapId = dungeon.createMap(new CreateDungeonMapCommand(mapName)).mapId();
            refreshMaps();
            loadSelectedMap();
        });
    }

    public void renameMap(String mapKey, String mapName) {
        MapSelection selection = findMap(mapKey);
        if (selection == null) {
            return;
        }
        withBusy(() -> {
            selectedMapId = dungeon.renameMap(new RenameDungeonMapCommand(selection.mapId(), mapName)).mapId();
            refreshMaps();
            loadSelectedMap();
        });
    }

    public void deleteMap(String mapKey) {
        MapSelection selection = findMap(mapKey);
        if (selection == null) {
            return;
        }
        withBusy(() -> {
            dungeon.deleteMap(new DeleteDungeonMapCommand(selection.mapId()));
            if (Objects.equals(selection.mapId(), selectedMapId)) {
                selectedMapId = null;
                clearInteraction();
            }
            refreshMaps();
            loadSelectedMap();
        });
    }

    public boolean primaryPressed(@Nullable PointerInput input) {
        if (!interactionEnabled() || input == null) {
            return false;
        }
        if (boundaryInteraction.handles(selectedTool.get())) {
            BoundaryInteraction.PressResult boundaryResult =
                    boundaryInteraction.press(input, selectedTool.get(), snapshot.get(), selection.get());
            if (boundaryResult.consumed()) {
                dragSession = null;
                paintInteraction.clear();
                if (boundaryResult.commit() != null) {
                    applyBoundaryCommit(boundaryResult.commit());
                }
                refreshStateText();
                return true;
            }
        }
        if (paintInteraction.press(input, selectedTool.get())) {
            selection.set(null);
            dragSession = null;
            refreshStateText();
            return true;
        }
        if (!selectionToolSelected()) {
            clearInteraction();
            return false;
        }
        HitTarget hit = input.hitTarget();
        if (selectableHit(hit)) {
            DungeonMapDisplayModel.TopologyRef topologyRef =
                    new DungeonMapDisplayModel.TopologyRef(hit.topologyRefKind(), hit.topologyRefId());
            DungeonEditorHandleRef handleRef = dragHandleRef(hit);
            DungeonMapDisplayModel.Selection nextSelection = new DungeonMapDisplayModel.Selection(
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
            dragPreview.set(null);
            refreshInspector();
            refreshStateText();
            return dragSession != null;
        }
        clearInteraction();
        return false;
    }

    public void primaryDragged(@Nullable PointerInput input) {
        if (!interactionEnabled() || input == null || !input.primaryButtonDown()) {
            return;
        }
        if (paintInteraction.drag(input, selectedTool.get())) {
            refreshStateText();
            return;
        }
        if (!selectionToolSelected() || dragSession == null) {
            return;
        }
        dragSession = dragSession.withCurrentPointer(input.q(), input.r());
        if (!dragSession.moved()) {
            dragPreview.set(null);
            snapshot.set(dragSession.baseSnapshot());
        } else {
            snapshot.set(dragSession.baseSnapshot());
            showDragPreview(dragSession);
        }
        refreshStateText();
    }

    public void primaryReleased(@Nullable PointerInput input) {
        PaintInteraction.PaintCommit paintCommit = paintInteraction.release(input, selectedTool.get());
        if (paintCommit != null) {
            if (interactionEnabled()) {
                applyPaintCommit(paintCommit);
            }
            refreshStateText();
            return;
        }
        if (dragSession == null || input == null) {
            return;
        }
        DragSession releasedSession = dragSession;
        dragSession = null;
        dragPreview.set(null);
        snapshot.set(releasedSession.baseSnapshot());
        if (!interactionEnabled() || !selectionToolSelected() || !releasedSession.moved()) {
            refreshStateText();
            return;
        }
        moveSelectedHandle(releasedSession);
    }

    public void levelScrolled(int delta) {
        if (delta == 0) {
            return;
        }
        if (dragSession == null) {
            moveProjection(delta);
            return;
        }
        int nextLevel = dragSession.currentLevel() + delta;
        dragSession = dragSession.withCurrentLevel(nextLevel);
        projectionLevel.set(nextLevel);
        snapshot.set(dragSession.baseSnapshot());
        if (dragSession.moved()) {
            showDragPreview(dragSession);
        } else {
            dragPreview.set(null);
        }
        refreshStateText();
    }

    public void saveRoomNarration(
            long roomId,
            String visualDescription,
            List<DungeonInspectorSnapshot.RoomExitNarration> exits
    ) {
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || roomId <= 0L) {
            return;
        }
        withBusy(() -> {
            DungeonOperationResult result = dungeon.applyOperation(new ApplyDungeonEditorOperationCommand(
                    mapId,
                    new DungeonEditorOperation.SaveRoomNarration(roomId, visualDescription, exits)));
            snapshot.set(result.snapshot());
            reachableLevels.set(levelsFrom(result.snapshot(), projectionLevel.get()));
            status.set("Raumbeschreibung gespeichert.");
            refreshInspector();
        });
        refreshStateText();
    }

    private void refreshMaps() {
        List<MapSelection> selections = dungeon.searchMaps(new SearchMapsQuery("")).maps().stream()
                .map(DungeonEditorViewModel::toMapSelection)
                .toList();
        maps.set(selections);
        if (selectedMapId == null && !selections.isEmpty()) {
            selectedMapId = selections.getFirst().mapId();
        }
        if (selectedMapId != null && selections.stream().noneMatch(selection -> selection.mapId().equals(selectedMapId))) {
            selectedMapId = selections.isEmpty() ? null : selections.getFirst().mapId();
        }
        selectedMapKey.set(selectedMapId == null ? "" : key(selectedMapId));
    }

    private void loadSelectedMap() {
        if (selectedMapId == null) {
            snapshot.set(null);
            reachableLevels.set(List.of(0));
            status.set(maps.get().isEmpty() ? "Keine Dungeon-Maps vorhanden." : "Kein Dungeon ausgewaehlt.");
            refreshStateText();
            return;
        }
        try {
            DungeonSnapshot nextSnapshot = dungeon.loadSnapshot(new LoadDungeonSnapshotQuery(selectedMapId))
                    .withMode(DungeonMapMode.EDITOR);
            snapshot.set(nextSnapshot);
            reachableLevels.set(levelsFrom(nextSnapshot, projectionLevel.get()));
            status.set("");
        } catch (RuntimeException exception) {
            snapshot.set(null);
            reachableLevels.set(List.of(0));
            status.set("Dungeon konnte nicht geladen werden: " + exception.getMessage());
        }
        refreshInspector();
        refreshStateText();
    }

    private void refreshStateText() {
        Selection currentSelection = selection.get();
        DragPreview currentPreview = dragPreview.get();
        String selectionText = currentSelection == null
                ? "Auswahl: Keine"
                : "Auswahl: " + currentSelection.label()
                        + " (" + currentSelection.topologyRef().kind() + " " + currentSelection.topologyRef().id() + ")";
        String previewText = currentPreview == null || !currentPreview.active()
                ? "Drag: inaktiv"
                : "Drag: dq=" + currentPreview.deltaQ()
                        + ", dr=" + currentPreview.deltaR()
                        + ", dz=" + currentPreview.deltaLevel();
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

    private void moveSelectedHandle(DragSession releasedSession) {
        Selection currentSelection = releasedSession.selection();
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || currentSelection == null || currentSelection.handleRef().ownerId() <= 0L) {
            return;
        }
        withBusy(() -> {
            DungeonOperationResult result = dungeon.applyOperation(new ApplyDungeonEditorOperationCommand(
                    mapId,
                    new DungeonEditorOperation.MoveEditorHandle(
                            currentSelection.handleRef(),
                            releasedSession.deltaQ(),
                            releasedSession.deltaR(),
                            releasedSession.deltaLevel())));
            snapshot.set(result.snapshot());
            reachableLevels.set(levelsFrom(result.snapshot(), projectionLevel.get()));
            status.set("Topologieelement verschoben: dq=" + releasedSession.deltaQ()
                    + ", dr=" + releasedSession.deltaR()
                    + ", dz=" + releasedSession.deltaLevel());
            selection.set(currentSelection);
            refreshInspector();
        });
        refreshStateText();
    }

    private void showDragPreview(DragSession session) {
        dragPreview.set(new DragPreview(
                session.selection().clusterId(),
                session.deltaQ(),
                session.deltaR(),
                session.deltaLevel(),
                session.selection().handleRef(),
                session.selection().label()));
    }

    private void applyPaintCommit(PaintInteraction.PaintCommit commit) {
        if (commit == null) {
            return;
        }
        applyCommittedOperation(commit.operation(), commit.status());
    }

    private void applyBoundaryCommit(BoundaryInteraction.BoundaryCommit commit) {
        if (commit == null) {
            return;
        }
        applyCommittedOperation(commit.operation(), commit.status());
    }

    private void applyCommittedOperation(DungeonEditorOperation operation, String statusText) {
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || operation == null) {
            return;
        }
        withBusy(() -> {
            DungeonOperationResult result = dungeon.applyOperation(new ApplyDungeonEditorOperationCommand(
                    mapId,
                    operation));
            snapshot.set(result.snapshot());
            reachableLevels.set(levelsFrom(result.snapshot(), projectionLevel.get()));
            status.set(statusText);
            selection.set(null);
            inspector.set(null);
        });
    }

    private boolean interactionEnabled() {
        return selectedMapId != null
                && snapshot.get() != null
                && !busy.get()
                && viewMode.get() == DungeonMapDisplayModel.ViewMode.GRID;
    }

    private static DungeonTopologyElementRef toTopologyElementRef(DungeonMapDisplayModel.TopologyRef ref) {
        DungeonMapDisplayModel.TopologyRef safeRef = ref == null ? DungeonMapDisplayModel.TopologyRef.empty() : ref;
        return new DungeonTopologyElementRef(toTopologyElementKind(safeRef.kind()), safeRef.id());
    }

    private static DungeonTopologyElementKind toTopologyElementKind(String kind) {
        try {
            return DungeonTopologyElementKind.valueOf(kind == null ? "" : kind.trim());
        } catch (IllegalArgumentException exception) {
            return DungeonTopologyElementKind.EMPTY;
        }
    }

    private void clearInteraction() {
        dragSession = null;
        paintInteraction.clear();
        boundaryInteraction.clear();
        dragPreview.set(null);
        selection.set(null);
        inspector.set(null);
        refreshStateText();
    }

    private void refreshInspector() {
        Selection currentSelection = selection.get();
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || currentSelection == null || snapshot.get() == null) {
            inspector.set(null);
            return;
        }
        inspector.set(dungeon.describeSelection(new DescribeDungeonSelectionQuery(
                mapId,
                toTopologyElementRef(currentSelection.topologyRef()),
                currentSelection.clusterId(),
                currentSelection.clusterSelection())));
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
                || hit.handleRef().kind() == DungeonEditorHandleKind.CLUSTER_LABEL;
    }

    private static DungeonEditorHandleRef dragHandleRef(HitTarget hit) {
        if (hit.kind() == HitKind.HANDLE) {
            return hit.handleRef();
        }
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.CLUSTER_LABEL,
                new DungeonTopologyElementRef(DungeonTopologyElementKind.valueOf(hit.topologyRefKind()), hit.topologyRefId()),
                hit.ownerId(),
                hit.clusterId(),
                0L,
                hit.ownerId(),
                0,
                new DungeonCellRef(0, 0, 0),
                "");
    }

    private boolean selectionToolSelected() {
        return DEFAULT_TOOL.equals(selectedTool.get());
    }

    private void moveProjection(int offset) {
        projectionLevel.set(projectionLevel.get() + offset);
        loadSelectedMap();
    }

    private void withBusy(Runnable action) {
        busy.set(true);
        try {
            action.run();
        } catch (RuntimeException exception) {
            status.set(rootCauseMessage(exception));
        } finally {
            busy.set(false);
        }
    }

    private static String rootCauseMessage(RuntimeException exception) {
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

    private static MapSelection toMapSelection(DungeonMapSummary summary) {
        return new MapSelection(
                key(summary.mapId()),
                summary.mapId(),
                summary.mapName(),
                summary.revision());
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
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    public record HitTarget(
            HitKind kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            String label,
            DungeonEditorHandleRef handleRef
    ) {
        public HitTarget {
            kind = kind == null ? HitKind.EMPTY : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            label = label == null || label.isBlank() ? kind.name() : label;
            handleRef = handleRef == null
                    ? new DungeonEditorHandleRef(
                            DungeonEditorHandleKind.CLUSTER_LABEL,
                            new DungeonTopologyElementRef(
                                    DungeonTopologyElementKind.valueOf(topologyRefKind),
                                    topologyRefId),
                            ownerId,
                            clusterId,
                            0L,
                            ownerId,
                            0,
                            new DungeonCellRef(0, 0, 0),
                            "")
                    : handleRef;
        }
    }

    private static HitTarget emptyHitTarget() {
        return new HitTarget(HitKind.EMPTY, 0L, 0L, "EMPTY", 0L, "", emptyHandleRef());
    }

    private static DungeonEditorHandleRef emptyHandleRef() {
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.CLUSTER_LABEL,
                new DungeonTopologyElementRef(DungeonTopologyElementKind.EMPTY, 0L),
                0L,
                0L,
                0L,
                0L,
                0,
                new DungeonCellRef(0, 0, 0),
                "");
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
            DungeonCellRef start,
            DungeonCellRef end
    ) {
        public BoundaryTarget {
            kind = kind == null || kind.isBlank() ? "WALL" : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind;
            topologyRefId = Math.max(0L, topologyRefId);
            start = start == null ? new DungeonCellRef(0, 0, 0) : start;
            end = end == null ? new DungeonCellRef(0, 0, 0) : end;
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget(false, "WALL", 0L, 0L, "EMPTY", 0L,
                    new DungeonCellRef(0, 0, 0), new DungeonCellRef(0, 0, 0));
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

        private PressResult doorPressed(
                PointerInput input,
                String selectedTool,
                @Nullable DungeonSnapshot snapshot
        ) {
            BoundaryTarget boundary = input.boundaryTarget();
            if (!input.primaryButtonDown() || boundary == null || !boundary.present() || boundary.clusterId() <= 0L) {
                return PressResult.ignored();
            }
            boolean deleteMode = DOOR_DELETE_TOOL.equals(selectedTool);
            if (deleteMode) {
                if (!"DOOR".equals(boundary.kind())) {
                    return PressResult.ignored();
                }
            } else if ("DOOR".equals(boundary.kind()) || !touchesDistinctRooms(snapshot, boundary)) {
                return PressResult.ignored();
            }
            DungeonEditorOperation operation = new DungeonEditorOperation.EditClusterBoundaries(
                    boundary.clusterId(),
                    List.of(edgeRef(boundary.start(), boundary.end())),
                    DungeonBoundaryKind.DOOR,
                    deleteMode);
            String status = deleteMode ? "Tuer geloescht." : "Tuer gesetzt.";
            return PressResult.consumed(new BoundaryCommit(operation, status));
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
            DungeonEditorOperation operation = new DungeonEditorOperation.EditClusterBoundaries(
                    current.clusterId(),
                    current.previewEdges().stream().map(EdgeKey::toEdgeRef).toList(),
                    DungeonBoundaryKind.WALL,
                    current.deleteMode());
            String status = current.deleteMode() ? "Wandpfad geloescht." : "Wandpfad gesetzt.";
            return PressResult.consumed(new BoundaryCommit(operation, status));
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

        private static boolean touchesDistinctRooms(@Nullable DungeonSnapshot snapshot, BoundaryTarget boundary) {
            if (snapshot == null || snapshot.map() == null || boundary == null) {
                return false;
            }
            Set<Long> roomIds = new LinkedHashSet<>();
            List<CellKey> touchingCells = EdgeKey.from(boundary.start(), boundary.end()).touchingCells();
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

        private record BoundaryCommit(DungeonEditorOperation operation, String status) {
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

            static EdgeKey from(DungeonCellRef start, DungeonCellRef end) {
                return between(
                        new VertexKey(start.q(), start.r(), start.level()),
                        new VertexKey(end.q(), end.r(), end.level()));
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

            List<CellKey> touchingCells() {
                if (start.level() != end.level()) {
                    return List.of();
                }
                if (start.r() == end.r()) {
                    int minQ = Math.min(start.q(), end.q());
                    int maxQ = Math.max(start.q(), end.q());
                    List<CellKey> result = new ArrayList<>();
                    for (int q = minQ; q < maxQ; q++) {
                        result.add(new CellKey(q, start.r() - 1, start.level()));
                        result.add(new CellKey(q, start.r(), start.level()));
                    }
                    return List.copyOf(result);
                }
                if (start.q() == end.q()) {
                    int minR = Math.min(start.r(), end.r());
                    int maxR = Math.max(start.r(), end.r());
                    List<CellKey> result = new ArrayList<>();
                    for (int r = minR; r < maxR; r++) {
                        result.add(new CellKey(start.q() - 1, r, start.level()));
                        result.add(new CellKey(start.q(), r, start.level()));
                    }
                    return List.copyOf(result);
                }
                return List.of();
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

    private static final class PaintInteraction {

        private static final String ROOM_PAINT_TOOL = "Raum malen";
        private static final String ROOM_DELETE_TOOL = "Raum loeschen";

        private final ReadOnlyObjectWrapper<DungeonMapDisplayModel.PaintPreview> paintPreview =
                new ReadOnlyObjectWrapper<>();
        private @Nullable PaintSession paintSession;

        ReadOnlyObjectProperty<DungeonMapDisplayModel.PaintPreview> paintPreviewProperty() {
            return paintPreview.getReadOnlyProperty();
        }

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
            paintPreview.set(toPreview(paintSession));
            return true;
        }

        boolean drag(PointerInput input, String selectedTool) {
            if (paintSession == null || input == null || !input.primaryButtonDown()
                    || !roomPaintToolSelected(selectedTool)) {
                return false;
            }
            paintSession = paintSession.withEnd(input.q(), input.r());
            paintPreview.set(toPreview(paintSession));
            return true;
        }

        @Nullable PaintCommit release(@Nullable PointerInput input, String selectedTool) {
            PaintSession session = paintSession;
            if (session == null) {
                return null;
            }
            paintSession = null;
            paintPreview.set(null);
            if (!roomPaintToolSelected(selectedTool)) {
                return null;
            }
            PaintSession released = input == null ? session : session.withEnd(input.q(), input.r());
            DungeonCellRef start = new DungeonCellRef(released.startQ(), released.startR(), released.level());
            DungeonCellRef end = new DungeonCellRef(released.endQ(), released.endR(), released.level());
            DungeonEditorOperation operation = released.deleteMode()
                    ? new DungeonEditorOperation.DeleteRoomRectangle(start, end)
                    : new DungeonEditorOperation.PaintRoomRectangle(start, end);
            String status = released.deleteMode() ? "Raumflaeche geloescht." : "Raumflaeche gemalt.";
            return new PaintCommit(operation, status);
        }

        void clear() {
            paintSession = null;
            paintPreview.set(null);
        }

        String stateText() {
            DungeonMapDisplayModel.PaintPreview currentPaintPreview = paintPreview.get();
            if (currentPaintPreview == null || !currentPaintPreview.active()) {
                return "Raumvorschau: inaktiv";
            }
            return "Raumvorschau: "
                    + (currentPaintPreview.deleteMode() ? "loeschen" : "malen")
                    + " z=" + currentPaintPreview.level();
        }

        private boolean roomPaintToolSelected(String selectedTool) {
            return ROOM_PAINT_TOOL.equals(selectedTool) || ROOM_DELETE_TOOL.equals(selectedTool);
        }

        private static DungeonMapDisplayModel.PaintPreview toPreview(PaintSession session) {
            return new DungeonMapDisplayModel.PaintPreview(
                    session.startQ(),
                    session.startR(),
                    session.endQ(),
                    session.endR(),
                    session.level(),
                    session.deleteMode());
        }

        private record PaintCommit(DungeonEditorOperation operation, String status) {
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

    private record DragSession(
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

}

package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
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
import src.domain.dungeon.published.BaseMapSnapshot;
import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.published.RenameDungeonMapCommand;
import src.domain.dungeon.published.SearchMapsQuery;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel.DragPreview;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel.Selection;

public final class DungeonEditorViewModel {

    private static final String DEFAULT_TOOL = "Auswahl";

    private final DungeonApplicationService dungeon;
    private final PaintInteraction paintInteraction = new PaintInteraction();
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<DungeonSnapshot> snapshot = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<Selection> selection = new ReadOnlyObjectWrapper<>();
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

    public void primaryPressed(@Nullable PointerInput input) {
        if (!interactionEnabled() || input == null) {
            return;
        }
        if (paintInteraction.press(input, selectedTool.get())) {
            selection.set(null);
            dragSession = null;
            refreshStateText();
            return;
        }
        if (!selectionToolSelected()) {
            clearInteraction();
            return;
        }
        HitTarget hit = input.hitTarget();
        if (hit != null && hit.kind() == HitKind.ROOM && hit.clusterId() > 0L) {
            DungeonMapDisplayModel.TopologyRef topologyRef =
                    new DungeonMapDisplayModel.TopologyRef(hit.topologyRefKind(), hit.topologyRefId());
            DungeonMapDisplayModel.Selection nextSelection =
                    new DungeonMapDisplayModel.Selection(hit.ownerId(), hit.clusterId(), hit.label(), topologyRef);
            selection.set(nextSelection);
            dragSession = new DragSession(nextSelection, input.q(), input.r());
            dragPreview.set(null);
            refreshStateText();
            return;
        }
        clearInteraction();
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
        int deltaQ = input.q() - dragSession.pressQ();
        int deltaR = input.r() - dragSession.pressR();
        if (deltaQ == 0 && deltaR == 0) {
            dragPreview.set(null);
        } else {
            dragPreview.set(new DragPreview(dragSession.selection().clusterId(), deltaQ, deltaR));
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
        int deltaQ = input.q() - releasedSession.pressQ();
        int deltaR = input.r() - releasedSession.pressR();
        if (!interactionEnabled() || !selectionToolSelected() || (deltaQ == 0 && deltaR == 0)) {
            refreshStateText();
            return;
        }
        moveSelectedCluster(releasedSession.selection(), deltaQ, deltaR);
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
            BaseMapSnapshot loaded = dungeon.loadMapSnapshot(new LoadMapSnapshotQuery(selectedMapId, projectionLevel.get()));
            DungeonSnapshot nextSnapshot = new DungeonSnapshot(
                    loaded.mapName(),
                    DungeonMapMode.EDITOR,
                    loaded.map(),
                    List.of(),
                    List.of(),
                    toRevisionInt(loaded.revision()));
            snapshot.set(nextSnapshot);
            projectionLevel.set(loaded.currentFloor());
            reachableLevels.set(levelsFrom(nextSnapshot, projectionLevel.get()));
            status.set("Dungeon geladen: " + loaded.mapName());
        } catch (RuntimeException exception) {
            snapshot.set(null);
            reachableLevels.set(List.of(0));
            status.set("Dungeon konnte nicht geladen werden: " + exception.getMessage());
        }
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
                : "Drag: dq=" + currentPreview.deltaQ() + ", dr=" + currentPreview.deltaR();
        state.set("Werkzeug: " + selectedTool.get()
                + "\nAnsicht: " + viewMode.get().label()
                + "\nEbene: z=" + projectionLevel.get()
                + "\n" + overlaySettings.get().mode().label()
                + "\n" + selectionText
                + "\n" + previewText
                + "\n" + paintInteraction.stateText()
                + "\nAuswahlwerkzeug: Topologieelemente koennen auf dem Raster gezogen werden."
                + "\nRaumwerkzeug: Rechteck ziehen und beim Loslassen anwenden.");
    }

    private void moveSelectedCluster(Selection currentSelection, int deltaQ, int deltaR) {
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || currentSelection == null || currentSelection.clusterId() <= 0L) {
            return;
        }
        withBusy(() -> {
            DungeonOperationResult result = dungeon.applyOperation(new ApplyDungeonEditorOperationCommand(
                    mapId,
                    new DungeonEditorOperation.MoveTopologyElement(
                            toTopologyElementRef(currentSelection.topologyRef()),
                            deltaQ,
                            deltaR)));
            snapshot.set(result.snapshot());
            reachableLevels.set(levelsFrom(result.snapshot(), projectionLevel.get()));
            status.set("Topologieelement verschoben: dq=" + deltaQ + ", dr=" + deltaR);
            selection.set(currentSelection);
        });
        refreshStateText();
    }

    private void applyPaintCommit(PaintInteraction.PaintCommit commit) {
        DungeonMapId mapId = selectedMapId;
        if (mapId == null || commit == null) {
            return;
        }
        withBusy(() -> {
            DungeonOperationResult result = dungeon.applyOperation(new ApplyDungeonEditorOperationCommand(
                    mapId,
                    commit.operation()));
            snapshot.set(result.snapshot());
            reachableLevels.set(levelsFrom(result.snapshot(), projectionLevel.get()));
            status.set(commit.status());
            selection.set(null);
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
        dragPreview.set(null);
        selection.set(null);
        refreshStateText();
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
            status.set(exception.getMessage() == null ? "Dungeon-Aktion fehlgeschlagen." : exception.getMessage());
        } finally {
            busy.set(false);
        }
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

    private static int toRevisionInt(long revision) {
        return (int) Math.max(0L, Math.min(Integer.MAX_VALUE, revision));
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
            String label
    ) {
        public HitTarget {
            kind = kind == null ? HitKind.EMPTY : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            label = label == null || label.isBlank() ? kind.name() : label;
        }
    }

    public record PointerInput(
            int q,
            int r,
            int level,
            boolean primaryButtonDown,
            HitTarget hitTarget
    ) {
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
            int pressR
    ) {
    }

}

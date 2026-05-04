package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.ReadOnlyBooleanProperty;
import javafx.beans.property.ReadOnlyBooleanWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorCell;
import src.domain.dungeoneditor.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.DungeonEditorMapSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapSummary;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorPreview;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorSurface;

public final class DungeonEditorContributionModel {

    private static final String DEFAULT_TOOL = "Auswahl";
    private static final String DEFAULT_VIEW_MODE = "GRID";

    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<List<MapSelection>> maps = new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyObjectWrapper<List<MapListEntry>> mapEntries = new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyStringWrapper selectedMapKey = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<List<Integer>> reachableLevels = new ReadOnlyObjectWrapper<>(List.of(0));
    private final ReadOnlyBooleanWrapper busy = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyStringWrapper viewModeLabel = new ReadOnlyStringWrapper("Grid");
    private final ReadOnlyObjectWrapper<OverlayProjection> overlayProjection =
            new ReadOnlyObjectWrapper<>(new OverlayProjection("OFF", 2, 0.35, List.of()));
    private final ReadOnlyObjectWrapper<List<RoomNarrationCardProjection>> narrationCards =
            new ReadOnlyObjectWrapper<>(List.of());
    private final IntegerProperty projectionLevel = new SimpleIntegerProperty(0);
    private final StringProperty selectedTool = new SimpleStringProperty(DEFAULT_TOOL);
    private @Nullable DungeonEditorMapId selectedMapId;
    private @Nullable DungeonEditorSurface currentSurface;
    private @Nullable DungeonEditorInspectorSnapshot currentInspector;
    private DungeonEditorSnapshot.Selection currentSelection = DungeonEditorSnapshot.Selection.empty();
    private DungeonEditorPreview currentPreview = DungeonEditorPreview.none();
    private String currentViewModeKey = DEFAULT_VIEW_MODE;

    public DungeonEditorContributionModel() {
        refreshStateText();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
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

    public ReadOnlyObjectProperty<List<MapListEntry>> mapEntriesProperty() {
        return mapEntries.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty viewModeLabelProperty() {
        return viewModeLabel.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<OverlayProjection> overlayProjectionProperty() {
        return overlayProjection.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<List<RoomNarrationCardProjection>> narrationCardsProperty() {
        return narrationCards.getReadOnlyProperty();
    }

    public IntegerProperty projectionLevelProperty() {
        return projectionLevel;
    }

    public StringProperty selectedToolProperty() {
        return selectedTool;
    }

    public void apply(DungeonEditorSnapshot editorSnapshot) {
        DungeonEditorSnapshot safeSnapshot = editorSnapshot == null
                ? DungeonEditorSnapshot.empty("")
                : editorSnapshot;
        List<MapSelection> nextMaps = safeSnapshot.maps().stream()
                .map(DungeonEditorContributionModel::toMapSelection)
                .toList();
        maps.set(nextMaps);
        mapEntries.set(nextMaps.stream()
                .map(selection -> new MapListEntry(
                        selection.key(),
                        selection.mapId() == null ? 0L : selection.mapId().value(),
                        selection.mapName(),
                        selection.revision()))
                .toList());
        selectedMapId = safeSnapshot.selectedMapId();
        selectedMapKey.set(selectedMapId == null ? "" : key(selectedMapId));
        currentSurface = safeSnapshot.surface();
        currentInspector = currentSurface == null ? null : currentSurface.inspector();
        currentSelection = safeSnapshot.selection() == null
                ? DungeonEditorSnapshot.Selection.empty()
                : safeSnapshot.selection();
        currentPreview = safeSnapshot.preview() == null
                ? DungeonEditorPreview.none()
                : safeSnapshot.preview();
        currentViewModeKey = normalizeViewModeKey(safeSnapshot.viewModeKey());
        viewModeLabel.set("GRAPH".equals(currentViewModeKey) ? "Graph" : "Grid");
        selectedTool.set(normalizeTool(safeSnapshot.selectedTool()));
        overlayProjection.set(toOverlayProjection(safeSnapshot.overlaySettings()));
        projectionLevel.set(safeSnapshot.projectionLevel());
        narrationCards.set(toNarrationCards(currentInspector));
        if (currentSurface == null) {
            reachableLevels.set(List.of(projectionLevel.get()));
            if (nextMaps.isEmpty()) {
                status.set("Keine Dungeon-Maps vorhanden.");
            } else if (selectedMapId == null) {
                status.set("Kein Dungeon ausgewählt.");
            } else {
                status.set(safeSnapshot.statusText());
            }
        } else {
            reachableLevels.set(levelsFrom(currentSurface, projectionLevel.get()));
            status.set(safeSnapshot.statusText());
        }
        clampProjectionLevel();
        busy.set(false);
        refreshStateText();
    }

    private void clampProjectionLevel() {
        List<Integer> levels = reachableLevels.get();
        if (levels.isEmpty()) {
            return;
        }
        projectionLevel.set(Math.max(levels.getFirst(), Math.min(levels.getLast(), projectionLevel.get())));
    }

    private void refreshStateText() {
        String selectionText = "EMPTY".equals(currentSelection.topologyRef().kind())
                ? "Auswahl: Keine"
                : "Auswahl: " + selectionLabel(currentSelection, currentInspector)
                        + " (" + currentSelection.topologyRef().kind() + " " + currentSelection.topologyRef().id() + ")";
        state.set("Werkzeug: " + selectedTool.get()
                + "\nAnsicht: " + viewModeLabel.get()
                + "\nEbene: z=" + projectionLevel.get()
                + "\n" + overlayLabel(overlayProjection.get())
                + "\n" + selectionText
                + "\n" + previewText(currentPreview));
    }

    private static String overlayLabel(@Nullable OverlayProjection overlayProjection) {
        OverlayProjection safeOverlay = overlayProjection == null
                ? new OverlayProjection("OFF", 2, 0.35, List.of())
                : overlayProjection;
        return switch (safeOverlay.modeKey()) {
            case "NEARBY" -> "Nahe Ebenen";
            case "SELECTED" -> "Ausgewählte Ebenen";
            default -> "Overlays aus";
        };
    }

    private static String selectionLabel(
            DungeonEditorSnapshot.Selection selection,
            @Nullable DungeonEditorInspectorSnapshot inspector
    ) {
        if (inspector != null && !inspector.title().isBlank()) {
            return inspector.title();
        }
        return selection.topologyRef().kind();
    }

    private static String previewText(DungeonEditorPreview preview) {
        if (preview == null || preview instanceof DungeonEditorPreview.NonePreview) {
            return "Topologie-Preview: inaktiv";
        }
        if (preview instanceof DungeonEditorPreview.MoveHandlePreview movePreview) {
            return "Topologie-Preview: verschieben dq=" + movePreview.deltaQ()
                    + ", dr=" + movePreview.deltaR()
                    + ", dz=" + movePreview.deltaLevel();
        }
        if (preview instanceof DungeonEditorPreview.RoomRectanglePreview roomRectangle) {
            return "Topologie-Preview: "
                    + (roomRectangle.deleteMode() ? "Raum löschen" : "Raum malen")
                    + " z=" + roomRectangle.start().level();
        }
        if (preview instanceof DungeonEditorPreview.ClusterBoundariesPreview boundaries) {
            return "Topologie-Preview: "
                    + (boundaries.deleteMode() ? "Kanten löschen" : "Kanten setzen")
                    + " (" + boundaries.edges().size() + ")";
        }
        if (preview instanceof DungeonEditorPreview.MoveBoundaryStretchPreview stretch) {
            return "Topologie-Preview: Wandstrecke verschieben dq=" + stretch.deltaQ()
                    + ", dr=" + stretch.deltaR()
                    + ", dz=" + stretch.deltaLevel()
                    + " (" + stretch.sourceEdges().size() + ")";
        }
        return "Topologie-Preview: aktiv";
    }

    private static List<Integer> levelsFrom(@Nullable DungeonEditorSurface surface, int fallbackLevel) {
        TreeSet<Integer> levels = new TreeSet<>();
        if (surface != null && surface.map() != null) {
            surface.map().areas().forEach(area -> addCellLevels(levels, area.cells()));
            for (DungeonEditorMapSnapshot.Feature feature : surface.map().features()) {
                addCellLevels(levels, feature.cells());
            }
            surface.map().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            if (surface.previewMap() != null) {
                surface.previewMap().areas().forEach(area -> addCellLevels(levels, area.cells()));
                for (DungeonEditorMapSnapshot.Feature feature : surface.previewMap().features()) {
                    addCellLevels(levels, feature.cells());
                }
                surface.previewMap().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            }
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ArrayList<>(levels);
    }

    private static void addCellLevels(Set<Integer> levels, List<DungeonEditorCell> cells) {
        for (DungeonEditorCell cell : cells == null ? List.<DungeonEditorCell>of() : cells) {
            levels.add(cell.level());
        }
    }

    private static String key(@Nullable DungeonEditorMapId mapId) {
        return mapId == null ? "" : Long.toString(mapId.value());
    }

    private static String normalizeTool(String selectedTool) {
        return selectedTool == null || selectedTool.isBlank() ? DEFAULT_TOOL : selectedTool;
    }

    private static String normalizeViewModeKey(String viewModeKey) {
        return "GRAPH".equalsIgnoreCase(viewModeKey) ? "GRAPH" : DEFAULT_VIEW_MODE;
    }

    private static OverlayProjection toOverlayProjection(DungeonEditorOverlaySettings overlaySettings) {
        DungeonEditorOverlaySettings safeOverlay =
                overlaySettings == null ? DungeonEditorOverlaySettings.defaults() : overlaySettings;
        return new OverlayProjection(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static List<RoomNarrationCardProjection> toNarrationCards(@Nullable DungeonEditorInspectorSnapshot inspector) {
        if (inspector == null) {
            return List.of();
        }
        return inspector.roomNarrations().stream()
                .map(card -> new RoomNarrationCardProjection(
                        card.roomId(),
                        card.roomName(),
                        card.visualDescription(),
                        card.exits().stream()
                                .map(exit -> new RoomExitNarrationProjection(
                                        exit.label(),
                                        exit.cell().q(),
                                        exit.cell().r(),
                                        exit.cell().level(),
                                        exit.direction(),
                                        exit.description()))
                                .toList()))
                .toList();
    }

    private static MapSelection toMapSelection(@Nullable DungeonEditorMapSummary summary) {
        DungeonEditorMapSummary safeSummary = summary == null
                ? new DungeonEditorMapSummary(new DungeonEditorMapId(1L), "Dungeon Map", 0L)
                : summary;
        return new MapSelection(
                key(safeSummary.mapId()),
                safeSummary.mapId(),
                safeSummary.mapName(),
                safeSummary.revision());
    }

    public record MapSelection(
            String key,
            DungeonEditorMapId mapId,
            String mapName,
            long revision
    ) {
        public MapSelection {
            key = key == null ? "" : key;
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0L, revision);
        }
    }

    public record MapListEntry(
            String key,
            long mapIdValue,
            String mapName,
            long revision
    ) {
        public MapListEntry {
            key = key == null ? "" : key;
            mapIdValue = Math.max(0L, mapIdValue);
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0L, revision);
        }
    }

    public record OverlayProjection(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {
        public OverlayProjection {
            modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }
    }

    public record RoomNarrationCardProjection(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarrationProjection> exits
    ) {
        public RoomNarrationCardProjection {
            roomName = roomName == null || roomName.isBlank() ? "Raum" : roomName;
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    public record RoomExitNarrationProjection(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        public RoomExitNarrationProjection {
            label = label == null || label.isBlank() ? "Ausgang" : label;
            direction = direction == null || direction.isBlank() ? "NORTH" : direction;
            description = description == null ? "" : description;
        }
    }
}

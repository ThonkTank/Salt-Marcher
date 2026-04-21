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
import src.domain.dungeon.published.BaseMapSnapshot;
import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.published.RenameDungeonMapCommand;
import src.domain.dungeon.published.SearchMapsQuery;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;

public final class DungeonEditorViewModel {

    private static final String DEFAULT_TOOL = "Auswahl";

    private final DungeonApplicationService dungeon;
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<DungeonSnapshot> snapshot = new ReadOnlyObjectWrapper<>();
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
            }
            refreshMaps();
            loadSelectedMap();
        });
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
        state.set("Werkzeug: " + selectedTool.get()
                + "\nAnsicht: " + viewMode.get().label()
                + "\nEbene: z=" + projectionLevel.get()
                + "\n" + overlaySettings.get().mode().label()
                + "\nWerkzeuge: Praesentationszustand bis Editor-Operationen angebunden sind.");
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
}

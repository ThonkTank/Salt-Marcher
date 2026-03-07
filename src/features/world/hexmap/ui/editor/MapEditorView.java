package features.world.hexmap.ui.editor;

import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import features.world.hexmap.ui.editor.MapEditorApplicationService;
import features.world.hexmap.ui.editor.controls.EditorTool;
import features.world.hexmap.ui.editor.controls.MapEditorControls;
import features.world.hexmap.ui.editor.dialogs.EditMapDialog;
import features.world.hexmap.ui.editor.dialogs.NewMapDialog;
import features.world.hexmap.ui.editor.panes.MapEditorCanvas;
import features.world.hexmap.ui.editor.panes.TilePropertiesPane;
import features.world.hexmap.ui.editor.panes.ToolSettingsPane;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import ui.AppView;
import ui.UiErrorReporter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * Top-Level-Ansicht des Karteneditors fuer Hex-Map-Bearbeitung (Gelaende, Orte, Fraktionen).
 * Detailpanel: TilePropertiesPane (Infos zum ausgewaehlten Feld).
 * Zustandspanel: ToolSettingsPane (Gelaendepalette, spaetere Brush-Einstellungen).
 */
public class MapEditorView implements AppView {

    private final MapEditorControls controls;
    private final MapEditorCanvas canvas;
    private final TilePropertiesPane propertiesPane;
    private final ToolSettingsPane toolSettingsPane;
    private final MapEditorApplicationService applicationService;

    /** Sammelt Tile-ID -> Gelaendeaenderung waehrend eines Malstrichs; Flush bei Mouse-Release. */
    private final Map<Long, HexTerrainType> dirtyTiles = new HashMap<>();
    private final AtomicLong loadSequence = new AtomicLong(0);
    private Long currentMapId;
    private boolean initialLoadDone = false;

    public MapEditorView() {
        controls = new MapEditorControls();
        canvas = new MapEditorCanvas();
        propertiesPane = new TilePropertiesPane();
        toolSettingsPane = new ToolSettingsPane();
        applicationService = new MapEditorApplicationService();

        controls.setOnToolChanged(tool -> {
            canvas.setPaintMode(tool == EditorTool.TERRAIN_BRUSH);
            toolSettingsPane.setTerrainVisible(tool == EditorTool.TERRAIN_BRUSH);
        });

        controls.setOnMapSelected(mapId -> {
            currentMapId = mapId;
            loadMapAsync(mapId);
        });
        controls.setOnNewMapRequested(this::showNewMapDialog);
        controls.setOnEditMapRequested(this::showEditMapDialog);

        canvas.setOnTileClicked(tile -> {
            if (controls.getActiveTool() == EditorTool.SELECT) {
                propertiesPane.showTile(tile);
            } else if (controls.getActiveTool() == EditorTool.TERRAIN_BRUSH) {
                paintTile(tile);
            }
        });

        canvas.setOnTileDragPainted(this::paintTile);
        canvas.setOnPaintStrokeFinished(this::flushDirtyTiles);
    }

    /** Optimistisches UI-Update; DB-Schreiben wird bis zum Ende des Malstrichs aufgeschoben. */
    private void paintTile(HexTile tile) {
        if (tile == null || tile.tileId() == null) return;
        HexTerrainType terrain = toolSettingsPane.getActiveTerrainType();
        if (terrain == tile.terrainType()) return;

        canvas.updateTileTerrain(tile.tileId(), terrain);
        dirtyTiles.put(tile.tileId(), terrain);
        propertiesPane.showTile(tile, terrain);
    }

    /** Schreibt gesammelte Gelaendeaenderungen asynchron in die DB. */
    private void flushDirtyTiles() {
        if (dirtyTiles.isEmpty()) return;
        Map<Long, HexTerrainType> batch = new HashMap<>(dirtyTiles);
        dirtyTiles.clear();

        applicationService.flushTerrainChanges(batch, () -> { }, ex -> {
            UiErrorReporter.reportBackgroundFailure("MapEditorView.flushDirtyTiles()", ex);
            if (currentMapId != null) {
                loadMapAsync(currentMapId);
            }
            new Alert(Alert.AlertType.ERROR,
                    "Geländeänderungen konnten nicht gespeichert werden. Die Karte wurde neu geladen.")
                    .showAndWait();
        });
    }

    private void showEditMapDialog(HexMap map) {
        int oldRadius = map.radius() != null ? map.radius() : 0;
        EditMapDialog dialog = new EditMapDialog(
                map,
                newRadius -> applicationService.removedTilesForRadiusChange(oldRadius, newRadius));
        dialog.showAndWait().ifPresent(result -> {
            boolean shrinking = result.radius() < oldRadius;

            if (shrinking) {
                int tilesToRemove = applicationService.removedTilesForRadiusChange(oldRadius, result.radius());
                Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                        "Radius von " + oldRadius + " auf " + result.radius() + " verkleinern?\n"
                        + tilesToRemove + " Felder werden unwiderruflich gel\u00f6scht.\n"
                        + "Falls die Gruppe auf einem dieser Felder steht, wird ihre Position zur\u00fcckgesetzt.",
                        ButtonType.CANCEL, ButtonType.OK);
                confirm.setHeaderText("Kartenverkleinerung best\u00e4tigen");
                Button cancelBtn = (Button) confirm.getDialogPane().lookupButton(ButtonType.CANCEL);
                cancelBtn.setDefaultButton(true);
                Button okBtn = (Button) confirm.getDialogPane().lookupButton(ButtonType.OK);
                okBtn.setDefaultButton(false);

                var choice = confirm.showAndWait();
                if (choice.isEmpty() || choice.get() != ButtonType.OK) return;
            }

            applicationService.updateMap(map.mapId(), result.name(), oldRadius, result.radius(),
                () -> loadMapListAsync(maps -> {
                    controls.selectMap(map.mapId());
                }),
                ex -> {
                UiErrorReporter.reportBackgroundFailure("MapEditorView.editMap()", ex);
                String msg = ex.getMessage() != null ? ex.getMessage() : "Unbekannter Fehler";
                new Alert(Alert.AlertType.ERROR, "Fehler beim Speichern: " + msg).showAndWait();
            });
        });
    }

    /** Laedt alle Karten in die ComboBox und waehlt die erste Karte aus (oder öffnet den Neu-Dialog). */
    private void loadMapList() {
        loadMapListAsync(maps -> {
            if (maps.isEmpty()) {
                showNewMapDialog();
            } else {
                controls.selectMap(maps.get(0).mapId());
            }
        });
    }

    private void showNewMapDialog() {
        NewMapDialog dialog = new NewMapDialog();
        dialog.showAndWait().ifPresent(result -> {
            applicationService.createMap(result.name(), result.radius(),
                newMapId -> loadMapListAsync(maps -> controls.selectMap(newMapId)),
                ex -> UiErrorReporter.reportBackgroundFailure("MapEditorView.createMap()", ex));
        });
    }

    /** Laedt die Kartenliste asynchron, fuellt die Controls und ruft danach onLoaded auf dem FX-Thread auf. */
    private void loadMapListAsync(Consumer<List<HexMap>> onLoaded) {
        applicationService.loadMapList(maps -> {
            controls.setMaps(maps);
            onLoaded.accept(maps);
        }, ex -> UiErrorReporter.reportBackgroundFailure("MapEditorView.loadMapListAsync()", ex));
    }

    private void loadMapAsync(Long mapId) {
        long requestSequence = loadSequence.incrementAndGet();
        applicationService.loadMap(mapId,
                tiles -> {
                    if (requestSequence != loadSequence.get()) {
                        return;
                    }
                    canvas.loadTiles(tiles);
                },
                ex -> {
                    if (requestSequence != loadSequence.get()) {
                        return;
                    }
                    UiErrorReporter.reportBackgroundFailure("MapEditorView.loadMapAsync()", ex);
                });
    }

    @Override public Node getMainContent()     { return canvas; }
    @Override public String getTitle()        { return "Karteneditor"; }
    @Override public String getIconText()     { return "\u270F"; } // ✏
    @Override public Node getControlsContent() { return controls; }
    @Override public Node getDetailsContent()  { return propertiesPane; }
    @Override public Node getStateContent()    { return toolSettingsPane; }

    @Override
    public void onShow() {
        if (!initialLoadDone) {
            loadMapList();
            initialLoadDone = true;
        }
    }
}

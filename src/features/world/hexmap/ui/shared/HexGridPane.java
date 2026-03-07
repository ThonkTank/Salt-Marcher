package features.world.hexmap.ui.shared;

import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import javafx.scene.Group;
import javafx.scene.control.Label;
import javafx.scene.layout.Pane;
import javafx.scene.shape.Polygon;
import javafx.scene.shape.Rectangle;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Gemeinsamer Hex-Grid-Renderer fuer Overworld-Ansicht und Karteneditor.
 * Rendert Flat-Top-Hexagone aus axialen (Q, R)-Koordinaten.
 * Unterstuetzt Verschieben (Drag) und Zoom (Mausrad).
 * Im Read-only-Modus sind Klickinteraktionen deaktiviert.
 */
public class HexGridPane extends Pane {

    private static final double HEX_SIZE = 48.0; // px, Mittelpunkt bis Ecke

    private static final double[] HEX_VERTEX_DX;
    private static final double[] HEX_VERTEX_DY;
    static {
        HEX_VERTEX_DX = new double[6];
        HEX_VERTEX_DY = new double[6];
        for (int i = 0; i < 6; i++) {
            double angle = Math.toRadians(60.0 * i);
            HEX_VERTEX_DX[i] = HEX_SIZE * Math.cos(angle);
            HEX_VERTEX_DY[i] = HEX_SIZE * Math.sin(angle);
        }
    }

    private final Group hexGroup = new Group();
    private final Label emptyLabel = new Label("Keine Karte geladen");

    /** O(1)-Lookup tile-ID -> Polygon fuer Selektion und reload-sicheren Zugriff. */
    private final Map<Long, Polygon> tilePolygons = new HashMap<>();
    private final HexGridViewportController viewportController;
    private final PartyTokenController partyTokenController;

    private boolean readOnly = false;
    private boolean paintMode = false;
    private Polygon selectedPolygon = null;

    private Consumer<HexTile> onTileClicked;
    private Consumer<HexTile> onTileHovered;
    private Consumer<HexTile> onTileDragPainted;
    private Runnable onPaintStrokeFinished;

    public HexGridPane() {
        Rectangle clip = new Rectangle();
        clip.widthProperty().bind(widthProperty());
        clip.heightProperty().bind(heightProperty());
        setClip(clip);

        emptyLabel.getStyleClass().addAll("text-muted", "hex-map-placeholder");
        getChildren().addAll(emptyLabel, hexGroup);

        viewportController = new HexGridViewportController(
                this,
                hexGroup,
                () -> paintMode,
                () -> {
                    if (onPaintStrokeFinished != null) {
                        onPaintStrokeFinished.run();
                    }
                });
        partyTokenController = new PartyTokenController(
                hexGroup,
                tilePolygons,
                tile -> hexCenterX(tile.q()),
                tile -> hexCenterY(tile.q(), tile.r()));
    }

    @Override
    protected void layoutChildren() {
        double w = getWidth(), h = getHeight();
        double lw = emptyLabel.prefWidth(-1);
        double lh = emptyLabel.prefHeight(-1);
        emptyLabel.resizeRelocate((w - lw) / 2.0, (h - lh) / 2.0, lw, lh);
        // hexGroup wird ueber Translate-/Scale-Transforms gesteuert, kein eigener Layout-Pass noetig
    }

    // -------------------------------------------------------------------------
    // Daten laden

    /** Baut alle Hex-Polygon-Nodes aus der uebergebenen Feldliste neu auf. */
    public void loadTiles(List<HexTile> tiles) {
        hexGroup.getChildren().clear();
        tilePolygons.clear();
        selectedPolygon = null;

        if (tiles == null || tiles.isEmpty()) {
            emptyLabel.setVisible(true);
            return;
        }
        emptyLabel.setVisible(false);

        List<Polygon> polygons = new ArrayList<>(tiles.size());
        for (HexTile tile : tiles) {
            Polygon hex = buildHexPolygon(tile);
            polygons.add(hex);
            if (tile.tileId() != null) tilePolygons.put(tile.tileId(), hex);
        }
        hexGroup.getChildren().addAll(polygons);

        // Gruppenmarker nach dem Reload wieder oben einfuegen
        partyTokenController.reinsertAfterTileReload();

        viewportController.centerOnTiles(
                tiles,
                tile -> hexCenterX(tile.q()),
                tile -> hexCenterY(tile.q(), tile.r()));
    }

    // -------------------------------------------------------------------------
    // Oeffentliche API

    public void setOnTileClicked(Consumer<HexTile> cb)      { onTileClicked = cb; }
    public void setOnTileHovered(Consumer<HexTile> cb)      { onTileHovered = cb; }
    public void setOnTileDragPainted(Consumer<HexTile> cb)  { onTileDragPainted = cb; }
    public void setOnPaintStrokeFinished(Runnable cb)       { onPaintStrokeFinished = cb; }
    public void setOnPartyTokenMoved(Consumer<HexTile> cb)  { partyTokenController.setOnPartyTokenMoved(cb); }
    public void setReadOnly(boolean readOnly)               { this.readOnly = readOnly; }
    public void setPaintMode(boolean paintMode)             { this.paintMode = paintMode; }

    /**
     * Zeigt oder verschiebt den Gruppenmarker auf das angegebene Feld.
     * Mit null wird der Marker entfernt. Das Node wird beim ersten Aufruf lazy erzeugt.
     */
    public void setPartyToken(Long tileId) {
        partyTokenController.setPartyToken(tileId);
    }

    /** Markiert das uebergebene Feld als selektiert (vorige Selektion wird entfernt). ID-basiert und reload-sicher. */
    public void setSelectedTile(HexTile tile) {
        if (selectedPolygon != null) {
            selectedPolygon.getStyleClass().remove("hex-tile-selected");
            selectedPolygon = null;
        }
        if (tile == null || tile.tileId() == null) return;
        Polygon p = tilePolygons.get(tile.tileId());
        if (p != null) {
            p.getStyleClass().add("hex-tile-selected");
            selectedPolygon = p;
        }
    }

    /**
     * Aktualisiert die Terrain-CSS-Klasse eines vorhandenen Feld-Polygons ohne Reload.
     * Patcht zusaetzlich das in userData gespeicherte HexTile fuer konsistente Folgezugriffe.
     */
    public void updateTileTerrain(long tileId, HexTerrainType newTerrainType) {
        Polygon p = tilePolygons.get(tileId);
        if (p == null) return;
        p.getStyleClass().removeIf(c -> c.startsWith("hex-terrain-"));
        String cls = terrainCssClass(newTerrainType);
        if (cls != null) p.getStyleClass().add(cls);
        Object ud = p.getUserData();
        if (ud instanceof HexTile tile) {
            p.setUserData(new HexTile(
                    tile.tileId(),
                    tile.mapId(),
                    tile.q(),
                    tile.r(),
                    newTerrainType,
                    tile.elevation(),
                    tile.biome(),
                    tile.explored(),
                    tile.dominantFactionId(),
                    tile.notes()));
        }
    }

    // -------------------------------------------------------------------------

    private Polygon buildHexPolygon(HexTile tile) {
        double cx = hexCenterX(tile.q());
        double cy = hexCenterY(tile.q(), tile.r());

        double[] pts = new double[12];
        for (int i = 0; i < 6; i++) {
            pts[i * 2] = cx + HEX_VERTEX_DX[i];
            pts[i * 2 + 1] = cy + HEX_VERTEX_DY[i];
        }

        Polygon hex = new Polygon(pts);
        hex.getStyleClass().add("hex-tile");
        String terrainClass = terrainCssClass(tile.terrainType());
        if (terrainClass != null) hex.getStyleClass().add(terrainClass);
        hex.setUserData(tile);

        // Full-Drag starten, damit benachbarte Hexes MOUSE_DRAG_ENTERED erhalten.
        hex.setOnDragDetected(e -> {
            if (paintMode && !readOnly && e.isPrimaryButtonDown()) hex.startFullDrag();
        });

        // Initiales Hex sofort bei Mouse-Press bemalen (vor jeder Drag-Bewegung).
        hex.setOnMousePressed(e -> {
            if (paintMode && e.isPrimaryButtonDown() && !readOnly && onTileDragPainted != null) {
                HexTile currentTile = currentTile(hex);
                if (currentTile != null) {
                    onTileDragPainted.accept(currentTile);
                }
            }
        });

        // Hover-Styling (tritt nur ausserhalb einer Drag-Geste auf).
        hex.setOnMouseEntered(e -> {
            hex.getStyleClass().add("hex-tile-hovered");
            if (onTileHovered != null) {
                HexTile currentTile = currentTile(hex);
                if (currentTile != null) {
                    onTileHovered.accept(currentTile);
                }
            }
        });
        hex.setOnMouseExited(e -> hex.getStyleClass().remove("hex-tile-hovered"));

        // Drag-Malen: feuert beim Eintritt in dieses Hex waehrend einer Full-Drag-Geste.
        hex.setOnMouseDragEntered(e -> {
            hex.getStyleClass().add("hex-tile-hovered");
            if (paintMode && !readOnly && onTileDragPainted != null) {
                HexTile currentTile = currentTile(hex);
                if (currentTile != null) {
                    onTileDragPainted.accept(currentTile);
                }
            }
        });
        hex.setOnMouseDragExited(e -> hex.getStyleClass().remove("hex-tile-hovered"));

        // Handler immer installiert; readOnly wird bei Dispatch geprueft, damit Umschalten korrekt funktioniert.
        hex.setOnMouseClicked(e -> {
            if (!readOnly && e.isStillSincePress()) {
                HexTile currentTile = currentTile(hex);
                if (currentTile != null) {
                    setSelectedTile(currentTile);
                    if (onTileClicked != null) {
                        onTileClicked.accept(currentTile);
                    }
                }
            }
        });
        return hex;
    }

    private static HexTile currentTile(Polygon hex) {
        Object userData = hex.getUserData();
        return userData instanceof HexTile tile ? tile : null;
    }

    /** Flat-Top axial -> Pixel-X: size * 3/2 * q (unabhaengig von r). */
    private static double hexCenterX(int q) {
        return HEX_SIZE * 1.5 * q;
    }

    /** Flat-Top axial -> Pixel-Y: size * sqrt(3) * (r + q/2). */
    private static double hexCenterY(int q, int r) {
        return HEX_SIZE * Math.sqrt(3.0) * (r + q * 0.5);
    }

    private static String terrainCssClass(HexTerrainType terrainType) {
        HexTerrainUiType t = terrainType == null ? null : HexTerrainUiType.fromKey(terrainType.dbValue());
        return t != null ? t.tileCssClass() : null;
    }
}

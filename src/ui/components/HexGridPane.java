package ui.components;

import entities.HexTile;
import javafx.beans.value.ChangeListener;
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
 * Shared hex grid renderer used by both the overworld viewer and the map editor.
 * Renders flat-top hexagons from axial (Q, R) coordinates. Supports pan (drag)
 * and zoom (scroll wheel). In read-only mode, click interactions are disabled.
 */
public class HexGridPane extends Pane {

    private static final double HEX_SIZE = 48.0; // px, center to vertex

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

    /** O(1) tile-ID → polygon lookup for selection and reload-safe access. */
    private final Map<Long, Polygon> tilePolygons = new HashMap<>();

    // Pan/zoom state
    private double dragStartX, dragStartY;
    private double translateX = 0, translateY = 0;
    private double zoomScale = 1.0;

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

        setupPanZoom();
    }

    @Override
    protected void layoutChildren() {
        double w = getWidth(), h = getHeight();
        double lw = emptyLabel.prefWidth(-1);
        double lh = emptyLabel.prefHeight(-1);
        emptyLabel.resizeRelocate((w - lw) / 2.0, (h - lh) / 2.0, lw, lh);
        // hexGroup managed via translate/scale transforms — no layout pass needed
    }

    // -------------------------------------------------------------------------
    // Data loading

    /** Rebuilds all hex Polygon nodes from the given tile list. */
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
            if (tile.TileId != null) tilePolygons.put(tile.TileId, hex);
        }
        hexGroup.getChildren().addAll(polygons);
        centerOnTiles(tiles);
    }

    // -------------------------------------------------------------------------
    // Public API

    public void setOnTileClicked(Consumer<HexTile> cb)      { onTileClicked = cb; }
    public void setOnTileHovered(Consumer<HexTile> cb)     { onTileHovered = cb; }
    public void setOnTileDragPainted(Consumer<HexTile> cb)   { onTileDragPainted = cb; }
    public void setOnPaintStrokeFinished(Runnable cb)       { onPaintStrokeFinished = cb; }
    public void setReadOnly(boolean readOnly)               { this.readOnly = readOnly; }
    public void setPaintMode(boolean paintMode)             { this.paintMode = paintMode; }

    /** Highlights the given tile as selected (clears previous selection). ID-based — reload-safe. */
    public void setSelectedTile(HexTile tile) {
        if (selectedPolygon != null) {
            selectedPolygon.getStyleClass().remove("hex-tile-selected");
            selectedPolygon = null;
        }
        if (tile == null || tile.TileId == null) return;
        Polygon p = tilePolygons.get(tile.TileId);
        if (p != null) {
            p.getStyleClass().add("hex-tile-selected");
            selectedPolygon = p;
        }
    }

    /**
     * Updates the terrain CSS class on an existing tile polygon without reloading.
     * Also patches the HexTile stored in userData so subsequent reads stay consistent.
     */
    public void updateTileTerrain(long tileId, String newTerrainType) {
        Polygon p = tilePolygons.get(tileId);
        if (p == null) return;
        p.getStyleClass().removeIf(c -> c.startsWith("hex-terrain-"));
        String cls = terrainCssClass(newTerrainType);
        if (cls != null) p.getStyleClass().add(cls);
        Object ud = p.getUserData();
        if (ud instanceof HexTile tile) tile.TerrainType = newTerrainType;
    }

    // -------------------------------------------------------------------------

    private Polygon buildHexPolygon(HexTile tile) {
        double cx = hexCenterX(tile.Q);
        double cy = hexCenterY(tile.Q, tile.R);

        double[] pts = new double[12];
        for (int i = 0; i < 6; i++) {
            pts[i * 2]     = cx + HEX_VERTEX_DX[i];
            pts[i * 2 + 1] = cy + HEX_VERTEX_DY[i];
        }

        Polygon hex = new Polygon(pts);
        hex.getStyleClass().add("hex-tile");
        String terrainClass = terrainCssClass(tile.TerrainType);
        if (terrainClass != null) hex.getStyleClass().add(terrainClass);
        hex.setUserData(tile);

        hex.setOnMouseEntered(e -> {
            hex.getStyleClass().add("hex-tile-hovered");
            if (onTileHovered != null) onTileHovered.accept(tile);
            if (paintMode && e.isPrimaryButtonDown() && !readOnly && onTileDragPainted != null) {
                onTileDragPainted.accept(tile);
            }
        });
        hex.setOnMouseExited(e -> hex.getStyleClass().remove("hex-tile-hovered"));

        // Handler always installed; readOnly checked at dispatch time so toggling works.
        hex.setOnMouseClicked(e -> {
            if (!readOnly && e.isStillSincePress()) {
                setSelectedTile(tile);
                if (onTileClicked != null) onTileClicked.accept(tile);
            }
        });
        return hex;
    }

    /** Flat-top axial → pixel X: size * 3/2 * q (independent of r). */
    private static double hexCenterX(int q) {
        return HEX_SIZE * 1.5 * q;
    }

    /** Flat-top axial → pixel Y: size * sqrt(3) * (r + q/2). */
    private static double hexCenterY(int q, int r) {
        return HEX_SIZE * Math.sqrt(3.0) * (r + q * 0.5);
    }

    private static String terrainCssClass(String key) {
        TerrainType t = TerrainType.fromKey(key);
        return t != null ? t.tileCssClass() : null;
    }

    /**
     * Centers the view on the centroid of all tiles.
     * Defers until layout is complete if the pane hasn't been sized yet.
     */
    private void centerOnTiles(List<HexTile> tiles) {
        double w = getWidth(), h = getHeight();
        if (w == 0 || h == 0) {
            // Layout not yet complete — wait for first real size, then center once.
            ChangeListener<Number> listener = new ChangeListener<>() {
                @Override public void changed(javafx.beans.value.ObservableValue<? extends Number> obs,
                                              Number oldV, Number newV) {
                    if (newV.doubleValue() > 0) {
                        widthProperty().removeListener(this);
                        centerOnTiles(tiles);
                    }
                }
            };
            widthProperty().addListener(listener);
            return;
        }
        double sumX = 0, sumY = 0;
        for (HexTile t : tiles) {
            sumX += hexCenterX(t.Q);
            sumY += hexCenterY(t.Q, t.R);
        }
        double cx = sumX / tiles.size(), cy = sumY / tiles.size();
        zoomScale = 1.0;
        translateX = w / 2.0 - cx;
        translateY = h / 2.0 - cy;
        applyTransform();
    }

    private void setupPanZoom() {
        // Use local (pane) coordinates for both drag and zoom so the behaviour is
        // correct regardless of parent transforms or SplitPane insets.
        setOnMousePressed(e -> {
            dragStartX = e.getX() - translateX;
            dragStartY = e.getY() - translateY;
        });

        setOnMouseReleased(e -> {
            if (paintMode && onPaintStrokeFinished != null) onPaintStrokeFinished.run();
        });

        setOnMouseDragged(e -> {
            if (paintMode && e.isPrimaryButtonDown()) return; // painting, not panning
            translateX = e.getX() - dragStartX;
            translateY = e.getY() - dragStartY;
            applyTransform();
        });

        setOnScroll(e -> {
            double factor = e.getDeltaY() > 0 ? 1.1 : 0.9;
            zoomScale = Math.max(0.2, Math.min(5.0, zoomScale * factor));
            // Zoom toward the cursor position (local coords).
            translateX = e.getX() - factor * (e.getX() - translateX);
            translateY = e.getY() - factor * (e.getY() - translateY);
            applyTransform();
        });
    }

    private void applyTransform() {
        hexGroup.setTranslateX(translateX);
        hexGroup.setTranslateY(translateY);
        hexGroup.setScaleX(zoomScale);
        hexGroup.setScaleY(zoomScale);
    }
}

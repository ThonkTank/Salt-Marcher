package features.world.hexmap.ui.shared;

import features.world.hexmap.model.HexTile;
import javafx.geometry.Point2D;
import javafx.scene.Cursor;
import javafx.scene.Group;
import javafx.scene.control.Label;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Circle;
import javafx.scene.shape.Polygon;

import java.util.Map;
import java.util.function.Consumer;
import java.util.function.ToDoubleFunction;

/**
 * Verwaltet den Gruppenmarker (Token) inkl. Drag-and-Drop und Tile-Snapping.
 */
final class PartyTokenController {

    private static final double TOKEN_RADIUS = 14.0;

    private final Group hexGroup;
    private final Map<Long, Polygon> tilePolygons;
    private final ToDoubleFunction<HexTile> centerX;
    private final ToDoubleFunction<HexTile> centerY;

    private StackPane partyToken;
    private Long partyTileId;
    private boolean draggingToken;
    private double tokenDragOffsetX;
    private double tokenDragOffsetY;

    private Consumer<HexTile> onPartyTokenMoved;

    PartyTokenController(
            Group hexGroup,
            Map<Long, Polygon> tilePolygons,
            ToDoubleFunction<HexTile> centerX,
            ToDoubleFunction<HexTile> centerY
    ) {
        this.hexGroup = hexGroup;
        this.tilePolygons = tilePolygons;
        this.centerX = centerX;
        this.centerY = centerY;
    }

    void setOnPartyTokenMoved(Consumer<HexTile> callback) {
        onPartyTokenMoved = callback;
    }

    void setPartyToken(Long tileId) {
        if (tileId == null) {
            if (partyToken != null) {
                hexGroup.getChildren().remove(partyToken);
            }
            partyTileId = null;
            return;
        }

        partyTileId = tileId;
        if (partyToken == null) {
            partyToken = buildPartyToken();
        }
        if (!hexGroup.getChildren().contains(partyToken)) {
            hexGroup.getChildren().add(partyToken);
        }
        positionTokenById(tileId);
    }

    void reinsertAfterTileReload() {
        if (partyToken == null || partyTileId == null) {
            return;
        }
        if (!hexGroup.getChildren().contains(partyToken)) {
            hexGroup.getChildren().add(partyToken);
        }
        positionTokenById(partyTileId);
    }

    private StackPane buildPartyToken() {
        Circle circle = new Circle(TOKEN_RADIUS);
        circle.getStyleClass().add("party-token-circle");

        Label icon = new Label("\u2691");
        icon.getStyleClass().add("party-token-icon");
        icon.setMouseTransparent(true);

        StackPane token = new StackPane(circle, icon);
        token.setPrefSize(TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
        token.setMaxSize(TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
        token.setCursor(Cursor.HAND);

        token.setOnMousePressed(e -> {
            if (e.isPrimaryButtonDown()) {
                Point2D local = hexGroup.sceneToLocal(e.getSceneX(), e.getSceneY());
                tokenDragOffsetX = (token.getLayoutX() + TOKEN_RADIUS) - local.getX();
                tokenDragOffsetY = (token.getLayoutY() + TOKEN_RADIUS) - local.getY();
                draggingToken = true;
                token.setCursor(Cursor.MOVE);
                e.consume();
            }
        });

        token.setOnMouseDragged(e -> {
            if (!draggingToken) {
                return;
            }
            Point2D local = hexGroup.sceneToLocal(e.getSceneX(), e.getSceneY());
            double cx = local.getX() + tokenDragOffsetX;
            double cy = local.getY() + tokenDragOffsetY;
            token.setLayoutX(cx - TOKEN_RADIUS);
            token.setLayoutY(cy - TOKEN_RADIUS);
            e.consume();
        });

        token.setOnMouseReleased(e -> {
            if (!draggingToken) {
                return;
            }

            draggingToken = false;
            token.setCursor(Cursor.HAND);
            Point2D local = hexGroup.sceneToLocal(e.getSceneX(), e.getSceneY());
            double dropX = local.getX() + tokenDragOffsetX;
            double dropY = local.getY() + tokenDragOffsetY;

            HexTile nearest = findNearestTile(dropX, dropY);
            if (nearest != null && nearest.tileId() != null) {
                positionToken(nearest);
                if (!nearest.tileId().equals(partyTileId)) {
                    partyTileId = nearest.tileId();
                    if (onPartyTokenMoved != null) {
                        onPartyTokenMoved.accept(nearest);
                    }
                }
            } else {
                positionTokenById(partyTileId);
            }
            e.consume();
        });

        return token;
    }

    private void positionToken(HexTile tile) {
        if (partyToken == null) {
            return;
        }
        double cx = centerX.applyAsDouble(tile);
        double cy = centerY.applyAsDouble(tile);
        partyToken.setLayoutX(cx - TOKEN_RADIUS);
        partyToken.setLayoutY(cy - TOKEN_RADIUS);
    }

    private void positionTokenById(Long tileId) {
        if (tileId == null) {
            return;
        }
        Polygon polygon = tilePolygons.get(tileId);
        if (polygon != null && polygon.getUserData() instanceof HexTile tile) {
            positionToken(tile);
        }
    }

    /** Findet das Feld mit dem naechsten Hex-Mittelpunkt zum Punkt (in lokalen hexGroup-Koordinaten). */
    private HexTile findNearestTile(double localX, double localY) {
        HexTile nearest = null;
        double minDist = Double.MAX_VALUE;

        for (Polygon polygon : tilePolygons.values()) {
            if (!(polygon.getUserData() instanceof HexTile tile)) continue;

            double cx = centerX.applyAsDouble(tile);
            double cy = centerY.applyAsDouble(tile);
            double dx = localX - cx;
            double dy = localY - cy;
            double dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                nearest = tile;
            }
        }
        return nearest;
    }
}

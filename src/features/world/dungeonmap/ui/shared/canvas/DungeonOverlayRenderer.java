package features.world.dungeonmap.ui.shared.canvas;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.projection.DungeonMapConnectionPath;
import features.world.dungeonmap.ui.shared.format.DungeonRoomFeatureOrder;
import features.world.dungeonmap.ui.shared.selection.DungeonSelection;
import javafx.geometry.Point2D;
import javafx.scene.control.Label;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.paint.Color;
import javafx.scene.paint.CycleMethod;
import javafx.scene.paint.LinearGradient;
import javafx.scene.paint.Paint;
import javafx.scene.paint.Stop;
import javafx.scene.shape.Circle;
import javafx.scene.shape.Polyline;
import javafx.scene.shape.Rectangle;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

final class DungeonOverlayRenderer {

    private static final Color FEATURE_SELECTION_STROKE = Color.web("#f3e3a0");
    private static final Color CONNECTION_STROKE = Color.web("#d6c28a");
    private static final Color CONNECTION_SELECTED_STROKE = Color.web("#5ba8f0");
    private static final Color CONNECTION_HANDLE_FILL = Color.web("#f5e2aa");
    private static final Color CONNECTION_HANDLE_SELECTED_FILL = Color.web("#ffffff");

    private final Pane roomLabelsLayer;
    private final Pane featuresLayer;
    private final Pane connectionsLayer;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private final Map<Long, Label> roomLabelNodes = new HashMap<>();
    private final List<Label> areaLabelNodes = new ArrayList<>();
    private final Map<Long, Label> featureLabelNodes = new HashMap<>();
    private final Map<String, Rectangle> featureTileNodes = new HashMap<>();
    private final Map<Long, ConnectionNode> connectionNodes = new HashMap<>();

    private Consumer<Long> onConnectionClicked;
    private Consumer<DungeonMapPane.ConnectionPointMoveRequest> onConnectionPointMoved;
    private Consumer<DungeonMapPane.ConnectionPointInsertRequest> onConnectionPointInserted;
    private Consumer<DungeonMapPane.ConnectionPointDeleteRequest> onConnectionPointDeleted;
    private Consumer<DungeonFeature> onFeatureClicked;
    private boolean showFeatures = true;
    private DungeonCanvasColorMode colorRenderMode = DungeonCanvasColorMode.ROOMS;

    DungeonOverlayRenderer(
            Pane roomLabelsLayer,
            Pane featuresLayer,
            Pane connectionsLayer,
            DungeonCanvasModel model,
            DungeonViewport viewport
    ) {
        this.roomLabelsLayer = roomLabelsLayer;
        this.featuresLayer = featuresLayer;
        this.connectionsLayer = connectionsLayer;
        this.model = model;
        this.viewport = viewport;
        this.roomLabelsLayer.setPickOnBounds(false);
        this.featuresLayer.setPickOnBounds(false);
        this.connectionsLayer.setPickOnBounds(false);
    }

    void rebuildNodes() {
        roomLabelNodes.clear();
        areaLabelNodes.clear();
        featureLabelNodes.clear();
        featureTileNodes.clear();
        connectionNodes.clear();
        roomLabelsLayer.getChildren().clear();
        featuresLayer.getChildren().clear();
        connectionsLayer.getChildren().clear();

        for (DungeonRoom room : model.roomsById().values()) {
            Label label = new Label();
            label.setMouseTransparent(true);
            label.getStyleClass().addAll("dungeon-room-map-label", "section-header");
            roomLabelNodes.put(room.roomId(), label);
            roomLabelsLayer.getChildren().add(label);
        }
        for (int i = 0; i < model.areaLabelAnchors().size(); i++) {
            Label label = new Label();
            label.setMouseTransparent(true);
            label.getStyleClass().addAll("dungeon-room-map-label", "section-header");
            areaLabelNodes.add(label);
            roomLabelsLayer.getChildren().add(label);
        }
        for (Map.Entry<String, List<DungeonFeatureTile>> entry : model.featureTilesByCoord().entrySet()) {
            Rectangle rectangle = new Rectangle();
            rectangle.setMouseTransparent(true);
            featureTileNodes.put(entry.getKey(), rectangle);
            featuresLayer.getChildren().add(rectangle);
        }
        for (Map.Entry<Long, DungeonFeature> entry : model.featuresById().entrySet()) {
            Label label = new Label(entry.getValue().toString());
            label.getStyleClass().addAll("dungeon-room-map-label", "section-header");
            label.setOnMouseClicked(event -> handleFeatureClick(event.getButton(), entry.getKey()));
            featureLabelNodes.put(entry.getKey(), label);
            featuresLayer.getChildren().add(label);
        }
        for (DungeonMapConnectionPath connectionPath : model.roomConnections()) {
            ConnectionNode connectionNode = buildConnectionNode(connectionPath);
            connectionNodes.put(connectionPath.connectionId(), connectionNode);
            connectionsLayer.getChildren().add(connectionNode.line());
            connectionsLayer.getChildren().add(connectionNode.hitLine());
            connectionsLayer.getChildren().addAll(connectionNode.handles());
        }
    }

    void repositionOverlays(Region owner) {
        positionRoomLabels(owner);
        positionFeatures(owner);
        for (DungeonMapConnectionPath connectionPath : model.roomConnections()) {
            positionConnection(owner, connectionPath);
        }
        refreshFeatureStyles();
        refreshConnectionStyles();
    }

    void setOnConnectionClicked(Consumer<Long> onConnectionClicked) {
        this.onConnectionClicked = onConnectionClicked;
    }

    void setOnConnectionPointMoved(Consumer<DungeonMapPane.ConnectionPointMoveRequest> onConnectionPointMoved) {
        this.onConnectionPointMoved = onConnectionPointMoved;
    }

    void setOnConnectionPointInserted(Consumer<DungeonMapPane.ConnectionPointInsertRequest> onConnectionPointInserted) {
        this.onConnectionPointInserted = onConnectionPointInserted;
    }

    void setOnConnectionPointDeleted(Consumer<DungeonMapPane.ConnectionPointDeleteRequest> onConnectionPointDeleted) {
        this.onConnectionPointDeleted = onConnectionPointDeleted;
    }

    void setOnFeatureClicked(Consumer<DungeonFeature> onFeatureClicked) {
        this.onFeatureClicked = onFeatureClicked;
    }

    void setShowFeatures(boolean showFeatures) {
        this.showFeatures = showFeatures;
        updateVisibility();
    }

    void setColorRenderMode(DungeonCanvasColorMode colorRenderMode) {
        this.colorRenderMode = colorRenderMode == null ? DungeonCanvasColorMode.ROOMS : colorRenderMode;
    }

    void refreshFeatureStyles() {
        for (Map.Entry<String, Rectangle> entry : featureTileNodes.entrySet()) {
            Rectangle rectangle = entry.getValue();
            List<DungeonFeatureTile> tiles = model.featureTilesByCoord().get(entry.getKey());
            if (tiles == null || tiles.isEmpty()) {
                continue;
            }
            boolean selected = isSelectedFeatureTile(tiles);
            rectangle.setFill(featureTileFill(tiles, selected));
            rectangle.setStroke(selected ? FEATURE_SELECTION_STROKE : featureStrokeColor(tiles));
            rectangle.setStrokeWidth(selected ? Math.max(2.0, 2.5 * viewport.strokeScale()) : Math.max(1.0, viewport.strokeScale()));
        }
        for (Map.Entry<Long, Label> entry : featureLabelNodes.entrySet()) {
            DungeonFeature feature = model.featuresById().get(entry.getKey());
            boolean selected = model.selection() != null
                    && model.selection().type() == DungeonSelection.SelectionType.FEATURE
                    && entry.getKey().equals(model.selection().id());
            Label label = entry.getValue();
            label.setText(feature == null ? "Feature" : feature.toString());
            label.setVisible(showFeatures);
            label.setManaged(showFeatures);
            label.setOpacity(selected ? 1.0 : 0.9);
            label.setStyle(selected ? "-fx-border-color: rgba(243, 227, 160, 0.95);" : "");
        }
    }

    void refreshConnectionStyles() {
        DungeonSelection selection = model.selection();
        Long selectedConnectionId = selection != null && selection.type() == DungeonSelection.SelectionType.CONNECTION
                ? selection.id()
                : null;
        for (Map.Entry<Long, ConnectionNode> entry : connectionNodes.entrySet()) {
            boolean selected = selectedConnectionId != null && selectedConnectionId.equals(entry.getKey());
            ConnectionNode node = entry.getValue();
            node.line().setStroke(selected ? CONNECTION_SELECTED_STROKE : CONNECTION_STROKE);
            node.line().setStrokeWidth(selected ? Math.max(3.0, 4.0 * viewport.strokeScale()) : Math.max(2.0, 3.0 * viewport.strokeScale()));
            for (Circle handle : node.handles()) {
                handle.setFill(selected ? CONNECTION_HANDLE_SELECTED_FILL : CONNECTION_HANDLE_FILL);
                handle.setStroke(selected ? CONNECTION_SELECTED_STROKE : CONNECTION_STROKE);
                handle.setStrokeWidth(Math.max(1.0, 1.5 * viewport.strokeScale()));
            }
        }
    }

    private void handleFeatureClick(MouseButton button, Long featureId) {
        if (button != MouseButton.PRIMARY || onFeatureClicked == null || featureId == null) {
            return;
        }
        DungeonFeature feature = model.featuresById().get(featureId);
        if (feature != null) {
            onFeatureClicked.accept(feature);
        }
    }

    private ConnectionNode buildConnectionNode(DungeonMapConnectionPath connectionPath) {
        Polyline line = new Polyline();
        line.setFill(Color.TRANSPARENT);
        line.setMouseTransparent(true);
        Polyline hitLine = new Polyline();
        hitLine.setFill(Color.TRANSPARENT);
        hitLine.setStroke(Color.TRANSPARENT);
        hitLine.setStrokeWidth(Math.max(10.0, 14.0 * viewport.strokeScale()));
        hitLine.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && onConnectionClicked != null) {
                onConnectionClicked.accept(connectionPath.connectionId());
                if (event.getClickCount() >= 2 && onConnectionPointInserted != null) {
                    Point2D point = connectionsLayer.sceneToLocal(event.getSceneX(), event.getSceneY());
                    onConnectionPointInserted.accept(new DungeonMapPane.ConnectionPointInsertRequest(
                            connectionPath.connectionId(),
                            viewport.cellX(point.getX()),
                            viewport.cellY(point.getY())));
                }
                event.consume();
            }
        });
        List<Circle> handles = new ArrayList<>();
        for (int index = 0; index < connectionPath.controlPoints().size(); index++) {
            handles.add(buildConnectionHandle(connectionPath.connectionId(), index));
        }
        return new ConnectionNode(line, hitLine, handles);
    }

    private Circle buildConnectionHandle(Long connectionId, int pointIndex) {
        Circle handle = new Circle();
        handle.setRadius(Math.max(4.0, 5.0 * viewport.strokeScale()));
        handle.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && onConnectionClicked != null) {
                onConnectionClicked.accept(connectionId);
                event.consume();
                return;
            }
            if (event.getButton() == MouseButton.SECONDARY && onConnectionPointDeleted != null) {
                onConnectionPointDeleted.accept(new DungeonMapPane.ConnectionPointDeleteRequest(connectionId, pointIndex));
                event.consume();
            }
        });
        handle.setOnMouseDragged(event -> {
            if (onConnectionPointMoved == null) {
                return;
            }
            Point2D point = connectionsLayer.sceneToLocal(event.getSceneX(), event.getSceneY());
            onConnectionPointMoved.accept(new DungeonMapPane.ConnectionPointMoveRequest(
                    connectionId,
                    pointIndex,
                    viewport.cellX(point.getX()),
                    viewport.cellY(point.getY())));
            event.consume();
        });
        return handle;
    }

    private void positionConnection(Region owner, DungeonMapConnectionPath connectionPath) {
        ConnectionNode node = connectionNodes.get(connectionPath.connectionId());
        if (node == null) {
            return;
        }
        node.line().getPoints().setAll(connectionPolylinePoints(connectionPath));
        node.hitLine().getPoints().setAll(connectionPolylinePoints(connectionPath));
        boolean selected = model.selection() != null
                && model.selection().type() == DungeonSelection.SelectionType.CONNECTION
                && connectionPath.connectionId().equals(model.selection().id());
        boolean visible = node.line().getPoints().size() >= 4;
        node.line().setVisible(visible);
        node.line().setManaged(visible);
        node.hitLine().setVisible(visible);
        node.hitLine().setManaged(visible);
        for (int index = 0; index < node.handles().size(); index++) {
            Circle handle = node.handles().get(index);
            boolean handleVisible = visible && selected && index < connectionPath.controlPoints().size();
            if (handleVisible) {
                var point = connectionPath.controlPoints().get(index);
                handle.setCenterX(viewport.screenCenterX(point.x()));
                handle.setCenterY(viewport.screenCenterY(point.y()));
                handle.setRadius(Math.max(4.0, 5.0 * viewport.strokeScale()));
            }
            handle.setVisible(handleVisible);
            handle.setManaged(handleVisible);
        }
    }

    private void updateVisibility() {
        roomLabelsLayer.setVisible(true);
        roomLabelsLayer.setManaged(true);
        featuresLayer.setVisible(showFeatures);
        featuresLayer.setManaged(showFeatures);
        connectionsLayer.setVisible(true);
        connectionsLayer.setManaged(true);
    }

    private List<Double> connectionPolylinePoints(DungeonMapConnectionPath connectionPath) {
        List<Double> points = new ArrayList<>();
        for (DungeonMapConnectionPath.GridPoint point : connectionPath.routePoints()) {
            points.add(viewport.screenX(point.x()));
            points.add(viewport.screenY(point.y()));
        }
        return points;
    }

    private void positionFeatures(Region owner) {
        double cellSize = viewport.scaledCellSize();
        for (Map.Entry<String, Rectangle> entry : featureTileNodes.entrySet()) {
            String[] coords = entry.getKey().split(":");
            int x = Integer.parseInt(coords[0]);
            int y = Integer.parseInt(coords[1]);
            Rectangle rectangle = entry.getValue();
            rectangle.setX(viewport.screenX(x) + 2.0);
            rectangle.setY(viewport.screenY(y) + 2.0);
            rectangle.setWidth(Math.max(4.0, cellSize - 5.0));
            rectangle.setHeight(Math.max(4.0, cellSize - 5.0));
            boolean visible = viewport.isVisible(owner, rectangle.getX(), rectangle.getY(), rectangle.getWidth());
            rectangle.setVisible(showFeatures && visible);
            rectangle.setManaged(showFeatures && visible);
        }
        List<Map.Entry<Long, List<DungeonFeatureTile>>> entries = new ArrayList<>(model.featureTilesByFeatureId().entrySet());
        entries.sort(Comparator.comparingLong(Map.Entry::getKey));
        int labelIndex = 0;
        for (Map.Entry<Long, List<DungeonFeatureTile>> entry : entries) {
            List<DungeonFeatureTile> tiles = entry.getValue();
            if (tiles == null || tiles.isEmpty()) {
                continue;
            }
            double sumX = 0;
            double sumY = 0;
            for (DungeonFeatureTile tile : tiles) {
                sumX += viewport.screenCenterX(tile.x());
                sumY += viewport.screenCenterY(tile.y());
            }
            double centerX = sumX / tiles.size();
            double centerY = sumY / tiles.size();
            Label label = featureLabelNodes.get(entry.getKey());
            if (label != null) {
                double width = label.prefWidth(-1);
                double height = label.prefHeight(width);
                label.resize(width, height);
                double offsetY = 18.0 + (labelIndex % 3) * (height + 6.0);
                label.relocate(centerX - (width / 2.0), centerY - (height / 2.0) + offsetY);
                boolean visible = viewport.isVisible(owner, centerX, centerY + offsetY, Math.max(width, height) / 2.0);
                label.setVisible(showFeatures && visible);
                label.setManaged(showFeatures && visible);
                labelIndex++;
            }
        }
    }

    private void positionRoomLabels(Region owner) {
        boolean roomMode = colorRenderMode == DungeonCanvasColorMode.ROOMS;
        for (Map.Entry<Long, Label> entry : roomLabelNodes.entrySet()) {
            Long roomId = entry.getKey();
            Label label = entry.getValue();
            DungeonRoom room = model.roomsById().get(roomId);
            DungeonCanvasLabelLayout.RoomLabelAnchor anchor = model.roomLabelAnchors().get(roomId);
            if (room == null || anchor == null || anchor.squareCount() == 0) {
                label.setVisible(false);
                label.setManaged(false);
                continue;
            }
            double centerX = viewport.screenCenterX(anchor.x());
            double centerY = viewport.screenCenterY(anchor.y());
            label.setText(room.name() == null || room.name().isBlank() ? "Raum" : room.name());
            double width = label.prefWidth(-1);
            double height = label.prefHeight(width);
            label.resize(width, height);
            label.relocate(centerX - (width / 2.0), centerY - (height / 2.0));
            boolean visible = viewport.isVisible(owner, centerX, centerY, Math.max(width, height) / 2.0);
            label.setVisible(roomMode && visible);
            label.setManaged(roomMode && visible);
        }
        boolean areaMode = colorRenderMode == DungeonCanvasColorMode.AREAS;
        List<DungeonCanvasLabelLayout.AreaLabelAnchor> anchors = model.areaLabelAnchors();
        for (int i = 0; i < areaLabelNodes.size(); i++) {
            Label label = areaLabelNodes.get(i);
            DungeonCanvasLabelLayout.AreaLabelAnchor anchor = i < anchors.size() ? anchors.get(i) : null;
            if (anchor == null || anchor.squareCount() == 0) {
                label.setVisible(false);
                label.setManaged(false);
                continue;
            }
            double centerX = viewport.screenCenterX(anchor.x());
            double centerY = viewport.screenCenterY(anchor.y());
            label.setText(anchor.areaName() == null || anchor.areaName().isBlank() ? "Bereich" : anchor.areaName());
            double width = label.prefWidth(-1);
            double height = label.prefHeight(width);
            label.resize(width, height);
            label.relocate(centerX - (width / 2.0), centerY - (height / 2.0));
            boolean visible = viewport.isVisible(owner, centerX, centerY, Math.max(width, height) / 2.0);
            label.setVisible(areaMode && visible);
            label.setManaged(areaMode && visible);
        }
    }

    private boolean isSelectedFeatureTile(List<DungeonFeatureTile> tiles) {
        DungeonSelection selection = model.selection();
        if (selection == null) {
            return false;
        }
        if (selection.type() == DungeonSelection.SelectionType.FEATURE && selection.id() != null) {
            for (DungeonFeatureTile tile : tiles) {
                if (selection.id().equals(tile.featureId())) {
                    return true;
                }
            }
        }
        if (selection.type() == DungeonSelection.SelectionType.SQUARE && selection.square() != null) {
            for (DungeonFeatureTile tile : tiles) {
                if (tile.x() == selection.square().x() && tile.y() == selection.square().y()) {
                    return true;
                }
            }
        }
        return false;
    }

    private static Color featureColor(DungeonFeatureCategory category, double opacity) {
        DungeonFeatureCategory effective = category == null ? DungeonFeatureCategory.CURIOSITY : category;
        Color base = switch (effective) {
            case HAZARD -> Color.web("#c85a48");
            case ENCOUNTER -> Color.web("#4f85c5");
            case TREASURE -> Color.web("#d4af37");
            case CURIOSITY -> Color.web("#6ea27d");
        };
        return Color.color(base.getRed(), base.getGreen(), base.getBlue(), opacity);
    }

    private Paint featureTileFill(List<DungeonFeatureTile> tiles, boolean selected) {
        List<Color> colors = orderedFeatureColors(tiles, selected ? 0.42 : 0.24);
        if (colors.isEmpty()) {
            return Color.TRANSPARENT;
        }
        if (colors.size() == 1) {
            return colors.get(0);
        }
        List<Stop> stops = new ArrayList<>();
        double bandSize = 1.0 / colors.size();
        for (int i = 0; i < colors.size(); i++) {
            double start = i * bandSize;
            double end = Math.min(1.0, start + bandSize);
            Color color = colors.get(i);
            stops.add(new Stop(start, color));
            stops.add(new Stop(Math.max(start, end - 0.001), color));
        }
        return new LinearGradient(0, 0, 10, 10, false, CycleMethod.REPEAT, stops);
    }

    private Color featureStrokeColor(List<DungeonFeatureTile> tiles) {
        List<Color> colors = orderedFeatureColors(tiles, 0.65);
        return colors.isEmpty() ? Color.TRANSPARENT : colors.get(0);
    }

    private List<Color> orderedFeatureColors(List<DungeonFeatureTile> tiles, double opacity) {
        List<DungeonFeature> features = orderedFeaturesForTiles(tiles);
        List<Color> colors = new ArrayList<>();
        for (DungeonFeature feature : features) {
            colors.add(featureColor(feature == null ? null : feature.category(), opacity));
        }
        return colors;
    }

    private List<DungeonFeature> orderedFeaturesForTiles(List<DungeonFeatureTile> tiles) {
        if (tiles == null || tiles.isEmpty()) {
            return List.of();
        }
        List<DungeonFeature> features = new ArrayList<>();
        LinkedHashSet<Long> featureIds = new LinkedHashSet<>();
        for (DungeonFeatureTile tile : tiles) {
            if (tile != null) {
                featureIds.add(tile.featureId());
            }
        }
        for (Long featureId : featureIds) {
            DungeonFeature feature = model.featuresById().get(featureId);
            if (feature != null) {
                features.add(feature);
            }
        }
        features.sort(DungeonRoomFeatureOrder.comparator());
        return features;
    }

    private record ConnectionNode(Polyline line, Polyline hitLine, List<Circle> handles) {
    }
}

package features.world.dungeonmap.ui.shared.canvas;

import features.world.dungeonmap.model.domain.DungeonEndpoint;
import features.world.dungeonmap.model.domain.DungeonEndpointRole;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonLink;
import features.world.dungeonmap.model.domain.DungeonLinkAnchor;
import features.world.dungeonmap.model.domain.DungeonLinkAnchorType;
import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.ui.shared.format.DungeonRoomFeatureOrder;
import features.world.dungeonmap.ui.shared.selection.DungeonSelection;
import javafx.scene.input.MouseButton;
import javafx.scene.control.Label;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.paint.CycleMethod;
import javafx.scene.paint.Paint;
import javafx.scene.shape.Circle;
import javafx.scene.shape.Line;
import javafx.scene.shape.Rectangle;
import javafx.scene.paint.Color;
import javafx.scene.paint.LinearGradient;
import javafx.scene.paint.Stop;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

final class DungeonOverlayRenderer {

    private static final Color FEATURE_SELECTION_STROKE = Color.web("#f3e3a0");
    private static final Color LINK_STROKE = Color.web("#c8a86a");
    private static final Color LINK_SELECTED_STROKE = Color.web("#41a9f2");
    private static final Color ENTRY_FILL = Color.web("#7cbf88");
    private static final Color EXIT_FILL = Color.web("#cc7a6b");
    private static final Color BOTH_FILL = Color.web("#e8b870");
    private static final Color ENDPOINT_PENDING_FILL = Color.web("#f4d35e");
    private static final Color ENDPOINT_STROKE = Color.web("#2b2012");
    private static final Color ENDPOINT_SELECTED_STROKE = Color.web("#f0a040");
    private static final Color DEFAULT_ENTRY_STROKE = Color.web("#f8f3a6");
    private static final Color PARTY_STROKE = Color.web("#41a9f2");
    private static final double ENDPOINT_HIT_RADIUS = 10.0;

    private final Pane roomLabelsLayer;
    private final Pane featuresLayer;
    private final Pane linksLayer;
    private final Pane endpointsLayer;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private final Map<Long, Label> roomLabelNodes = new HashMap<>();
    private final List<Label> areaLabelNodes = new java.util.ArrayList<>();
    private final Map<Long, Label> featureLabelNodes = new HashMap<>();
    private final Map<String, Rectangle> featureTileNodes = new HashMap<>();
    private final Map<Long, EndpointNode> endpointNodes = new HashMap<>();
    private final Map<Long, Line> linkNodes = new HashMap<>();

    private Consumer<DungeonEndpoint> onEndpointClicked;
    private Consumer<DungeonLink> onLinkClicked;
    private Consumer<DungeonFeature> onFeatureClicked;
    private boolean showFeatures = true;
    private boolean showLinks = true;
    private boolean showEndpoints = true;
    private DungeonCanvasColorMode colorRenderMode = DungeonCanvasColorMode.ROOMS;

    DungeonOverlayRenderer(
            Pane roomLabelsLayer,
            Pane featuresLayer,
            Pane linksLayer,
            Pane endpointsLayer,
            DungeonCanvasModel model,
            DungeonViewport viewport
    ) {
        this.roomLabelsLayer = roomLabelsLayer;
        this.featuresLayer = featuresLayer;
        this.linksLayer = linksLayer;
        this.endpointsLayer = endpointsLayer;
        this.model = model;
        this.viewport = viewport;
        this.roomLabelsLayer.setPickOnBounds(false);
        this.featuresLayer.setPickOnBounds(false);
        this.linksLayer.setPickOnBounds(false);
        this.endpointsLayer.setPickOnBounds(false);
    }

    void rebuildNodes() {
        roomLabelNodes.clear();
        areaLabelNodes.clear();
        featureLabelNodes.clear();
        featureTileNodes.clear();
        endpointNodes.clear();
        linkNodes.clear();
        roomLabelsLayer.getChildren().clear();
        featuresLayer.getChildren().clear();
        linksLayer.getChildren().clear();
        endpointsLayer.getChildren().clear();

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
        for (Map.Entry<String, java.util.List<DungeonFeatureTile>> entry : model.featureTilesByCoord().entrySet()) {
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
        for (DungeonEndpoint endpoint : model.endpointsById().values()) {
            EndpointNode endpointNode = buildEndpointNode(endpoint);
            endpointNodes.put(endpoint.endpointId(), endpointNode);
            endpointsLayer.getChildren().addAll(endpointNode.hitTarget(), endpointNode.visual());
        }
        for (DungeonLink link : model.linksById().values()) {
            Line line = buildLinkNode(link);
            if (line != null) {
                linkNodes.put(link.linkId(), line);
                linksLayer.getChildren().add(line);
            }
        }
    }

    void repositionOverlays(Region owner) {
        positionRoomLabels(owner);
        positionFeatures(owner);
        for (Map.Entry<Long, DungeonEndpoint> entry : model.endpointsById().entrySet()) {
            positionEndpoint(owner, entry.getKey(), entry.getValue());
        }
        for (Map.Entry<Long, DungeonLink> entry : model.linksById().entrySet()) {
            positionLink(owner, entry.getKey(), entry.getValue());
        }
        refreshFeatureStyles();
        refreshEndpointStyles();
        refreshLinkStyles();
    }

    void setOnEndpointClicked(Consumer<DungeonEndpoint> onEndpointClicked) {
        this.onEndpointClicked = onEndpointClicked;
    }

    void setOnLinkClicked(Consumer<DungeonLink> onLinkClicked) {
        this.onLinkClicked = onLinkClicked;
    }

    void setOnFeatureClicked(Consumer<DungeonFeature> onFeatureClicked) {
        this.onFeatureClicked = onFeatureClicked;
    }

    void setShowLinks(boolean showLinks) {
        this.showLinks = showLinks;
        updateVisibility();
    }

    void setShowFeatures(boolean showFeatures) {
        this.showFeatures = showFeatures;
        updateVisibility();
    }

    void setShowEndpoints(boolean showEndpoints) {
        this.showEndpoints = showEndpoints;
        updateVisibility();
    }

    void setColorRenderMode(DungeonCanvasColorMode colorRenderMode) {
        this.colorRenderMode = colorRenderMode == null ? DungeonCanvasColorMode.ROOMS : colorRenderMode;
    }

    void refreshFeatureStyles() {
        for (Map.Entry<String, Rectangle> entry : featureTileNodes.entrySet()) {
            Rectangle rectangle = entry.getValue();
            java.util.List<DungeonFeatureTile> tiles = model.featureTilesByCoord().get(entry.getKey());
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

    void refreshEndpointStyles() {
        for (Map.Entry<Long, EndpointNode> entry : endpointNodes.entrySet()) {
            Long endpointId = entry.getKey();
            EndpointNode endpointNode = entry.getValue();
            Circle circle = endpointNode.visual();
            DungeonSelection selection = model.selection();
            boolean isSelected = selection != null
                    && selection.type() == DungeonSelection.SelectionType.ENDPOINT
                    && endpointId.equals(selection.id());
            boolean isParty = endpointId.equals(model.partyEndpointId());
            boolean isPending = isPendingEndpoint(endpointId);
            DungeonEndpoint endpoint = model.endpointsById().get(endpointId);
            circle.setFill(isPending ? ENDPOINT_PENDING_FILL : endpointFill(endpoint));
            circle.setStroke(isParty
                    ? PARTY_STROKE
                    : isSelected
                    ? ENDPOINT_SELECTED_STROKE
                    : endpoint != null && endpoint.defaultEntry()
                    ? DEFAULT_ENTRY_STROKE
                    : ENDPOINT_STROKE);
            circle.setStrokeWidth(isParty || isSelected
                    ? Math.max(2.0, 3.0 * viewport.strokeScale())
                    : Math.max(1.0, viewport.strokeScale()));
            EndpointRadii radii = endpointRadii(endpoint, isParty);
            circle.setRadius(radii.visualRadius());
            endpointNode.hitTarget().setRadius(radii.hitRadius());
        }
    }

    void refreshLinkStyles() {
        for (Map.Entry<Long, Line> entry : linkNodes.entrySet()) {
            DungeonSelection selection = model.selection();
            boolean isSelected = selection != null
                    && selection.type() == DungeonSelection.SelectionType.LINK
                    && entry.getKey().equals(selection.id());
            Line line = entry.getValue();
            line.setStroke(isSelected ? LINK_SELECTED_STROKE : LINK_STROKE);
            line.setStrokeWidth(isSelected ? Math.max(3.0, 5.0 * viewport.strokeScale()) : Math.max(2.0, 3.0 * viewport.strokeScale()));
        }
    }

    private EndpointNode buildEndpointNode(DungeonEndpoint endpoint) {
        Circle visual = new Circle();
        visual.setMouseTransparent(true);
        Circle hitTarget = new Circle();
        hitTarget.setFill(Color.TRANSPARENT);
        hitTarget.setStroke(Color.TRANSPARENT);
        hitTarget.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && onEndpointClicked != null) {
                onEndpointClicked.accept(endpoint);
            }
            event.consume();
        });
        return new EndpointNode(visual, hitTarget);
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

    private Line buildLinkNode(DungeonLink link) {
        Point from = resolveAnchorPoint(link.fromAnchor());
        Point to = resolveAnchorPoint(link.toAnchor());
        if (from == null || to == null) {
            return null;
        }
        Line line = new Line();
        line.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && onLinkClicked != null) {
                onLinkClicked.accept(link);
            }
        });
        return line;
    }

    private void positionEndpoint(Region owner, Long endpointId, DungeonEndpoint endpoint) {
        EndpointNode endpointNode = endpointNodes.get(endpointId);
        if (endpointNode == null) {
            return;
        }
        Circle circle = endpointNode.visual();
        Circle hitTarget = endpointNode.hitTarget();
        double cx = viewport.screenCenterX(endpoint.x());
        double cy = viewport.screenCenterY(endpoint.y());
        EndpointRadii radii = endpointRadii(endpoint, endpointId.equals(model.partyEndpointId()));
        circle.setCenterX(cx);
        circle.setCenterY(cy);
        circle.setRadius(radii.visualRadius());
        hitTarget.setCenterX(cx);
        hitTarget.setCenterY(cy);
        hitTarget.setRadius(radii.hitRadius());
        boolean visible = viewport.isVisible(owner, cx, cy, radii.hitRadius());
        circle.setVisible(showEndpoints && visible);
        circle.setManaged(showEndpoints && visible);
        hitTarget.setVisible(showEndpoints && visible);
        hitTarget.setManaged(showEndpoints && visible);
    }

    private EndpointRadii endpointRadii(DungeonEndpoint endpoint, boolean isParty) {
        double visualRadius = isParty || endpoint != null && endpoint.defaultEntry()
                ? Math.max(4.0, 7.0 * viewport.strokeScale())
                : Math.max(3.0, 5.0 * viewport.strokeScale());
        return new EndpointRadii(visualRadius, Math.max(ENDPOINT_HIT_RADIUS, visualRadius));
    }

    private void positionLink(Region owner, Long linkId, DungeonLink link) {
        Line line = linkNodes.get(linkId);
        if (line == null) {
            return;
        }
        Point from = resolveAnchorPoint(link.fromAnchor());
        Point to = resolveAnchorPoint(link.toAnchor());
        if (from == null || to == null) {
            line.setVisible(false);
            line.setManaged(false);
            return;
        }
        double x1 = from.x();
        double y1 = from.y();
        double x2 = to.x();
        double y2 = to.y();
        line.setStartX(x1);
        line.setStartY(y1);
        line.setEndX(x2);
        line.setEndY(y2);
        boolean visible = viewport.isVisible(owner, x1, y1, 2.0)
                || viewport.isVisible(owner, x2, y2, 2.0)
                || viewport.lineIntersectsViewport(owner, x1, y1, x2, y2);
        line.setVisible(showLinks && visible);
        line.setManaged(showLinks && visible);
    }

    private void updateVisibility() {
        roomLabelsLayer.setVisible(true);
        roomLabelsLayer.setManaged(true);
        featuresLayer.setVisible(showFeatures);
        featuresLayer.setManaged(showFeatures);
        linksLayer.setVisible(showLinks);
        linksLayer.setManaged(showLinks);
        endpointsLayer.setVisible(showEndpoints);
        endpointsLayer.setManaged(showEndpoints);
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
        List<Map.Entry<Long, java.util.List<DungeonFeatureTile>>> entries = new ArrayList<>(model.featureTilesByFeatureId().entrySet());
        entries.sort(Comparator.comparingLong(Map.Entry::getKey));
        int labelIndex = 0;
        for (Map.Entry<Long, java.util.List<DungeonFeatureTile>> entry : entries) {
            java.util.List<DungeonFeatureTile> tiles = entry.getValue();
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

    private boolean isSelectedFeatureTile(java.util.List<DungeonFeatureTile> tiles) {
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
        // Shared tiles stay visibly shared: keep every participating feature color in the hatch
        // instead of collapsing the tile to a single "primary" feature.
        List<Stop> stops = new ArrayList<>();
        double bandSize = 1.0 / colors.size();
        for (int i = 0; i < colors.size(); i++) {
            double start = i * bandSize;
            double end = Math.min(1.0, start + bandSize);
            Color color = colors.get(i);
            stops.add(new Stop(start, color));
            stops.add(new Stop(Math.max(start, end - 0.001), color));
        }
        return new LinearGradient(
                0,
                0,
                10,
                10,
                false,
                CycleMethod.REPEAT,
                stops);
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
        java.util.LinkedHashSet<Long> featureIds = new java.util.LinkedHashSet<>();
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

    private Color endpointFill(DungeonEndpoint endpoint) {
        if (endpoint == null || endpoint.role() == null) {
            return BOTH_FILL;
        }
        return switch (endpoint.role()) {
            case ENTRY -> ENTRY_FILL;
            case EXIT -> EXIT_FILL;
            case BOTH -> BOTH_FILL;
        };
    }

    private boolean isPendingEndpoint(Long endpointId) {
        DungeonLinkAnchor pendingAnchor = model.pendingLinkStart();
        return pendingAnchor != null
                && pendingAnchor.type() == DungeonLinkAnchorType.ENDPOINT
                && endpointId != null
                && endpointId == pendingAnchor.anchorId();
    }

    private Point resolveAnchorPoint(DungeonLinkAnchor anchor) {
        if (anchor == null) {
            return null;
        }
        return switch (anchor.type()) {
            case ENDPOINT -> {
                DungeonEndpoint endpoint = model.endpointsById().get(anchor.anchorId());
                if (endpoint == null) {
                    yield null;
                }
                yield new Point(viewport.screenCenterX(endpoint.x()), viewport.screenCenterY(endpoint.y()));
            }
            case PASSAGE -> {
                DungeonPassage passage = model.passagesById().get(anchor.anchorId());
                if (passage == null) {
                    yield null;
                }
                yield switch (passage.direction()) {
                    case EAST -> new Point(viewport.screenX(passage.x() + 1), viewport.screenCenterY(passage.y()));
                    case SOUTH -> new Point(viewport.screenCenterX(passage.x()), viewport.screenY(passage.y() + 1));
                };
            }
        };
    }

    private record Point(double x, double y) {
    }

    private record EndpointRadii(double visualRadius, double hitRadius) {
    }

    private record EndpointNode(Circle visual, Circle hitTarget) {
    }
}

package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonSelection;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.shape.Circle;
import javafx.scene.shape.Line;
import javafx.scene.paint.Color;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

final class DungeonOverlayRenderer {

    private static final Color LINK_STROKE = Color.web("#c8a86a");
    private static final Color LINK_SELECTED_STROKE = Color.web("#41a9f2");
    private static final Color ENDPOINT_FILL = Color.web("#e8b870");
    private static final Color ENDPOINT_PENDING_FILL = Color.web("#f4d35e");
    private static final Color ENDPOINT_STROKE = Color.web("#2b2012");
    private static final Color ENDPOINT_SELECTED_STROKE = Color.web("#f0a040");
    private static final Color PARTY_STROKE = Color.web("#41a9f2");

    private final Pane linksLayer;
    private final Pane endpointsLayer;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private final Map<Long, Circle> endpointNodes = new HashMap<>();
    private final Map<Long, Line> linkNodes = new HashMap<>();

    private Consumer<DungeonEndpoint> onEndpointClicked;
    private Consumer<DungeonLink> onLinkClicked;
    private boolean showLinks = true;
    private boolean showEndpoints = true;

    DungeonOverlayRenderer(Pane linksLayer, Pane endpointsLayer, DungeonCanvasModel model, DungeonViewport viewport) {
        this.linksLayer = linksLayer;
        this.endpointsLayer = endpointsLayer;
        this.model = model;
        this.viewport = viewport;
        this.linksLayer.setPickOnBounds(false);
        this.endpointsLayer.setPickOnBounds(false);
    }

    void rebuildNodes() {
        endpointNodes.clear();
        linkNodes.clear();
        linksLayer.getChildren().clear();
        endpointsLayer.getChildren().clear();

        for (DungeonEndpoint endpoint : model.endpointsById().values()) {
            Circle circle = buildEndpointNode(endpoint);
            endpointNodes.put(endpoint.endpointId(), circle);
            endpointsLayer.getChildren().add(circle);
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
        for (Map.Entry<Long, DungeonEndpoint> entry : model.endpointsById().entrySet()) {
            positionEndpoint(owner, entry.getKey(), entry.getValue());
        }
        for (Map.Entry<Long, DungeonLink> entry : model.linksById().entrySet()) {
            positionLink(owner, entry.getKey(), entry.getValue());
        }
        refreshEndpointStyles();
        refreshLinkStyles();
    }

    void setOnEndpointClicked(Consumer<DungeonEndpoint> onEndpointClicked) {
        this.onEndpointClicked = onEndpointClicked;
    }

    void setOnLinkClicked(Consumer<DungeonLink> onLinkClicked) {
        this.onLinkClicked = onLinkClicked;
    }

    void setShowLinks(boolean showLinks) {
        this.showLinks = showLinks;
        updateVisibility();
    }

    void setShowEndpoints(boolean showEndpoints) {
        this.showEndpoints = showEndpoints;
        updateVisibility();
    }

    void refreshEndpointStyles() {
        for (Map.Entry<Long, Circle> entry : endpointNodes.entrySet()) {
            Long endpointId = entry.getKey();
            Circle circle = entry.getValue();
            DungeonSelection selection = model.selection();
            boolean isSelected = selection != null
                    && selection.type() == DungeonSelection.SelectionType.ENDPOINT
                    && endpointId.equals(selection.id());
            boolean isParty = endpointId.equals(model.partyEndpointId());
            boolean isPending = endpointId.equals(model.pendingLinkStartId());
            circle.setFill(isPending ? ENDPOINT_PENDING_FILL : ENDPOINT_FILL);
            circle.setStroke(isParty ? PARTY_STROKE : isSelected ? ENDPOINT_SELECTED_STROKE : ENDPOINT_STROKE);
            circle.setStrokeWidth(isParty || isSelected
                    ? Math.max(2.0, 3.0 * viewport.strokeScale())
                    : Math.max(1.0, viewport.strokeScale()));
            circle.setRadius(isParty ? Math.max(4.0, 7.0 * viewport.strokeScale()) : Math.max(3.0, 5.0 * viewport.strokeScale()));
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

    private Circle buildEndpointNode(DungeonEndpoint endpoint) {
        Circle circle = new Circle();
        circle.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && onEndpointClicked != null) {
                onEndpointClicked.accept(endpoint);
            }
            event.consume();
        });
        return circle;
    }

    private Line buildLinkNode(DungeonLink link) {
        DungeonEndpoint from = model.endpointsById().get(link.fromEndpointId());
        DungeonEndpoint to = model.endpointsById().get(link.toEndpointId());
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
        Circle circle = endpointNodes.get(endpointId);
        if (circle == null) {
            return;
        }
        double cx = viewport.screenCenterX(endpoint.x());
        double cy = viewport.screenCenterY(endpoint.y());
        double radius = Math.max(3.0, 5.0 * viewport.strokeScale());
        circle.setCenterX(cx);
        circle.setCenterY(cy);
        circle.setRadius(radius);
        boolean visible = viewport.isVisible(owner, cx, cy, radius);
        circle.setVisible(showEndpoints && visible);
        circle.setManaged(showEndpoints && visible);
    }

    private void positionLink(Region owner, Long linkId, DungeonLink link) {
        Line line = linkNodes.get(linkId);
        if (line == null) {
            return;
        }
        DungeonEndpoint from = model.endpointsById().get(link.fromEndpointId());
        DungeonEndpoint to = model.endpointsById().get(link.toEndpointId());
        if (from == null || to == null) {
            line.setVisible(false);
            line.setManaged(false);
            return;
        }
        double x1 = viewport.screenCenterX(from.x());
        double y1 = viewport.screenCenterY(from.y());
        double x2 = viewport.screenCenterX(to.x());
        double y2 = viewport.screenCenterY(to.y());
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
        linksLayer.setVisible(showLinks);
        linksLayer.setManaged(showLinks);
        endpointsLayer.setVisible(showEndpoints);
        endpointsLayer.setManaged(showEndpoints);
    }
}

package src.view.mapcanvas.View;
import javafx.geometry.Insets;
import javafx.scene.canvas.Canvas;
import javafx.scene.control.Label;
import javafx.scene.Node;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.Pane;
import javafx.scene.layout.StackPane;
import org.jspecify.annotations.Nullable;
import src.view.mapcanvas.api.MapCanvasCell;
import src.view.mapcanvas.api.MapCanvasLayer;
import src.view.mapcanvas.api.MapCanvasViewport;
import src.view.mapcanvas.api.MapCanvasRenderModel;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.IntConsumer;
import java.util.function.Consumer;
/**
 * Reusable workspace for map editor and travel screens.
 */
public final class MapWorkspaceView extends BorderPane {
    private final Label titleLabel = new Label();
    private final Label subtitleLabel = new Label();
    private final Label modeBadge = new Label();
    private final Label statusLabel = new Label();
    private final Label summaryLabel = new Label();
    private final StackPane contentHost = new StackPane();
    private final Map<MapCanvasLayer, Pane> layerHosts = new EnumMap<>(MapCanvasLayer.class);
    private final MapCameraController cameraController = new MapCameraController();
    private final MapPointerController pointerController = new MapPointerController();
    private final MapTopologyRenderer squareRenderer = new SquareMapTopologyRenderer();
    private final Canvas renderSurface = squareRenderer.createCanvas();
    private Consumer<MapCanvasViewport> viewportListener = ignored -> {
    };
    private IntConsumer floorStepListener = ignored -> {
    };
    private @Nullable MapCanvasRenderModel renderModel;
    private MapWorkspaceSelectionSupport.@Nullable SelectionKey selectedTarget;
    public MapWorkspaceView() {
        getStyleClass().add("surface-root");
        setPadding(new Insets(8));
        MapWorkspaceChrome.configureLabels(titleLabel, subtitleLabel, modeBadge, statusLabel, summaryLabel);
        MapWorkspaceChrome.configureContentHost(contentHost);
        contentHost.getChildren().setAll(layeredContent());
        setTop(MapWorkspaceChrome.buildHeader(
                new MapWorkspaceHeaderLabels(titleLabel, subtitleLabel, modeBadge, statusLabel),
                cameraController,
                new MapWorkspaceCanvasMetrics() {
                    @Override
                    public double width() {
                        return MapWorkspaceViewportSupport.width(contentHost);
                    }
                    @Override
                    public double height() {
                        return MapWorkspaceViewportSupport.height(contentHost);
                    }
                },
                this::afterViewportChanged
        ));
        setCenter(contentHost);
        setBottom(summaryLabel);
        setMargin(summaryLabel, new Insets(8, 0, 0, 0));
        new MapWorkspaceInteractionHandler(
                contentHost,
                cameraController,
                new MapWorkspaceInteractionCallbacks() {
                    @Override
                    public void onPrimaryClick(double canvasX, double canvasY) {
                        MapCanvasCell hit = MapWorkspaceSelectionSupport.findCellAtCanvasPosition(
                                renderModel,
                                currentViewport(),
                                canvasX,
                                canvasY,
                                cameraController.pixelsPerTile());
                        if (hit != null && hit.interactive()) {
                            pointerController.notifyCellSelected(MapWorkspaceSelectionSupport.highlightedCell(hit, selectedTarget));
                        }
                    }
                    @Override
                    public void onViewportChanged() {
                        afterViewportChanged();
                    }
                    @Override
                    public void onViewportGeometryChanged() {
                        redraw();
                    }
                    @Override
                    public void onFloorStep(int delta) {
                        floorStepListener.accept(delta);
                    }
                    @Override
                    public boolean mapLoaded() {
                        return renderModel != null && renderModel.mapLoaded();
                    }
                    @Override
                    public MapWorkspaceCanvasMetrics canvasMetrics() {
                        return new MapWorkspaceCanvasMetrics() {
                            @Override
                            public double width() {
                                return MapWorkspaceViewportSupport.width(contentHost);
                            }
                            @Override
                            public double height() {
                                return MapWorkspaceViewportSupport.height(contentHost);
                            }
                        };
                    }
                }
        );
    }
    public void setCellSelectionListener(Consumer<MapCanvasCell> listener) {
        pointerController.setCellSelectionListener(listener);
    }
    public void setViewportListener(Consumer<MapCanvasViewport> listener) {
        this.viewportListener = listener == null ? ignored -> {
        } : listener;
    }
    public void setFloorStepListener(IntConsumer listener) {
        this.floorStepListener = listener == null ? ignored -> {
        } : listener;
    }
    public MapCanvasViewport currentViewport() {
        return MapWorkspaceViewportSupport.currentViewport(cameraController, contentHost);
    }
    public void show(MapCanvasRenderModel nextRenderModel) {
        this.renderModel = Objects.requireNonNull(nextRenderModel, "nextRenderModel");
        redraw();
    }
    public void setLayerContent(MapCanvasLayer layer, Collection<? extends Node> nodes) {
        Pane host = layerHosts.get(Objects.requireNonNull(layer, "layer"));
        if (host == null) {
            return;
        }
        host.getChildren().setAll(nodes == null ? List.of() : nodes);
    }
    public void setSelectedTarget(@Nullable String ownerKind, long ownerId, @Nullable String partKind) {
        if (ownerKind == null || ownerKind.isBlank()) {
            selectedTarget = null;
        } else {
            selectedTarget = new MapWorkspaceSelectionSupport.SelectionKey(ownerKind, ownerId, partKind == null ? "" : partKind);
        }
        redraw();
    }
    public void resetView() {
        cameraController.reset();
        afterViewportChanged();
    }
    private void redraw() {
        if (renderModel == null) {
            return;
        }
        MapCanvasViewport viewport = currentViewport();
        titleLabel.setText(renderModel.title());
        subtitleLabel.setText(renderModel.subtitle() + "  Zoom " + String.format("%.1f", cameraController.zoom()) + "x");
        modeBadge.setText(renderModel.modeLabel());
        statusLabel.setText(renderModel.statusLabel());
        summaryLabel.setText(renderModel.summaryLabel());
        squareRenderer.render(renderSurface, renderModel, viewport);
    }
    private void afterViewportChanged() {
        MapWorkspaceViewportSupport.notifyViewportChanged(renderModel, viewportListener, currentViewport());
        redraw();
    }
    private List<javafx.scene.Node> layeredContent() {
        for (MapCanvasLayer layer : MapCanvasLayer.values()) {
            Pane host = new Pane();
            host.setMouseTransparent(true);
            host.prefWidthProperty().bind(contentHost.widthProperty());
            host.prefHeightProperty().bind(contentHost.heightProperty());
            layerHosts.put(layer, host);
        }
        return List.of(
                layerHosts.get(MapCanvasLayer.BELOW_GRID),
                renderSurface,
                layerHosts.get(MapCanvasLayer.BELOW_CONTENT),
                layerHosts.get(MapCanvasLayer.ABOVE_CONTENT),
                layerHosts.get(MapCanvasLayer.SELECTION_OVERLAY),
                layerHosts.get(MapCanvasLayer.ACTOR_OVERLAY),
                layerHosts.get(MapCanvasLayer.TOOL_OVERLAY),
                layerHosts.get(MapCanvasLayer.HUD_OVERLAY));
    }
}

package src.view.mapshared.View;
import javafx.geometry.Insets;
import javafx.scene.canvas.Canvas;
import javafx.scene.control.Label;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.StackPane;
import org.jspecify.annotations.Nullable;
import src.view.mapshared.ViewModel.MapCellViewModel;
import src.view.mapshared.ViewModel.MapViewport;
import src.view.mapshared.ViewModel.MapWorkspaceRenderModel;
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
    private final MapCameraController cameraController = new MapCameraController();
    private final MapPointerController pointerController = new MapPointerController();
    private final MapTopologyRenderer squareRenderer = new SquareMapTopologyRenderer();
    private final Canvas renderSurface = squareRenderer.createCanvas();
    private Consumer<MapViewport> viewportListener = ignored -> {
    };
    private IntConsumer floorStepListener = ignored -> {
    };
    private @Nullable MapWorkspaceRenderModel renderModel;
    private MapWorkspaceSelectionSupport.@Nullable SelectionKey selectedTarget;
    public MapWorkspaceView() {
        getStyleClass().add("surface-root");
        setPadding(new Insets(8));
        MapWorkspaceChrome.configureLabels(titleLabel, subtitleLabel, modeBadge, statusLabel, summaryLabel);
        MapWorkspaceChrome.configureContentHost(contentHost);
        contentHost.getChildren().setAll(renderSurface);
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
                        MapCellViewModel hit = MapWorkspaceSelectionSupport.findCellAtCanvasPosition(
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
    public void setCellSelectionListener(Consumer<MapCellViewModel> listener) {
        pointerController.setCellSelectionListener(listener);
    }
    public void setViewportListener(Consumer<MapViewport> listener) {
        this.viewportListener = listener == null ? ignored -> {
        } : listener;
    }
    public void setFloorStepListener(IntConsumer listener) {
        this.floorStepListener = listener == null ? ignored -> {
        } : listener;
    }
    public MapViewport currentViewport() {
        return MapWorkspaceViewportSupport.currentViewport(cameraController, contentHost);
    }
    public void show(MapWorkspaceRenderModel nextRenderModel) {
        this.renderModel = Objects.requireNonNull(nextRenderModel, "nextRenderModel");
        redraw();
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
        MapViewport viewport = currentViewport();
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
}

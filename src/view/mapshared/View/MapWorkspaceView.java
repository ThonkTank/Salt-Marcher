package src.view.mapshared.View;

import javafx.geometry.Insets;
import javafx.scene.canvas.Canvas;
import javafx.scene.control.Label;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.StackPane;
import org.jspecify.annotations.Nullable;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.mapshared.Controller.MapCameraController;
import src.view.mapshared.Controller.MapPointerController;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapViewport;
import src.view.mapshared.Model.MapWorkspaceRenderModel;

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
    private @Nullable SelectionKey selectedTarget;

    public MapWorkspaceView() {
        getStyleClass().addAll("scene-pane", "map-workspace");
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
                        return contentHost.getWidth() > 1.0 ? contentHost.getWidth() : 960.0;
                    }

                    @Override
                    public double height() {
                        return contentHost.getHeight() > 1.0 ? contentHost.getHeight() : 640.0;
                    }
                },
                this::afterViewportChanged
        ));
        setCenter(contentHost);
        setBottom(summaryLabel);
        BorderPane.setMargin(summaryLabel, new Insets(8, 0, 0, 0));
        new MapWorkspaceInteractionHandler(
                contentHost,
                cameraController,
                new MapWorkspaceInteractionCallbacks() {
                    @Override
                    public void onPrimaryClick(double canvasX, double canvasY) {
                        MapCellViewModel hit = findCellAtCanvasPosition(canvasX, canvasY);
                        if (hit != null && hit.interactive()) {
                            pointerController.notifyCellSelected(highlightedCell(hit));
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
                                return contentHost.getWidth() > 1.0 ? contentHost.getWidth() : 960.0;
                            }

                            @Override
                            public double height() {
                                return contentHost.getHeight() > 1.0 ? contentHost.getHeight() : 640.0;
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
        return cameraController.currentViewport(
                contentHost.getWidth() > 1.0 ? contentHost.getWidth() : 960.0,
                contentHost.getHeight() > 1.0 ? contentHost.getHeight() : 640.0
        );
    }

    public void show(MapWorkspaceRenderModel nextRenderModel) {
        this.renderModel = Objects.requireNonNull(nextRenderModel, "nextRenderModel");
        redraw();
    }

    public void setSelectedTarget(@Nullable MapSelectionRef selectionRef) {
        selectedTarget = selectionRef == null ? null : new SelectionKey(
                selectionRef.ownerKind(),
                selectionRef.ownerId(),
                selectionRef.partKind()
        );
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

    private @Nullable MapCellViewModel findCellAtCanvasPosition(double canvasX, double canvasY) {
        if (renderModel == null || !renderModel.mapLoaded()) {
            return null;
        }
        double scale = cameraController.pixelsPerTile();
        MapViewport viewport = currentViewport();
        int q = (int) Math.floor(screenToWorldX(canvasX, viewport, scale));
        int r = (int) Math.floor(screenToWorldY(canvasY, viewport, scale));
        for (MapCellViewModel source : renderModel.scene().cells()) {
            if (source.q() == q && source.r() == r) {
                return source;
            }
        }
        return null;
    }

    private MapCellViewModel highlightedCell(MapCellViewModel source) {
        boolean selected = selectedTarget != null
                && selectedTarget.matches(source.ownerKind(), source.ownerId(), source.partKind());
        if (!selected && !source.current()) {
            return source;
        }
        return new MapCellViewModel(
                source.q(),
                source.r(),
                source.label(),
                source.room(),
                source.corridor(),
                source.blocked(),
                source.interactive(),
                true,
                source.ownerKind(),
                source.ownerId(),
                source.partKind()
        );
    }

    private double worldToScreenX(int q, MapViewport viewport, double scale) {
        return (q - viewport.centerX()) * scale + viewport.canvasWidth() / 2.0;
    }

    private double worldToScreenY(int r, MapViewport viewport, double scale) {
        return (r - viewport.centerY()) * scale + viewport.canvasHeight() / 2.0;
    }

    private double screenToWorldX(double canvasX, MapViewport viewport, double scale) {
        return viewport.centerX() + (canvasX - viewport.canvasWidth() / 2.0) / scale;
    }

    private double screenToWorldY(double canvasY, MapViewport viewport, double scale) {
        return viewport.centerY() + (canvasY - viewport.canvasHeight() / 2.0) / scale;
    }

    private void afterViewportChanged() {
        notifyViewportChanged();
        redraw();
    }

    private void notifyViewportChanged() {
        if (renderModel != null && renderModel.mapLoaded()) {
            viewportListener.accept(currentViewport());
        }
    }

    private record SelectionKey(String ownerKind, long ownerId, String partKind) {

        private boolean matches(String otherKind, long otherId, String otherPartKind) {
            return ownerId == otherId
                    && Objects.equals(ownerKind, otherKind)
                    && Objects.equals(partKind, otherPartKind);
        }
    }
}

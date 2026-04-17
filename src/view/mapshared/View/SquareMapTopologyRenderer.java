package src.view.mapshared.View;

import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Line;
import org.jspecify.annotations.Nullable;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapEdgeViewModel;
import src.view.mapshared.Model.MapWorkspaceRenderModel;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Square-grid renderer used by the initial dungeon skeleton.
 */
public final class SquareMapTopologyRenderer implements MapTopologyRenderer {

    private final SquareMapLayoutMetrics layout = new SquareMapLayoutMetrics(58.0, 10.0, 28.0);
    private final SquareMapCellFactory cellFactory = new SquareMapCellFactory(layout);

    @Override
    public Node render(MapWorkspaceRenderModel renderModel, Consumer<MapCellViewModel> onCellSelected) {
        Pane scene = new Pane();
        scene.getStyleClass().add("dungeon-map-scene");
        double width = layout.totalWidth(renderModel.width());
        double height = layout.totalHeight(renderModel.height());
        scene.setMinSize(width, height);
        scene.setPrefSize(width, height);
        scene.setMaxSize(Region.USE_PREF_SIZE, Region.USE_PREF_SIZE);

        Map<String, MapCellViewModel> cellsByKey = new LinkedHashMap<>();
        for (MapCellViewModel cell : renderModel.cells()) {
            cellsByKey.put(layout.key(cell.q(), cell.r()), cell);
        }

        paintGrid(scene, renderModel.width(), renderModel.height());
        paintEdges(scene, renderModel.edges());

        for (int r = 0; r < renderModel.height(); r++) {
            for (int q = 0; q < renderModel.width(); q++) {
                @Nullable MapCellViewModel snapshot = cellsByKey.get(layout.key(q, r));
                scene.getChildren().add(cellFactory.create(snapshot, q, r, onCellSelected));
            }
        }
        return scene;
    }

    private void paintGrid(Pane scene, int width, int height) {
        for (int column = 0; column <= width; column++) {
            double x = layout.padding() + column * (layout.cellSize() + layout.gap()) - layout.gap() / 2.0;
            Line line = new Line(x, layout.padding() - layout.gap() / 2.0, x, scene.getPrefHeight() - layout.padding() + layout.gap() / 2.0);
            line.getStyleClass().add("dungeon-map-grid-line");
            scene.getChildren().add(line);
        }
        for (int row = 0; row <= height; row++) {
            double y = layout.padding() + row * (layout.cellSize() + layout.gap()) - layout.gap() / 2.0;
            Line line = new Line(layout.padding() - layout.gap() / 2.0, y, scene.getPrefWidth() - layout.padding() + layout.gap() / 2.0, y);
            line.getStyleClass().add("dungeon-map-grid-line");
            scene.getChildren().add(line);
        }
    }

    private void paintEdges(Pane scene, Iterable<MapEdgeViewModel> edges) {
        for (MapEdgeViewModel edge : edges) {
            Line line = new Line(
                    layout.centerX(edge.fromQ()),
                    layout.centerY(edge.fromR()),
                    layout.centerX(edge.toQ()),
                    layout.centerY(edge.toR()));
            line.getStyleClass().add("door".equals(edge.kind()) ? "dungeon-map-door" : "dungeon-map-wall");
            scene.getChildren().add(line);

            if (!edge.label().isBlank()) {
                Label marker = new Label("door".equals(edge.kind()) ? "D" : "");
                marker.getStyleClass().add("door".equals(edge.kind()) ? "dungeon-map-door-marker" : "dungeon-map-wall-marker");
                marker.relocate((layout.centerX(edge.fromQ()) + layout.centerX(edge.toQ())) / 2.0 - 11.0,
                        (layout.centerY(edge.fromR()) + layout.centerY(edge.toR())) / 2.0 - 11.0);
                scene.getChildren().add(marker);
            }
        }
    }
}

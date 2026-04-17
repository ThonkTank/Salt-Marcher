package src.view.mapshared.interactor;

import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.domain.mapcore.api.MapCellRef;
import src.domain.mapcore.api.MapCellSnapshot;
import src.domain.mapcore.api.MapEdgeSnapshot;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapEdgeViewModel;

/**
 * Shared view-layer helpers for dungeon workspace projection and sidebar cards.
 */
public final class MapWorkspaceSupport {

    private MapWorkspaceSupport() {
    }

    public static MapCellViewModel toViewCell(MapCellSnapshot cell, @Nullable MapCellRef activeCell) {
        boolean current = activeCell != null && activeCell.equals(cell.ref());
        return new MapCellViewModel(
                cell.ref().q(),
                cell.ref().r(),
                cell.label(),
                cell.style().room(),
                cell.style().corridor(),
                cell.style().blocked(),
                cell.style().interactive(),
                current || cell.style().current(),
                cell.selectionRef() == null ? "" : cell.selectionRef().ownerKind(),
                cell.selectionRef() == null ? -1L : cell.selectionRef().ownerId(),
                cell.selectionRef() == null ? "" : cell.selectionRef().partKind()
        );
    }

    public static MapEdgeViewModel toViewEdge(MapEdgeSnapshot edge) {
        return new MapEdgeViewModel(
                edge.ref().from().q(),
                edge.ref().from().r(),
                edge.ref().to().q(),
                edge.ref().to().r(),
                edge.kind(),
                edge.label(),
                edge.selectionRef() != null,
                edge.selectionRef() == null ? "" : edge.selectionRef().ownerKind(),
                edge.selectionRef() == null ? -1L : edge.selectionRef().ownerId(),
                edge.selectionRef() == null ? "" : edge.selectionRef().partKind()
        );
    }

    public static VBox card(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }

    public static Label muted(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        return label;
    }
}

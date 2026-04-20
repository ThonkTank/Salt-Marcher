package src.view.tabs.dungeontravel;

import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.view.views.DungeonMapDisplayModel;

public final class DungeonTravelViewModel {

    private final DungeonApplicationService dungeon;
    private final ReadOnlyObjectWrapper<DungeonMapDisplayModel> displayModel =
            new ReadOnlyObjectWrapper<>(travelPlaceholder());
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");

    public DungeonTravelViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
    }

    public ReadOnlyObjectProperty<DungeonMapDisplayModel> displayModelProperty() {
        return displayModel.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public void refresh() {
        displayModel.set(toDisplayModel(dungeon.loadSnapshot()));
        state.set("Travel projection refreshed.");
    }

    private static DungeonMapDisplayModel toDisplayModel(DungeonSnapshot snapshot) {
        if (snapshot == null) {
            return travelPlaceholder();
        }
        DungeonMapSnapshot map = snapshot.map();
        var cells = map.areas().stream()
                .flatMap(area -> area.cells().stream().map(cell -> renderCell(area, cell)))
                .toList();
        var edges = map.boundaries().stream()
                .filter(boundary -> boundary.edge() != null
                        && boundary.edge().from() != null
                        && boundary.edge().to() != null)
                .map(DungeonTravelViewModel::renderEdge)
                .toList();
        return new DungeonMapDisplayModel(
                snapshot.mapName(),
                map.width() + " x " + map.height() + " squares",
                snapshot.mode().name(),
                "Revision " + snapshot.revision(),
                cells.size() + " cells, " + edges.size() + " edges",
                !cells.isEmpty(),
                cells.isEmpty() ? "No dungeon map geometry available." : "",
                topology(map.topology()),
                cells,
                edges);
    }

    private static DungeonMapDisplayModel.RenderCell renderCell(DungeonAreaSnapshot area, DungeonCellRef cell) {
        boolean room = area.kind() == DungeonAreaKind.ROOM;
        boolean corridor = area.kind() == DungeonAreaKind.CORRIDOR;
        return new DungeonMapDisplayModel.RenderCell(
                cell.q(),
                cell.r(),
                area.label(),
                room,
                corridor,
                false,
                true,
                false,
                room ? "room" : "corridor",
                area.id(),
                "area");
    }

    private static DungeonMapDisplayModel.RenderEdge renderEdge(DungeonBoundarySnapshot boundary) {
        DungeonEdgeRef edge = boundary.edge();
        return new DungeonMapDisplayModel.RenderEdge(
                edge.from().q(),
                edge.from().r(),
                edge.to().q(),
                edge.to().r(),
                boundary.kind(),
                boundary.label(),
                "door".equalsIgnoreCase(boundary.kind()),
                boundary.kind(),
                boundary.id(),
                "boundary");
    }

    private static DungeonMapDisplayModel.RenderTopology topology(DungeonTopologyKind topology) {
        return topology == DungeonTopologyKind.HEX
                ? DungeonMapDisplayModel.RenderTopology.HEX
                : DungeonMapDisplayModel.RenderTopology.SQUARE;
    }

    private static DungeonMapDisplayModel travelPlaceholder() {
        return new DungeonMapDisplayModel(
                "Travel workspace",
                "",
                "",
                "",
                "",
                false,
                "No dungeon map loaded.",
                DungeonMapDisplayModel.RenderTopology.SQUARE,
                java.util.List.of(),
                java.util.List.of());
    }
}

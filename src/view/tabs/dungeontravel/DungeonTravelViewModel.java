package src.view.tabs.dungeontravel;

import java.util.List;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.mapcore.api.MapCellRef;
import src.domain.mapcore.api.MapCellSnapshot;
import src.domain.mapcore.api.MapCellStyle;
import src.domain.mapcore.api.MapEdgeRef;
import src.domain.mapcore.api.MapEdgeSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.domain.mapcore.api.MapSurfaceSnapshot;
import src.domain.mapcore.api.MapTopologyKind;

public final class DungeonTravelViewModel {

    private final DungeonApplicationService dungeon;
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<MapPresentation> mapPresentation =
            new ReadOnlyObjectWrapper<>(MapPresentation.empty("Travel workspace"));

    public DungeonTravelViewModel(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
    }

    public ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<MapPresentation> mapPresentationProperty() {
        return mapPresentation.getReadOnlyProperty();
    }

    public void refresh() {
        DungeonSnapshot snapshot = dungeon.loadSnapshot();
        mapPresentation.set(toPresentation(snapshot));
        status.set(statusText(snapshot));
        state.set("Travel projection refreshed.");
    }

    private MapPresentation toPresentation(DungeonSnapshot snapshot) {
        MapSurfaceSnapshot surface = snapshot.surface();
        List<CellPresentation> cells = surface.allCells().stream()
                .map(this::toCellPresentation)
                .toList();
        List<EdgePresentation> edges = surface.edges().stream()
                .filter(this::hasCompleteEdgeRef)
                .map(this::toEdgePresentation)
                .toList();
        boolean mapLoaded = !cells.isEmpty();
        String overlayMessage = mapLoaded ? "" : "No dungeon map geometry available.";
        return new MapPresentation(
                snapshot.mapName(),
                surface.width() + " x " + surface.height() + " squares",
                snapshot.mode().name(),
                statusText(snapshot),
                cells.size() + " cells, " + edges.size() + " edges",
                mapLoaded,
                overlayMessage,
                TopologyPresentation.from(surface.topology()),
                cells,
                edges);
    }

    private CellPresentation toCellPresentation(MapCellSnapshot cell) {
        MapCellRef ref = cell.ref();
        MapCellStyle style = cell.style() == null
                ? new MapCellStyle(false, false, false, false, false)
                : cell.style();
        MapSelectionRef selection = cell.selectionRef();
        return new CellPresentation(
                ref.q(),
                ref.r(),
                cell.label(),
                style.room(),
                style.corridor(),
                style.blocked(),
                style.interactive(),
                style.current(),
                selection == null ? "" : selection.ownerKind(),
                selection == null ? 0L : selection.ownerId(),
                selection == null ? "" : selection.partKind());
    }

    private EdgePresentation toEdgePresentation(MapEdgeSnapshot edge) {
        MapEdgeRef ref = edge.ref();
        MapSelectionRef selection = edge.selectionRef();
        return new EdgePresentation(
                ref.from().q(),
                ref.from().r(),
                ref.to().q(),
                ref.to().r(),
                edge.kind(),
                edge.label(),
                selection != null,
                selection == null ? "" : selection.ownerKind(),
                selection == null ? 0L : selection.ownerId(),
                selection == null ? "" : selection.partKind());
    }

    private boolean hasCompleteEdgeRef(MapEdgeSnapshot edge) {
        return edge.ref() != null && edge.ref().from() != null && edge.ref().to() != null;
    }

    private String statusText(DungeonSnapshot snapshot) {
        return "Revision " + snapshot.revision();
    }

    public enum TopologyPresentation {
        SQUARE,
        HEX;

        public static TopologyPresentation from(MapTopologyKind topology) {
            return topology == MapTopologyKind.HEX ? HEX : SQUARE;
        }
    }

    public record MapPresentation(
            String title,
            String subtitle,
            String modeLabel,
            String statusLabel,
            String summaryLabel,
            boolean mapLoaded,
            String overlayMessage,
            TopologyPresentation topology,
            List<CellPresentation> cells,
            List<EdgePresentation> edges
    ) {

        public MapPresentation {
            title = title == null || title.isBlank() ? "Dungeon Map" : title;
            subtitle = subtitle == null ? "" : subtitle;
            modeLabel = modeLabel == null ? "" : modeLabel;
            statusLabel = statusLabel == null ? "" : statusLabel;
            summaryLabel = summaryLabel == null ? "" : summaryLabel;
            overlayMessage = overlayMessage == null ? "" : overlayMessage;
            topology = topology == null ? TopologyPresentation.SQUARE : topology;
            cells = cells == null ? List.of() : List.copyOf(cells);
            edges = edges == null ? List.of() : List.copyOf(edges);
        }

        public static MapPresentation empty(String title) {
            return new MapPresentation(
                    title,
                    "",
                    "",
                    "",
                    "",
                    false,
                    "No dungeon map loaded.",
                    TopologyPresentation.SQUARE,
                    List.of(),
                    List.of());
        }
    }

    public record CellPresentation(
            int q,
            int r,
            String label,
            boolean room,
            boolean corridor,
            boolean blocked,
            boolean interactive,
            boolean current,
            String ownerKind,
            long ownerId,
            String partKind
    ) {

        public CellPresentation {
            label = label == null ? "" : label;
            ownerKind = ownerKind == null ? "" : ownerKind;
            partKind = partKind == null ? "" : partKind;
        }
    }

    public record EdgePresentation(
            int fromQ,
            int fromR,
            int toQ,
            int toR,
            String kind,
            String label,
            boolean interactive,
            String ownerKind,
            long ownerId,
            String partKind
    ) {

        public EdgePresentation {
            kind = kind == null || kind.isBlank() ? "edge" : kind;
            label = label == null ? "" : label;
            ownerKind = ownerKind == null ? "" : ownerKind;
            partKind = partKind == null ? "" : partKind;
        }
    }
}

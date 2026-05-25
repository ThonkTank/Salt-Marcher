package src.domain.dungeon;

import java.util.List;
import src.domain.dungeon.model.worldspace.model.DungeonAreaType;
import src.domain.dungeon.model.worldspace.model.DungeonTopology;
import src.domain.dungeon.model.worldspace.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonTopologyKind;

final class DungeonPublishedMapProjectionServiceAssembly {

    private DungeonPublishedMapProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonSnapshot defaultSnapshot() {
        return new src.domain.dungeon.published.DungeonSnapshot(
                "Dungeon",
                src.domain.dungeon.published.DungeonMapMode.EDITOR,
                src.domain.dungeon.published.DungeonMapSnapshot.empty(),
                List.of(),
                List.of(),
                0);
    }

    static src.domain.dungeon.published.DungeonMapSnapshot mapSnapshot(
            src.domain.dungeon.model.worldspace.model.DungeonMapFacts facts,
            List<src.domain.dungeon.model.worldspace.model.DungeonEditorHandleFacts> handles
    ) {
        src.domain.dungeon.model.worldspace.model.DungeonMapFacts safeFacts = facts == null
                ? new src.domain.dungeon.model.worldspace.model.DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : facts;
        List<src.domain.dungeon.model.worldspace.model.DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : List.copyOf(handles);
        return new src.domain.dungeon.published.DungeonMapSnapshot(
                topology(safeFacts),
                safeFacts.width(),
                safeFacts.height(),
                safeFacts.areas().stream().map(DungeonPublishedMapProjectionServiceAssembly::area).toList(),
                safeFacts.boundaries().stream().map(boundary -> new src.domain.dungeon.published.DungeonBoundarySnapshot(
                        boundary.kind(),
                        boundary.id(),
                        boundary.label(),
                        edge(boundary.edge()),
                        topologyRef(boundary.topologyRef()))).toList(),
                safeFacts.features().stream().map(feature -> new src.domain.dungeon.published.DungeonFeatureSnapshot(
                        src.domain.dungeon.published.DungeonFeatureKind.valueOf(feature.kind().name()),
                        feature.id(),
                        feature.label(),
                        feature.cells().stream().map(DungeonPublishedMapProjectionServiceAssembly::cell).toList(),
                        feature.description(),
                        feature.destinationLabel(),
                        topologyRef(feature.topologyRef()))).toList(),
                safeHandles.stream().map(DungeonPublishedMapProjectionServiceAssembly::handle).toList());
    }

    static src.domain.dungeon.published.DungeonCellRef cell(src.domain.dungeon.model.worldspace.model.DungeonCell cell) {
        src.domain.dungeon.model.worldspace.model.DungeonCell safeCell =
                cell == null ? new src.domain.dungeon.model.worldspace.model.DungeonCell(0, 0, 0) : cell;
        return new src.domain.dungeon.published.DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
    }

    static src.domain.dungeon.published.DungeonTopologyElementRef topologyRef(DungeonTopologyRef ref) {
        if (ref == null) {
            return src.domain.dungeon.published.DungeonTopologyElementRef.empty();
        }
        return new src.domain.dungeon.published.DungeonTopologyElementRef(
                src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    static int revision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }

    private static DungeonTopologyKind topology(src.domain.dungeon.model.worldspace.model.DungeonMapFacts facts) {
        return facts.topology() == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
    }

    private static src.domain.dungeon.published.DungeonAreaSnapshot area(src.domain.dungeon.model.worldspace.model.DungeonAreaFacts area) {
        return new src.domain.dungeon.published.DungeonAreaSnapshot(
                area.kind() == DungeonAreaType.CORRIDOR ? src.domain.dungeon.published.DungeonAreaKind.CORRIDOR : src.domain.dungeon.published.DungeonAreaKind.ROOM,
                area.id(),
                area.clusterId(),
                area.label(),
                area.cells().stream().map(DungeonPublishedMapProjectionServiceAssembly::cell).toList(),
                topologyRef(area.topologyRef()));
    }

    private static src.domain.dungeon.published.DungeonEditorHandleSnapshot handle(src.domain.dungeon.model.worldspace.model.DungeonEditorHandleFacts handle) {
        return new src.domain.dungeon.published.DungeonEditorHandleSnapshot(
                handleRef(handle.handle()),
                handle.label(),
                cell(handle.handle().cell()));
    }

    private static src.domain.dungeon.published.DungeonEditorHandleRef handleRef(src.domain.dungeon.model.worldspace.model.DungeonEditorHandle handle) {
        return new src.domain.dungeon.published.DungeonEditorHandleRef(
                src.domain.dungeon.published.DungeonEditorHandleKind.valueOf(handle.type().name()),
                topologyRef(handle.topologyRef()),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                cell(handle.cell()),
                handle.direction().name());
    }

    private static src.domain.dungeon.published.DungeonEdgeRef edge(src.domain.dungeon.model.worldspace.model.DungeonEdge edge) {
        if (edge == null) {
            return new src.domain.dungeon.published.DungeonEdgeRef(cell(null), cell(null));
        }
        return new src.domain.dungeon.published.DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
    }
}

package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonEditorHandleType;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonTopologyElementRef;

public final class TranslateDungeonAuthoredInputUseCase {

    public DungeonEditorHandle domainHandle(@Nullable DungeonEditorHandleRef ref) {
        if (ref == null) {
            return new DungeonEditorHandle(
                    DungeonEditorHandleType.CLUSTER_LABEL,
                    DungeonTopologyRef.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    domainCell(null),
                    DungeonEdgeDirection.NORTH);
        }
        return new DungeonEditorHandle(
                DungeonEditorHandleType.valueOf(ref.kind().name()),
                domainTopologyRef(ref.topologyRef()),
                ref.ownerId(),
                ref.clusterId(),
                ref.corridorId(),
                ref.roomId(),
                ref.index(),
                domainCell(ref.cell()),
                ref.direction() == null || ref.direction().isBlank()
                        ? DungeonEdgeDirection.NORTH
                        : DungeonEdgeDirection.parse(ref.direction()));
    }

    public DungeonTopologyRef domainTopologyRef(@Nullable DungeonTopologyElementRef ref) {
        if (ref == null) {
            return DungeonTopologyRef.empty();
        }
        return new DungeonTopologyRef(
                src.domain.dungeon.map.value.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    public DungeonCell domainCell(@Nullable DungeonCellRef cell) {
        return cell == null ? new DungeonCell(0, 0, 0) : new DungeonCell(cell.q(), cell.r(), cell.level());
    }

    public DungeonEdge domainEdge(@Nullable DungeonEdgeRef edge) {
        if (edge == null) {
            DungeonCell origin = domainCell(null);
            return new DungeonEdge(origin, origin);
        }
        return new DungeonEdge(domainCell(edge.from()), domainCell(edge.to()));
    }

    public DungeonMapIdentity domainMapId(@Nullable DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}

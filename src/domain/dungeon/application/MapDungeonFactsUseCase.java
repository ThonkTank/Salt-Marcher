package src.domain.dungeon.application;

import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;

public final class MapDungeonFactsUseCase {

    public DungeonMapSnapshot toPublishedSnapshot(DungeonMapFacts facts) {
        DungeonMapFacts safeFacts = facts == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, java.util.List.of(), java.util.List.of())
                : facts;
        return new DungeonMapSnapshot(
                toPublishedTopology(safeFacts.topology()),
                safeFacts.width(),
                safeFacts.height(),
                safeFacts.areas().stream().map(this::toPublishedArea).toList(),
                safeFacts.boundaries().stream().map(this::toPublishedBoundary).toList());
    }

    public DungeonMapId toPublishedId(DungeonMapIdentity identity) {
        return new DungeonMapId(identity == null ? 1L : identity.value());
    }

    public DungeonMapIdentity toDomainIdentity(DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private DungeonAreaSnapshot toPublishedArea(DungeonAreaFacts area) {
        return new DungeonAreaSnapshot(
                toPublishedAreaKind(area.kind()),
                area.id(),
                area.label(),
                area.cells().stream().map(this::toPublishedCell).toList());
    }

    private DungeonBoundarySnapshot toPublishedBoundary(DungeonBoundaryFacts boundary) {
        return new DungeonBoundarySnapshot(
                boundary.kind(),
                boundary.id(),
                boundary.label(),
                toPublishedEdge(boundary.edge()));
    }

    private DungeonAreaKind toPublishedAreaKind(DungeonAreaType kind) {
        return kind == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM;
    }

    private DungeonTopologyKind toPublishedTopology(DungeonTopology topology) {
        return topology == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
    }

    private DungeonCellRef toPublishedCell(DungeonCell cell) {
        return new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }

    private DungeonEdgeRef toPublishedEdge(DungeonEdge edge) {
        return new DungeonEdgeRef(toPublishedCell(edge.from()), toPublishedCell(edge.to()));
    }
}

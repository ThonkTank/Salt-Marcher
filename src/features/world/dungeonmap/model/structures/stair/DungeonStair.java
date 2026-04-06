package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.objects.StructureObject;

import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Metadata owner for one persisted dungeon stair.
 */
public final class DungeonStair {

    private final Long stairId;
    private final long mapId;
    private final String name;
    private final StructureObject structure;

    private DungeonStair(
            Long stairId,
            long mapId,
            String name,
            StructureObject structure
    ) {
        this.stairId = stairId;
        this.mapId = mapId;
        this.name = normalizeName(name);
        this.structure = structure == null ? StructureObject.empty() : structure;
    }

    public static DungeonStair resolved(
            Long stairId,
            long mapId,
            String name,
            List<CubePoint> path,
            Set<Integer> stopLevels
    ) {
        return new DungeonStair(
                stairId,
                mapId,
                name,
                StructureObject.fromPathPoints(path, stopLevels));
    }

    public static DungeonStair resolved(
            Long stairId,
            long mapId,
            String name,
            StructureObject structure
    ) {
        return new DungeonStair(stairId, mapId, name, structure);
    }

    public Long stairId() {
        return stairId;
    }

    public long mapId() {
        return mapId;
    }

    public String name() {
        return name;
    }

    public StructureObject structure() {
        return structure;
    }

    public List<CubePoint> path() {
        return structure.stairPath();
    }

    public Set<Integer> stopLevels() {
        return structure.stairStopLevels();
    }

    public List<StructureObject.StairStop> exits() {
        return structure.stairStops();
    }

    public String label() {
        if (name != null) {
            return name;
        }
        return stairId == null ? "Treppe neu" : "Treppe " + stairId;
    }

    public Set<Integer> reachableLevels() {
        return structure.stairStopLevels().isEmpty() ? structure.levels() : structure.stairStopLevels();
    }

    public Set<CubePoint> occupiedPositions() {
        return structure.cubePoints();
    }

    public List<StructureObject.StairStop> exitsAtLevel(int levelZ) {
        return structure.stairStopsAtLevel(levelZ);
    }

    public InteractiveLabelHandle labelHandle(int levelZ) {
        CubePoint anchorPoint = exits().stream()
                .map(StructureObject.StairStop::position)
                .filter(position -> position.z() == levelZ)
                .findFirst()
                .orElseGet(() -> path().stream()
                        .filter(position -> position.z() == levelZ)
                        .findFirst()
                        .orElse(null));
        if (anchorPoint == null) {
            return null;
        }
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.StairRef(stairId),
                label(),
                GridPoint2x.cell(anchorPoint.projectedCell()));
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof DungeonStair stair)) {
            return false;
        }
        return mapId == stair.mapId
                && Objects.equals(stairId, stair.stairId)
                && Objects.equals(name, stair.name)
                && Objects.equals(structure, stair.structure);
    }

    @Override
    public int hashCode() {
        return Objects.hash(stairId, mapId, name, structure);
    }

    @Override
    public String toString() {
        return "DungeonStair[stairId=" + stairId
                + ", mapId=" + mapId
                + ", name=" + name
                + ", structure=" + structure
                + "]";
    }

    public DungeonStair movedBy(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if ((resolvedDelta.x() == 0 && resolvedDelta.y() == 0) && levelDelta == 0) {
            return this;
        }
        return new DungeonStair(stairId, mapId, name, structure.movedBy(resolvedDelta, levelDelta));
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim();
    }
}

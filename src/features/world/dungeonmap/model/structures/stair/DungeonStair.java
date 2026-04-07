package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;

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
    private final Stair stair;

    private DungeonStair(
            Long stairId,
            long mapId,
            String name,
            Stair stair
    ) {
        this.stairId = stairId;
        this.mapId = mapId;
        this.name = normalizeName(name);
        this.stair = Objects.requireNonNull(stair, "stair");
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
                Stair.of(path, stopLevels));
    }

    public static DungeonStair resolved(
            Long stairId,
            long mapId,
            String name,
            Stair stair
    ) {
        return new DungeonStair(stairId, mapId, name, stair);
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

    public Stair stair() {
        return stair;
    }

    public List<CubePoint> path() {
        return stair.path();
    }

    public Set<Integer> stopLevels() {
        return stair.stopLevels();
    }

    public List<StairExit> exits() {
        return stair.exits();
    }

    public String label() {
        if (name != null) {
            return name;
        }
        return stairId == null ? "Treppe neu" : "Treppe " + stairId;
    }

    public Set<Integer> reachableLevels() {
        return stair.reachableLevels();
    }

    public Set<CubePoint> occupiedPositions() {
        return stair.occupiedPositions();
    }

    public List<StairExit> exitsAtLevel(int levelZ) {
        return stair.exitsAtLevel(levelZ);
    }

    public InteractiveLabelHandle labelHandle(int levelZ) {
        CubePoint anchorPoint = exits().stream()
                .map(StairExit::position)
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
                && Objects.equals(this.stair, stair.stair);
    }

    @Override
    public int hashCode() {
        return Objects.hash(stairId, mapId, name, stair);
    }

    @Override
    public String toString() {
        return "DungeonStair[stairId=" + stairId
                + ", mapId=" + mapId
                + ", name=" + name
                + ", stair=" + stair
                + "]";
    }

    public DungeonStair movedBy(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if ((resolvedDelta.x() == 0 && resolvedDelta.y() == 0) && levelDelta == 0) {
            return this;
        }
        return new DungeonStair(stairId, mapId, name, stair.movedBy(resolvedDelta, levelDelta));
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim();
    }
}

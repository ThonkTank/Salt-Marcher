package features.world.dungeon.model.structures.stair;

import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.model.interaction.InteractiveLabelHandle;

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
            GridPath path,
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

    public GridPath gridPath() {
        return stair.gridPath();
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

    public Set<GridPoint> occupiedPositions() {
        return stair.occupiedPositions();
    }

    public List<StairExit> exitsAtLevel(int levelZ) {
        return stair.exitsAtLevel(levelZ);
    }

    public InteractiveLabelHandle labelHandle(int levelZ) {
        GridPoint anchorPoint = exits().stream()
                .map(StairExit::cell)
                .filter(position -> position.z() == levelZ)
                .findFirst()
                .orElseGet(() -> gridPath().points().stream()
                        .filter(position -> position.z() == levelZ)
                        .findFirst()
                        .orElse(null));
        if (anchorPoint == null) {
            return null;
        }
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.StairRef(stairId),
                label(),
                anchorPoint);
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

    public DungeonStair movedBy(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        return new DungeonStair(stairId, mapId, name, stair.movedBy(resolvedTranslation));
    }

    public DungeonStair movedBy(int levelDelta) {
        GridTranslation translation = new GridTranslation(0, 0, levelDelta);
        if (translation.isZero()) {
            return this;
        }
        return new DungeonStair(stairId, mapId, name, stair.movedBy(translation));
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim();
    }
}

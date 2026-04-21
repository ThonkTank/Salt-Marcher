package src.domain.dungeon.map.entity;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonStairExit;
import src.domain.dungeon.map.value.DungeonStairShape;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class DungeonStair {

    private final long stairId;
    private final long mapId;
    private final String name;
    private final DungeonStairShape shape;
    private final DungeonEdgeDirection direction;
    private final int dimension1;
    private final int dimension2;
    private final List<DungeonCell> path;
    private final List<DungeonStairExit> exits;
    private final @Nullable Long corridorId;

    public DungeonStair(
            long stairId,
            long mapId,
            String name,
            DungeonStairShape shape,
            DungeonEdgeDirection direction,
            int dimension1,
            int dimension2,
            List<DungeonCell> path,
            List<DungeonStairExit> exits,
            @Nullable Long corridorId
    ) {
        this.stairId = stairId;
        this.mapId = mapId;
        this.name = name == null || name.isBlank() ? "Treppe " + stairId : name.trim();
        this.shape = shape == null ? DungeonStairShape.LADDER : shape;
        this.direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
        this.dimension1 = Math.max(0, dimension1);
        this.dimension2 = Math.max(0, dimension2);
        this.path = normalizeCells(path);
        this.exits = normalizeExits(exits);
        this.corridorId = corridorId == null || corridorId <= 0L ? null : corridorId;
    }

    public long stairId() {
        return stairId;
    }

    public long mapId() {
        return mapId;
    }

    public String name() {
        return name;
    }

    public DungeonStairShape shape() {
        return shape;
    }

    public DungeonEdgeDirection direction() {
        return direction;
    }

    public int dimension1() {
        return dimension1;
    }

    public int dimension2() {
        return dimension2;
    }

    public List<DungeonCell> path() {
        return path;
    }

    public List<DungeonStairExit> exits() {
        return exits;
    }

    public @Nullable Long corridorId() {
        return corridorId;
    }

    public Set<DungeonCell> occupiedCells() {
        LinkedHashSet<DungeonCell> result = new LinkedHashSet<>(path);
        for (DungeonStairExit exit : exits) {
            result.add(exit.position());
        }
        return Set.copyOf(result);
    }

    public Set<Integer> reachableLevels() {
        LinkedHashSet<Integer> result = new LinkedHashSet<>();
        occupiedCells().stream()
                .map(DungeonCell::level)
                .sorted()
                .forEach(result::add);
        return Set.copyOf(result);
    }

    public List<DungeonStairExit> exitsAtLevel(int level) {
        return exits.stream()
                .filter(exit -> exit.position().level() == level)
                .toList();
    }

    public boolean isReadable() {
        return !occupiedCells().isEmpty();
    }

    private static List<DungeonCell> normalizeCells(List<DungeonCell> cells) {
        return (cells == null ? List.<DungeonCell>of() : cells).stream()
                .filter(cell -> cell != null)
                .distinct()
                .sorted(Comparator
                        .comparingInt(DungeonCell::level)
                        .thenComparingInt(DungeonCell::r)
                        .thenComparingInt(DungeonCell::q))
                .toList();
    }

    private static List<DungeonStairExit> normalizeExits(List<DungeonStairExit> exits) {
        return (exits == null ? List.<DungeonStairExit>of() : exits).stream()
                .filter(exit -> exit != null)
                .sorted(Comparator
                        .comparingInt((DungeonStairExit exit) -> exit.position().level())
                        .thenComparingInt(exit -> exit.position().r())
                        .thenComparingInt(exit -> exit.position().q())
                        .thenComparingLong(DungeonStairExit::exitId))
                .toList();
    }
}

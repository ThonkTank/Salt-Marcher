package src.domain.dungeon.model.worldspace.model;

public record DungeonStairExit(
        long exitId,
        DungeonCell position,
        String label
) {

    public DungeonStairExit {
        exitId = Math.max(0L, exitId);
        position = position == null ? new DungeonCell(0, 0, 0) : position;
        label = label == null || label.isBlank()
                ? "Ausgang z=" + position.level() + " (" + position.q() + "," + position.r() + ")"
                : label.trim();
    }
}

package features.world.dungeon.dungeonmap.structure.model.boundary.door;

public record DoorRef(long doorId) {

    public DoorRef {
        if (doorId == 0L) {
            throw new IllegalArgumentException("doorId must be non-zero");
        }
    }
}

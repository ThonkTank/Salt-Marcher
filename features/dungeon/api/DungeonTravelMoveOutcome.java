package features.dungeon.api;

public record DungeonTravelMoveOutcome(
        DungeonTravelMoveStatus status,
        DungeonTravelRejectionReason rejectionReason,
        long commandGeneration
) {
    public DungeonTravelMoveOutcome {
        status = status == null ? DungeonTravelMoveStatus.IDLE : status;
        rejectionReason = rejectionReason == null ? DungeonTravelRejectionReason.NONE : rejectionReason;
        commandGeneration = Math.max(0L, commandGeneration);
    }

    public static DungeonTravelMoveOutcome idle() {
        return new DungeonTravelMoveOutcome(
                DungeonTravelMoveStatus.IDLE,
                DungeonTravelRejectionReason.NONE,
                0L);
    }

    public static DungeonTravelMoveOutcome moving(long commandGeneration) {
        return new DungeonTravelMoveOutcome(
                DungeonTravelMoveStatus.MOVING,
                DungeonTravelRejectionReason.NONE,
                commandGeneration);
    }

    public static DungeonTravelMoveOutcome accepted(long commandGeneration) {
        return new DungeonTravelMoveOutcome(
                DungeonTravelMoveStatus.ACCEPTED,
                DungeonTravelRejectionReason.NONE,
                commandGeneration);
    }

    public static DungeonTravelMoveOutcome rejected(
            DungeonTravelRejectionReason reason,
            long commandGeneration
    ) {
        return new DungeonTravelMoveOutcome(
                DungeonTravelMoveStatus.REJECTED,
                reason,
                commandGeneration);
    }
}

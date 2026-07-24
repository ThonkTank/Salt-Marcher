package features.sessionplanner.api;

import java.math.BigDecimal;
import java.util.List;

public record UpdateSessionTreasureCommand(
        SessionPlannerAuthoredTarget target,
        long sceneId,
        Treasure treasure
) {
    public UpdateSessionTreasureCommand {
        if (target == null || sceneId <= 0L || treasure == null || treasure.sceneId() != sceneId) {
            throw new IllegalArgumentException("valid treasure target is required");
        }
    }

    public record Treasure(
            long treasureId, long sceneId, String title, String note, String stockClass, String channel,
            String theme, String magicType, long targetCp, int nonMagicSlots, int magicSlots,
            List<Item> items, List<Packing> packing
    ) {
        public Treasure {
            items = items == null ? List.of() : List.copyOf(items);
            packing = packing == null ? List.of() : List.copyOf(packing);
        }
    }

    public record Item(
            long lineId, String role, String itemId, String text, long quantity, long unitCp, long actualCp,
            BigDecimal totalCapacity, String allowedContainers, String magicRarity, boolean cursed
    ) { }

    public record Packing(long lineId, String containerType, int containerCount, String containerId, boolean valid) { }
}

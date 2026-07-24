package features.sessionplanner.domain.session;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

/** An independently editable treasure owned by one Session Planner scene. */
public record SessionTreasure(
        long treasureId,
        long sceneId,
        String title,
        String note,
        String stockClass,
        String channel,
        String theme,
        String magicType,
        long targetCp,
        int nonMagicSlots,
        int magicSlots,
        List<Item> items,
        List<Packing> packing
) {

    public SessionTreasure {
        if (treasureId <= 0L || sceneId <= 0L) {
            throw new IllegalArgumentException("treasure and scene identities must be positive");
        }
        title = text(title);
        note = text(note);
        stockClass = text(stockClass);
        channel = text(channel);
        theme = text(theme);
        magicType = text(magicType);
        targetCp = Math.max(0L, targetCp);
        nonMagicSlots = Math.max(0, nonMagicSlots);
        magicSlots = Math.max(0, magicSlots);
        items = items == null ? List.of() : List.copyOf(items);
        packing = packing == null ? List.of() : List.copyOf(packing);
        if (items.stream().map(Item::lineId).distinct().count() != items.size()) {
            throw new IllegalArgumentException("treasure item line identities must be unique");
        }
        if (packing.stream().map(Packing::lineId).distinct().count() != packing.size()) {
            throw new IllegalArgumentException("treasure packing line identities must be unique");
        }
    }

    public String displayTitle() {
        if (!title.isBlank()) {
            return title;
        }
        return theme.isBlank() ? "Schatz" : theme;
    }

    public record Item(
            long lineId,
            String role,
            String itemId,
            String text,
            long quantity,
            long unitCp,
            long actualCp,
            BigDecimal totalCapacity,
            String allowedContainers,
            String magicRarity,
            boolean cursed
    ) {
        public Item {
            if (lineId <= 0L) {
                throw new IllegalArgumentException("treasure item line identity must be positive");
            }
            role = SessionTreasure.text(role);
            itemId = SessionTreasure.text(itemId);
            text = SessionTreasure.text(text);
            quantity = Math.max(0L, quantity);
            unitCp = Math.max(0L, unitCp);
            actualCp = Math.max(0L, actualCp);
            totalCapacity = totalCapacity == null ? BigDecimal.ZERO : totalCapacity.max(BigDecimal.ZERO);
            allowedContainers = SessionTreasure.text(allowedContainers);
            magicRarity = SessionTreasure.text(magicRarity);
        }
    }

    public record Packing(
            long lineId,
            String containerType,
            int containerCount,
            String containerId,
            boolean valid
    ) {
        public Packing {
            if (lineId <= 0L) {
                throw new IllegalArgumentException("packing line identity must be positive");
            }
            containerType = SessionTreasure.text(containerType);
            containerCount = Math.max(0, containerCount);
            containerId = SessionTreasure.text(containerId);
        }
    }

    private static String text(String value) {
        return Objects.requireNonNullElse(value, "").trim();
    }
}

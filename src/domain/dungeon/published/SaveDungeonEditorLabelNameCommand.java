package src.domain.dungeon.published;

import java.util.Locale;

public record SaveDungeonEditorLabelNameCommand(
        String targetKind,
        long targetId,
        String name
) {
    public static final String TARGET_CLUSTER = "CLUSTER";
    public static final String TARGET_ROOM = "ROOM";

    public SaveDungeonEditorLabelNameCommand {
        targetKind = normalizeTargetKind(targetKind);
        targetId = Math.max(0L, targetId);
        name = name == null ? "" : name.trim();
    }

    public static String normalizeTargetKind(String candidate) {
        String normalized = candidate == null ? "" : candidate.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case TARGET_CLUSTER, TARGET_ROOM -> normalized;
            default -> "";
        };
    }
}

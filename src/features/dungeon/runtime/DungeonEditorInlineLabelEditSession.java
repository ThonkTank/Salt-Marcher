package src.features.dungeon.runtime;

public record DungeonEditorInlineLabelEditSession(
        boolean active,
        String targetKind,
        long targetId,
        String labelKind,
        long ownerId,
        long clusterId,
        String topologyKind,
        long topologyId,
        String draftText,
        double centerX,
        double centerY,
        double width,
        double height,
        double rotationDegrees
) {
    private static final DungeonEditorInlineLabelEditSession INACTIVE =
            new DungeonEditorInlineLabelEditSession(
                    false,
                    "",
                    0L,
                    "",
                    0L,
                    0L,
                    "",
                    0L,
                    "",
                    0.0,
                    0.0,
                    1.0,
                    0.6,
                    0.0);

    public DungeonEditorInlineLabelEditSession {
        targetKind = safeText(targetKind);
        targetId = Math.max(0L, targetId);
        labelKind = safeText(labelKind);
        ownerId = Math.max(0L, ownerId);
        clusterId = Math.max(0L, clusterId);
        topologyKind = safeText(topologyKind);
        topologyId = Math.max(0L, topologyId);
        draftText = safeText(draftText);
        width = Math.max(1.0, width);
        height = Math.max(0.6, height);
    }

    public static DungeonEditorInlineLabelEditSession inactive() {
        return INACTIVE;
    }

    public static DungeonEditorInlineLabelEditSession active(
            Target target,
            String draftText,
            Placement placement
    ) {
        Target safeTarget = target == null ? Target.empty() : target;
        Placement safePlacement = placement == null ? Placement.empty() : placement;
        return new DungeonEditorInlineLabelEditSession(
                true,
                safeTarget.targetKind(),
                safeTarget.targetId(),
                safeTarget.labelKind(),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                safeTarget.topologyKind(),
                safeTarget.topologyId(),
                draftText,
                safePlacement.centerX(),
                safePlacement.centerY(),
                safePlacement.width(),
                safePlacement.height(),
                safePlacement.rotationDegrees());
    }

    public DungeonEditorInlineLabelEditSession withDraftText(String nextDraftText) {
        if (!active) {
            return inactive();
        }
        return active(
                new Target(targetKind, targetId, labelKind, ownerId, clusterId, topologyKind, topologyId),
                nextDraftText,
                new Placement(centerX, centerY, width, height, rotationDegrees));
    }

    public record Target(
            String targetKind,
            long targetId,
            String labelKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId
    ) {
        public Target {
            targetKind = safeText(targetKind);
            targetId = Math.max(0L, targetId);
            labelKind = safeText(labelKind);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = safeText(topologyKind);
            topologyId = Math.max(0L, topologyId);
        }

        private static Target empty() {
            return new Target("", 0L, "", 0L, 0L, "", 0L);
        }
    }

    public record Placement(
            double centerX,
            double centerY,
            double width,
            double height,
            double rotationDegrees
    ) {
        public Placement {
            width = Math.max(1.0, width);
            height = Math.max(0.6, height);
        }

        private static Placement empty() {
            return new Placement(0.0, 0.0, 1.0, 0.6, 0.0);
        }
    }

    private static String safeText(String text) {
        return text == null ? "" : text;
    }
}

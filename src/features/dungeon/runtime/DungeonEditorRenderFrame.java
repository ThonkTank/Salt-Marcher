package src.features.dungeon.runtime;

import java.util.Objects;

public record DungeonEditorRenderFrame(
        DungeonEditorPreparedFrameFacts preparedFacts,
        DungeonEditorInlineLabelEditSession inlineLabelEditSession,
        MeasurementSnapshot measurement
) {
    public DungeonEditorRenderFrame {
        preparedFacts = Objects.requireNonNull(preparedFacts, "preparedFacts");
        inlineLabelEditSession = inlineLabelEditSession == null
                ? DungeonEditorInlineLabelEditSession.inactive()
                : inlineLabelEditSession;
        measurement = measurement == null ? MeasurementSnapshot.empty() : measurement;
    }

    public static DungeonEditorRenderFrame empty() {
        return new DungeonEditorRenderFrame(
                DungeonEditorPreparedFrameFacts.empty(),
                DungeonEditorInlineLabelEditSession.inactive(),
                MeasurementSnapshot.empty());
    }

    public record MeasurementSnapshot(
            long runtimeFramePublicationCount,
            long mapInteractionFrameRecomputeCount,
            long mapInteractionFrameRecomputeNanos
    ) {
        public MeasurementSnapshot {
            runtimeFramePublicationCount = Math.max(0L, runtimeFramePublicationCount);
            mapInteractionFrameRecomputeCount = Math.max(0L, mapInteractionFrameRecomputeCount);
            mapInteractionFrameRecomputeNanos = Math.max(0L, mapInteractionFrameRecomputeNanos);
        }

        static MeasurementSnapshot empty() {
            return new MeasurementSnapshot(0L, 0L, 0L);
        }
    }
}

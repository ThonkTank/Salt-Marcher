package features.world.read.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadOverworldTransitionTargetsInput() {

    public record OverworldTransitionTargetSummaryInput(
            long mapId,
            long tileId,
            String label
    ) {
        public OverworldTransitionTargetSummaryInput {
            label = label == null || label.isBlank() ? "Overworld-Ziel" : label.trim();
        }
    }

    public record LoadedOverworldTransitionTargetsInput(
            List<OverworldTransitionTargetSummaryInput> targets
    ) {
        public LoadedOverworldTransitionTargetsInput {
            targets = targets == null ? List.of() : List.copyOf(targets);
        }
    }
}

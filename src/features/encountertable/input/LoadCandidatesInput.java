package features.encountertable.input;

import features.creatures.model.Creature;
import java.util.List;
import java.util.Map;

@SuppressWarnings("unused")
public record LoadCandidatesInput(List<Long> tableIds, int maxXp) {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record LoadedCandidatesInput(
            Status status,
            List<Creature> candidates,
            Map<Long, Integer> selectionWeights
    ) {
    }
}

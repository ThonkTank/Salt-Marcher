package src.domain.party.application;

import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.port.PartyRuntimeRepository;
import src.domain.party.roster.value.PartyMutationStatus;

public final class PartyRuntimeAccess {

    private final @Nullable PartyRuntimeRepository runtimeFeedback;

    private PartyRuntimeAccess(@Nullable PartyRuntimeRepository runtimeFeedback) {
        this.runtimeFeedback = runtimeFeedback;
    }

    public static PartyRuntimeAccess fromRepository(PartyRosterRepository repository) {
        PartyRosterRepository safeRepository = Objects.requireNonNull(repository, "repository");
        return new PartyRuntimeAccess(safeRepository instanceof PartyRuntimeRepository feedback ? feedback : null);
    }

    public void runMutation(Supplier<PartyMutationStatus> operation) {
        try {
            PartyMutationStatus status = operation.get();
            if (runtimeFeedback != null) {
                runtimeFeedback.recordMutationStatus(status);
            }
        } catch (IllegalStateException exception) {
            if (runtimeFeedback != null) {
                runtimeFeedback.recordStorageErrorMutation();
            }
        }
    }

    public void publishAdventuringDayCalculation(List<Integer> levels, int totalGroupXp) {
        if (runtimeFeedback != null) {
            runtimeFeedback.publishAdventuringDayCalculation(
                    levels == null ? List.of() : List.copyOf(levels),
                    totalGroupXp);
        }
    }
}

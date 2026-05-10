package src.domain.party.application;

import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.model.roster.repository.PartyRuntimeRepository;

public final class PartyRuntimeFeedbackUseCase {

    private final @Nullable PartyRuntimeRepository runtimeFeedback;

    private PartyRuntimeFeedbackUseCase(@Nullable PartyRuntimeRepository runtimeFeedback) {
        this.runtimeFeedback = runtimeFeedback;
    }

    public static PartyRuntimeFeedbackUseCase fromRepository(PartyRosterRepository repository) {
        PartyRosterRepository safeRepository = Objects.requireNonNull(repository, "repository");
        return new PartyRuntimeFeedbackUseCase(safeRepository instanceof PartyRuntimeRepository feedback ? feedback : null);
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

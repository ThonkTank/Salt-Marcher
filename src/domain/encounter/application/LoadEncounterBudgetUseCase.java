package src.domain.encounter.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;

public final class LoadEncounterBudgetUseCase {

    private final EncounterPartyFactsRepository party;

    public LoadEncounterBudgetUseCase(EncounterPartyFactsRepository party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    public Result execute() {
        EncounterPartyFactsRepository.PartyBudgetFacts facts = party.loadPartyBudgetFacts();
        if (facts.status() == EncounterPartyFactsRepository.Status.STORAGE_ERROR) {
            return Result.storageError();
        }
        if (facts.status() == EncounterPartyFactsRepository.Status.NO_ACTIVE_PARTY) {
            return Result.noActiveParty();
        }
        EncounterDifficultyMath.BudgetSummary summary = EncounterDifficultyMath.summarizeBudget(
                facts.activePartyLevels(),
                facts.consumedDailyXp(),
                facts.totalBudgetXp());
        return Result.success(summary);
    }

    public record Result(
            Status status,
            EncounterDifficultyMath.@Nullable BudgetSummary budget,
            String message
    ) {

        static Result success(EncounterDifficultyMath.BudgetSummary budget) {
            return new Result(Status.SUCCESS, budget, "");
        }

        static Result noActiveParty() {
            return new Result(Status.NO_ACTIVE_PARTY, null, "No active party is available.");
        }

        static Result storageError() {
            return new Result(Status.STORAGE_ERROR, null, "Party data could not be loaded.");
        }
    }

    public enum Status {
        SUCCESS,
        NO_ACTIVE_PARTY,
        STORAGE_ERROR
    }
}

package src.domain.encounter.application;

import java.util.Objects;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;

public final class LoadEncounterBudgetUseCase {

    private final EncounterPartyFactsRepository party;
    private static final EncounterDifficultyMath.BudgetSummary EMPTY_BUDGET =
            new EncounterDifficultyMath.BudgetSummary(java.util.List.of(), 1, 0, 0, 0, 0, 0, 0, 0);

    public LoadEncounterBudgetUseCase(EncounterPartyFactsRepository party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    public Result execute() {
        EncounterPartyFactsRepository.PartyBudgetFacts facts = party.loadPartyBudgetFacts();
        if (facts.status().isStorageError()) {
            return Result.storageError();
        }
        if (facts.status().isNoActiveParty()) {
            return Result.noActiveParty();
        }
        EncounterDifficultyMath.BudgetSummary summary = EncounterDifficultyMath.summarizeBudget(
                facts.activePartyLevels(),
                facts.consumedDailyXp(),
                facts.totalBudgetXp());
        return Result.success(summary);
    }

    public record Result(
            EncounterPartyFactsRepository.Status status,
            EncounterDifficultyMath.BudgetSummary budget,
            String message
    ) {

        public Result {
            status = status == null ? EncounterPartyFactsRepository.Status.STORAGE_ERROR : status;
            message = message == null ? "" : message;
        }

        static Result success(EncounterDifficultyMath.BudgetSummary budget) {
            return new Result(EncounterPartyFactsRepository.Status.SUCCESS, budget, "");
        }

        static Result noActiveParty() {
            return new Result(
                    EncounterPartyFactsRepository.Status.NO_ACTIVE_PARTY,
                    EMPTY_BUDGET,
                    "No active party is available.");
        }

        static Result storageError() {
            return new Result(
                    EncounterPartyFactsRepository.Status.STORAGE_ERROR,
                    EMPTY_BUDGET,
                    "Party data could not be loaded.");
        }
    }
}

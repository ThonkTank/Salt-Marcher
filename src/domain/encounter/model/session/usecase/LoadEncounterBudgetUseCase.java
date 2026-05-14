package src.domain.encounter.application;

import java.util.Objects;
import src.domain.encounter.model.generation.helper.EncounterDifficultyMathHelper;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;

public final class LoadEncounterBudgetUseCase {

    private final EncounterPartyFactsRepository party;
    private static final EncounterDifficultyMathHelper.BudgetSummary EMPTY_BUDGET =
            new EncounterDifficultyMathHelper.BudgetSummary(java.util.List.of(), 1, 0, 0, 0, 0, 0, 0, 0);

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
        EncounterDifficultyMathHelper.BudgetSummary summary = EncounterDifficultyMathHelper.summarizeBudget(
                facts.activePartyLevels(),
                facts.consumedDailyXp(),
                facts.totalBudgetXp());
        return Result.success(summary);
    }

    public record Result(
            EncounterPartyFactsRepository.Status status,
            EncounterDifficultyMathHelper.BudgetSummary budget,
            String message
    ) {

        public Result {
            status = status == null ? EncounterPartyFactsRepository.Status.storageErrorStatus() : status;
            message = message == null ? "" : message;
        }

        static Result success(EncounterDifficultyMathHelper.BudgetSummary budget) {
            return new Result(EncounterPartyFactsRepository.Status.successStatus(), budget, "");
        }

        static Result noActiveParty() {
            return new Result(
                    EncounterPartyFactsRepository.Status.noActivePartyStatus(),
                    EMPTY_BUDGET,
                    "No active party is available.");
        }

        static Result storageError() {
            return new Result(
                    EncounterPartyFactsRepository.Status.storageErrorStatus(),
                    EMPTY_BUDGET,
                    "Party data could not be loaded.");
        }
    }
}

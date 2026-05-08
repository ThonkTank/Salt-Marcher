package src.domain.encounter.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;

public final class LoadEncounterBudgetUseCase {

    private final EncounterPartyFactsRepository party;

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
        return Result.success(new EncounterBudgetSummary(
                summary.activePartyLevels(),
                summary.averagePartyLevel(),
                summary.easyThreshold(),
                summary.mediumThreshold(),
                summary.hardThreshold(),
                summary.deadlyThreshold(),
                summary.dailyBudgetXp(),
                summary.consumedDailyXp(),
                summary.remainingDailyXp()));
    }

    public record Result(
            EncounterGenerationStatus status,
            @Nullable EncounterBudgetSummary budget,
            String message
    ) {

        public Result {
            status = status == null ? EncounterGenerationStatus.defaultFailure() : status;
            message = message == null ? "" : message;
        }

        static Result success(EncounterBudgetSummary budget) {
            return new Result(EncounterGenerationStatus.SUCCESS, budget, "");
        }

        static Result noActiveParty() {
            return new Result(EncounterGenerationStatus.NO_ACTIVE_PARTY, null, "No active party is available.");
        }

        static Result storageError() {
            return new Result(EncounterGenerationStatus.STORAGE_ERROR, null, "Party data could not be loaded.");
        }
    }
}

package src.domain.encounter.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.LoadActivePartyCompositionQuery;
import src.domain.party.published.LoadAdventuringDaySummaryQuery;
import src.domain.party.published.ReadStatus;

public final class LoadEncounterBudgetUseCase {

    private final PartyApplicationService party;

    public LoadEncounterBudgetUseCase(PartyApplicationService party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    public Result execute() {
        ActivePartyCompositionResult compositionResult =
                party.loadActivePartyComposition(new LoadActivePartyCompositionQuery());
        AdventuringDayResult dayResult = party.loadAdventuringDaySummary(new LoadAdventuringDaySummaryQuery());
        if (compositionResult.status() != ReadStatus.SUCCESS || dayResult.status() != ReadStatus.SUCCESS) {
            return Result.storageError();
        }
        if (compositionResult.composition().activePartyLevels().isEmpty()) {
            return Result.noActiveParty();
        }
        EncounterDifficultyMath.BudgetSummary summary = EncounterDifficultyMath.summarizeBudget(
                compositionResult.composition().activePartyLevels(),
                dayResult.summary().consumedXp(),
                dayResult.summary().totalBudgetXp());
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

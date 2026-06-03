package src.domain.encounter.model.generation.usecase;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.helper.EncounterDifficultyMathHelper;
import src.domain.encounter.model.generation.EncounterDifficultyThresholds;
import src.domain.encounter.model.session.PartyBudgetFacts;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;

final class EncounterGenerationPartyLoadUseCase {

    private EncounterGenerationPartyLoadUseCase() {
    }

    static PartyLoadResult loadPartyState(EncounterPartyFactsRepository party) {
        PartyBudgetFacts facts = party.loadPartyBudgetFacts();
        if (facts.status().isStorageError()) {
            return PartyLoadResult.failure("Party data could not be loaded.");
        }
        if (facts.status().isNoActiveParty()) {
            return PartyLoadResult.failure("No active party is available.");
        }
        List<Integer> partyLevels = facts.activePartyLevels();
        EncounterDifficultyThresholds thresholds = EncounterDifficultyMathHelper.thresholdsFor(partyLevels);
        return PartyLoadResult.success(thresholds, partyLevels.size());
    }

    record PartyLoadResult(
            boolean success,
            @Nullable EncounterDifficultyThresholds thresholds,
            int partySize,
            String message
    ) {

        EncounterGenerationPreparationUseCase failure() {
            return EncounterGenerationPreparationUseCase.failure(message);
        }

        EncounterDifficultyThresholds requireThresholds() {
            if (thresholds == null) {
                throw new IllegalStateException("Party thresholds missing for successful load.");
            }
            return thresholds;
        }

        private static PartyLoadResult success(
                EncounterDifficultyThresholds thresholds,
                int partySize
        ) {
            return new PartyLoadResult(true, thresholds, partySize, "");
        }

        private static PartyLoadResult failure(String message) {
            return new PartyLoadResult(false, null, 0, message);
        }
    }
}

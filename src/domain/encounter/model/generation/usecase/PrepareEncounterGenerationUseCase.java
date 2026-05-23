package src.domain.encounter.model.generation.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.model.EncounterDifficultyThresholds;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;
import src.domain.encounter.model.reference.port.ApplicationEncounterCreatureCatalogPort;
import src.domain.encounter.model.reference.port.ApplicationEncounterTableCandidatePort;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;

public final class PrepareEncounterGenerationUseCase {

    private PrepareEncounterGenerationUseCase() {
    }

    public static EncounterGenerationPreparationUseCase prepare(
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures,
            ApplicationEncounterCreatureCatalogPort creatureCatalog,
            @Nullable EncounterTableCandidateRepository encounterTables,
            @Nullable ApplicationEncounterTableCandidatePort tableCandidates,
            EncounterGenerationRequest request,
            int searchLimit
    ) {
        EncounterGenerationPartyLoadUseCase.PartyLoadResult partyLoad =
                EncounterGenerationPartyLoadUseCase.loadPartyState(party);
        if (!partyLoad.success()) {
            return partyLoad.failure();
        }
        EncounterDifficultyThresholds thresholds = partyLoad.requireThresholds();

        EncounterGenerationLockedCreatureUseCase.LockedCreatures lockedCreatures =
                EncounterGenerationLockedCreatureUseCase.loadLockedCreatures(creatures, creatureCatalog, request);
        if (!lockedCreatures.success()) {
            return lockedCreatures.failure();
        }

        EncounterGenerationUnlockedCandidateUseCase.CandidateLoadResult candidates =
                EncounterGenerationUnlockedCandidateUseCase.loadUnlockedCandidates(
                        creatures,
                        creatureCatalog,
                        encounterTables,
                        tableCandidates,
                        request,
                        thresholds,
                        lockedCreatures.lockedProfiles().keySet(),
                        searchLimit);
        if (!candidates.success()) {
            return candidates.failure();
        }
        if (lockedCreatures.lockedProfiles().isEmpty() && candidates.unlockedProfiles().isEmpty()) {
            return EncounterGenerationPreparationUseCase.failure("No creatures matched the current filters.");
        }

        EncounterGenerationSearchUseCase.GenerationSearchResult searchResult =
                EncounterGenerationSearchUseCase.generateDrafts(
                        request,
                        thresholds,
                        partyLoad.partySize(),
                        lockedCreatures,
                        candidates.unlockedProfiles());
        if (searchResult.drafts().isEmpty()) {
            return EncounterGenerationPreparationUseCase.failure("No encounter compositions fit the current request.");
        }
        return EncounterGenerationPreparationUseCase.success(
                searchResult.drafts(),
                searchResult.message(),
                searchResult.diagnostics(),
                searchResult.autoResolved(),
                searchResult.fallbackUsed());
    }
}

package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.encounter.model.generation.EncounterCandidateProfile;
import src.domain.encounter.model.generation.EncounterCreatureFacts;
import src.domain.encounter.model.reference.port.ApplicationEncounterTableCandidatePort;
import src.domain.encountertable.published.EncounterTableCandidate;
import src.domain.encountertable.published.EncounterTableCandidatesModel;
import src.domain.encountertable.published.EncounterTableCandidatesResult;
import src.domain.encountertable.published.EncounterTableReadStatus;

final class EncounterTableCandidateServiceAssembly implements ApplicationEncounterTableCandidatePort {

    private final EncounterTableCandidatesModel candidatesModel;

    EncounterTableCandidateServiceAssembly(EncounterTableCandidatesModel candidatesModel) {
        this.candidatesModel = Objects.requireNonNull(candidatesModel, "candidatesModel");
    }

    @Override
    public List<EncounterCandidateProfile> loadCandidates() {
        EncounterTableCandidatesResult result = candidatesModel.current();
        if (result.status() != EncounterTableReadStatus.SUCCESS) {
            return List.of();
        }
        List<EncounterCandidateProfile> candidates = new ArrayList<>();
        for (EncounterTableCandidate candidate : result.candidates()) {
            candidates.add(toProfile(candidate));
        }
        return List.copyOf(candidates);
    }

    private static EncounterCandidateProfile toProfile(EncounterTableCandidate candidate) {
        return EncounterCandidateProfile.fromFacts(
                new EncounterCreatureFacts(
                        candidate.creatureId(),
                        candidate.name(),
                        candidate.creatureType(),
                        candidate.challengeRating(),
                        candidate.xp(),
                        candidate.hitPoints(),
                        candidate.hitDiceCount(),
                        candidate.hitDiceSides(),
                        candidate.hitDiceModifier(),
                        candidate.armorClass(),
                        candidate.initiativeBonus(),
                        candidate.legendaryActionCount(),
                        0,
                        0,
                        0,
                        0,
                        null,
                        null,
                        null,
                        0,
                        List.of()),
                candidate.weight());
    }
}

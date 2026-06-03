package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.creatures.published.CreatureActionDetail;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureEncounterCandidate;
import src.domain.creatures.published.CreatureEncounterCandidatesModel;
import src.domain.creatures.published.CreatureEncounterCandidatesResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.encounter.model.generation.EncounterCandidateProfile;
import src.domain.encounter.model.generation.EncounterCreatureFacts;
import src.domain.encounter.model.reference.EncounterCreatureReference;
import src.domain.encounter.model.reference.port.ApplicationEncounterCreatureCatalogPort;

final class EncounterCreatureCatalogServiceAssembly implements ApplicationEncounterCreatureCatalogPort {

    private final CreatureDetailModel detailModel;
    private final CreatureEncounterCandidatesModel candidatesModel;

    EncounterCreatureCatalogServiceAssembly(
            CreatureDetailModel detailModel,
            CreatureEncounterCandidatesModel candidatesModel
    ) {
        this.detailModel = Objects.requireNonNull(detailModel, "detailModel");
        this.candidatesModel = Objects.requireNonNull(candidatesModel, "candidatesModel");
    }

    @Override
    public Optional<EncounterCreatureReference> loadCreature() {
        CreatureDetailResult result = detailModel.current();
        if (result.status() != CreatureLookupStatus.SUCCESS || result.detail() == null) {
            return Optional.empty();
        }
        return Optional.of(toReference(result.detail()));
    }

    @Override
    public List<EncounterCandidateProfile> loadCandidates() {
        CreatureEncounterCandidatesResult result = candidatesModel.current();
        if (result.status() != CreatureQueryStatus.SUCCESS) {
            return List.of();
        }
        List<EncounterCandidateProfile> candidates = new ArrayList<>();
        for (CreatureEncounterCandidate candidate : result.candidates()) {
            candidates.add(toProfile(candidate));
        }
        return List.copyOf(candidates);
    }

    private static EncounterCandidateProfile toProfile(CreatureEncounterCandidate candidate) {
        return EncounterCandidateProfile.fromFacts(
                toFacts(candidate),
                candidate.selectionWeight());
    }

    private static EncounterCreatureReference toReference(CreatureDetail detail) {
        List<String> actionTypes = new ArrayList<>();
        for (CreatureActionDetail action : detail.actions()) {
            actionTypes.add(action.actionType());
        }
        return new EncounterCreatureReference(
                detail.id(),
                detail.name(),
                detail.creatureType(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.hitDiceCount(),
                detail.hitDiceSides(),
                detail.hitDiceModifier(),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.legendaryActionCount(),
                detail.flySpeed(),
                detail.swimSpeed(),
                detail.climbSpeed(),
                detail.burrowSpeed(),
                detail.damageResistances(),
                detail.damageImmunities(),
                detail.conditionImmunities(),
                detail.passivePerception(),
                List.copyOf(actionTypes));
    }

    private static EncounterCreatureFacts toFacts(CreatureEncounterCandidate candidate) {
        return new EncounterCreatureFacts(
                candidate.id(),
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
                List.of());
    }
}

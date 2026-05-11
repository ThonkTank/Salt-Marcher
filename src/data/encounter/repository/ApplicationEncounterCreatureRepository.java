package src.data.encounter.repository;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.data.creatures.query.SqliteCreatureCatalogQueryAdapter;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.encounter.model.generation.helper.EncounterCandidateProfileHelper;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterCreatureFacts;
import src.domain.encounter.model.reference.model.EncounterCreatureCandidateCriteria;
import src.domain.encounter.model.reference.model.EncounterCreatureReference;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;

public final class ApplicationEncounterCreatureRepository implements EncounterCreatureRepository {

    private static final int DEFAULT_LIMIT = 250;
    private static final int MAX_LIMIT = 1000;

    private final CreatureCatalogPort creatureCatalogLookup;

    public ApplicationEncounterCreatureRepository() {
        this(new SqliteCreatureCatalogQueryAdapter());
    }

    ApplicationEncounterCreatureRepository(CreatureCatalogPort creatureCatalogLookup) {
        this.creatureCatalogLookup = Objects.requireNonNull(creatureCatalogLookup, "creatureCatalogLookup");
    }

    @Override
    public Optional<EncounterCreatureReference> loadCreature(long creatureId) {
        if (creatureId <= 0L) {
            return Optional.empty();
        }
        return Optional.ofNullable(creatureCatalogLookup.loadCreatureDetail(creatureId))
                .map(ApplicationEncounterCreatureRepository::toReference);
    }

    @Override
    public List<EncounterCandidateProfile> loadCandidates(EncounterCreatureCandidateCriteria criteria) {
        EncounterCreatureCandidateCriteria safeCriteria = criteria == null
                ? new EncounterCreatureCandidateCriteria(List.of(), List.of(), List.of(), 0, 0, 0)
                : criteria;
        int minimumXp = Math.max(0, safeCriteria.minimumXp());
        int maximumXp = safeCriteria.maximumXp() <= 0 ? Integer.MAX_VALUE : safeCriteria.maximumXp();
        if (minimumXp > maximumXp) {
            return List.of();
        }
        CreatureCatalogData.EncounterCandidateSpec spec = new CreatureCatalogData.EncounterCandidateSpec(
                safeCriteria.creatureTypes(),
                safeCriteria.creatureSubtypes(),
                safeCriteria.biomes(),
                minimumXp,
                maximumXp,
                normalizeLimit(safeCriteria.limit()));
        return creatureCatalogLookup.loadEncounterCandidates(spec).stream()
                .map(ApplicationEncounterCreatureRepository::toProfile)
                .toList();
    }

    private static int normalizeLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    private static EncounterCandidateProfile toProfile(CreatureCatalogData.EncounterCandidateProfile candidate) {
        return EncounterCandidateProfileHelper.fromFacts(new EncounterCreatureFacts(
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
                List.of()));
    }

    private static EncounterCreatureReference toReference(CreatureCatalogData.CreatureProfile detail) {
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
                detail.actions().stream()
                        .map(action -> action.actionType())
                        .toList());
    }
}

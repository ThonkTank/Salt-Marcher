package src.data.encounter.query;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.data.creatures.query.SqliteCreatureCatalogQueryAdapter;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.encounter.model.generation.helper.EncounterCandidateProfileHelper;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterCreatureFacts;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.reference.model.EncounterCreatureCandidateCriteria;
import src.domain.encounter.model.reference.model.EncounterCreatureReference;

public final class ApplicationEncounterCreatureRepository implements EncounterCreatureRepository {

    private static final int DEFAULT_LIMIT = 250;
    private static final int MAX_LIMIT = 1000;

    private final CreatureCatalogLookup creatureCatalogLookup;

    public ApplicationEncounterCreatureRepository() {
        this(new SqliteCreatureCatalogQueryAdapter());
    }

    ApplicationEncounterCreatureRepository(CreatureCatalogLookup creatureCatalogLookup) {
        this.creatureCatalogLookup = Objects.requireNonNull(creatureCatalogLookup, "creatureCatalogLookup");
    }

    @Override
    public Optional<EncounterCreatureReference> loadCreature(long creatureId) {
        if (creatureId <= 0L) {
            return Optional.empty();
        }
        return Optional.ofNullable(creatureCatalogLookup.loadCreatureDetail(creatureId))
                .map(EncounterCreatureReference::fromCatalogProfile);
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
        CreatureCatalogLookup.EncounterCandidateSpec spec = new CreatureCatalogLookup.EncounterCandidateSpec(
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

    private static EncounterCandidateProfile toProfile(CreatureCatalogLookup.EncounterCandidateProfile candidate) {
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
}

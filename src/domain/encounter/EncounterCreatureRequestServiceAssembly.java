package src.domain.encounter;

import java.util.List;
import java.util.Objects;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.RefreshCreatureEncounterCandidatesCommand;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encounter.model.reference.model.EncounterCreatureCandidateCriteria;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;

final class EncounterCreatureRequestServiceAssembly implements EncounterCreatureRepository {

    private static final int DEFAULT_LIMIT = 250;
    private static final int MAX_LIMIT = 1000;
    private static final long NO_CREATURE_ID = 0L;

    private final CreaturesApplicationService creatures;

    EncounterCreatureRequestServiceAssembly(CreaturesApplicationService creatures) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
    }

    @Override
    public void requestCreature(long creatureId) {
        if (creatureId > NO_CREATURE_ID) {
            creatures.selectCreatureDetail(new SelectCreatureDetailCommand(creatureId));
        }
    }

    @Override
    public void requestCandidates(EncounterCreatureCandidateCriteria criteria) {
        EncounterCreatureCandidateCriteria safeCriteria = criteria == null
                ? new EncounterCreatureCandidateCriteria(List.of(), List.of(), List.of(), 0, 0, 0)
                : criteria;
        int minimumXp = Math.max(0, safeCriteria.minimumXp());
        int maximumXp = safeCriteria.maximumXp() <= 0 ? Integer.MAX_VALUE : safeCriteria.maximumXp();
        if (minimumXp > maximumXp) {
            return;
        }
        creatures.refreshEncounterCandidates(new RefreshCreatureEncounterCandidatesCommand(
                safeCriteria.creatureTypes(),
                safeCriteria.creatureSubtypes(),
                safeCriteria.biomes(),
                minimumXp,
                maximumXp,
                normalizeLimit(safeCriteria.limit())));
    }

    private static int normalizeLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }
}

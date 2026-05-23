package src.domain.encounter.model.generation.usecase;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.helper.EncounterRoleClassificationHelper;
import src.domain.encounter.model.generation.model.EncounterCreatureFacts;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftEntry;
import src.domain.encounter.model.generation.model.EncounterDraftMetrics;
import src.domain.encounter.model.generation.model.EncounterGeneratedAlternative;
import src.domain.encounter.model.generation.model.EncounterRoleClassification;
import src.domain.encounter.model.generation.model.GeneratedEncounterCreatureData;
import src.domain.encounter.model.reference.model.EncounterCreatureReference;
import src.domain.encounter.model.reference.port.ApplicationEncounterCreatureCatalogPort;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;

public final class AssembleEncounterResultUseCase {

    private final EncounterCreatureRepository creatures;
    private final ApplicationEncounterCreatureCatalogPort creatureCatalog;

    public AssembleEncounterResultUseCase(
            EncounterCreatureRepository creatures,
            ApplicationEncounterCreatureCatalogPort creatureCatalog
    ) {
        this.creatures = creatures;
        this.creatureCatalog = creatureCatalog;
    }

    public List<EncounterGeneratedAlternative> assemble(List<EncounterDraft> drafts, int alternativeCount) {
        Map<Long, EncounterCreatureReference> detailCache = new LinkedHashMap<>();
        List<EncounterGeneratedAlternative> encounters = new ArrayList<>();
        int remainingAlternatives = alternativeCount;
        for (EncounterDraft draft : drafts) {
            if (remainingAlternatives <= 0) {
                break;
            }
            remainingAlternatives--;
            EncounterDraftMetrics metrics = draft.metrics();
            List<GeneratedEncounterCreatureData> creatures = new ArrayList<>();
            for (EncounterDraftEntry entry : draft.entries()) {
                EncounterCreatureReference detail = cachedCreatureDetail(detailCache, entry.creatureId());
                EncounterCreatureFacts facts = detail == null ? entry.facts() : detail.toFacts();
                EncounterRoleClassification classification = EncounterRoleClassificationHelper.classify(facts);
                creatures.add(new GeneratedEncounterCreatureData(
                        entry.creatureId(),
                        entry.creatureName(),
                        entry.challengeRating(),
                        entry.xp(),
                        entry.quantity(),
                        classification.role().label(),
                        classification.tags()));
            }
            encounters.add(new EncounterGeneratedAlternative(
                    draft.title(),
                    draft.achievedDifficulty(),
                    metrics.adjustedXp(),
                    creatures));
        }
        return encounters;
    }

    private @Nullable EncounterCreatureReference cachedCreatureDetail(
            Map<Long, EncounterCreatureReference> detailCache,
            long creatureId
    ) {
        EncounterCreatureReference cached = detailCache.get(creatureId);
        if (cached != null) {
            return cached;
        }
        EncounterCreatureReference loaded = loadCreatureDetailOrNull(creatureId);
        if (loaded != null) {
            detailCache.put(creatureId, loaded);
        }
        return loaded;
    }

    private @Nullable EncounterCreatureReference loadCreatureDetailOrNull(long creatureId) {
        creatures.requestCreature(creatureId);
        return creatureCatalog.loadCreature().orElse(null);
    }
}

package features.sessionplanner.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.encounter.api.GeneratedEncounterPlanImportCommand;
import features.encounter.api.GeneratedEncounterPlanImportResult;
import features.encounter.api.GeneratedEncounterPlanRole;
import features.encounter.api.GeneratedEncounterPlanSlotSpec;
import features.encounter.api.GeneratedEncounterPlanSource;
import features.encounter.api.GeneratedEncounterPlanSpec;
import features.sessiongeneration.api.GenerationResult;
import features.sessionplanner.domain.session.SessionEncounter;
import features.sessionplanner.domain.session.SessionEncounterAllocation;
import features.sessionplanner.domain.session.SessionGeneratedRewardReference;
import features.sessionplanner.domain.session.SessionPlan;

final class GeneratedSessionAssembly {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int ALLOCATION_SCALE = 4;

    private GeneratedSessionAssembly() {
    }

    static GeneratedEncounterPlanImportCommand toImportCommand(GenerationResult result) {
        List<GeneratedEncounterPlanSpec> plans = result.encounters().stream()
                .map(encounter -> new GeneratedEncounterPlanSpec(
                        encounter.encounterNumber(),
                        "Generierter Encounter " + encounter.encounterNumber(),
                        expandedSlots(encounter.blocks())))
                .toList();
        return new GeneratedEncounterPlanImportCommand(
                new GeneratedEncounterPlanSource(result.engineVersion(), result.runId().value()),
                plans);
    }

    static SessionPlan toSessionPlan(
            SessionPlan stable,
            GenerationResult result,
            List<GeneratedEncounterPlanImportResult.ImportedPlan> importedPlans
    ) {
        Map<Integer, Long> importedByNumber = new LinkedHashMap<>();
        importedPlans.forEach(plan -> importedByNumber.put(plan.encounterNumber(), plan.planId()));
        List<SessionEncounter> scenes = new ArrayList<>();
        Map<Integer, Long> encounterScenes = new LinkedHashMap<>();
        long targetTotal = result.encounters().stream().mapToLong(GenerationResult.Encounter::targetXp).sum();
        BigDecimal consumed = BigDecimal.ZERO;
        long nextSceneId = 1L;
        for (int index = 0; index < result.encounters().size(); index++) {
            GenerationResult.Encounter encounter = result.encounters().get(index);
            Long planId = importedByNumber.get(encounter.encounterNumber());
            if (planId == null) {
                throw new IllegalStateException("Imported encounter mapping is incomplete");
            }
            BigDecimal allocation = index == result.encounters().size() - 1
                    ? HUNDRED.subtract(consumed)
                    : BigDecimal.valueOf(encounter.targetXp())
                            .multiply(HUNDRED)
                            .divide(BigDecimal.valueOf(targetTotal), ALLOCATION_SCALE, RoundingMode.DOWN);
            consumed = consumed.add(allocation);
            scenes.add(new SessionEncounter(
                    nextSceneId,
                    planId.longValue(),
                    new SessionEncounterAllocation(allocation),
                    "Generierter Encounter " + encounter.encounterNumber(),
                    encounter.monsterSummary(),
                    0L));
            encounterScenes.put(encounter.encounterNumber(), nextSceneId++);
        }
        List<SessionGeneratedRewardReference> rewards = new ArrayList<>();
        for (GenerationResult.Treasure treasure : result.treasures()) {
            long sceneId;
            if (treasure.channel() == GenerationResult.RewardChannel.ENCOUNTER) {
                Long anchor = encounterScenes.get(treasure.anchorEncounterNumber());
                if (anchor == null) {
                    throw new IllegalStateException("Generated encounter reward has no scene anchor");
                }
                sceneId = anchor.longValue();
            } else {
                sceneId = nextSceneId++;
                scenes.add(new SessionEncounter(
                        sceneId,
                        0L,
                        SessionEncounterAllocation.zero(),
                        treasure.channel() == GenerationResult.RewardChannel.QUEST
                                ? "Quest-Belohnung"
                                : "Umgebungsfund",
                        treasure.theme(),
                        0L));
            }
            rewards.add(new SessionGeneratedRewardReference(
                    sceneId,
                    result.runId().value(),
                    treasure.treasureId(),
                    SessionGenerationPreviewProjection.rewardLabel(treasure, result.lootItems())));
        }
        return stable.replaceGeneratedContent(scenes, rewards);
    }

    private static List<GeneratedEncounterPlanSlotSpec> expandedSlots(
            List<GenerationResult.EncounterBlock> blocks
    ) {
        List<GeneratedEncounterPlanSlotSpec> slots = new ArrayList<>();
        for (GenerationResult.EncounterBlock block : blocks) {
            for (int count = 0; count < block.count(); count++) {
                slots.add(new GeneratedEncounterPlanSlotSpec(
                        block.monsterXp(),
                        GeneratedEncounterPlanRole.valueOf(block.requestedRole().name())));
            }
        }
        return List.copyOf(slots);
    }
}

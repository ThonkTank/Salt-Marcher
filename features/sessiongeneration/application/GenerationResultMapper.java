package features.sessiongeneration.application;

import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.domain.generation.GeneratedRun;

final class GenerationResultMapper {

    private GenerationResultMapper() {
    }

    static GenerationResult toApi(GeneratedRun run) {
        return new GenerationResult(
                new GenerationRunId(run.runId()),
                run.engineVersion(),
                run.catalogVersion(),
                run.catalogContentHash(),
                run.seed(),
                new GenerationResult.SessionSummary(
                        run.session().partyCount(), run.session().adventureDayFraction(),
                        run.session().encounterCount(), run.session().dayXpBudget(),
                        run.session().sessionXpTarget(), run.session().averageLevel(),
                        run.session().normalBudgetCp(), run.session().overstockBudgetCp(),
                        run.session().nonMagicSlots(), run.session().normalMagic(),
                        run.session().overstockMagic(), run.session().treasureCount()),
                run.encounterTargets().stream().map(target -> new GenerationResult.EncounterTarget(
                        target.encounterNumber(), target.targetXp())).toList(),
                run.encounters().stream().map(encounter -> new GenerationResult.Encounter(
                        encounter.encounterNumber(), encounter.targetXp(), encounter.adjustedXp(),
                        GenerationResult.Difficulty.valueOf(encounter.difficulty().name()), encounter.candidateId(),
                        encounter.monsterSummary(), encounter.monsterCount(), encounter.multiplier(),
                        encounter.blocks().stream().map(block -> new GenerationResult.EncounterBlock(
                                encounterRole(block.role()),
                                block.challengeCode(), block.challengeLabel(), block.unitXp(), block.quantity()))
                                .toList())).toList(),
                run.treasures().stream().map(treasure -> new GenerationResult.Treasure(
                        treasure.treasureId(), GenerationResult.StockClass.valueOf(treasure.stockClass().name()),
                        GenerationResult.RewardChannel.valueOf(treasure.channel().name()),
                        treasure.anchorEncounterNumber(), treasure.theme(), treasure.magicType(), treasure.targetCp(),
                        treasure.nonMagicSlots(), treasure.magicSlots())).toList(),
                run.loot().stream().map(line -> new GenerationResult.LootItem(
                        line.lineId(), line.treasureId(), GenerationResult.LootRole.valueOf(line.role().name()),
                        line.itemId(), line.text(), line.quantity(), line.unitCp(), line.actualCp(),
                        line.totalCapacity(), line.allowedContainers(), line.magicRarity(), line.cursed())).toList(),
                run.packing().stream().map(row -> new GenerationResult.Packing(
                        row.lineId(), row.treasureId(), row.containerType(), row.containerCount(),
                        row.containerId(), row.valid())).toList(),
                new GenerationResult.RewardSummary(
                        run.rewards().normalActualCp(), run.rewards().overstockActualCp(), run.rewards().magicCount()),
                run.formattedText(),
                run.audits().stream().map(audit -> new GenerationResult.Audit(
                        audit.code(), GenerationResult.AuditStatus.valueOf(audit.status().name()), audit.detail()))
                        .toList());
    }

    private static GenerationResult.EncounterRole encounterRole(GeneratedRun.EncounterRole role) {
        return switch (role) {
            case MINION -> GenerationResult.EncounterRole.MINION;
            case SUPPORT -> GenerationResult.EncounterRole.SUPPORT;
            case STANDARD -> GenerationResult.EncounterRole.STANDARD;
            case ELITE -> GenerationResult.EncounterRole.ELITE;
            case BOSS -> GenerationResult.EncounterRole.BOSS;
        };
    }
}

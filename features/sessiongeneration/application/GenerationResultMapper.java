package features.sessiongeneration.application;

import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GeneratedRunDraft;

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
                run.party().stream().map(value -> new GenerationResult.PartyLevel(
                        value.level(), value.players())).toList(),
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
                        encounter.maxChallengeCode(), encounter.bossScore(),
                        encounter.blocks().stream().map(block -> new GenerationResult.EncounterBlock(
                                block.id(),
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

    static GeneratedRunDraft toDomain(features.sessiongeneration.api.GenerationDraft draft) {
        GenerationResult result = draft.result();
        GeneratedRun run = new GeneratedRun(
                result.runId().value(), result.engineVersion(), result.catalogVersion(), result.catalogContentHash(),
                result.seed(),
                result.party().stream().map(value -> new GeneratedRun.PartyLevel(
                        value.level(), value.players())).toList(),
                new GeneratedRun.SessionContext(
                        result.session().partyCount(), result.session().adventureDayFraction(),
                        result.session().encounterCount(), result.session().dayXpBudget(),
                        result.session().sessionXpTarget(), result.session().averageLevel(),
                        result.session().normalBudgetCp(), result.session().overstockBudgetCp(),
                        result.session().nonMagicSlots(), result.session().normalMagic(),
                        result.session().overstockMagic(), result.session().treasureCount()),
                result.encounterTargets().stream().map(value -> new GeneratedRun.EncounterTarget(
                        value.encounterNumber(), value.targetXp())).toList(),
                result.encounters().stream().map(value -> new GeneratedRun.EncounterPlan(
                        value.encounterNumber(), value.targetXp(), value.adjustedXp(),
                        GeneratedRun.Difficulty.valueOf(value.difficulty().name()), value.candidateId(),
                        value.monsterSummary(), value.monsterCount(), value.multiplier(), value.maxChallengeCode(),
                        value.bossScore(), value.blocks().stream().map(block -> new GeneratedRun.EncounterBlock(
                                block.id(), GeneratedRun.EncounterRole.valueOf(block.requestedRole().name()),
                                block.challengeCode(), block.challengeLabel(), block.monsterXp(), block.count()))
                                .toList())).toList(),
                result.treasures().stream().map(value -> new GeneratedRun.TreasurePlan(
                        value.treasureId(), GeneratedRun.StockClass.valueOf(value.stockClass().name()),
                        GeneratedRun.RewardChannel.valueOf(value.channel().name()), value.anchorEncounterNumber(),
                        value.theme(), value.magicType(), value.targetCp(), value.nonMagicSlots(), value.magicSlots()))
                        .toList(),
                result.lootItems().stream().map(value -> new GeneratedRun.LootLine(
                        value.lineId(), value.treasureId(), GeneratedRun.LootRole.valueOf(value.role().name()),
                        value.itemId(), value.text(), value.quantity(), value.unitCp(), value.actualCp(),
                        value.totalCapacity(), value.allowedContainers(), value.magicRarity(), value.cursed())).toList(),
                result.packing().stream().map(value -> new GeneratedRun.PackingRow(
                        value.lineId(), value.treasureId(), value.containerType(), value.containerCount(),
                        value.containerId(), value.valid())).toList(),
                new GeneratedRun.RewardSummary(
                        result.rewards().normalActualCp(), result.rewards().overstockActualCp(),
                        result.rewards().magicCount()),
                result.formattedText(),
                result.audits().stream().map(value -> new GeneratedRun.Audit(
                        value.code(), GeneratedRun.AuditStatus.valueOf(value.status().name()), value.detail())).toList());
        return new GeneratedRunDraft(run, draft.contentFingerprint());
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

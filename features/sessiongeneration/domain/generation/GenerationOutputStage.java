package features.sessiongeneration.domain.generation;

import static features.sessiongeneration.domain.generation.GeneratedRun.AuditStatus.FAIL;
import static features.sessiongeneration.domain.generation.GeneratedRun.AuditStatus.PASS;
import static features.sessiongeneration.domain.generation.GeneratedRun.AuditStatus.WARNING;

import features.sessiongeneration.domain.generation.GeneratedRun.Audit;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterPlan;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterTarget;
import features.sessiongeneration.domain.generation.GeneratedRun.LootLine;
import features.sessiongeneration.domain.generation.GeneratedRun.LootRole;
import features.sessiongeneration.domain.generation.GeneratedRun.PackingRow;
import features.sessiongeneration.domain.generation.GeneratedRun.RewardChannel;
import features.sessiongeneration.domain.generation.GeneratedRun.RewardSummary;
import features.sessiongeneration.domain.generation.GeneratedRun.StockClass;
import features.sessiongeneration.domain.generation.GeneratedRun.TreasurePlan;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class GenerationOutputStage {

    RewardSummary summarize(List<TreasurePlan> treasures, List<LootLine> loot) {
        Map<Integer, StockClass> stock = new HashMap<>();
        treasures.forEach(treasure -> stock.put(treasure.treasureId(), treasure.stockClass()));
        long normal = loot.stream().filter(line -> stock.get(line.treasureId()) == StockClass.NORMAL)
                .mapToLong(LootLine::actualCp).sum();
        long overstock = loot.stream().filter(line -> stock.get(line.treasureId()) == StockClass.OVERSTOCK)
                .mapToLong(LootLine::actualCp).sum();
        int magic = (int) loot.stream().filter(line -> line.role() == LootRole.MAGIC).count();
        return new RewardSummary(normal, overstock, magic);
    }

    String format(
            List<EncounterPlan> encounters,
            List<TreasurePlan> treasures,
            List<LootLine> loot,
            RewardSummary rewards
    ) {
        NumberFormat numbers = NumberFormat.getIntegerInstance(Locale.GERMANY);
        StringBuilder output = new StringBuilder();
        output.append("Rewards: ").append(numbers.format(Math.round(rewards.normalActualCp() / 100.0))).append(" gp");
        if (rewards.overstockActualCp() > 0L) {
            output.append(" + ").append(numbers.format(Math.round(rewards.overstockActualCp() / 100.0)))
                    .append(" gp Overstock");
        }
        output.append("\nMagic Items: ").append(rewards.magicCount()).append("\n\n");
        for (EncounterPlan encounter : encounters) {
            output.append(encounter.encounterNumber()).append(". ").append(encounter.difficulty())
                    .append(" [").append(numbers.format(encounter.adjustedXp())).append(" XP]: ")
                    .append(encounter.monsterSummary()).append("\n   Loot\n");
            List<Integer> treasureIds = treasures.stream()
                    .filter(treasure -> treasure.channel() == RewardChannel.ENCOUNTER
                            && treasure.anchorEncounterNumber() == encounter.encounterNumber())
                    .map(TreasurePlan::treasureId).toList();
            List<LootLine> encounterLoot = loot.stream().filter(line -> treasureIds.contains(line.treasureId())).toList();
            if (encounterLoot.isEmpty()) {
                output.append("   —\n\n");
            } else {
                encounterLoot.forEach(line -> output.append("   ").append(line.text()).append('\n'));
                output.append('\n');
            }
        }
        return output.toString().trim();
    }

    List<Audit> audit(GeneratedRun run, boolean completeCandidateCoverage) {
        List<Audit> audits = new ArrayList<>();
        add(audits, "party-count",
                run.session().partyCount() == run.party().stream().mapToInt(GeneratedRun.PartyLevel::players).sum());
        add(audits, "encounter-target-sum",
                run.encounterTargets().stream().mapToLong(EncounterTarget::targetXp).sum()
                        == run.session().sessionXpTarget());
        add(audits, "candidate-coverage", completeCandidateCoverage);
        add(audits, "one-plan-per-target", run.encounters().size() == run.encounterTargets().size());
        add(audits, "treasure-count", run.treasures().size() == run.session().treasureCount());
        add(audits, "quest-cap",
                run.treasures().stream().filter(treasure -> treasure.channel() == RewardChannel.QUEST).count() <= 1);
        add(audits, "encounter-anchor-uniqueness",
                run.treasures().stream().filter(treasure -> treasure.anchorEncounterNumber() > 0)
                        .map(TreasurePlan::anchorEncounterNumber).distinct().count()
                        == run.treasures().stream().filter(treasure -> treasure.anchorEncounterNumber() > 0).count());
        add(audits, "slot-total", run.treasures().stream().mapToInt(TreasurePlan::nonMagicSlots).sum()
                == run.session().nonMagicSlots());
        add(audits, "slot-curve", nonIncreasing(
                run.treasures().stream().map(TreasurePlan::nonMagicSlots).toList()));
        add(audits, "magic-count", run.loot().stream().filter(line -> line.role() == LootRole.MAGIC).count()
                == run.session().normalMagic() + run.session().overstockMagic());
        add(audits, "magic-on-top", run.loot().stream().filter(line -> line.role() == LootRole.MAGIC)
                .allMatch(line -> line.actualCp() == 0L && line.unitCp() == 0L));
        add(audits, "nonmagic-draws", run.loot().stream().filter(line -> line.role() != LootRole.MAGIC)
                .allMatch(line -> !line.itemId().isBlank() && !line.text().isBlank()));
        add(audits, "nonmagic-overfit", nonMagicWithinCurrentBudgets(run));
        add(audits, "treasure-budget-tolerance", treasureBudgetsWithinTolerance(run));
        add(audits, "packing-valid", run.packing().stream().allMatch(PackingRow::valid));
        add(audits, "unique-line-ids", run.loot().stream().map(LootLine::lineId).distinct().count() == run.loot().size());
        add(audits, "final-output", !run.formattedText().isBlank());
        long unresolvedFallbacks = run.loot().stream().filter(line -> line.text().contains("[unresolved]")).count();
        if (unresolvedFallbacks > 0L) {
            audits.add(new Audit(
                    "unresolved-fallback",
                    WARNING,
                    unresolvedFallbacks + " catalog-backed selections used a documented fallback"));
        }
        return List.copyOf(audits);
    }

    private static void add(List<Audit> audits, String code, boolean passes) {
        audits.add(new Audit(code, passes ? PASS : FAIL, passes ? "" : "invariant violated"));
    }

    private static boolean nonIncreasing(List<Integer> values) {
        for (int index = 1; index < values.size(); index++) {
            if (values.get(index) > values.get(index - 1)) return false;
        }
        return true;
    }

    private static boolean nonMagicWithinCurrentBudgets(GeneratedRun run) {
        for (TreasurePlan treasure : run.treasures()) {
            List<LootLine> lines = run.loot().stream()
                    .filter(line -> line.treasureId() == treasure.treasureId() && line.role() != LootRole.MAGIC)
                    .toList();
            long spent = 0L;
            for (int index = 0; index < lines.size(); index++) {
                long available = Math.max(0L, (treasure.targetCp() - spent) / (lines.size() - index));
                if (lines.get(index).actualCp() > Math.round(available * 1.05)) return false;
                spent += lines.get(index).actualCp();
            }
        }
        return true;
    }

    private static boolean treasureBudgetsWithinTolerance(GeneratedRun run) {
        for (TreasurePlan treasure : run.treasures()) {
            long actual = run.loot().stream().filter(line -> line.treasureId() == treasure.treasureId())
                    .mapToLong(LootLine::actualCp).sum();
            if (treasure.targetCp() > 0L
                    && Math.abs(actual - treasure.targetCp()) / (double) treasure.targetCp() > 0.15) return false;
        }
        return true;
    }
}

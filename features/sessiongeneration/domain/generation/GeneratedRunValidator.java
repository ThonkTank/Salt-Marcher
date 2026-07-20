package features.sessiongeneration.domain.generation;

import features.sessiongeneration.domain.generation.GeneratedRun.AuditStatus;
import features.sessiongeneration.domain.generation.GeneratedRun.LootRole;
import features.sessiongeneration.domain.generation.GeneratedRun.RewardChannel;
import features.sessiongeneration.domain.generation.GeneratedRun.StockClass;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.ToIntFunction;

public final class GeneratedRunValidator {

    public void validate(GeneratedRun run) {
        Objects.requireNonNull(run, "run");
        required(run.runId(), "run id");
        required(run.engineVersion(), "engine version");
        required(run.catalogVersion(), "catalog version");
        required(run.catalogContentHash(), "catalog content hash");
        require(run.seed() >= 0L, "seed must not be negative");
        validateParty(run);
        validateSession(run);
        validateEncounters(run);
        Map<Integer, StockClass> treasureStock = validateTreasures(run);
        Map<Integer, GeneratedRun.LootLine> loot = validateLoot(run, treasureStock);
        validatePacking(run, loot);
        validateRewards(run, treasureStock);
        validateAudits(run);
        required(run.formattedText(), "formatted output");
    }

    private static void validateParty(GeneratedRun run) {
        require(!run.party().isEmpty(), "party must not be empty");
        int previousLevel = 0;
        int players = 0;
        for (GeneratedRun.PartyLevel entry : run.party()) {
            require(entry.level() >= 1 && entry.level() <= 20, "party level is invalid");
            require(entry.level() > previousLevel, "party levels must be strictly ordered and unique");
            require(entry.players() > 0, "party player count must be positive");
            previousLevel = entry.level();
            players += entry.players();
        }
        require(players == run.session().partyCount(), "party count does not match party rows");
    }

    private static void validateSession(GeneratedRun run) {
        GeneratedRun.SessionContext session = Objects.requireNonNull(run.session(), "session");
        require(nonNegative(session.adventureDayFraction()), "adventure-day fraction is invalid");
        require(session.encounterCount() > 0, "encounter count must be positive");
        require(session.dayXpBudget() > 0L && session.sessionXpTarget() > 0L, "XP budgets must be positive");
        require(nonNegative(session.averageLevel()), "average level is invalid");
        require(session.normalBudgetCp() >= 0L && session.overstockBudgetCp() >= 0L,
                "reward budgets must not be negative");
        require(session.nonMagicSlots() >= 0 && session.normalMagic() >= 0 && session.overstockMagic() >= 0,
                "reward counts must not be negative");
        require(session.treasureCount() >= 0, "treasure count must not be negative");
    }

    private static void validateEncounters(GeneratedRun run) {
        require(run.encounterTargets().size() == run.session().encounterCount(),
                "encounter targets do not match session count");
        require(run.encounters().size() == run.encounterTargets().size(),
                "encounter plans do not match targets");
        requireSequential(run.encounterTargets(), GeneratedRun.EncounterTarget::encounterNumber, "encounter targets");
        requireSequential(run.encounters(), GeneratedRun.EncounterPlan::encounterNumber, "encounter plans");
        Map<Integer, Long> targets = new HashMap<>();
        run.encounterTargets().forEach(target -> {
            require(target.targetXp() > 0L, "encounter target XP must be positive");
            targets.put(target.encounterNumber(), target.targetXp());
        });
        for (GeneratedRun.EncounterPlan encounter : run.encounters()) {
            require(Objects.equals(targets.get(encounter.encounterNumber()), encounter.targetXp()),
                    "encounter plan target does not match target row");
            require(encounter.adjustedXp() > 0L && encounter.monsterCount() > 0,
                    "encounter result values must be positive");
            require(nonNegative(encounter.multiplier()) && nonNegative(encounter.bossScore()),
                    "encounter decimal values are invalid");
            required(encounter.candidateId(), "candidate id");
            required(encounter.monsterSummary(), "monster summary");
            require(!encounter.blocks().isEmpty(), "encounter blocks must not be empty");
            Set<String> blockIds = new HashSet<>();
            int monsterCount = 0;
            for (GeneratedRun.EncounterBlock block : encounter.blocks()) {
                require(blockIds.add(required(block.id(), "block id")), "encounter block ids must be unique");
                Objects.requireNonNull(block.role(), "encounter role");
                required(block.challengeLabel(), "challenge label");
                require(block.unitXp() > 0L && block.quantity() > 0, "encounter block values must be positive");
                monsterCount += block.quantity();
            }
            require(monsterCount == encounter.monsterCount(), "encounter monster count does not match blocks");
        }
    }

    private static Map<Integer, StockClass> validateTreasures(GeneratedRun run) {
        require(run.treasures().size() == run.session().treasureCount(),
                "treasure rows do not match session count");
        requireSequential(run.treasures(), GeneratedRun.TreasurePlan::treasureId, "treasures");
        Set<Integer> encounterNumbers = new HashSet<>();
        run.encounters().forEach(encounter -> encounterNumbers.add(encounter.encounterNumber()));
        Map<Integer, StockClass> stock = new HashMap<>();
        for (GeneratedRun.TreasurePlan treasure : run.treasures()) {
            Objects.requireNonNull(treasure.stockClass(), "stock class");
            Objects.requireNonNull(treasure.channel(), "reward channel");
            required(treasure.theme(), "treasure theme");
            require(treasure.targetCp() >= 0L && treasure.nonMagicSlots() >= 0 && treasure.magicSlots() >= 0,
                    "treasure values must not be negative");
            if (treasure.channel() == RewardChannel.ENCOUNTER) {
                require(encounterNumbers.contains(treasure.anchorEncounterNumber()),
                        "encounter treasure anchor is invalid");
            } else {
                require(treasure.anchorEncounterNumber() == 0, "non-encounter treasure must not have an anchor");
            }
            stock.put(treasure.treasureId(), treasure.stockClass());
        }
        return stock;
    }

    private static Map<Integer, GeneratedRun.LootLine> validateLoot(
            GeneratedRun run,
            Map<Integer, StockClass> treasureStock
    ) {
        requireSequential(run.loot(), GeneratedRun.LootLine::lineId, "loot lines");
        Map<Integer, GeneratedRun.LootLine> lines = new HashMap<>();
        for (GeneratedRun.LootLine line : run.loot()) {
            require(treasureStock.containsKey(line.treasureId()), "loot treasure reference is invalid");
            Objects.requireNonNull(line.role(), "loot role");
            required(line.itemId(), "loot item id");
            required(line.text(), "loot display text");
            require(line.quantity() > 0L && line.unitCp() >= 0L && line.actualCp() >= 0L,
                    "loot values are invalid");
            require(nonNegative(line.totalCapacity()), "loot capacity is invalid");
            lines.put(line.lineId(), line);
        }
        return lines;
    }

    private static void validatePacking(
            GeneratedRun run,
            Map<Integer, GeneratedRun.LootLine> loot
    ) {
        require(run.packing().size() == loot.size(), "every loot line must have one packing row");
        Set<Integer> packedLines = new HashSet<>();
        int expectedLineId = 1;
        for (GeneratedRun.PackingRow row : run.packing()) {
            require(row.lineId() == expectedLineId++, "packing rows must follow loot-line order");
            GeneratedRun.LootLine line = loot.get(row.lineId());
            require(line != null && line.treasureId() == row.treasureId(), "packing loot reference is invalid");
            require(packedLines.add(row.lineId()), "packing line ids must be unique");
            required(row.containerType(), "packing container type");
            required(row.containerId(), "packing container id");
            boolean loose = row.containerType().equals("none")
                    && row.containerId().equals("none")
                    && row.containerCount() == 0;
            require((loose || row.containerCount() > 0) && row.valid(), "packing row is invalid");
        }
    }

    private static void validateRewards(GeneratedRun run, Map<Integer, StockClass> treasureStock) {
        long normal = 0L;
        long overstock = 0L;
        int magic = 0;
        for (GeneratedRun.LootLine line : run.loot()) {
            if (treasureStock.get(line.treasureId()) == StockClass.NORMAL) normal += line.actualCp();
            else overstock += line.actualCp();
            if (line.role() == LootRole.MAGIC) magic++;
        }
        require(run.rewards().normalActualCp() == normal
                        && run.rewards().overstockActualCp() == overstock
                        && run.rewards().magicCount() == magic,
                "reward summary does not match loot rows");
    }

    private static void validateAudits(GeneratedRun run) {
        require(!run.audits().isEmpty(), "audits must not be empty");
        Set<String> codes = new HashSet<>();
        for (GeneratedRun.Audit audit : run.audits()) {
            require(codes.add(required(audit.code(), "audit code")), "audit codes must be unique");
            Objects.requireNonNull(audit.status(), "audit status");
            Objects.requireNonNull(audit.detail(), "audit detail");
            require(audit.status() != AuditStatus.FAIL, "failed generation audits must not be persisted");
        }
    }

    private static <T> void requireSequential(List<T> values, ToIntFunction<T> identity, String name) {
        int expected = 1;
        for (T value : values) {
            require(identity.applyAsInt(value) == expected++, name + " must be ordered and sequential");
        }
    }

    private static boolean nonNegative(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) >= 0;
    }

    private static String required(String value, String name) {
        require(value != null && !value.isBlank(), name + " must not be blank");
        return value;
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException(message);
    }
}

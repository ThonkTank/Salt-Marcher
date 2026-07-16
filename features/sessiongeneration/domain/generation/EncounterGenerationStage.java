package features.sessiongeneration.domain.generation;

import features.sessiongeneration.domain.catalog.GenerationCatalog.CatalogSnapshot;
import features.sessiongeneration.domain.catalog.GenerationCatalog.ChallengeRank;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Pattern;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Progression;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Role;
import features.sessiongeneration.domain.catalog.GenerationCatalog.RoleBand;
import features.sessiongeneration.domain.generation.GeneratedRun.Difficulty;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterBlock;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterPlan;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterTarget;
import features.sessiongeneration.domain.generation.GeneratedRun.PartyLevel;
import features.sessiongeneration.domain.generation.GeneratedRun.SessionContext;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class EncounterGenerationStage {

    Result generate(GenerationInput input, CatalogSnapshot catalog, SessionContext session) {
        List<EncounterTarget> targets = allocateTargets(input, catalog, session);
        List<Candidate> candidates = buildCandidates(targets, session, catalog);
        List<EncounterPlan> selected = select(targets, candidates, input.seed());
        return new Result(targets, withBossScores(selected, input), selected.size() == targets.size());
    }

    private static List<EncounterTarget> allocateTargets(
            GenerationInput input,
            CatalogSnapshot catalog,
            SessionContext session
    ) {
        if (session.encounterCount() == 1) return List.of(new EncounterTarget(1, session.sessionXpTarget()));
        Map<Integer, Progression> byLevel = new HashMap<>();
        catalog.progression().forEach(row -> byLevel.put(row.level(), row));
        long medium = 0L;
        long hard = 0L;
        long deadly = 0L;
        for (PartyLevel partyLevel : input.party()) {
            Progression row = byLevel.get(partyLevel.level());
            if (row == null) throw new IllegalStateException("missing progression level " + partyLevel.level());
            medium += row.mediumXp() * partyLevel.players();
            hard += row.hardXp() * partyLevel.players();
            deadly += row.deadlyXp() * partyLevel.players();
        }
        List<BigDecimal> raw = new ArrayList<>();
        raw.add(BigDecimal.valueOf(medium).multiply(new BigDecimal("0.85")));
        for (int index = 1; index < session.encounterCount() - 1; index++) {
            BigDecimal fraction = BigDecimal.valueOf(index)
                    .divide(BigDecimal.valueOf(session.encounterCount() - 1L), 12, RoundingMode.HALF_UP);
            raw.add(BigDecimal.valueOf(medium).add(BigDecimal.valueOf(hard - medium).multiply(fraction)));
        }
        raw.add(BigDecimal.valueOf(deadly));
        BigDecimal total = raw.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        List<EncounterTarget> result = new ArrayList<>();
        long allocated = 0L;
        for (int index = 0; index < raw.size(); index++) {
            long target = index == raw.size() - 1
                    ? session.sessionXpTarget() - allocated
                    : GenerationMath.rounded(raw.get(index).multiply(BigDecimal.valueOf(session.sessionXpTarget()))
                            .divide(total, 12, RoundingMode.HALF_UP));
            result.add(new EncounterTarget(index + 1, target));
            allocated += target;
        }
        return List.copyOf(result);
    }

    private static List<Candidate> buildCandidates(
            List<EncounterTarget> targets,
            SessionContext session,
            CatalogSnapshot catalog
    ) {
        int partyLevel = GenerationMath.clamp(
                session.averageLevel().setScale(0, RoundingMode.HALF_UP).intValue(), 1, 20);
        Map<String, ChallengeRank> ranks = new HashMap<>();
        catalog.challengeRanks().forEach(rank -> ranks.put(rank.id(), rank));
        Map<Role, List<ChallengeRank>> ranksByRole = new EnumMap<>(Role.class);
        for (RoleBand band : catalog.roleBands()) {
            if (band.partyLevel() == partyLevel) {
                ranksByRole.computeIfAbsent(band.role(), ignored -> new ArrayList<>())
                        .add(ranks.get(band.challengeRankId()));
            }
        }
        List<Candidate> all = new ArrayList<>();
        List<Pattern> patterns = catalog.patterns().stream()
                .sorted(Comparator.comparingInt(Pattern::sortOrder)).toList();
        for (EncounterTarget target : targets) {
            for (Pattern pattern : patterns) {
                List<List<EncounterBlock>> pools = new ArrayList<>();
                for (Role role : pattern.roles()) {
                    double desired = target.targetXp() / (double) pattern.roles().size();
                    List<EncounterBlock> blocks = blocks(
                            role, ranksByRole.getOrDefault(role, List.of()), target.targetXp()).stream()
                            .sorted(Comparator.comparingDouble(block -> Math.abs(adjustedBlockXp(block) - desired)))
                            .limit(4).toList();
                    if (blocks.isEmpty()) {
                        pools.clear();
                        break;
                    }
                    pools.add(blocks);
                }
                if (pools.size() == pattern.roles().size()) combine(target, pools, 0, new ArrayList<>(), all);
            }
        }
        return List.copyOf(all);
    }

    private static List<EncounterBlock> blocks(Role role, List<ChallengeRank> ranks, long target) {
        int minimum = switch (role) {
            case MINION -> 4;
            case SUPPORT -> 2;
            default -> 1;
        };
        int maximum = switch (role) {
            case MINION -> 10;
            case SUPPORT, STANDARD -> 5;
            case ELITE -> 2;
            case BOSS -> 1;
            default -> 1;
        };
        List<EncounterBlock> result = new ArrayList<>();
        for (ChallengeRank rank : ranks) {
            for (int quantity = minimum; quantity <= maximum; quantity++) {
                EncounterBlock block = new EncounterBlock(
                        GenerationMath.title(role) + "_CR" + rank.label().replace('/', '_') + "_Nr" + quantity,
                        encounterRole(role), rank.code(), rank.label(), rank.xp(), quantity);
                if (adjustedBlockXp(block) <= target * 1.05) result.add(block);
            }
        }
        return result;
    }

    private static GeneratedRun.EncounterRole encounterRole(Role role) {
        return switch (role) {
            case MINION -> GeneratedRun.EncounterRole.MINION;
            case SUPPORT -> GeneratedRun.EncounterRole.SUPPORT;
            case STANDARD -> GeneratedRun.EncounterRole.STANDARD;
            case ELITE -> GeneratedRun.EncounterRole.ELITE;
            case BOSS -> GeneratedRun.EncounterRole.BOSS;
            case CARRIER, USEFUL, FLAVOR -> throw new IllegalArgumentException("Loot role is not an encounter role");
        };
    }

    private static double adjustedBlockXp(EncounterBlock block) {
        return block.unitXp() * block.quantity() * GenerationMath.multiplier(block.quantity());
    }

    private static void combine(
            EncounterTarget target,
            List<List<EncounterBlock>> pools,
            int index,
            List<EncounterBlock> selected,
            List<Candidate> output
    ) {
        if (index < pools.size()) {
            for (EncounterBlock block : pools.get(index)) {
                selected.add(block);
                combine(target, pools, index + 1, selected, output);
                selected.removeLast();
            }
            return;
        }
        long maxUnit = selected.stream().mapToLong(EncounterBlock::unitXp).max().orElseThrow();
        double effectiveCount = selected.stream()
                .mapToDouble(block -> block.quantity() * Math.sqrt(block.unitXp() / (double) maxUnit)).sum();
        double multiplier = GenerationMath.multiplier(effectiveCount);
        long rawXp = selected.stream().mapToLong(block -> block.unitXp() * block.quantity()).sum();
        long adjusted = GenerationMath.rounded(BigDecimal.valueOf(rawXp).multiply(BigDecimal.valueOf(multiplier)));
        String id = target.encounterNumber() + ":" + selected.stream().map(EncounterBlock::id)
                .reduce((left, right) -> left + "|" + right).orElseThrow();
        output.add(new Candidate(
                target.encounterNumber(), id, List.copyOf(selected), adjusted, adjusted - target.targetXp(),
                selected.stream().mapToInt(EncounterBlock::quantity).sum(), BigDecimal.valueOf(multiplier)));
    }

    private static List<EncounterPlan> select(List<EncounterTarget> targets, List<Candidate> candidates, long seed) {
        List<EncounterPlan> result = new ArrayList<>();
        for (EncounterTarget target : targets) {
            List<Candidate> ordered = candidates.stream()
                    .filter(candidate -> candidate.encounterNumber() == target.encounterNumber())
                    .sorted(Comparator.comparingLong((Candidate candidate) -> Math.abs(candidate.delta()))
                            .thenComparing(Candidate::id)).toList();
            if (ordered.isEmpty()) continue;
            List<Candidate> fits = ordered.stream()
                    .filter(candidate -> Math.abs(candidate.delta()) <= target.targetXp() * 0.05).toList();
            List<Candidate> pool = (fits.isEmpty() ? ordered : fits).stream().limit(3).toList();
            Candidate selected = pool.get((int) Math.floorMod(seed + target.encounterNumber() * 719L, pool.size()));
            String monsters = selected.blocks().stream()
                    .map(block -> block.quantity() + "x CR " + block.challengeLabel())
                    .reduce((left, right) -> left + ", " + right).orElse("");
            int maxCode = selected.blocks().stream().mapToInt(EncounterBlock::challengeCode).max().orElse(-3);
            result.add(new EncounterPlan(
                    target.encounterNumber(), target.targetXp(), selected.adjustedXp(),
                    difficulty(target.encounterNumber(), targets.size()), selected.id(), monsters,
                    selected.monsterCount(), selected.multiplier(), maxCode, BigDecimal.ZERO, selected.blocks()));
        }
        return List.copyOf(result);
    }

    private static Difficulty difficulty(int number, int count) {
        if (count == 1 || number == count) return Difficulty.DEADLY;
        if (number == 1) return Difficulty.EASY;
        return number / (double) (count + 1) <= 0.5 ? Difficulty.MEDIUM : Difficulty.HARD;
    }

    private static List<EncounterPlan> withBossScores(List<EncounterPlan> encounters, GenerationInput input) {
        long totalAdjusted = encounters.stream().mapToLong(EncounterPlan::adjustedXp).sum();
        int maxLevel = input.party().stream().filter(entry -> entry.players() > 0)
                .mapToInt(PartyLevel::level).max().orElse(1);
        List<EncounterPlan> result = new ArrayList<>();
        for (EncounterPlan encounter : encounters) {
            BigDecimal xpShare = BigDecimal.valueOf(encounter.adjustedXp())
                    .divide(BigDecimal.valueOf(Math.max(1L, totalAdjusted)), 12, RoundingMode.HALF_UP);
            BigDecimal difficulty = BigDecimal.valueOf(switch (encounter.difficulty()) {
                case EASY -> 1.0;
                case MEDIUM -> 1.5;
                case HARD -> 2.0;
                case DEADLY -> 3.0;
            });
            BigDecimal challenge = BigDecimal.valueOf(Math.min(
                    2.5, 1 + encounter.maxChallengeCode() / (double) Math.max(1, maxLevel)));
            result.add(new EncounterPlan(
                    encounter.encounterNumber(), encounter.targetXp(), encounter.adjustedXp(), encounter.difficulty(),
                    encounter.candidateId(), encounter.monsterSummary(), encounter.monsterCount(), encounter.multiplier(),
                    encounter.maxChallengeCode(), xpShare.multiply(difficulty).multiply(challenge), encounter.blocks()));
        }
        return List.copyOf(result);
    }

    record Result(List<EncounterTarget> targets, List<EncounterPlan> encounters, boolean completeCoverage) {
        Result {
            targets = List.copyOf(targets);
            encounters = List.copyOf(encounters);
        }
    }

    private record Candidate(
            int encounterNumber,
            String id,
            List<EncounterBlock> blocks,
            long adjustedXp,
            long delta,
            int monsterCount,
            BigDecimal multiplier
    ) {
    }
}

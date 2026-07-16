package src.domain.sessiongeneration;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import src.domain.sessiongeneration.GenerationResult.EncounterBlock;
import src.domain.sessiongeneration.GenerationResult.EncounterPlan;
import src.domain.sessiongeneration.GenerationResult.SessionContext;

final class SheetV1EncounterGenerator {

    private static final double FIT = 0.05d;
    private final SessionGenerationCatalog catalog;
    private final SheetV1SessionContextCalculator contextCalculator;
    private final Map<String, Cr> crById;

    SheetV1EncounterGenerator(SessionGenerationCatalog catalog, SheetV1SessionContextCalculator contextCalculator) {
        this.catalog = catalog;
        this.contextCalculator = contextCalculator;
        crById = loadChallengeRatings(catalog);
    }

    EncounterOutput generate(GenerationRequest request, SessionContext context) {
        int count = encounterCount(request);
        List<Integer> targets = targets(request, context.sessionXpTarget(), count);
        int partyLevel = Math.max(1, Math.min(20, context.averageLevel().setScale(0, RoundingMode.HALF_UP).intValue()));
        Map<String, List<Block>> blocksByRole = blocksByRole(partyLevel);
        List<Pattern> patterns = patterns();
        List<Selected> selected = new ArrayList<>();
        for (int index = 0; index < targets.size(); index++) {
            selected.add(select(request.seed(), index + 1, targets.get(index), patterns, blocksByRole));
        }
        return new EncounterOutput(
                rankBossiness(request, selected),
                count,
                selected.stream().map(value -> new EncounterAudit(
                        value.encounterNumber(), value.candidateCount(), value.fitCandidateCount(), value.selectedFit()))
                        .toList());
    }

    private int encounterCount(GenerationRequest request) {
        if (request.encounterCount() != null) {
            return request.encounterCount();
        }
        int fullDay = 6 + (int) Math.floorMod(
                (long) Math.floor(Math.abs(Math.sin((request.seed() + 409L) * 12.9898d)) * 1_000_000d), 3L);
        return Math.max(1, SheetV1SessionContextCalculator.round(
                BigDecimal.valueOf(fullDay).multiply(request.adventureDayFraction())));
    }

    private List<Integer> targets(GenerationRequest request, int sessionXp, int count) {
        if (count == 1) {
            return List.of(sessionXp);
        }
        double medium = contextCalculator.threshold(request, "Medium_XP_Per_Character");
        double hard = contextCalculator.threshold(request, "Hard_XP_Per_Character");
        double deadly = contextCalculator.threshold(request, "Deadly_XP_Per_Character");
        List<Double> raw = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            if (index == 0) {
                raw.add(medium * 0.85d);
            } else if (index == count - 1) {
                raw.add(deadly);
            } else {
                raw.add(medium + (hard - medium) * index / (count - 1d));
            }
        }
        double total = raw.stream().mapToDouble(Double::doubleValue).sum();
        List<Integer> result = new ArrayList<>();
        int assigned = 0;
        for (int index = 0; index < count; index++) {
            int target = index == count - 1 ? sessionXp - assigned : (int) Math.round(raw.get(index) * sessionXp / total);
            result.add(target);
            assigned += target;
        }
        return List.copyOf(result);
    }

    private Selected select(
            long seed,
            int encounterNumber,
            int target,
            List<Pattern> patterns,
            Map<String, List<Block>> blocksByRole
    ) {
        List<Candidate> candidates = new ArrayList<>();
        for (Pattern pattern : patterns) {
            List<List<Block>> choices = new ArrayList<>();
            boolean complete = true;
            for (String role : pattern.roles()) {
                List<Block> best = blocksByRole.getOrDefault(role, List.of()).stream()
                        .filter(block -> block.adjustedXp() <= target * 1.05d)
                        .sorted(Comparator.comparingDouble(block -> Math.abs(block.adjustedXp() - target / (double) pattern.roles().size())))
                        .limit(4)
                        .toList();
                if (best.isEmpty()) {
                    complete = false;
                    break;
                }
                choices.add(best);
            }
            if (complete) {
                combine(encounterNumber, target, choices, 0, new ArrayList<>(), candidates);
            }
        }
        Comparator<Candidate> ordering = Comparator
                .comparingDouble((Candidate candidate) -> Math.abs(candidate.adjustedXp() - target))
                .thenComparing(Candidate::id);
        candidates.sort(ordering);
        List<Candidate> fit = candidates.stream()
                .filter(candidate -> Math.abs(candidate.adjustedXp() - target) <= target * FIT)
                .toList();
        List<Candidate> pool = (fit.isEmpty() ? candidates : fit).stream().limit(3).toList();
        if (pool.isEmpty()) {
            return new Selected(encounterNumber, target, null, candidates.size(), fit.size(), false);
        }
        int pick = (int) Math.floorMod(seed + encounterNumber * 719L, pool.size());
        Candidate selected = pool.get(pick);
        return new Selected(
                encounterNumber, target, selected, candidates.size(), fit.size(),
                Math.abs(selected.adjustedXp() - target) <= target * FIT);
    }

    private static void combine(
            int encounterNumber,
            int target,
            List<List<Block>> choices,
            int depth,
            List<Block> selected,
            List<Candidate> output
    ) {
        if (depth == choices.size()) {
            output.add(Candidate.from(encounterNumber, target, selected));
            return;
        }
        for (Block block : choices.get(depth)) {
            selected.add(block);
            combine(encounterNumber, target, choices, depth + 1, selected, output);
            selected.remove(selected.size() - 1);
        }
    }

    private List<EncounterPlan> rankBossiness(GenerationRequest request, List<Selected> selected) {
        double totalXp = selected.stream().filter(value -> value.candidate() != null)
                .mapToDouble(value -> value.candidate().adjustedXp()).sum();
        int maxLevel = request.playersByLevel().keySet().stream().mapToInt(Integer::intValue).max().orElse(1);
        Map<Integer, Double> scoreByEncounter = new HashMap<>();
        for (Selected value : selected) {
            if (value.candidate() == null) {
                scoreByEncounter.put(value.encounterNumber(), 0d);
                continue;
            }
            String difficulty = difficulty(value.encounterNumber(), selected.size());
            double difficultyMultiplier = switch (difficulty) {
                case "MEDIUM" -> 1.5d;
                case "HARD" -> 2d;
                case "DEADLY" -> 3d;
                default -> 1d;
            };
            int maxCr = value.candidate().blocks().stream().mapToInt(block -> block.cr().code()).max().orElse(0);
            double factor = Math.min(2.5d, 1d + maxCr / (double) Math.max(1, maxLevel));
            scoreByEncounter.put(value.encounterNumber(), value.candidate().adjustedXp() / Math.max(1d, totalXp)
                    * difficultyMultiplier * factor);
        }
        List<Integer> ranked = selected.stream().map(Selected::encounterNumber)
                .sorted(Comparator.<Integer>comparingDouble(scoreByEncounter::get).reversed().thenComparingInt(Integer::intValue))
                .toList();
        List<EncounterPlan> result = new ArrayList<>();
        for (Selected value : selected) {
            Candidate candidate = value.candidate();
            if (candidate == null) {
                continue;
            }
            String difficulty = difficulty(value.encounterNumber(), selected.size());
            List<EncounterBlock> blocks = candidate.blocks().stream()
                    .map(block -> new EncounterBlock(
                            block.role(), block.cr().label(), block.cr().code(), block.quantity(), block.cr().xp()))
                    .toList();
            String monsterText = blocks.stream()
                    .map(block -> block.quantity() + "x CR " + block.challengeRating())
                    .reduce((left, right) -> left + ", " + right).orElse("");
            String line = difficulty + " [" + integerFormat(candidate.adjustedXp()) + " XP]: " + monsterText;
            result.add(new EncounterPlan(
                    value.encounterNumber(), value.target(), candidate.adjustedXp(), difficulty, blocks,
                    candidate.multiplier(), ranked.indexOf(value.encounterNumber()) + 1, line));
        }
        return List.copyOf(result);
    }

    private Map<String, List<Block>> blocksByRole(int partyLevel) {
        Map<String, List<Block>> result = new LinkedHashMap<>();
        for (Map<String, String> band : catalog.table("DB_EncounterRoleBands")) {
            if (!SheetV1SessionContextCalculator.active(band)
                    || (int) SheetV1SessionContextCalculator.number(band, "Party_Level") != partyLevel) {
                continue;
            }
            Cr cr = crById.get(band.get("CR_ID"));
            String role = band.get("Role");
            if (cr == null || role == null) {
                continue;
            }
            int minimum = switch (role) {
                case "Minion" -> 4;
                case "Support" -> 2;
                default -> 1;
            };
            int maximum = switch (role) {
                case "Minion" -> 10;
                case "Support", "Standard" -> 5;
                case "Elite" -> 2;
                case "Boss" -> 1;
                default -> 0;
            };
            for (int quantity = minimum; quantity <= maximum; quantity++) {
                int rawXp = cr.xp() * quantity;
                int adjusted = (int) Math.round(rawXp * multiplier(quantity));
                String id = role + "_CR" + cr.label().replace('/', '_') + "_Nr" + quantity;
                result.computeIfAbsent(role, ignored -> new ArrayList<>())
                        .add(new Block(id, role, cr, quantity, rawXp, adjusted));
            }
        }
        return result;
    }

    private List<Pattern> patterns() {
        List<Pattern> result = new ArrayList<>();
        for (Map<String, String> row : catalog.table("DB_EncounterPatterns")) {
            if (!SheetV1SessionContextCalculator.active(row)) {
                continue;
            }
            List<String> roles = List.of(row.get("Role_1"), row.get("Role_2"), row.get("Role_3")).stream()
                    .filter(role -> role != null && !role.isBlank()).toList();
            result.add(new Pattern(row.get("Pattern_ID"), roles));
        }
        return List.copyOf(result);
    }

    private static Map<String, Cr> loadChallengeRatings(SessionGenerationCatalog catalog) {
        Map<String, Cr> result = new LinkedHashMap<>();
        for (Map<String, String> row : catalog.table("DB_CR")) {
            if (SheetV1SessionContextCalculator.active(row)) {
                result.put(row.get("CR_ID"), new Cr(
                        (int) SheetV1SessionContextCalculator.number(row, "CR_Code"),
                        row.get("CR_Label"),
                        (int) SheetV1SessionContextCalculator.number(row, "XP")));
            }
        }
        return Map.copyOf(result);
    }

    private static double multiplier(double count) {
        if (count <= 1d) return 1d;
        if (count <= 2d) return 1.5d;
        if (count <= 6d) return 2d;
        if (count <= 10d) return 2.5d;
        if (count <= 14d) return 3d;
        return 4d;
    }

    private static String difficulty(int number, int count) {
        if (count == 1 || number == count) return "DEADLY";
        if (number == 1) return "EASY";
        return number / (double) (count + 1) <= 0.5d ? "MEDIUM" : "HARD";
    }

    private static String integerFormat(int value) {
        return NumberFormat.getIntegerInstance(Locale.GERMANY).format(value);
    }

    private record Cr(int code, String label, int xp) {
    }

    private record Block(String id, String role, Cr cr, int quantity, int rawXp, int adjustedXp) {
    }

    private record Pattern(String id, List<String> roles) {
    }

    private record Candidate(String id, List<Block> blocks, int adjustedXp, double multiplier) {
        static Candidate from(int encounterNumber, int target, List<Block> selected) {
            List<Block> blocks = List.copyOf(selected);
            int rawXp = blocks.stream().mapToInt(Block::rawXp).sum();
            double maxUnitXp = blocks.stream().mapToDouble(block -> block.cr().xp()).max().orElse(1d);
            double effectiveCount = blocks.stream()
                    .mapToDouble(block -> block.quantity() * Math.sqrt(block.cr().xp() / maxUnitXp)).sum();
            double multiplier = SheetV1EncounterGenerator.multiplier(effectiveCount);
            int adjustedXp = (int) Math.round(rawXp * multiplier);
            String id = encounterNumber + ":" + blocks.stream().map(Block::id)
                    .reduce((left, right) -> left + "|" + right).orElse("");
            return new Candidate(id, blocks, adjustedXp, multiplier);
        }
    }

    record EncounterOutput(List<EncounterPlan> plans, int targetCount, List<EncounterAudit> audits) {
    }

    record EncounterAudit(
            int encounterNumber,
            int candidateCount,
            int fitCandidateCount,
            boolean selectedFit
    ) {
    }

    private record Selected(
            int encounterNumber,
            int target,
            Candidate candidate,
            int candidateCount,
            int fitCandidateCount,
            boolean selectedFit
    ) {
    }
}

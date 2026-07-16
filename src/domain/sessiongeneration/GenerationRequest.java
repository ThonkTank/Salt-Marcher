package src.domain.sessiongeneration;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

public record GenerationRequest(
        Map<Integer, Integer> playersByLevel,
        BigDecimal adventureDayFraction,
        Integer encounterCount,
        long seed,
        String rulesetVersion,
        String locale
) {

    public static final String SHEET_V1 = "sheet-v1";

    public GenerationRequest {
        playersByLevel = normalizePlayers(playersByLevel);
        adventureDayFraction = adventureDayFraction == null ? new BigDecimal("0.6") : adventureDayFraction;
        if (adventureDayFraction.signum() < 0) {
            throw new IllegalArgumentException("adventureDayFraction must not be negative");
        }
        if (encounterCount != null && (encounterCount < 1 || encounterCount > 10)) {
            throw new IllegalArgumentException("encounterCount must be between 1 and 10");
        }
        if (seed < 0) {
            throw new IllegalArgumentException("seed must not be negative");
        }
        rulesetVersion = rulesetVersion == null || rulesetVersion.isBlank() ? SHEET_V1 : rulesetVersion.trim();
        locale = locale == null || locale.isBlank() ? "de-DE" : locale.trim();
        if (!SHEET_V1.equals(rulesetVersion)) {
            throw new IllegalArgumentException("Unsupported ruleset: " + rulesetVersion);
        }
    }

    public static GenerationRequest sheetV1(
            Map<Integer, Integer> playersByLevel,
            BigDecimal adventureDayFraction,
            Integer encounterCount,
            long seed
    ) {
        return new GenerationRequest(
                playersByLevel, adventureDayFraction, encounterCount, seed, SHEET_V1, "de-DE");
    }

    @Override
    public Map<Integer, Integer> playersByLevel() {
        return Map.copyOf(playersByLevel);
    }

    private static Map<Integer, Integer> normalizePlayers(Map<Integer, Integer> players) {
        Map<Integer, Integer> normalized = new LinkedHashMap<>();
        if (players != null) {
            players.entrySet().stream()
                    .filter(entry -> entry.getKey() != null && entry.getValue() != null)
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> {
                        int level = entry.getKey();
                        int count = entry.getValue();
                        if (level < 1 || level > 20 || count < 0) {
                            throw new IllegalArgumentException("Player levels must be 1..20 with non-negative counts");
                        }
                        if (count > 0) {
                            normalized.put(level, count);
                        }
                    });
        }
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("At least one player is required");
        }
        return Map.copyOf(normalized);
    }
}

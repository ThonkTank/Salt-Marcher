package features.partyanalysis.service;

import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ActionRow;
import features.spells.api.SpellOffenseProfileLookup;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class SpellcastingActionInterpreter {
    private static final Pattern SPELL_LINE_PATTERN = Pattern.compile(
            "(?im)^(?:cantrips \\(at will\\)|(\\d+)(?:st|nd|rd|th) level \\((\\d+) slots?\\)):\\s*(.+)$");
    private static final Pattern ONCE_EACH_PATTERN = Pattern.compile(
            "can cast\\s+(.+?)\\s+once each without expending a spell slot",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern CAST_SPELL_LEVEL_CAP_PATTERN = Pattern.compile(
            "casts? a spell of (\\d+)(?:st|nd|rd|th) level or lower",
            Pattern.CASE_INSENSITIVE);

    private SpellcastingActionInterpreter() {
        throw new AssertionError("No instances");
    }

    static List<ResolvedSpellOption> interpret(ActionRow action, SpellOffenseProfileLookup lookup) {
        if (lookup == null) {
            lookup = SpellOffenseProfileLookup.NO_OP;
        }
        if (action == null) {
            return List.of();
        }

        String name = lower(action.name());
        return switch (name) {
            case "spellcasting", "innate spellcasting" -> parsePreparedSpells(action, lookup);
            case "cast spell" -> List.of();
            default -> List.of();
        };
    }

    static Optional<ResolvedSpellOption> bestSpellForLegendaryCast(
            ActionRow action,
            List<ResolvedSpellOption> spellOptions) {
        if (action == null || spellOptions == null || spellOptions.isEmpty()) {
            return Optional.empty();
        }
        Matcher matcher = CAST_SPELL_LEVEL_CAP_PATTERN.matcher(lower(action.description()));
        if (!matcher.find()) {
            return Optional.empty();
        }
        int levelCap = Integer.parseInt(matcher.group(1));
        return spellOptions.stream()
                .filter(option -> option.spellLevel() <= levelCap)
                .max(Comparator.comparingDouble(ResolvedSpellOption::expectedDamagePerUse));
    }

    private static List<ResolvedSpellOption> parsePreparedSpells(ActionRow action, SpellOffenseProfileLookup lookup) {
        String description = action == null ? null : action.description();
        if (description == null || description.isBlank()) {
            return List.of();
        }

        List<ResolvedSpellOption> options = new ArrayList<>();
        Matcher matcher = SPELL_LINE_PATTERN.matcher(description);
        while (matcher.find()) {
            int spellLevel = matcher.group(1) == null ? 0 : Integer.parseInt(matcher.group(1));
            Integer uses = matcher.group(2) == null ? null : Integer.valueOf(matcher.group(2));
            String poolKey = matcher.group(1) == null
                    ? "action:" + action.actionId() + ":prepared:cantrip"
                    : "action:" + action.actionId() + ":prepared:level:" + spellLevel;
            for (String spellName : splitSpellNames(matcher.group(3))) {
                lookup.findByName(spellName).ifPresent(profile -> options.add(new ResolvedSpellOption(
                        poolKey,
                        profile.spellName(),
                        spellLevel,
                        profile.castingChannel(),
                        profile.targetProfile(),
                        profile.expectedDamagePerUse(),
                        uses)));
            }
        }

        Matcher onceEachMatcher = ONCE_EACH_PATTERN.matcher(description);
        if (onceEachMatcher.find()) {
            for (String spellName : splitSpellNames(onceEachMatcher.group(1))) {
                lookup.findByName(spellName).ifPresent(profile -> options.add(new ResolvedSpellOption(
                        "action:" + action.actionId() + ":innate:" + spellName,
                        profile.spellName(),
                        profile.spellLevel(),
                        profile.castingChannel(),
                        profile.targetProfile(),
                        profile.expectedDamagePerUse(),
                        1)));
            }
        }

        return options;
    }

    private static List<String> splitSpellNames(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        String normalized = raw.replace(" and ", ", ");
        List<String> names = new ArrayList<>();
        for (String token : normalized.split(",")) {
            String trimmed = token.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (trimmed.startsWith("*")) {
                trimmed = trimmed.substring(1).trim();
            }
            int asterisk = trimmed.indexOf('*');
            if (asterisk >= 0) {
                trimmed = trimmed.substring(0, asterisk).trim();
            }
            if (!trimmed.isEmpty()) {
                names.add(trimmed.toLowerCase(Locale.ROOT));
            }
        }
        return names;
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    record ResolvedSpellOption(
            String poolKey,
            String spellName,
            int spellLevel,
            String castingChannel,
            String targetProfile,
            double expectedDamagePerUse,
            Integer maxUses
    ) {}
}

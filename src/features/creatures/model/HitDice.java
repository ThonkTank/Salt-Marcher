package features.creatures.model;

import java.util.Objects;
import java.util.Optional;
import java.util.random.RandomGenerator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Typed hit-dice expression (e.g. 18d8+54). */
public record HitDice(int count, int sides, int modifier) {
    private static final Pattern HIT_DICE_PATTERN =
            Pattern.compile("^\\s*(\\d+)\\s*[dD]\\s*(\\d+)\\s*(([+-])\\s*(\\d+))?\\s*$");

    public HitDice {
        if (count <= 0) throw new IllegalArgumentException("count must be > 0");
        if (sides <= 0) throw new IllegalArgumentException("sides must be > 0");
    }

    public static Optional<HitDice> fromParts(Integer count, Integer sides, Integer modifier) {
        if (count == null || sides == null) return Optional.empty();
        try {
            return Optional.of(new HitDice(count, sides, modifier == null ? 0 : modifier));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    public static Optional<HitDice> tryParse(String expression) {
        if (expression == null || expression.isBlank()) return Optional.empty();
        Matcher matcher = HIT_DICE_PATTERN.matcher(expression);
        if (!matcher.matches()) return Optional.empty();

        int parsedCount;
        int parsedSides;
        try {
            parsedCount = Integer.parseInt(matcher.group(1));
            parsedSides = Integer.parseInt(matcher.group(2));
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }

        int parsedModifier = 0;
        if (matcher.group(3) != null) {
            int amount;
            try {
                amount = Integer.parseInt(matcher.group(5));
            } catch (NumberFormatException ex) {
                return Optional.empty();
            }
            parsedModifier = "-".equals(matcher.group(4)) ? -amount : amount;
        }

        try {
            return Optional.of(new HitDice(parsedCount, parsedSides, parsedModifier));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    public int roll(RandomGenerator random) {
        Objects.requireNonNull(random, "random");
        int total = modifier;
        for (int i = 0; i < count; i++) {
            total += random.nextInt(sides) + 1;
        }
        return Math.max(1, total);
    }
}

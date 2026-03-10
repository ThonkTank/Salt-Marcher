package shared.creatures.parser;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts attack-roll bonus from action descriptions.
 */
public final class ActionToHitParser {
    private ActionToHitParser() {
        throw new AssertionError("No instances");
    }

    private static final Pattern TO_HIT_PATTERN = Pattern.compile("(?i)([+-]\\d+)\\s*to hit");

    public static Integer extractToHitBonus(String actionDescription) {
        if (actionDescription == null || actionDescription.isBlank()) {
            return null;
        }
        Matcher matcher = TO_HIT_PATTERN.matcher(actionDescription);
        if (!matcher.find()) {
            return null;
        }
        return Integer.parseInt(matcher.group(1));
    }
}

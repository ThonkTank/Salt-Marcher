package features.sessionplanner.adapter.javafx;

import java.math.BigDecimal;
import features.sessionplanner.api.SessionPlannerRestKind;

final class SessionPlannerVocabulary {

    static long parsePositiveLong(String raw) {
        try {
            return Math.max(0L, Long.parseLong(text(raw)));
        } catch (NumberFormatException exception) {
            return 0L;
        }
    }

    static BigDecimal parsePositiveDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            BigDecimal parsed = new BigDecimal(raw.trim().replace(',', '.'));
            return parsed.signum() <= 0 ? null : parsed;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    static String restLabel(SessionPlannerRestKind restKind) {
        return switch (restKind == null ? SessionPlannerRestKind.NONE : restKind) {
            case NONE -> "Keine Rast";
            case SHORT_REST -> "Kurze Rast";
            case LONG_REST -> "Lange Rast";
        };
    }

    static String text(String value) {
        return value == null ? "" : value;
    }

    private SessionPlannerVocabulary() {
    }
}

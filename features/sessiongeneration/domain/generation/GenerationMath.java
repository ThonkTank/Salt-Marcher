package features.sessiongeneration.domain.generation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

final class GenerationMath {

    private GenerationMath() {
    }

    static int clamp(long value, int minimum, int maximum) {
        return (int) Math.max(minimum, Math.min(maximum, value));
    }

    static double multiplier(double quantity) {
        if (quantity <= 1) return 1.0;
        if (quantity <= 2) return 1.5;
        if (quantity <= 6) return 2.0;
        if (quantity <= 10) return 2.5;
        if (quantity <= 14) return 3.0;
        return 4.0;
    }

    static String title(Enum<?> value) {
        String text = value.name().toLowerCase(Locale.ROOT).replace('_', ' ');
        return Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }

    static long rounded(BigDecimal value) {
        return value.setScale(0, RoundingMode.HALF_UP).longValueExact();
    }
}

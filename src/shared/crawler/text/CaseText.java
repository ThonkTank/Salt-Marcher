package shared.crawler.text;

public final class CaseText {
    private CaseText() {
        throw new AssertionError("No instances");
    }

    /** Uppercases the first character of a single word, lowercases the rest. */
    public static String capitalizeFirst(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase();
    }

    /** Capitalizes the first letter of each whitespace-delimited word, lowercases the rest. */
    public static String toTitleCase(String s) {
        if (s == null || s.isEmpty()) return s;
        String[] parts = s.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(part.charAt(0)))
                    .append(part.substring(1).toLowerCase());
        }
        return sb.toString();
    }
}

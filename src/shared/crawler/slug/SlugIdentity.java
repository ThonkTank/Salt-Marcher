package shared.crawler.slug;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.logging.Logger;

public final class SlugIdentity {
    private static final Logger LOGGER = Logger.getLogger(SlugIdentity.class.getName());

    private SlugIdentity() {
        throw new AssertionError("No instances");
    }

    /**
     * Removes duplicates for slugs with the same name suffix but different ID prefixes.
     * Keeps the smallest ID (oldest/2014 version).
     */
    public static Set<String> deduplicateSlugs(Set<String> slugs) {
        Map<String, String> bestByName = new HashMap<>();
        Map<String, Long> bestIdByName = new HashMap<>();

        for (String slug : slugs) {
            int dash = slug.indexOf('-');
            if (dash <= 0) {
                bestByName.putIfAbsent(slug, slug);
                continue;
            }

            String idStr = slug.substring(0, dash);
            String nameSuffix = slug.substring(dash + 1);
            long id;
            try {
                id = Long.parseLong(idStr);
            } catch (NumberFormatException e) {
                bestByName.putIfAbsent(slug, slug);
                continue;
            }

            Long existingId = bestIdByName.get(nameSuffix);
            if (existingId == null || id < existingId) {
                bestByName.put(nameSuffix, slug);
                bestIdByName.put(nameSuffix, id);
            }
        }

        return new LinkedHashSet<>(bestByName.values());
    }

    /**
     * Derives the slug value stored in the database from a crawler-produced filename.
     */
    public static String slugFromFilename(String filename) {
        return filename.replaceFirst("\\.html$", "");
    }

    /**
     * Normalizes a slug to a stable key without numeric prefix.
     */
    public static String slugKey(String slug) {
        if (slug == null) return null;
        String cleaned = slug.trim().toLowerCase();
        if (cleaned.isEmpty()) return null;
        int dash = cleaned.indexOf('-');
        if (dash > 0) {
            String prefix = cleaned.substring(0, dash);
            boolean numericPrefix = true;
            for (int i = 0; i < prefix.length(); i++) {
                if (!Character.isDigit(prefix.charAt(i))) {
                    numericPrefix = false;
                    break;
                }
            }
            if (numericPrefix && dash + 1 < cleaned.length()) {
                return cleaned.substring(dash + 1);
            }
        }
        return cleaned;
    }

    /**
     * Extracts the numeric ID from crawler filenames.
     */
    public static Long extractIdFromFilename(String filename) {
        String base = filename.replaceFirst("\\.html$", "");
        int dash = base.indexOf('-');
        if (dash > 0) {
            String prefix = base.substring(0, dash);
            try {
                return Long.parseLong(prefix);
            } catch (NumberFormatException ignored) {
                // fall through to hash fallback
            }
        }
        long hash = (long) (base.hashCode() & 0x7FFFFFFF);
        LOGGER.warning("No numeric ID prefix in filename '" + filename
                + "'; using hash-based ID " + hash + ". Check for DB collisions.");
        return hash;
    }
}

package saltmarcher.architecture;

import java.util.Locale;

final class ArchitectureNaming {

    private ArchitectureNaming() {
    }

    static String expectedDomainRootFileName(String feature) {
        if (feature == null || feature.isBlank()) {
            return "ApplicationService.java";
        }
        return feature.substring(0, 1).toUpperCase(Locale.ROOT)
                + feature.substring(1)
                + "ApplicationService.java";
    }

    static String expectedDataRootFileName(String feature) {
        if (feature == null || feature.isBlank()) {
            return "ServiceContribution.java";
        }
        return feature.substring(0, 1).toUpperCase(Locale.ROOT)
                + feature.substring(1)
                + "ServiceContribution.java";
    }

    static String expectedDataSchemaFileName(String feature) {
        if (feature == null || feature.isBlank()) {
            return "PersistenceSchema.java";
        }
        return feature.substring(0, 1).toUpperCase(Locale.ROOT)
                + feature.substring(1)
                + "PersistenceSchema.java";
    }

    static boolean isFeatureFileName(String feature, String fileName, String suffix) {
        String fullSuffix = suffix + ".java";
        if (feature == null
                || fileName == null
                || !fileName.endsWith(fullSuffix)) {
            return false;
        }
        String prefix = fileName.substring(0, fileName.length() - fullSuffix.length());
        return normalizeFeatureToken(prefix).equals(normalizeFeatureToken(feature));
    }

    private static String normalizeFeatureToken(String value) {
        StringBuilder normalized = new StringBuilder();
        for (char character : value.toCharArray()) {
            if (Character.isLetterOrDigit(character)) {
                normalized.append(Character.toLowerCase(character));
            }
        }
        return normalized.toString();
    }
}

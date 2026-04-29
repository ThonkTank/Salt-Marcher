package saltmarcher.architecture;

import java.util.Locale;

public final class ArchitectureNaming {

    private ArchitectureNaming() {
    }

    public static String expectedDomainRootFileName(String feature) {
        return expectedDomainRootFileName(feature, null);
    }

    public static String expectedDomainRootFileName(String feature, String contextName) {
        return expectedFeatureFileName(feature, contextName, "ApplicationService");
    }

    public static String expectedDataRootFileName(String feature) {
        return expectedFeatureFileName(feature, null, "ServiceContribution");
    }

    public static String expectedDataRootFileName(String feature, String contextName) {
        return expectedFeatureFileName(feature, contextName, "ServiceContribution");
    }

    public static String expectedDataSchemaFileName(String feature) {
        return expectedFeatureFileName(feature, null, "PersistenceSchema");
    }

    public static String expectedDataSchemaFileName(String feature, String contextName) {
        return expectedFeatureFileName(feature, contextName, "PersistenceSchema");
    }

    private static String expectedFeatureFileName(String feature, String contextName, String suffix) {
        if (contextName != null && !contextName.isBlank()) {
            return contextName + suffix + ".java";
        }
        if (feature == null || feature.isBlank()) {
            return suffix + ".java";
        }
        return feature.substring(0, 1).toUpperCase(Locale.ROOT) + feature.substring(1) + suffix + ".java";
    }

    public static boolean isFeatureFileName(String feature, String fileName, String suffix) {
        return isFeatureFileName(feature, null, fileName, suffix);
    }

    public static boolean isFeatureFileName(String feature, String contextName, String fileName, String suffix) {
        String fullSuffix = suffix + ".java";
        if (feature == null
                || fileName == null
                || !fileName.endsWith(fullSuffix)) {
            return false;
        }
        if (contextName != null && !contextName.isBlank()) {
            return fileName.equals(contextName + fullSuffix);
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

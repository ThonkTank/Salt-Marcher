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
}

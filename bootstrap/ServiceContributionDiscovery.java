package bootstrap;

import org.jspecify.annotations.Nullable;
import shell.api.ServiceContribution;

import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Discovers feature-owned service contributions from {@code src.data.<feature>} root classes.
 */
final class ServiceContributionDiscovery {

    private static final String DATA_ROOT = "src/data";
    private static final String DATA_PACKAGE_PREFIX = "src.data.";
    private static final String CONTRIBUTION_SUFFIX = "ServiceContribution";
    private final ContributionRootClassScanner rootClassScanner = new ContributionRootClassScanner();

    List<ServiceContribution> discover() {
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = ServiceContributionDiscovery.class.getClassLoader();
        }
        Map<String, List<String>> rootClassesByFeature = new TreeMap<>(
                rootClassScanner.discoverRootClasses(classLoader, DATA_ROOT, DATA_PACKAGE_PREFIX));
        List<ServiceContribution> contributions = new ArrayList<>();
        for (String className : resolveContributionClasses(rootClassesByFeature).values()) {
            ServiceContribution contribution = instantiateContribution(classLoader, className);
            if (contribution != null) {
                contributions.add(contribution);
            }
        }
        return contributions;
    }

    private Map<String, String> resolveContributionClasses(Map<String, List<String>> rootClassesByFeature) {
        Map<String, String> resolved = new TreeMap<>();
        for (Map.Entry<String, List<String>> entry : rootClassesByFeature.entrySet()) {
            String featureName = entry.getKey();
            List<String> rootClasses = entry.getValue().stream().distinct().sorted().toList();
            String expectedSimpleName = expectedContributionSimpleName(featureName);
            List<String> matchingClasses = rootClasses.stream()
                    .filter(className -> className.endsWith("." + expectedSimpleName))
                    .toList();
            if (matchingClasses.size() != 1) {
                throw invalidContribution(featureName, expectedSimpleName, rootClasses);
            }
            if (rootClasses.size() != 1) {
                throw new IllegalStateException("Data feature '" + featureName
                        + "' must expose exactly one root class under src/data/" + featureName + "/. "
                        + "Expected only '" + matchingClasses.getFirst() + "' but found: " + rootClasses);
            }
            resolved.put(featureName, matchingClasses.getFirst());
        }
        return resolved;
    }

    private IllegalStateException invalidContribution(String featureName, String expectedSimpleName, List<String> rootClasses) {
        return new IllegalStateException("Data feature '" + featureName
                + "' must expose exactly one root service contribution class named '" + expectedSimpleName
                + "' under src/data/" + featureName + "/. Found: " + rootClasses);
    }

    private String expectedContributionSimpleName(String featureName) {
        StringBuilder result = new StringBuilder();
        boolean capitalizeNext = true;
        for (int index = 0; index < featureName.length(); index++) {
            char character = featureName.charAt(index);
            if (!Character.isLetterOrDigit(character)) {
                capitalizeNext = true;
                continue;
            }
            if (capitalizeNext) {
                result.append(Character.toUpperCase(character));
                capitalizeNext = false;
            } else {
                result.append(character);
            }
        }
        result.append(CONTRIBUTION_SUFFIX);
        return result.toString();
    }

    private @Nullable ServiceContribution instantiateContribution(ClassLoader classLoader, String className) {
        Class<?> rawType;
        try {
            rawType = Class.forName(className, true, classLoader);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load service contribution " + className + ".", exception);
        }

        if (!ServiceContribution.class.isAssignableFrom(rawType)
                || rawType.isInterface()
                || Modifier.isAbstract(rawType.getModifiers())) {
            return null;
        }

        try {
            return (ServiceContribution) rawType.getDeclaredConstructor().newInstance();
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException | NoSuchMethodException exception) {
            throw new IllegalStateException("Service contribution " + className
                    + " must expose a public no-arg constructor.", exception);
        }
    }
}

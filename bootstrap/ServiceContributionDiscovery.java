package bootstrap;

import org.jspecify.annotations.Nullable;
import shell.api.ServiceContribution;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

final class ServiceContributionDiscovery {

    private static final String DATA_ROOT = "src/data";
    private static final String DATA_PACKAGE_PREFIX = "src.data.";
    private static final String DOMAIN_ROOT = "src/domain";
    private static final String DOMAIN_PACKAGE_PREFIX = "src.domain.";
    private static final String CONTRIBUTION_SUFFIX = "ServiceContribution";
    private static final int REQUIRED_ROOT_CLASS_COUNT = 1;
    private final ContributionRootClassScanner rootClassScanner = new ContributionRootClassScanner();

    List<ServiceContribution> discover() {
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = ServiceContributionDiscovery.class.getClassLoader();
        }
        List<ServiceContribution> contributions = new ArrayList<>();
        List<String> contributionClasses = new ArrayList<>();
        contributionClasses.addAll(resolveContributionClasses(
                rootClassScanner.discoverRootClasses(classLoader, DATA_ROOT, DATA_PACKAGE_PREFIX),
                true).values());
        contributionClasses.addAll(resolveContributionClasses(
                rootClassScanner.discoverRootClasses(classLoader, DOMAIN_ROOT, DOMAIN_PACKAGE_PREFIX),
                false).values());
        for (String className : contributionClasses) {
            ServiceContribution contribution = instantiateContribution(classLoader, className);
            if (contribution != null) {
                contributions.add(contribution);
            }
        }
        return contributions;
    }

    private Map<String, String> resolveContributionClasses(
            Map<String, List<String>> rootClassesByFeature,
            boolean contributionRequired
    ) {
        Map<String, String> resolved = new TreeMap<>();
        for (Map.Entry<String, List<String>> entry : rootClassesByFeature.entrySet()) {
            String featureName = entry.getKey();
            List<String> rootClasses = entry.getValue().stream().distinct().sorted().toList();
            List<String> matchingClasses = rootClasses.stream()
                    .filter(className -> className.endsWith(CONTRIBUTION_SUFFIX))
                    .toList();
            if (matchingClasses.isEmpty() && !contributionRequired) {
                continue;
            }
            if (matchingClasses.size() != REQUIRED_ROOT_CLASS_COUNT) {
                throw invalidContribution(featureName, rootClasses);
            }
            resolved.put(featureName, matchingClasses.getFirst());
        }
        return resolved;
    }

    private IllegalStateException invalidContribution(String featureName, List<String> rootClasses) {
        return new IllegalStateException("Backend feature '" + featureName
                + "' must expose exactly one root service contribution class ending with '" + CONTRIBUTION_SUFFIX
                + "' under src/data/" + featureName + "/ or src/domain/" + featureName + "/. Found: " + rootClasses);
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
            throw new IllegalStateException("Service contribution " + className
                    + " must be a concrete implementation of " + ServiceContribution.class.getName() + ".");
        }

        try {
            return (ServiceContribution) rawType.getDeclaredConstructor().newInstance();
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException | NoSuchMethodException exception) {
            throw new IllegalStateException("Service contribution " + className
                    + " must expose a public no-arg constructor.", exception);
        }
    }
}

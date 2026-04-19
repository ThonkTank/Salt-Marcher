package bootstrap;

import org.jspecify.annotations.Nullable;
import shell.api.ShellViewContribution;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Discovers feature-owned shell contributions from {@code src.view.<component>} root classes.
 */
public final class ShellViewDiscovery {

    private static final String VIEW_ROOT = "src/view";
    private static final String VIEW_PACKAGE_PREFIX = "src.view.";
    private static final String CONTRIBUTION_SUFFIX = "ViewContribution";
    private static final int REQUIRED_ROOT_CLASS_COUNT = 1;
    private final ContributionRootClassScanner rootClassScanner = new ContributionRootClassScanner();

    public List<ShellViewContribution> discover() {
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = ShellViewDiscovery.class.getClassLoader();
        }
        Map<String, List<String>> rootClassesByComponent = new TreeMap<>(
                rootClassScanner.discoverRootClasses(classLoader, VIEW_ROOT, VIEW_PACKAGE_PREFIX));

        List<ShellViewContribution> contributions = new ArrayList<>();
        for (Map.Entry<String, String> entry : resolveContributionClasses(rootClassesByComponent).entrySet()) {
            String className = entry.getValue();
            ShellViewContribution contribution = instantiateContribution(classLoader, className);
            if (contribution != null) {
                contributions.add(contribution);
            }
        }
        return contributions;
    }

    private Map<String, String> resolveContributionClasses(Map<String, List<String>> rootClassesByComponent) {
        Map<String, String> resolved = new TreeMap<>();
        for (Map.Entry<String, List<String>> entry : rootClassesByComponent.entrySet()) {
            String componentName = entry.getKey();
            List<String> rootClasses = entry.getValue().stream().distinct().sorted().toList();
            String expectedSimpleName = expectedContributionSimpleName(componentName);
            List<String> matchingClasses = rootClasses.stream()
                    .filter(className -> className.endsWith("." + expectedSimpleName))
                    .toList();

            if (matchingClasses.size() != REQUIRED_ROOT_CLASS_COUNT) {
                throw invalidContribution(componentName, expectedSimpleName, rootClasses);
            }
            if (rootClasses.size() != REQUIRED_ROOT_CLASS_COUNT) {
                throw new IllegalStateException("Component '" + componentName
                        + "' must expose exactly one root class under src/view/" + componentName + "/. "
                        + "Expected only '" + matchingClasses.getFirst() + "' but found: " + rootClasses);
            }
            resolved.put(componentName, matchingClasses.getFirst());
        }
        return resolved;
    }

    private IllegalStateException invalidContribution(String componentName, String expectedSimpleName, List<String> rootClasses) {
        return new IllegalStateException("Component '" + componentName
                + "' must expose exactly one root shell contribution class named '" + expectedSimpleName
                + "' under src/view/" + componentName + "/. Found: " + rootClasses);
    }

    private String expectedContributionSimpleName(String componentName) {
        StringBuilder result = new StringBuilder();
        boolean capitalizeNext = true;
        for (int index = 0; index < componentName.length(); index++) {
            char character = componentName.charAt(index);
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

    private @Nullable ShellViewContribution instantiateContribution(ClassLoader classLoader, String className) {
        Class<?> rawType;
        try {
            rawType = Class.forName(className, true, classLoader);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load shell contribution class " + className + ".", exception);
        }

        if (!ShellViewContribution.class.isAssignableFrom(rawType)
                || rawType.isInterface()
                || Modifier.isAbstract(rawType.getModifiers())) {
            return null;
        }

        try {
            return (ShellViewContribution) rawType.getDeclaredConstructor().newInstance();
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException | NoSuchMethodException exception) {
            throw new IllegalStateException("Shell contribution " + className + " must expose a public no-arg constructor.", exception);
        }
    }
}

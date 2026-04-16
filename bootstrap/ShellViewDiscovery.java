package bootstrap;

import shell.host.ShellViewContribution;

import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.net.JarURLConnection;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.stream.Stream;

/**
 * Discovers feature-owned shell contributions from {@code src.view.<component>} root classes.
 */
public final class ShellViewDiscovery {

    private static final String VIEW_ROOT = "src/view";
    private static final String CONTRIBUTION_SUFFIX = "ViewContribution";

    public List<ShellViewContribution> discover() {
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = ShellViewDiscovery.class.getClassLoader();
        }
        Map<String, List<String>> rootClassesByComponent = new TreeMap<>();
        try {
            Enumeration<URL> resources = classLoader.getResources(VIEW_ROOT);
            while (resources.hasMoreElements()) {
                URL resource = resources.nextElement();
                if ("file".equals(resource.getProtocol())) {
                    collectContributionClassNamesFromDirectory(Path.of(resource.toURI()), rootClassesByComponent);
                    continue;
                }
                if ("jar".equals(resource.getProtocol())) {
                    collectContributionClassNamesFromJar(resource, rootClassesByComponent);
                }
            }
        } catch (IOException | URISyntaxException exception) {
            throw new IllegalStateException("Could not discover shell view contributions.", exception);
        }

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

    private void collectContributionClassNamesFromDirectory(Path viewRoot, Map<String, List<String>> rootClassesByComponent)
            throws IOException {
        if (!Files.isDirectory(viewRoot)) {
            return;
        }

        try (Stream<Path> componentDirs = Files.list(viewRoot)) {
            for (Path componentDir : componentDirs.filter(Files::isDirectory).sorted().toList()) {
                String componentName = componentDir.getFileName().toString();
                try (Stream<Path> classFiles = Files.list(componentDir)) {
                    for (Path classFile : classFiles
                            .filter(Files::isRegularFile)
                            .filter(path -> path.getFileName().toString().endsWith(".class"))
                            .filter(path -> !path.getFileName().toString().contains("$"))
                            .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                            .toList()) {
                        registerRootClass(rootClassesByComponent, componentName,
                                classFile.getFileName().toString().replaceFirst("\\.class$", ""));
                    }
                }
            }
        }
    }

    private void collectContributionClassNamesFromJar(URL resource, Map<String, List<String>> rootClassesByComponent) throws IOException {
        JarURLConnection connection = (JarURLConnection) resource.openConnection();
        try (JarFile jarFile = connection.getJarFile()) {
            String prefix = connection.getEntryName();
            if (!prefix.endsWith("/")) {
                prefix += "/";
            }

            for (JarEntry entry : jarFile.stream().sorted(Comparator.comparing(JarEntry::getName)).toList()) {
                String name = entry.getName();
                if (entry.isDirectory() || !name.startsWith(prefix) || !name.endsWith(".class") || name.contains("$")) {
                    continue;
                }
                String relativeName = name.substring(prefix.length());
                String[] segments = relativeName.split("/");
                if (segments.length != 2) {
                    continue;
                }
                registerRootClass(rootClassesByComponent, segments[0], segments[1].replaceFirst("\\.class$", ""));
            }
        }
    }

    private void registerRootClass(Map<String, List<String>> rootClassesByComponent, String componentName, String simpleName) {
        rootClassesByComponent
                .computeIfAbsent(componentName, ignored -> new ArrayList<>())
                .add("src.view." + componentName + "." + simpleName);
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

            if (matchingClasses.size() != 1) {
                throw invalidContribution(componentName, expectedSimpleName, rootClasses);
            }
            if (rootClasses.size() != 1) {
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
        for (char character : componentName.toCharArray()) {
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

    private ShellViewContribution instantiateContribution(ClassLoader classLoader, String className) {
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

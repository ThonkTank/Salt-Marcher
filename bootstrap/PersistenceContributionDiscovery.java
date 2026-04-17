package bootstrap;

import shell.host.PersistenceContribution;

import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.net.JarURLConnection;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.stream.Stream;

/**
 * Discovers feature-owned persistence contributions from {@code src.data.<feature>} root classes.
 */
final class PersistenceContributionDiscovery {

    private static final String DATA_ROOT = "src/data";
    private static final String CONTRIBUTION_SUFFIX = "PersistenceContribution";

    List<PersistenceContribution> discover() {
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = PersistenceContributionDiscovery.class.getClassLoader();
        }
        Map<String, List<String>> rootClassesByFeature = new TreeMap<>();
        try {
            Enumeration<URL> resources = classLoader.getResources(DATA_ROOT);
            while (resources.hasMoreElements()) {
                URL resource = resources.nextElement();
                if ("file".equals(resource.getProtocol())) {
                    collectContributionClassNamesFromDirectory(Path.of(resource.toURI()), rootClassesByFeature);
                    continue;
                }
                if ("jar".equals(resource.getProtocol())) {
                    collectContributionClassNamesFromJar(resource, rootClassesByFeature);
                }
            }
        } catch (IOException | URISyntaxException exception) {
            throw new IllegalStateException("Could not discover persistence contributions.", exception);
        }
        List<PersistenceContribution> contributions = new ArrayList<>();
        for (String className : resolveContributionClasses(rootClassesByFeature).values()) {
            PersistenceContribution contribution = instantiateContribution(classLoader, className);
            if (contribution != null) {
                contributions.add(contribution);
            }
        }
        return contributions;
    }

    private void collectContributionClassNamesFromDirectory(Path dataRoot, Map<String, List<String>> rootClassesByFeature)
            throws IOException {
        if (!Files.isDirectory(dataRoot)) {
            return;
        }
        try (Stream<Path> featureDirs = Files.list(dataRoot)) {
            for (Path featureDir : featureDirs.filter(Files::isDirectory).sorted().toList()) {
                String featureName = featureDir.getFileName().toString();
                try (Stream<Path> classFiles = Files.list(featureDir)) {
                    for (Path classFile : classFiles
                            .filter(Files::isRegularFile)
                            .filter(path -> path.getFileName().toString().endsWith(".class"))
                            .filter(path -> !path.getFileName().toString().contains("$"))
                            .sorted()
                            .toList()) {
                        registerRootClass(rootClassesByFeature, featureName,
                                classFile.getFileName().toString().replaceFirst("\\.class$", ""));
                    }
                }
            }
        }
    }

    private void collectContributionClassNamesFromJar(URL resource, Map<String, List<String>> rootClassesByFeature) throws IOException {
        JarURLConnection connection = (JarURLConnection) resource.openConnection();
        try (JarFile jarFile = connection.getJarFile()) {
            String prefix = connection.getEntryName();
            if (!prefix.endsWith("/")) {
                prefix += "/";
            }
            for (JarEntry entry : jarFile.stream().sorted(java.util.Comparator.comparing(JarEntry::getName)).toList()) {
                String name = entry.getName();
                if (entry.isDirectory() || !name.startsWith(prefix) || !name.endsWith(".class") || name.contains("$")) {
                    continue;
                }
                String relativeName = name.substring(prefix.length());
                String[] segments = relativeName.split("/");
                if (segments.length != 2) {
                    continue;
                }
                registerRootClass(rootClassesByFeature, segments[0], segments[1].replaceFirst("\\.class$", ""));
            }
        }
    }

    private void registerRootClass(Map<String, List<String>> rootClassesByFeature, String featureName, String simpleName) {
        rootClassesByFeature
                .computeIfAbsent(featureName, ignored -> new ArrayList<>())
                .add("src.data." + featureName + "." + simpleName);
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
                + "' must expose exactly one root persistence contribution class named '" + expectedSimpleName
                + "' under src/data/" + featureName + "/. Found: " + rootClasses);
    }

    private String expectedContributionSimpleName(String featureName) {
        StringBuilder result = new StringBuilder();
        boolean capitalizeNext = true;
        for (char character : featureName.toCharArray()) {
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

    private PersistenceContribution instantiateContribution(ClassLoader classLoader, String className) {
        Class<?> rawType;
        try {
            rawType = Class.forName(className, true, classLoader);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load persistence contribution " + className + ".", exception);
        }

        if (!PersistenceContribution.class.isAssignableFrom(rawType)
                || rawType.isInterface()
                || Modifier.isAbstract(rawType.getModifiers())) {
            return null;
        }

        try {
            return (PersistenceContribution) rawType.getDeclaredConstructor().newInstance();
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException | NoSuchMethodException exception) {
            throw new IllegalStateException("Persistence contribution " + className
                    + " must expose a public no-arg constructor.", exception);
        }
    }
}

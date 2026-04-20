package bootstrap;

import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.jar.JarFile;
import org.jspecify.annotations.Nullable;
import shell.api.ShellContribution;

/**
 * Discovers shell contributions from the view-layer contribution roots.
 */
public final class ShellViewDiscovery {

    private static final List<ContributionRoot> CONTRIBUTION_ROOTS = List.of(
            new ContributionRoot("src/view/featuretabs", "src.view.featuretabs."),
            new ContributionRoot("src/view/runtimetabs", "src.view.runtimetabs."),
            new ContributionRoot("src/view/dropdowns", "src.view.dropdowns."));
    private static final String CLASS_SUFFIX = ".class";
    private static final String FILE_PROTOCOL = "file";
    private static final String JAR_PROTOCOL = "jar";

    public List<ShellContribution> discover() {
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = ShellViewDiscovery.class.getClassLoader();
        }
        List<ShellContribution> contributions = new ArrayList<>();
        for (String className : discoverContributionClassNames(classLoader)) {
            ShellContribution contribution = instantiateContribution(classLoader, className);
            if (contribution != null) {
                contributions.add(contribution);
            }
        }
        return contributions;
    }

    private List<String> discoverContributionClassNames(ClassLoader classLoader) {
        List<String> classNames = new ArrayList<>();
        try {
            for (ContributionRoot root : CONTRIBUTION_ROOTS) {
                Enumeration<URL> resources = classLoader.getResources(root.resourceRoot());
                while (resources.hasMoreElements()) {
                    URL resource = resources.nextElement();
                    if (FILE_PROTOCOL.equals(resource.getProtocol())) {
                        collectFromDirectory(Path.of(resource.toURI()), root, classNames);
                    } else if (JAR_PROTOCOL.equals(resource.getProtocol())) {
                        collectFromJar(resource, root, classNames);
                    }
                }
            }
        } catch (IOException | URISyntaxException exception) {
            throw new IllegalStateException("Could not discover shell contributions under src/view.", exception);
        }
        return classNames.stream().distinct().sorted().toList();
    }

    private void collectFromDirectory(Path rootDirectory, ContributionRoot root, List<String> classNames) throws IOException {
        if (!Files.isDirectory(rootDirectory)) {
            return;
        }
        try (var featureDirectories = Files.list(rootDirectory)) {
            for (Path featureDirectory : featureDirectories
                    .filter(Files::isDirectory)
                    .toList()) {
                collectContributionClasses(featureDirectory, root, classNames);
            }
        }
    }

    private void collectContributionClasses(
            Path contributionDirectory,
            ContributionRoot root,
            List<String> classNames) throws IOException {
        try (var files = Files.list(contributionDirectory)) {
            Path contributionDirectoryName = contributionDirectory.getFileName();
            if (contributionDirectoryName == null) {
                return;
            }
            String featureName = contributionDirectoryName.toString();
            for (Path classFile : files
                    .filter(Files::isRegularFile)
                    .filter(ShellViewDiscovery::isTopLevelContributionClass)
                    .toList()) {
                Path classFileName = classFile.getFileName();
                if (classFileName == null) {
                    continue;
                }
                String simpleName = classFileName.toString().replaceFirst("\\.class$", "");
                classNames.add(root.packagePrefix() + featureName + "." + simpleName);
            }
        }
    }

    private static boolean isTopLevelContributionClass(Path path) {
        Path fileName = path.getFileName();
        if (fileName == null) {
            return false;
        }
        String classFileName = fileName.toString();
        return classFileName.endsWith(CLASS_SUFFIX)
                && classFileName.endsWith("Contribution" + CLASS_SUFFIX)
                && !classFileName.contains("$");
    }

    private void collectFromJar(URL resource, ContributionRoot root, List<String> classNames) throws IOException {
        String rawPath = resource.getPath();
        int separatorIndex = rawPath.indexOf("!");
        if (separatorIndex < 0) {
            return;
        }
        String jarPath = rawPath.substring(0, separatorIndex).replaceFirst("^file:", "");
        try (JarFile jar = new JarFile(jarPath)) {
            jar.stream()
                    .map(java.util.zip.ZipEntry::getName)
                    .filter(name -> name.startsWith(root.resourceRoot() + "/"))
                    .filter(name -> name.endsWith(CLASS_SUFFIX))
                    .filter(name -> name.endsWith("Contribution" + CLASS_SUFFIX))
                    .filter(name -> name.indexOf('$') < 0)
                    .filter(name -> {
                        String relativeName = name.substring(root.resourceRoot().length() + 1);
                        return relativeName.indexOf('/') > 0
                                && relativeName.indexOf('/') == relativeName.lastIndexOf('/');
                    })
                    .map(name -> root.packagePrefix()
                            + name.substring(root.resourceRoot().length() + 1)
                                    .replace('/', '.')
                                    .replaceFirst("\\.class$", ""))
                    .forEach(classNames::add);
        }
    }

    private @Nullable ShellContribution instantiateContribution(ClassLoader classLoader, String className) {
        Class<?> rawType;
        try {
            rawType = Class.forName(className, true, classLoader);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load shell contribution " + className + ".", exception);
        }

        if (!ShellContribution.class.isAssignableFrom(rawType)
                || rawType.isInterface()
                || Modifier.isAbstract(rawType.getModifiers())) {
            return null;
        }

        try {
            return (ShellContribution) rawType.getDeclaredConstructor().newInstance();
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException | NoSuchMethodException exception) {
            throw new IllegalStateException("Shell contribution " + className + " must expose a public no-arg constructor.", exception);
        }
    }

    private record ContributionRoot(String resourceRoot, String packagePrefix) {
    }
}

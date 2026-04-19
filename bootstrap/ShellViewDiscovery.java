package bootstrap;

import org.jspecify.annotations.Nullable;
import shell.api.ShellContributionModel;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.jar.JarFile;

/**
 * Discovers shell contribution models from {@code src.view.models}.
 */
public final class ShellViewDiscovery {

    private static final String MODEL_ROOT = "src/view/models";
    private static final String MODEL_PACKAGE_PREFIX = "src.view.models.";
    private static final String CLASS_SUFFIX = ".class";
    private static final String FILE_PROTOCOL = "file";
    private static final String JAR_PROTOCOL = "jar";

    public List<ShellContributionModel> discover() {
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = ShellViewDiscovery.class.getClassLoader();
        }
        List<ShellContributionModel> contributions = new ArrayList<>();
        for (String className : discoverModelClassNames(classLoader)) {
            ShellContributionModel contribution = instantiateContribution(classLoader, className);
            if (contribution != null) {
                contributions.add(contribution);
            }
        }
        return contributions;
    }

    private List<String> discoverModelClassNames(ClassLoader classLoader) {
        List<String> classNames = new ArrayList<>();
        try {
            Enumeration<URL> resources = classLoader.getResources(MODEL_ROOT);
            while (resources.hasMoreElements()) {
                URL resource = resources.nextElement();
                if (FILE_PROTOCOL.equals(resource.getProtocol())) {
                    collectFromDirectory(Path.of(resource.toURI()), classNames);
                } else if (JAR_PROTOCOL.equals(resource.getProtocol())) {
                    collectFromJar(resource, classNames);
                }
            }
        } catch (IOException | URISyntaxException exception) {
            throw new IllegalStateException("Could not discover shell contribution models under " + MODEL_ROOT + ".", exception);
        }
        return classNames.stream().distinct().sorted().toList();
    }

    private void collectFromDirectory(Path modelDirectory, List<String> classNames) throws IOException {
        if (!Files.isDirectory(modelDirectory)) {
            return;
        }
        try (var files = Files.list(modelDirectory)) {
            for (Path classFile : files
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(CLASS_SUFFIX))
                    .filter(path -> !path.getFileName().toString().contains("$"))
                    .toList()) {
                String simpleName = classFile.getFileName().toString().replaceFirst("\\.class$", "");
                classNames.add(MODEL_PACKAGE_PREFIX + simpleName);
            }
        }
    }

    private void collectFromJar(URL resource, List<String> classNames) throws IOException {
        String rawPath = resource.getPath();
        int separatorIndex = rawPath.indexOf("!");
        if (separatorIndex < 0) {
            return;
        }
        String jarPath = rawPath.substring(0, separatorIndex).replaceFirst("^file:", "");
        try (JarFile jar = new JarFile(jarPath)) {
            jar.stream()
                    .map(entry -> entry.getName())
                    .filter(name -> name.startsWith(MODEL_ROOT + "/"))
                    .filter(name -> name.endsWith(CLASS_SUFFIX))
                    .filter(name -> name.indexOf('$') < 0)
                    .filter(name -> name.substring(MODEL_ROOT.length() + 1).indexOf('/') < 0)
                    .map(name -> MODEL_PACKAGE_PREFIX + name.substring(MODEL_ROOT.length() + 1).replaceFirst("\\.class$", ""))
                    .forEach(classNames::add);
        }
    }

    private @Nullable ShellContributionModel instantiateContribution(ClassLoader classLoader, String className) {
        Class<?> rawType;
        try {
            rawType = Class.forName(className, true, classLoader);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load shell contribution model " + className + ".", exception);
        }

        if (!ShellContributionModel.class.isAssignableFrom(rawType)
                || rawType.isInterface()
                || Modifier.isAbstract(rawType.getModifiers())) {
            return null;
        }

        try {
            return (ShellContributionModel) rawType.getDeclaredConstructor().newInstance();
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException | NoSuchMethodException exception) {
            throw new IllegalStateException("Shell contribution model " + className + " must expose a public no-arg constructor.", exception);
        }
    }
}

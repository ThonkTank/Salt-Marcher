package bootstrap;

import shell.host.RuntimeServiceProvider;
import shell.host.RuntimeServiceRegistry;

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
import java.util.List;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.stream.Stream;

/**
 * Discovers runtime service providers from {@code src.data}.
 */
final class RuntimeServiceDiscovery {

    private static final String DATA_ROOT = "src/data";

    RuntimeServiceRegistry discover() {
        RuntimeServiceRegistry.Builder builder = new RuntimeServiceRegistry.Builder();
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = RuntimeServiceDiscovery.class.getClassLoader();
        }
        try {
            Enumeration<URL> resources = classLoader.getResources(DATA_ROOT);
            while (resources.hasMoreElements()) {
                URL resource = resources.nextElement();
                if ("file".equals(resource.getProtocol())) {
                    registerProvidersFromDirectory(Path.of(resource.toURI()), classLoader, builder);
                    continue;
                }
                if ("jar".equals(resource.getProtocol())) {
                    registerProvidersFromJar(resource, classLoader, builder);
                }
            }
        } catch (IOException | URISyntaxException exception) {
            throw new IllegalStateException("Could not discover runtime service providers.", exception);
        }
        return builder.build();
    }

    private void registerProvidersFromDirectory(Path dataRoot, ClassLoader classLoader, RuntimeServiceRegistry.Builder builder)
            throws IOException {
        if (!Files.isDirectory(dataRoot)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(dataRoot)) {
            for (Path classFile : stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".class"))
                    .filter(path -> !path.getFileName().toString().contains("$"))
                    .sorted()
                    .toList()) {
                String relativeClassName = dataRoot.relativize(classFile).toString().replace('/', '.').replace('\\', '.');
                String className = "src.data." + relativeClassName.replaceFirst("\\.class$", "");
                instantiateProvider(classLoader, className, builder);
            }
        }
    }

    private void registerProvidersFromJar(URL resource, ClassLoader classLoader, RuntimeServiceRegistry.Builder builder) throws IOException {
        JarURLConnection connection = (JarURLConnection) resource.openConnection();
        try (JarFile jarFile = connection.getJarFile()) {
            String prefix = connection.getEntryName();
            if (!prefix.endsWith("/")) {
                prefix += "/";
            }
            final String jarPrefix = prefix;
            List<JarEntry> entries = jarFile.stream()
                    .filter(entry -> !entry.isDirectory())
                    .filter(entry -> entry.getName().startsWith(jarPrefix))
                    .filter(entry -> entry.getName().endsWith(".class"))
                    .filter(entry -> !entry.getName().contains("$"))
                    .sorted(Comparator.comparing(JarEntry::getName))
                    .toList();
            for (JarEntry entry : entries) {
                String relativeName = entry.getName().substring(jarPrefix.length()).replace('/', '.');
                instantiateProvider(classLoader, "src.data." + relativeName.replaceFirst("\\.class$", ""), builder);
            }
        }
    }

    private void instantiateProvider(ClassLoader classLoader, String className, RuntimeServiceRegistry.Builder builder) {
        Class<?> rawType;
        try {
            rawType = Class.forName(className, true, classLoader);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Could not load runtime service provider " + className + ".", exception);
        }

        if (!RuntimeServiceProvider.class.isAssignableFrom(rawType)
                || rawType.isInterface()
                || Modifier.isAbstract(rawType.getModifiers())) {
            return;
        }

        try {
            RuntimeServiceProvider provider = (RuntimeServiceProvider) rawType.getDeclaredConstructor().newInstance();
            provider.register(builder);
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException | NoSuchMethodException exception) {
            throw new IllegalStateException("Runtime service provider " + className
                    + " must expose a public no-arg constructor.", exception);
        }
    }
}

package bootstrap;

import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Stream;

final class ContributionRootClassScanner {

    private static final String FILE_PROTOCOL = "file";
    private static final String JAR_PROTOCOL = "jar";

    private final JarClassEntrySource jarClassEntrySource = new JarClassEntrySource();

    Map<String, List<String>> discoverRootClasses(
            ClassLoader classLoader,
            String resourceRoot,
            String packagePrefix
    ) {
        Map<String, List<String>> rootClassesBySegment = new TreeMap<>();
        try {
            Enumeration<URL> resources = classLoader.getResources(resourceRoot);
            while (resources.hasMoreElements()) {
                URL resource = resources.nextElement();
                if (FILE_PROTOCOL.equals(resource.getProtocol())) {
                    collectClassNamesFromDirectory(Path.of(resource.toURI()), packagePrefix, rootClassesBySegment);
                    continue;
                }
                if (JAR_PROTOCOL.equals(resource.getProtocol())) {
                    collectClassNamesFromJar(resource, packagePrefix, rootClassesBySegment);
                }
            }
        } catch (IOException | URISyntaxException exception) {
            throw new IllegalStateException("Could not discover contribution root classes under " + resourceRoot + ".", exception);
        }
        return rootClassesBySegment;
    }

    private void collectClassNamesFromDirectory(
            Path rootDirectory,
            String packagePrefix,
            Map<String, List<String>> rootClassesBySegment
    ) throws IOException {
        if (!Files.isDirectory(rootDirectory)) {
            return;
        }
        try (Stream<Path> segmentDirs = Files.list(rootDirectory)) {
            for (Path segmentDir : segmentDirs.filter(Files::isDirectory).sorted().toList()) {
                String segmentName = fileName(segmentDir);
                try (Stream<Path> classFiles = Files.list(segmentDir)) {
                    for (Path classFile : classFiles
                            .filter(Files::isRegularFile)
                            .filter(path -> fileName(path).endsWith(".class"))
                            .filter(path -> !fileName(path).contains("$"))
                            .sorted((left, right) -> fileName(left).compareTo(fileName(right)))
                            .toList()) {
                        registerRootClass(
                                rootClassesBySegment,
                                packagePrefix,
                                segmentName,
                                fileName(classFile).replaceFirst("\\.class$", ""));
                    }
                }
            }
        }
    }

    private void collectClassNamesFromJar(
            URL resource,
            String packagePrefix,
            Map<String, List<String>> rootClassesBySegment
    ) throws IOException {
        for (String relativeName : jarClassEntrySource.listRootClassEntries(resource)) {
            int separatorIndex = relativeName.indexOf('/');
            if (separatorIndex <= 0 || separatorIndex != relativeName.lastIndexOf('/')) {
                continue;
            }
            registerRootClass(
                    rootClassesBySegment,
                    packagePrefix,
                    relativeName.substring(0, separatorIndex),
                    relativeName.substring(separatorIndex + 1).replaceFirst("\\.class$", ""));
        }
    }

    private void registerRootClass(
            Map<String, List<String>> rootClassesBySegment,
            String packagePrefix,
            String segmentName,
            String simpleName
    ) {
        rootClassesBySegment
                .computeIfAbsent(segmentName, ignored -> new ArrayList<>())
                .add(packagePrefix + segmentName + "." + simpleName);
    }

    private static String fileName(Path path) {
        Path fileName = path.getFileName();
        if (fileName == null) {
            throw new IllegalArgumentException("Path has no file name: " + path);
        }
        return fileName.toString();
    }
}

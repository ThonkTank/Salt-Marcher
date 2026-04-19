package saltmarcher.architecture;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.Stream;

final class ArchitectureContext {

    private static final Set<String> IGNORED_REPOSITORY_SCAN_SEGMENTS =
            Set.of(".codex", ".git", ".gradle", "build");

    private final Path repoRoot;
    private List<SourceFile> sourceFiles;

    ArchitectureContext(Path repoRoot) {
        this.repoRoot = repoRoot;
    }

    Path repoRoot() {
        return repoRoot;
    }

    List<SourceFile> sourceFiles(ViolationSink violations) {
        if (sourceFiles == null) {
            sourceFiles = loadSourceFiles(violations);
        }
        return sourceFiles;
    }

    Set<String> domainFeatures(ViolationSink violations) {
        TreeSet<String> features = sourceFiles(violations).stream()
                .filter(SourceFile::isUnderDomainFeatureRoot)
                .map(SourceFile::featureName)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(TreeSet::new));
        Path domainRoot = repoRoot.resolve("src/domain");
        if (!Files.isDirectory(domainRoot)) {
            return features;
        }
        try (Stream<Path> stream = Files.list(domainRoot)) {
            stream.filter(Files::isDirectory)
                    .map(path -> path.getFileName().toString())
                    .forEach(features::add);
        } catch (IOException ignored) {
            // A scan-root violation is emitted by the domain directory rule.
        }
        return features;
    }

    Set<String> dataFeatures(ViolationSink violations) {
        return sourceFiles(violations).stream()
                .filter(SourceFile::isUnderDataFeatureRoot)
                .map(SourceFile::featureName)
                .filter(Objects::nonNull)
                .filter(featureName -> !featureName.equals("persistencecore"))
                .collect(Collectors.toCollection(TreeSet::new));
    }

    boolean domainNamedModuleTypeExists(String featureName, String simpleTypeName) {
        Path featureRoot = repoRoot.resolve("src/domain").resolve(featureName);
        if (!Files.isDirectory(featureRoot)) {
            return false;
        }
        try (Stream<Path> stream = Files.walk(featureRoot)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().equals(simpleTypeName + ".java"))
                    .map(this::relativeSegments)
                    .anyMatch(segments -> segments.size() >= 5
                            && "src".equals(segments.get(0))
                            && "domain".equals(segments.get(1))
                            && featureName.equals(segments.get(2))
                            && !Set.of("api", "application").contains(segments.get(3)));
        } catch (IOException ignored) {
            return false;
        }
    }

    boolean isIgnoredRepositoryScanPath(Path path) {
        return relativeSegments(path).stream().anyMatch(IGNORED_REPOSITORY_SCAN_SEGMENTS::contains);
    }

    boolean hasRepositoryContent(Path path) {
        if (isIgnoredRepositoryScanPath(path)) {
            return false;
        }
        if (Files.isRegularFile(path)) {
            return true;
        }
        if (!Files.isDirectory(path)) {
            return false;
        }
        try (Stream<Path> stream = Files.walk(path)) {
            return stream
                    .filter(candidate -> !candidate.equals(path))
                    .filter(candidate -> !isIgnoredRepositoryScanPath(candidate))
                    .anyMatch(Files::isRegularFile);
        } catch (IOException exception) {
            return true;
        }
    }

    String relativize(Path path) {
        return repoRoot.relativize(path.toAbsolutePath().normalize()).toString().replace('\\', '/');
    }

    List<String> relativeSegments(Path path) {
        String relativePath = relativize(path);
        if (relativePath.isBlank()) {
            return List.of();
        }
        return Arrays.asList(relativePath.split("/"));
    }

    private List<SourceFile> loadSourceFiles(ViolationSink violations) {
        List<SourceFile> files = new java.util.ArrayList<>();
        List<Path> roots = List.of(repoRoot.resolve("bootstrap"), repoRoot.resolve("shell"), repoRoot.resolve("src"));
        for (Path root : roots) {
            if (!Files.exists(root)) {
                continue;
            }
            try (Stream<Path> stream = Files.walk(root)) {
                stream.filter(Files::isRegularFile)
                        .filter(path -> path.getFileName().toString().endsWith(".java"))
                        .forEach(path -> {
                            try {
                                files.add(SourceFile.parse(repoRoot, path));
                            } catch (IOException exception) {
                                violations.add(contextPath(path), "file-readable",
                                        "Could not read source file: " + exception.getMessage());
                            }
                        });
            } catch (IOException exception) {
                violations.add(contextPath(root), "scan-root",
                        "Could not scan source root: " + exception.getMessage());
            }
        }
        return files.stream()
                .sorted(Comparator.comparing(SourceFile::relativePath))
                .toList();
    }

    private String contextPath(Path path) {
        return relativize(path);
    }
}

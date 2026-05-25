package saltmarcher.architecture;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import saltmarcher.architecture.domain.DomainRoleTopologySupport;

public final class ArchitectureContext {

    private static final String FOCUSED_VERIFICATION_PATHS_PROPERTY = "saltmarcher.focusedVerificationPaths";
    private static final Set<String> IGNORED_REPOSITORY_SCAN_SEGMENTS =
            Set.of(".codex", ".git", ".gradle", "build");
    private static final Pattern DOMAIN_CONTEXT_NAME_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Context Name:\\s+([A-Z][A-Za-z0-9_]*)\\s*$");
    private static final Pattern DOMAIN_APPLICATION_SERVICE_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Application Service:\\s+([A-Z][A-Za-z0-9_]*)\\s*$");

    private final Path repoRoot;
    private final List<String> focusedSourcePathPrefixes;
    private List<SourceFile> sourceFiles;

    public ArchitectureContext(Path repoRoot) {
        this.repoRoot = repoRoot;
        this.focusedSourcePathPrefixes = focusedSourcePathPrefixes();
    }

    public Path repoRoot() {
        return repoRoot;
    }

    public List<SourceFile> sourceFiles(ViolationSink violations) {
        if (sourceFiles == null) {
            sourceFiles = loadSourceFiles(violations);
        }
        return sourceFiles;
    }

    public Set<String> domainFeatures(ViolationSink violations) {
        TreeSet<String> features = sourceFiles(violations).stream()
                .filter(SourceFile::isUnderDomainFeatureRoot)
                .map(SourceFile::featureName)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(TreeSet::new));
        if (!focusedSourcePathPrefixes.isEmpty()) {
            return features;
        }
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

    public Set<String> dataFeatures(ViolationSink violations) {
        return sourceFiles(violations).stream()
                .filter(SourceFile::isUnderDataFeatureRoot)
                .map(SourceFile::featureName)
                .filter(Objects::nonNull)
                .filter(featureName -> !featureName.equals("persistencecore"))
                .collect(Collectors.toCollection(TreeSet::new));
    }

    public boolean domainNamedModuleTypeExists(String featureName, String simpleTypeName) {
        Path featureRoot = repoRoot.resolve("src/domain").resolve(featureName);
        if (!Files.isDirectory(featureRoot)) {
            return false;
        }
        try (Stream<Path> stream = Files.walk(featureRoot)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().equals(simpleTypeName + ".java"))
                    .map(this::relativeSegments)
                    .anyMatch(segments -> isLegacyDomainNamedModuleType(featureName, segments)
                            || DomainRoleTopologySupport.isModelRoleSource(segments, "model"));
        } catch (IOException ignored) {
            return false;
        }
    }

    private static boolean isLegacyDomainNamedModuleType(String featureName, List<String> segments) {
        return segments.size() == 6
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1))
                && featureName.equals(segments.get(2))
                && !Set.of("published", "application").contains(segments.get(3))
                && DomainRoleTopologySupport.isAllowedDomainRolePackage(segments.get(4));
    }

    public String domainContextName(String featureName) {
        Path document = repoRoot.resolve("src/domain").resolve(featureName).resolve("DOMAIN.md");
        if (!Files.isRegularFile(document)) {
            return null;
        }
        try {
            List<String> contextNames =
                    declaredDomainContextNames(Files.readString(document, StandardCharsets.UTF_8));
            return contextNames.size() == 1 ? contextNames.getFirst() : null;
        } catch (IOException ignored) {
            return null;
        }
    }

    public List<String> domainApplicationServices(String featureName) {
        Path document = repoRoot.resolve("src/domain").resolve(featureName).resolve("DOMAIN.md");
        if (!Files.isRegularFile(document)) {
            return List.of();
        }
        try {
            return declaredDomainApplicationServices(Files.readString(document, StandardCharsets.UTF_8));
        } catch (IOException ignored) {
            return List.of();
        }
    }

    public boolean isIgnoredRepositoryScanPath(Path path) {
        return relativeSegments(path).stream().anyMatch(IGNORED_REPOSITORY_SCAN_SEGMENTS::contains);
    }

    public boolean hasRepositoryContent(Path path) {
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

    public String relativize(Path path) {
        return repoRoot.relativize(path.toAbsolutePath().normalize()).toString().replace('\\', '/');
    }

    public List<String> relativeSegments(Path path) {
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
                        .filter(this::isFocusedSourcePath)
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

    private boolean isFocusedSourcePath(Path path) {
        if (focusedSourcePathPrefixes.isEmpty()) {
            return true;
        }
        String relativePath = relativize(path);
        return focusedSourcePathPrefixes.stream().anyMatch(prefix ->
                relativePath.equals(prefix) || relativePath.startsWith(prefix + "/"));
    }

    private static List<String> focusedSourcePathPrefixes() {
        String rawPaths = System.getProperty(FOCUSED_VERIFICATION_PATHS_PROPERTY, "");
        if (rawPaths.isBlank()) {
            return List.of();
        }
        return Arrays.stream(rawPaths.split(","))
                .map(String::trim)
                .map(path -> path.replace('\\', '/'))
                .map(path -> path.startsWith("./") ? path.substring(2) : path)
                .map(path -> path.endsWith("/") ? path.substring(0, path.length() - 1) : path)
                .filter(path -> !path.isBlank())
                .distinct()
                .sorted()
                .toList();
    }

    private static List<String> declaredDomainContextNames(String content) {
        List<String> result = new java.util.ArrayList<>();
        Matcher matcher = DOMAIN_CONTEXT_NAME_MARKER_PATTERN.matcher(content);
        while (matcher.find()) {
            result.add(matcher.group(1));
        }
        return result.stream().sorted().toList();
    }

    private static List<String> declaredDomainApplicationServices(String content) {
        List<String> result = new java.util.ArrayList<>();
        Matcher matcher = DOMAIN_APPLICATION_SERVICE_MARKER_PATTERN.matcher(content);
        while (matcher.find()) {
            result.add(matcher.group(1).trim());
        }
        return result.stream().sorted().distinct().toList();
    }
}

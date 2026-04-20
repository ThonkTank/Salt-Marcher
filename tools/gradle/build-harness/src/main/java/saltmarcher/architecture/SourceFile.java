package saltmarcher.architecture;

import static saltmarcher.architecture.ArchitectureNaming.expectedDataRootFileName;
import static saltmarcher.architecture.ArchitectureNaming.expectedDataSchemaFileName;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

record SourceFile(
        String relativePath,
        List<String> relativeSegments,
        String fileName,
        String content,
        String packageName,
        SourceKind kind,
        String featureName
) {
    private static final Pattern PACKAGE_PATTERN =
            Pattern.compile("(?m)^\\s*package\\s+([A-Za-z_][\\w.]*)\\s*;");

    static SourceFile parse(Path repoRoot, Path path) throws IOException {
        String content = Files.readString(path, StandardCharsets.UTF_8);
        String relativePath = repoRoot.relativize(path.toAbsolutePath().normalize()).toString().replace('\\', '/');
        List<String> relativeSegments = Arrays.asList(relativePath.split("/"));
        String fileName = path.getFileName().toString();
        String packageName = extractPackage(content);
        SourceKind kind = classify(relativeSegments, fileName);
        String featureName = extractFeatureName(relativeSegments);
        return new SourceFile(relativePath, relativeSegments, fileName, content, packageName, kind, featureName);
    }

    boolean isUnderDataFeatureRoot() {
        return relativeSegments.size() >= 3
                && "src".equals(relativeSegments.get(0))
                && "data".equals(relativeSegments.get(1))
                && !"persistencecore".equals(relativeSegments.get(2));
    }

    boolean isUnderDomainFeatureRoot() {
        return relativeSegments.size() >= 3
                && "src".equals(relativeSegments.get(0))
                && "domain".equals(relativeSegments.get(1));
    }

    private static String extractPackage(String content) {
        Matcher matcher = PACKAGE_PATTERN.matcher(content);
        return matcher.find() ? matcher.group(1) : "";
    }

    private static SourceKind classify(List<String> segments, String fileName) {
        if (segments.isEmpty()) {
            return SourceKind.UNKNOWN;
        }
        String root = segments.getFirst();
        if ("bootstrap".equals(root)) {
            return SourceKind.BOOTSTRAP;
        }
        if ("shell".equals(root) && segments.size() >= 2) {
            return "host".equals(segments.get(1)) ? SourceKind.SHELL_HOST
                    : "panel".equals(segments.get(1)) ? SourceKind.SHELL_PANEL : SourceKind.UNKNOWN;
        }
        if (segments.size() < 3 || !"src".equals(root)) {
            return SourceKind.UNKNOWN;
        }
        return switch (segments.get(1)) {
            case "view" -> {
                if (segments.size() == 4 && segments.get(2).equals("views")) {
                    yield SourceKind.VIEW_PANEL;
                }
                if (segments.size() == 5 && Set.of("tabs", "topbar", "state", "details").contains(segments.get(2))) {
                    if (Set.of("tabs", "topbar", "state").contains(segments.get(2))
                            && fileName.endsWith("Contribution.java")) {
                        yield SourceKind.VIEW_CONTRIBUTION;
                    }
                    if (fileName.endsWith("ViewModel.java")) {
                        yield SourceKind.VIEW_MODEL;
                    }
                    if (fileName.endsWith("View.java")) {
                        yield SourceKind.VIEW_PANEL;
                    }
                }
                yield SourceKind.UNKNOWN;
            }
            case "domain" -> {
                if (segments.size() == 4) {
                    yield SourceKind.DOMAIN_ROOT;
                }
                yield switch (segments.get(3)) {
                    case "published" -> SourceKind.DOMAIN_PUBLISHED;
                    case "application" -> SourceKind.DOMAIN_APPLICATION;
                    default -> segments.size() == 6 ? SourceKind.DOMAIN_ROLE : SourceKind.UNKNOWN;
                };
            }
            case "data" -> {
                if (segments.size() == 4) {
                    yield fileName.equals(expectedDataRootFileName(extractFeatureName(segments)))
                            ? SourceKind.DATA_ROOT
                            : SourceKind.UNKNOWN;
                }
                if (segments.size() < 5) {
                    yield SourceKind.UNKNOWN;
                }
                if ("persistencecore".equals(segments.get(2))) {
                    yield switch (segments.get(3)) {
                        case "sqlite" -> SourceKind.DATA_PERSISTENCECORE_SQLITE;
                        case "model" -> fileName.equals(expectedDataSchemaFileName(extractFeatureName(segments)))
                                ? SourceKind.DATA_SCHEMA
                                : SourceKind.DATA_MODEL;
                        default -> SourceKind.UNKNOWN;
                    };
                }
                yield switch (segments.get(3)) {
                    case "repository" -> SourceKind.DATA_REPOSITORY;
                    case "query" -> SourceKind.DATA_QUERY;
                    case "model" -> fileName.equals(expectedDataSchemaFileName(extractFeatureName(segments)))
                            ? SourceKind.DATA_SCHEMA
                            : SourceKind.DATA_MODEL;
                    case "mapper" -> SourceKind.DATA_MAPPER;
                    case "gateway" -> {
                        if (segments.size() < 6) {
                            yield SourceKind.UNKNOWN;
                        }
                        yield switch (segments.get(4)) {
                            case "local" -> SourceKind.DATA_GATEWAY_LOCAL;
                            case "remote" -> SourceKind.DATA_GATEWAY_REMOTE;
                            default -> SourceKind.UNKNOWN;
                        };
                    }
                    default -> SourceKind.UNKNOWN;
                };
            }
            default -> SourceKind.UNKNOWN;
        };
    }

    private static String extractFeatureName(List<String> segments) {
        if (segments.size() < 3) {
            return null;
        }
        if ("src".equals(segments.get(0)) && Set.of("domain", "data").contains(segments.get(1))) {
            return segments.get(2);
        }
        if ("src".equals(segments.get(0)) && "view".equals(segments.get(1))) {
            return segments.size() >= 4 ? segments.get(3) : null;
        }
        return null;
    }
}

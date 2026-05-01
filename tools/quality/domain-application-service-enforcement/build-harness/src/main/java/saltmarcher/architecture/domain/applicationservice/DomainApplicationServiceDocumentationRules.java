package saltmarcher.architecture.domain.applicationservice;

import static saltmarcher.architecture.ArchitectureNaming.expectedDomainRootFileName;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.SourceKind;
import saltmarcher.architecture.ViolationSink;

public final class DomainApplicationServiceDocumentationRules implements ArchitectureRule {

    private static final Pattern DOMAIN_CONTEXT_NAME_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Context Name:\\s+([A-Z][A-Za-z0-9_]*)\\s*$");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Set<String> domainFeatures = context.domainFeatures(violations);
        List<SourceFile> sourceFiles = context.sourceFiles(violations);
        validateDomainRootNamesMatchDeclaredContext(context, domainFeatures, sourceFiles, violations);
    }

    private void validateDomainRootNamesMatchDeclaredContext(
            ArchitectureContext context,
            Set<String> domainFeatures,
            List<SourceFile> sourceFiles,
            ViolationSink violations) {
        TreeMap<String, List<SourceFile>> rootsByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() == SourceKind.DOMAIN_ROOT) {
                rootsByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
        }

        for (String featureName : domainFeatures) {
            String contextName = declaredDomainContextName(context, featureName);
            if (contextName == null || contextName.isBlank()) {
                continue;
            }
            String expectedFileName = expectedDomainRootFileName(featureName, contextName);
            List<SourceFile> roots = rootsByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            if (roots.stream().noneMatch(sourceFile -> expectedFileName.equals(sourceFile.fileName()))) {
                String actualFiles = roots.isEmpty()
                        ? "none found"
                        : roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
                violations.add("src/domain/" + featureName + "/DOMAIN.md", "domain-applicationservice-root-presence",
                        "Context document declares '" + contextName + "', so src/domain/" + featureName
                                + "/ must expose " + expectedFileName + ". Found: " + actualFiles);
            }
        }
    }

    private String declaredDomainContextName(ArchitectureContext context, String featureName) {
        Path document = context.repoRoot().resolve("src/domain").resolve(featureName).resolve("DOMAIN.md");
        if (!Files.isRegularFile(document)) {
            return null;
        }
        try {
            List<String> declaredNames = declaredDomainContextNames(Files.readString(document, StandardCharsets.UTF_8));
            return declaredNames.size() == 1 ? declaredNames.getFirst() : null;
        } catch (IOException ignored) {
            return null;
        }
    }

    private static List<String> declaredDomainContextNames(String content) {
        Matcher matcher = DOMAIN_CONTEXT_NAME_MARKER_PATTERN.matcher(content);
        List<String> matches = new java.util.ArrayList<>();
        while (matcher.find()) {
            matches.add(matcher.group(1).trim());
        }
        return matches;
    }
}

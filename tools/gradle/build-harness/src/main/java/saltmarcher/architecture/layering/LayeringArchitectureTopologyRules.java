package saltmarcher.architecture.layering;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;

public final class LayeringArchitectureTopologyRules implements ArchitectureRule {

    private static final Pattern INCLUDED_BUILD_PATTERN =
            Pattern.compile("\\bincludeBuild\\s*\\(\\s*\"([^\"]+)\"\\s*\\)");
    private static final Set<String> ACTIVE_JAVA_ROOT_ALLOWLIST =
            Set.of("bootstrap", "shell", "src", "test", "tools", "salt-marcher");
    private static final Set<String> SRC_DIRECT_CHILD_ALLOWLIST =
            Set.of("features", "view", "domain", "data");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        validateActiveJavaRootAllowlist(context, violations);
        validateSrcDirectChildAllowlist(context, violations);
        validateIncludedBuildTaxonomy(context, violations);
        new LayeringPassiveCarrierMirrorRules().check(context, violations);
    }

    private void validateActiveJavaRootAllowlist(ArchitectureContext context, ViolationSink violations) {
        try (Stream<Path> stream = Files.walk(context.repoRoot())) {
            stream.filter(path -> !context.isIgnoredRepositoryScanPath(path))
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> {
                        List<String> segments = context.relativeSegments(path);
                        if (segments.isEmpty()) {
                            return;
                        }
                        String root = segments.getFirst();
                        if (!ACTIVE_JAVA_ROOT_ALLOWLIST.contains(root)) {
                            violations.add(context.relativize(path), "repository-active-java-root-allowlist",
                                    "Java source files must live under bootstrap/, shell/, src/, test/, tools/,"
                                            + " or legacy salt-marcher/. Do not create alternate active feature-code roots.");
                        }
                    });
        } catch (IOException exception) {
            violations.add(".", "scan-root",
                    "Could not scan repository Java source roots: " + exception.getMessage());
        }
    }

    private void validateSrcDirectChildAllowlist(ArchitectureContext context, ViolationSink violations) {
        Path srcRoot = context.repoRoot().resolve("src");
        if (!Files.isDirectory(srcRoot)) {
            return;
        }
        try (Stream<Path> stream = Files.list(srcRoot)) {
            stream.filter(path -> !SRC_DIRECT_CHILD_ALLOWLIST.contains(path.getFileName().toString()))
                    .filter(context::hasRepositoryContent)
                    .forEach(path -> violations.add(context.relativize(path), "repository-src-direct-child-allowlist",
                            "The src/ root may contain only features/, view/, domain/, and data/ as non-empty direct children."
                                    + " Migrated feature runtime code must be added under src/features/."));
        } catch (IOException exception) {
            violations.add(context.relativize(srcRoot), "scan-root",
                    "Could not scan src/ direct children: " + exception.getMessage());
        }
    }

    private void validateIncludedBuildTaxonomy(ArchitectureContext context, ViolationSink violations) {
        Path settingsFile = context.repoRoot().resolve("settings.gradle.kts");
        if (!Files.isRegularFile(settingsFile)) {
            return;
        }

        String content;
        try {
            content = Files.readString(settingsFile, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add("settings.gradle.kts", "file-readable",
                    "Could not read Gradle settings file: " + exception.getMessage());
            return;
        }

        Matcher matcher = INCLUDED_BUILD_PATTERN.matcher(content);
        while (matcher.find()) {
            String includedBuild = matcher.group(1);
            Path normalized = Path.of(includedBuild).normalize();
            if (normalized.isAbsolute() || normalized.startsWith("..")) {
                violations.add("settings.gradle.kts", "repository-included-build-taxonomy",
                        "Included Gradle builds must use repository-relative paths under tools/gradle/ or tools/quality/. Found: "
                                + includedBuild);
                continue;
            }
            String normalizedPath = normalized.toString().replace('\\', '/');
            if (!normalizedPath.startsWith("tools/gradle/")
                    && !normalizedPath.startsWith("tools/quality/")) {
                violations.add("settings.gradle.kts", "repository-included-build-taxonomy",
                        "Included Gradle builds must live under tools/gradle/ or tools/quality/. Found: "
                                + includedBuild);
            }
        }
    }
}

package saltmarcher.architecture.system;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;

public final class BuildHarnessPolicyRules implements ArchitectureRule {

    private static final Pattern SELF_TEST_FILE_PATTERN =
            Pattern.compile(".*SelfTest.*\\.java$");
    private static final List<String> LEGACY_SAME_WORKTREE_ISOLATION_FILES = List.of(
            "tools/gradle/prepare-isolated-gradle-env.sh",
            "tools/gradle/finalize-isolated-gradle-run.sh",
            "tools/gradle/saltmarcher-isolation.init.gradle.kts");
    private static final String QUALITY_PLATFORMS_WORKFLOW = ".github/workflows/quality-platforms.yml";

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        checkLegacyIsolationArtifacts(context, violations);
        checkQualityPlatformsWorkflow(context, violations);

        Path fixturesRoot = context.repoRoot().resolve("tools/gradle/build-harness/src/fixtures");
        if (Files.exists(fixturesRoot)) {
            violations.add(context.relativize(fixturesRoot), "build-harness-no-selftests",
                    "build-harness fixtures are forbidden. Enforce repository policy directly in architectureCheck instead of fixture-based selftests.");
        }

        Path mainJavaRoot = context.repoRoot().resolve("tools/gradle/build-harness/src/main/java");
        if (!Files.isDirectory(mainJavaRoot)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(mainJavaRoot)) {
            stream.filter(Files::isRegularFile)
                    .filter(path -> SELF_TEST_FILE_PATTERN.matcher(path.getFileName().toString()).matches())
                    .forEach(path -> violations.add(context.relativize(path), "build-harness-no-selftests",
                            "build-harness self-test mains are forbidden. Keep verification in architectureCheck instead of a separate meta-test layer."));
        } catch (IOException exception) {
            violations.add(context.relativize(mainJavaRoot), "scan-root",
                    "Could not scan build-harness policy root: " + exception.getMessage());
        }
    }

    private void checkLegacyIsolationArtifacts(ArchitectureContext context, ViolationSink violations) {
        for (String relativePath : LEGACY_SAME_WORKTREE_ISOLATION_FILES) {
            Path legacyPath = context.repoRoot().resolve(relativePath);
            if (Files.exists(legacyPath)) {
                violations.add(relativePath, "legacy-same-worktree-isolation-forbidden",
                        "Legacy same-worktree Gradle isolation is forbidden. Use linked git worktrees plus branch-gated verification instead.");
            }
        }
    }

    private void checkQualityPlatformsWorkflow(ArchitectureContext context, ViolationSink violations) {
        Path workflowFile = context.repoRoot().resolve(QUALITY_PLATFORMS_WORKFLOW);
        if (!Files.isRegularFile(workflowFile)) {
            return;
        }
        try {
            String content = Files.readString(workflowFile, StandardCharsets.UTF_8);
            if (!content.contains("merge_group:")) {
                violations.add(QUALITY_PLATFORMS_WORKFLOW, "quality-platforms-merge-group-required",
                        "quality-platforms workflow must run on merge_group so protected-branch checks stay valid for merge-queue integration.");
            }
            if (!content.contains("concurrency:")) {
                violations.add(QUALITY_PLATFORMS_WORKFLOW, "quality-platforms-concurrency-required",
                        "quality-platforms workflow must define workflow concurrency so superseded branch runs do not waste CI capacity.");
            }
            if (!content.contains("cancel-in-progress: true")) {
                violations.add(QUALITY_PLATFORMS_WORKFLOW, "quality-platforms-cancel-in-progress-required",
                        "quality-platforms workflow concurrency must cancel superseded in-progress runs.");
            }
        } catch (IOException exception) {
            violations.add(QUALITY_PLATFORMS_WORKFLOW, "workflow-readable",
                    "Could not read quality-platforms workflow: " + exception.getMessage());
        }
    }
}

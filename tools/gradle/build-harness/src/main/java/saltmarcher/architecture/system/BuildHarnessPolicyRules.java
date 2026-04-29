package saltmarcher.architecture.system;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;

public final class BuildHarnessPolicyRules implements ArchitectureRule {

    private static final Pattern SELF_TEST_FILE_PATTERN =
            Pattern.compile(".*SelfTest.*\\.java$");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
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
}

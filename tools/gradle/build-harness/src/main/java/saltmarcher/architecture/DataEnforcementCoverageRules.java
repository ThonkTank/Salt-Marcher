package saltmarcher.architecture;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

final class DataEnforcementCoverageRules implements ArchitectureRule {

    private static final String COVERAGE_PATH = "docs/standards/architecture-enforcement-coverage-data-system.md";
    private static final List<String> REQUIRED_DATA_COVERAGE_RULES = List.of(
            "data-root-service-contribution-only",
            "data-feature-bucket-layout",
            "data-feature-composition-root-presence",
            "data-feature-schema-contract",
            "data-service-contribution-shape",
            "data-service-registry-root-only",
            "data-composition-no-source-mechanics",
            "data-port-adapter-no-source-mechanics",
            "data-mapper-no-source-mechanics",
            "data-query-read-only-source-shape",
            "data-schema-ddl-placement",
            "data-schema-table-name-owned-by-schema",
            "data-port-adapter-role-contract",
            "data-port-adapter-public-signature-boundary",
            "data-port-adapter-gateway-collaborator-boundary",
            "data-gateway-public-signature-boundary",
            "data-gateway-domain-independence",
            "data-outer-layer-independence",
            "data-non-root-shell-independence",
            "data-model-domain-independence",
            "data-persistencecore-generic-only",
            "data-foreign-feature-public-boundary",
            "data-foreign-private-data-bucket-isolation",
            "data-feature-cycles",
            "data-enforcement-coverage-complete");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Path coverageDocument = context.repoRoot().resolve(COVERAGE_PATH);
        if (!Files.isRegularFile(coverageDocument)) {
            violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                    "Data enforcement coverage must document every required enforced data-layer rule.");
            return;
        }

        String content;
        try {
            content = Files.readString(coverageDocument, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(COVERAGE_PATH, "file-readable",
                    "Could not read data enforcement coverage: " + exception.getMessage());
            return;
        }

        for (String ruleId : REQUIRED_DATA_COVERAGE_RULES) {
            String line = lineContaining(content, "`" + ruleId + "`");
            if (line == null) {
                violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                        "Data enforcement coverage must list required rule id `" + ruleId + "`.");
                continue;
            }
            if (!line.contains("./gradlew") || !lineContainsMechanicalOwner(line)) {
                violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                        "Coverage row for `" + ruleId
                                + "` must name a mechanical owner and blocking Gradle entrypoint.");
            }
        }
    }

    private static String lineContaining(String content, String needle) {
        for (String line : content.split("\\R")) {
            if (line.contains(needle)) {
                return line;
            }
        }
        return null;
    }

    private static boolean lineContainsMechanicalOwner(String line) {
        return line.contains("build-harness")
                || line.contains("PMD")
                || line.contains("Error Prone")
                || line.contains("ArchUnit")
                || line.contains("Gradle");
    }
}

package saltmarcher.architecture;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

final class DataEnforcementCoverageRules implements ArchitectureRule {

    private static final String COVERAGE_PATH = "docs/standards/architecture-enforcement-coverage-data-system.md";
    private static final List<String> REQUIRED_ENFORCED_DATA_RULES = List.of(
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
    private static final List<String> REQUIRED_DATA_RULE_GROUPS = List.of(
            "data-adapter-zone-purpose",
            "data-ports-domain-owned",
            "data-role-bucket-placement",
            "data-active-record-rejected",
            "data-source-mechanics-owned-by-gateway",
            "data-source-local-shapes-owned-by-model",
            "data-single-write-model",
            "data-runtime-composition-root",
            "data-bootstrap-shell-no-source-wiring",
            "data-cross-feature-boundary",
            "data-service-contribution-thinness",
            "data-repository-write-model-role",
            "data-query-read-only-role",
            "data-gateway-internal-source-adapter",
            "data-model-schema-source-local",
            "data-mapper-translation-only",
            "data-persistencecore-generic-only-rule",
            "data-forbidden-business-policy",
            "data-view-shell-private-data-access",
            "data-domain-no-source-mechanics",
            "data-source-adapter-no-public-capabilities",
            "data-duplicate-schema-truth");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Path coverageDocument = context.repoRoot().resolve(COVERAGE_PATH);
        if (!Files.isRegularFile(coverageDocument)) {
            violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                    "Data enforcement coverage must document every required enforced data-layer rule and rule group.");
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

        validateRequiredEnforcedRules(content, violations);
        validateRequiredRuleGroups(content, violations);
    }

    private static void validateRequiredEnforcedRules(String content, ViolationSink violations) {
        for (String ruleId : REQUIRED_ENFORCED_DATA_RULES) {
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

    private static void validateRequiredRuleGroups(String content, ViolationSink violations) {
        for (String ruleGroupId : REQUIRED_DATA_RULE_GROUPS) {
            String line = lineContaining(content, "`" + ruleGroupId + "`");
            if (line == null) {
                violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                        "Data enforcement coverage must classify data-layer rule group `"
                                + ruleGroupId + "` as Enforced, Enforced Elsewhere, or Review-Owned.");
                continue;
            }
            if (!lineContainsRuleGroupStatus(line)) {
                violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                        "Coverage row for data-layer rule group `" + ruleGroupId
                                + "` must use status Enforced, Enforced Elsewhere, or Review-Owned.");
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

    private static boolean lineContainsRuleGroupStatus(String line) {
        return line.contains("Enforced Elsewhere")
                || line.contains("Enforced")
                || line.contains("Review-Owned");
    }
}

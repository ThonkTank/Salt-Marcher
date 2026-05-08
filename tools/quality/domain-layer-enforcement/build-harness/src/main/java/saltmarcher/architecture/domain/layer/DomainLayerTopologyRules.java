package saltmarcher.architecture.domain.layer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.system.SourceLayoutRules;

public final class DomainLayerTopologyRules implements ArchitectureRule {

    private static final Set<String> FORBIDDEN_TOP_LEVEL_BUCKETS = Set.of(
            "adapter",
            "adapters",
            "aggregate",
            "aggregates",
            "applications",
            "controller",
            "controllers",
            "datasource",
            "datasources",
            "entity",
            "entities",
            "event",
            "events",
            "factory",
            "factories",
            "gateway",
            "gateways",
            "interactor",
            "interactors",
            "mapper",
            "mappers",
            "query",
            "queries",
            "port",
            "ports",
            "record",
            "records",
            "repository",
            "repositories",
            "schema",
            "schemas",
            "service",
            "services",
            "specification",
            "specifications",
            "usecase",
            "usecases",
            "valueobject",
            "valueobjects",
            "view",
            "viewmodel");
    private static final Set<String> ROOT_TECHNICAL_BUCKETS = Set.of("published", "application", "model");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        validateDomainFeatureDirectories(context, violations);
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            validateNamedModuleFileLayout(sourceFile, violations);
        }
    }

    private void validateDomainFeatureDirectories(ArchitectureContext context, ViolationSink violations) {
        Path domainRoot = context.repoRoot().resolve("src/domain");
        if (!Files.isDirectory(domainRoot)) {
            return;
        }
        try (Stream<Path> stream = Files.list(domainRoot)) {
            stream.filter(Files::isDirectory)
                    .sorted()
                    .forEach(featureRoot -> validateDomainFeatureDirectory(context, featureRoot, violations));
        } catch (IOException exception) {
            violations.add(context.relativize(domainRoot), "scan-root",
                    "Could not scan domain feature root: " + exception.getMessage());
        }
    }

    private void validateDomainFeatureDirectory(
            ArchitectureContext context,
            Path featureRoot,
            ViolationSink violations) {
        try (Stream<Path> stream = Files.list(featureRoot)) {
            stream.filter(Files::isDirectory)
                    .sorted()
                    .forEach(directory -> validateDomainBucket(context.relativize(directory), directory.getFileName().toString(), violations));
        } catch (IOException exception) {
            violations.add(context.relativize(featureRoot), "scan-root",
                    "Could not scan domain feature directory: " + exception.getMessage());
        }
    }

    private void validateNamedModuleFileLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (!isNamedModuleSource(segments)) {
            return;
        }

        if (isModelFamilySource(segments)) {
            validateModelFamilyFileLayout(sourceFile, violations);
            return;
        }

        if (segments.size() < 6) {
            violations.add(sourceFile.relativePath(), "domain-layer-named-module-role-subpackage-required",
                    "Named domain modules must place Java files under an allowed tactical role package at src/domain/<context>/<module>/<role>/.");
            return;
        }

        String role = segments.get(4);
        if (!SourceLayoutRules.isAllowedDomainRolePackage(role)) {
            violations.add(sourceFile.relativePath(), "domain-layer-tactical-role-package-name-allowlist",
                    "Domain tactical role packages must be one of: aggregate, entity, value, policy, port, factory, service, event, specification.");
            return;
        }

        if (segments.size() != 6) {
            violations.add(sourceFile.relativePath(), "domain-layer-named-module-role-subpackage-required",
                    "Domain tactical role package Java files must stay as direct files under src/domain/<context>/<module>/<role>/.");
        }
    }

    private void validateModelFamilyFileLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 7) {
            violations.add(sourceFile.relativePath(), "domain-layer-named-module-role-subpackage-required",
                    "Model families must place Java files under src/domain/<context>/model/<family>/<role>/.");
            return;
        }

        String role = segments.get(5);
        if (!SourceLayoutRules.isAllowedDomainRolePackage(role)) {
            violations.add(sourceFile.relativePath(), "domain-layer-tactical-role-package-name-allowlist",
                    "Model-family role packages must be one of: aggregate, constants, entity, event, factory, helper, policy, port, repository, service, specification, usecase, value.");
            return;
        }

        if (segments.size() != 7) {
            violations.add(sourceFile.relativePath(), "domain-layer-named-module-role-subpackage-required",
                    "Model-family Java files must stay as direct files under src/domain/<context>/model/<family>/<role>/.");
        }
    }

    private static boolean isNamedModuleSource(List<String> segments) {
        return segments.size() >= 5
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1))
                && !ROOT_TECHNICAL_BUCKETS.contains(segments.get(3));
    }

    private static boolean isModelFamilySource(List<String> segments) {
        return segments.size() >= 6
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1))
                && "model".equals(segments.get(3));
    }

    private static void validateDomainBucket(String source, String bucket, ViolationSink violations) {
        if (ROOT_TECHNICAL_BUCKETS.contains(bucket)) {
            return;
        }
        if ("api".equals(bucket)) {
            violations.add(source, "domain-layer-forbidden-top-level-domain-buckets",
                    "Domain api/ packages have been replaced by published/.");
            return;
        }
        if (FORBIDDEN_TOP_LEVEL_BUCKETS.contains(bucket)) {
            violations.add(source, "domain-layer-forbidden-top-level-domain-buckets",
                    "Top-level technical role buckets are forbidden under src/domain/<context>/. Use published/, application/, model/, or a lower-case named domain module.");
            return;
        }
        if (!bucket.matches("[a-z][a-z0-9_]*")) {
            violations.add(source, "domain-layer-forbidden-top-level-domain-buckets",
                    "Direct non-published, non-application, non-model domain buckets must be lower-case named domain modules matching [a-z][a-z0-9_]*.");
        }
    }
}

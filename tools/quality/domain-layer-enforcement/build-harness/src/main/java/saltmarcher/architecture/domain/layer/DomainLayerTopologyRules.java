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

    private static final Set<String> ROOT_TECHNICAL_BUCKETS = Set.of("published", "application", "model");
    private static final Set<String> LEGACY_ROLE_SUFFIXES = Set.of(
            "Aggregate.java",
            "BoundaryTranslator.java",
            "Entity.java",
            "Factory.java",
            "Policy.java",
            "Projector.java",
            "RuntimeAccess.java",
            "RuntimeAdapter.java",
            "Service.java",
            "Specification.java");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        validateDomainFeatureDirectories(context, violations);
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            validateDomainSourceLayout(sourceFile, violations);
            validateReservedRoleSuffixPlacement(sourceFile, violations);
            validateLegacyRoleSuffixRejection(sourceFile, violations);
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

    private void validateDomainSourceLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (!isDomainSource(segments) || segments.size() < 5) {
            return;
        }

        if ("model".equals(segments.get(3))) {
            validateModelFamilyFileLayout(sourceFile, violations);
            return;
        }

        if (!ROOT_TECHNICAL_BUCKETS.contains(segments.get(3))) {
            violations.add(sourceFile.relativePath(), "domain-layer-forbidden-top-level-domain-buckets",
                    "Domain Java sources may live only under direct root ApplicationService files, published/, application/, or model/.");
        }
    }

    private void validateModelFamilyFileLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() == 5) {
            violations.add(sourceFile.relativePath(), "domain-layer-model-root-family-directories-only",
                    "src/domain/<context>/model/ may contain only lower-case family directories, not direct Java files.");
            return;
        }

        String family = segments.get(4);
        if (!family.matches("[a-z][a-z0-9_]*")) {
            violations.add(sourceFile.relativePath(), "domain-layer-model-root-family-directories-only",
                    "Model family directories must be lower-case names matching [a-z][a-z0-9_]*.");
            return;
        }

        if (segments.size() == 6) {
            violations.add(sourceFile.relativePath(), "domain-layer-model-family-role-subpackage-required",
                    "Model families must place Java files under src/domain/<context>/model/<family>/<role>/.");
            return;
        }

        String role = segments.get(5);
        if (!SourceLayoutRules.isAllowedTargetDomainRolePackage(role)) {
            violations.add(sourceFile.relativePath(), "domain-layer-model-role-package-name-allowlist",
                    "Model-family role packages must be one of: model, usecase, helper, constants, port, repository.");
            return;
        }

        if ("model".equals(role)) {
            return;
        }

        if (segments.size() != 7) {
            violations.add(sourceFile.relativePath(), "domain-layer-model-role-direct-file-placement",
                    "Model-family non-model role buckets must keep Java files as direct files under src/domain/<context>/model/<family>/<role>/.");
        }
    }

    private void validateReservedRoleSuffixPlacement(SourceFile sourceFile, ViolationSink violations) {
        if (!isDomainSource(sourceFile.relativeSegments())) {
            return;
        }

        String fileName = sourceFile.fileName();
        List<String> segments = sourceFile.relativeSegments();
        if (fileName.endsWith("ApplicationService.java") && segments.size() != 4) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix ApplicationService may appear only as a direct root file under src/domain/<context>/.");
            return;
        }
        if (fileName.endsWith("UseCase.java")
                && !(isRootApplicationUseCase(segments) || isModelRoleDirectFile(segments, "usecase"))) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix UseCase may appear only under src/domain/<context>/application/ or src/domain/<context>/model/<family>/usecase/.");
            return;
        }
        if (fileName.endsWith("Helper.java") && !isModelRoleDirectFile(segments, "helper")) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix Helper may appear only under src/domain/<context>/model/<family>/helper/.");
            return;
        }
        if (fileName.endsWith("Constants.java") && !isModelRoleDirectFile(segments, "constants")) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix Constants may appear only under src/domain/<context>/model/<family>/constants/.");
            return;
        }
        if (fileName.endsWith("Port.java") && !isModelRoleDirectFile(segments, "port")) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix Port may appear only under src/domain/<context>/model/<family>/port/.");
            return;
        }
        if (fileName.endsWith("Repository.java") && !isModelRoleDirectFile(segments, "repository")) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix Repository may appear only under src/domain/<context>/model/<family>/repository/.");
        }
    }

    private void validateLegacyRoleSuffixRejection(SourceFile sourceFile, ViolationSink violations) {
        if (!isDomainSource(sourceFile.relativeSegments())) {
            return;
        }
        String fileName = sourceFile.fileName();
        if (fileName.endsWith("ApplicationService.java")) {
            return;
        }
        for (String suffix : LEGACY_ROLE_SUFFIXES) {
            if (fileName.endsWith(suffix)) {
                violations.add(sourceFile.relativePath(), "domain-layer-legacy-role-suffix-rejection",
                        "Legacy domain role and helper suffixes such as *BoundaryTranslator, *Projector, *RuntimeAccess, *RuntimeAdapter, *Policy, *Service, *Factory, *Aggregate, *Entity, and *Specification are forbidden.");
                return;
            }
        }
    }

    private static boolean isDomainSource(List<String> segments) {
        return segments.size() >= 4
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1));
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
        violations.add(source, "domain-layer-forbidden-top-level-domain-buckets",
                "Only published/, application/, and model/ are allowed as direct child buckets under src/domain/<context>/.");
    }

    private static boolean isRootApplicationUseCase(List<String> segments) {
        return segments.size() == 5 && "application".equals(segments.get(3));
    }

    private static boolean isModelRoleDirectFile(List<String> segments, String role) {
        return segments.size() == 7
                && "model".equals(segments.get(3))
                && role.equals(segments.get(5));
    }
}

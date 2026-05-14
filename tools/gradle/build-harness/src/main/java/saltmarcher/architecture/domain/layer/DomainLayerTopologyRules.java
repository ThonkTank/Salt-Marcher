package saltmarcher.architecture.domain.layer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.domain.DomainRoleTopologySupport;

public final class DomainLayerTopologyRules implements ArchitectureRule {

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
        if (!DomainRoleTopologySupport.isDomainSource(segments)) {
            return;
        }

        if (DomainRoleTopologySupport.isDomainRootFile(segments)) {
            if (!DomainRoleTopologySupport.isDomainRootApplicationService(sourceFile)
                    && !DomainRoleTopologySupport.isDomainRootServiceComposition(sourceFile)) {
                violations.add(sourceFile.relativePath(), "domain-layer-root-direct-file-role-allowlist",
                        "Direct root domain files under src/domain/<context>/ must be *ApplicationService.java or service-composition roots only.");
            }
            return;
        }

        if (segments.size() < 5) {
            return;
        }

        if (DomainRoleTopologySupport.isModelRootSource(segments)) {
            validateModelFamilyFileLayout(sourceFile, violations);
            return;
        }

        if (DomainRoleTopologySupport.domainBucket(segments)
                .filter(DomainRoleTopologySupport::isRootTechnicalBucket)
                .isEmpty()) {
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
        if (!DomainRoleTopologySupport.isValidModelFamilyName(family)) {
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
        if (!DomainRoleTopologySupport.isAllowedTargetDomainRolePackage(role)) {
            violations.add(sourceFile.relativePath(), "domain-layer-model-role-package-name-allowlist",
                    "Model-family role packages must be one of: model, usecase, helper, constants, port, repository.");
            return;
        }

        if ("model".equals(role)) {
            validateModelSubtree(sourceFile, violations);
            return;
        }

        if (segments.size() != 7) {
            violations.add(sourceFile.relativePath(), "domain-layer-model-role-direct-file-placement",
                    "Model-family non-model role buckets must keep Java files as direct files under src/domain/<context>/model/<family>/<role>/.");
        }
    }

    private void validateModelSubtree(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        for (int index = 6; index < segments.size() - 1; index++) {
            String segment = segments.get(index);
            if (DomainRoleTopologySupport.isForbiddenModelSubtreeTechnicalBucket(segment)) {
                violations.add(sourceFile.relativePath(), "domain-layer-model-subtree-no-technical-buckets",
                        "Nested technical buckets are forbidden inside src/domain/<context>/model/<family>/model/**. Use only semantic subpackages for subordinate models.");
                return;
            }
        }
    }

    private void validateReservedRoleSuffixPlacement(SourceFile sourceFile, ViolationSink violations) {
        if (!DomainRoleTopologySupport.isDomainSource(sourceFile.relativeSegments())) {
            return;
        }

        String fileName = sourceFile.fileName();
        List<String> segments = sourceFile.relativeSegments();
        if (DomainRoleTopologySupport.hasRoleSuffix(fileName, "ApplicationService")
                && !DomainRoleTopologySupport.isDomainRootApplicationService(segments, fileName)) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix ApplicationService may appear only as a direct root file under src/domain/<context>/.");
            return;
        }
        if (DomainRoleTopologySupport.hasRoleSuffix(fileName, "UseCase")
                && !(DomainRoleTopologySupport.isRootApplicationUseCase(segments)
                || DomainRoleTopologySupport.isModelRoleDirectFile(segments, "usecase"))) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix UseCase may appear only under src/domain/<context>/application/ or src/domain/<context>/model/<family>/usecase/.");
            return;
        }
        if (DomainRoleTopologySupport.hasRoleSuffix(fileName, "Helper")
                && !DomainRoleTopologySupport.isModelRoleDirectFile(segments, "helper")) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix Helper may appear only under src/domain/<context>/model/<family>/helper/.");
            return;
        }
        if (DomainRoleTopologySupport.hasRoleSuffix(fileName, "Constants")
                && !DomainRoleTopologySupport.isModelRoleDirectFile(segments, "constants")) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix Constants may appear only under src/domain/<context>/model/<family>/constants/.");
            return;
        }
        if (DomainRoleTopologySupport.hasRoleSuffix(fileName, "Port")
                && !DomainRoleTopologySupport.isModelRoleDirectFile(segments, "port")) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix Port may appear only under src/domain/<context>/model/<family>/port/.");
            return;
        }
        if (DomainRoleTopologySupport.hasRoleSuffix(fileName, "Repository")
                && !DomainRoleTopologySupport.isModelRoleDirectFile(segments, "repository")) {
            violations.add(sourceFile.relativePath(), "domain-layer-reserved-role-suffix-perimeter",
                    "Reserved role suffix Repository may appear only under src/domain/<context>/model/<family>/repository/.");
        }
    }

    private void validateLegacyRoleSuffixRejection(SourceFile sourceFile, ViolationSink violations) {
        if (!DomainRoleTopologySupport.isDomainSource(sourceFile.relativeSegments())) {
            return;
        }
        String fileName = sourceFile.fileName();
        if (DomainRoleTopologySupport.hasRoleSuffix(fileName, "ApplicationService")) {
            return;
        }
        if (DomainRoleTopologySupport.hasLegacyRoleSuffix(fileName)) {
            violations.add(sourceFile.relativePath(), "domain-layer-legacy-role-suffix-rejection",
                    "Legacy domain role and helper suffixes such as *BoundaryTranslator, *Projector, *RuntimeAccess, *RuntimeAdapter, *Policy, *Service, *Factory, *Aggregate, *Entity, and *Specification are forbidden.");
        }
    }

    private static void validateDomainBucket(String source, String bucket, ViolationSink violations) {
        if (DomainRoleTopologySupport.isRootTechnicalBucket(bucket)) {
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
}

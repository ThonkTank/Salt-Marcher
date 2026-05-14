package saltmarcher.architecture.domain;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import saltmarcher.architecture.SourceFile;

public final class DomainRoleTopologySupport {

    private static final Set<String> ROOT_TECHNICAL_BUCKETS = Set.of("published", "application", "model");
    private static final Set<String> TARGET_ROLE_PACKAGES =
            Set.of("model", "constants", "helper", "port", "repository", "usecase");
    private static final Set<String> LEGACY_ROLE_PACKAGES =
            Set.of("aggregate", "entity", "value", "policy", "factory", "service", "event", "specification");
    private static final Set<String> FORBIDDEN_MODEL_SUBTREE_TECHNICAL_BUCKETS = Set.of(
            "aggregate",
            "application",
            "constants",
            "entity",
            "event",
            "factory",
            "helper",
            "policy",
            "port",
            "published",
            "repository",
            "service",
            "specification",
            "usecase",
            "value");
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

    private DomainRoleTopologySupport() {
    }

    public static boolean isDomainSource(SourceFile sourceFile) {
        return isDomainSource(sourceFile.relativeSegments());
    }

    public static boolean isDomainSource(List<String> segments) {
        return segments.size() >= 4
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1));
    }

    public static boolean isDomainRootFile(List<String> segments) {
        return isDomainSource(segments) && segments.size() == 4;
    }

    public static boolean isDomainRootApplicationService(SourceFile sourceFile) {
        return isDomainRootApplicationService(sourceFile.relativeSegments(), sourceFile.fileName());
    }

    public static boolean isDomainRootApplicationService(List<String> segments, String fileName) {
        return isDomainRootFile(segments) && fileName.endsWith("ApplicationService.java");
    }

    public static boolean isDomainRootServiceComposition(SourceFile sourceFile) {
        return isDomainRootServiceComposition(sourceFile.relativeSegments(), sourceFile.fileName());
    }

    public static boolean isDomainRootServiceComposition(List<String> segments, String fileName) {
        return isDomainRootFile(segments)
                && (fileName.endsWith("ServiceContribution.java") || fileName.endsWith("ServiceAssembly.java"));
    }

    public static Optional<String> domainBucket(List<String> segments) {
        if (!isDomainSource(segments) || segments.size() < 5) {
            return Optional.empty();
        }
        return Optional.of(segments.get(3));
    }

    public static boolean isRootTechnicalBucket(String bucket) {
        return ROOT_TECHNICAL_BUCKETS.contains(bucket);
    }

    public static Set<String> rootTechnicalBuckets() {
        return ROOT_TECHNICAL_BUCKETS;
    }

    public static boolean isPublishedSource(List<String> segments) {
        return isDomainSource(segments) && segments.size() >= 5 && "published".equals(segments.get(3));
    }

    public static boolean isPublishedDirectFile(List<String> segments) {
        return isPublishedSource(segments) && segments.size() == 5;
    }

    public static boolean isRootApplicationUseCase(List<String> segments) {
        return isDomainSource(segments)
                && segments.size() == 5
                && "application".equals(segments.get(3));
    }

    public static boolean isModelRootSource(List<String> segments) {
        return isDomainSource(segments) && segments.size() >= 5 && "model".equals(segments.get(3));
    }

    public static Optional<String> modelFamily(List<String> segments) {
        if (!isModelRootSource(segments) || segments.size() < 6) {
            return Optional.empty();
        }
        return Optional.of(segments.get(4));
    }

    public static boolean isValidModelFamilyName(String family) {
        return family.matches("[a-z][a-z0-9_]*");
    }

    public static Optional<String> modelRole(List<String> segments) {
        if (!isModelRootSource(segments) || segments.size() < 7) {
            return Optional.empty();
        }
        return Optional.of(segments.get(5));
    }

    public static boolean isModelRoleDirectFile(List<String> segments, String role) {
        return isModelRoleSource(segments, role) && segments.size() == 7;
    }

    public static boolean isModelRoleSource(SourceFile sourceFile, String role) {
        return isModelRoleSource(sourceFile.relativeSegments(), role);
    }

    public static boolean isModelRoleSource(List<String> segments, String role) {
        return isModelRootSource(segments)
                && segments.size() >= 7
                && role.equals(segments.get(5));
    }

    public static boolean isAllowedDomainRolePackage(String role) {
        return isAllowedTargetDomainRolePackage(role) || isLegacyDomainRolePackage(role);
    }

    public static boolean isAllowedTargetDomainRolePackage(String role) {
        return TARGET_ROLE_PACKAGES.contains(role);
    }

    public static Set<String> allowedTargetDomainRolePackages() {
        return TARGET_ROLE_PACKAGES;
    }

    public static boolean isLegacyDomainRolePackage(String role) {
        return LEGACY_ROLE_PACKAGES.contains(role);
    }

    public static boolean isForbiddenModelSubtreeTechnicalBucket(String segment) {
        return FORBIDDEN_MODEL_SUBTREE_TECHNICAL_BUCKETS.contains(segment);
    }

    public static boolean hasRoleSuffix(SourceFile sourceFile, String suffix) {
        return sourceFile.fileName().endsWith(suffix + ".java");
    }

    public static boolean hasRoleSuffix(String fileName, String suffix) {
        return fileName.endsWith(suffix + ".java");
    }

    public static boolean hasLegacyRoleSuffix(String fileName) {
        if (fileName.endsWith("ApplicationService.java")) {
            return false;
        }
        return LEGACY_ROLE_SUFFIXES.stream().anyMatch(fileName::endsWith);
    }

    public static Set<String> legacyRoleSuffixes() {
        return LEGACY_ROLE_SUFFIXES;
    }
}

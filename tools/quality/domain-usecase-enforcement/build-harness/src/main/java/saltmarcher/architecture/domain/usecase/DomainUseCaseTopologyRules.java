package saltmarcher.architecture.domain.usecase;

import java.util.List;
import java.util.regex.Pattern;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class DomainUseCaseTopologyRules implements ArchitectureRule {

    private static final List<String> ALLOWED_APPLICATION_FILE_SUFFIXES = List.of(
            "UseCase.java",
            "BoundaryTranslator.java",
            "Projector.java",
            "RuntimeAccess.java",
            "RuntimeAdapter.java");
    private static final Pattern GENERIC_USE_CASE_FILE_PATTERN =
            Pattern.compile(".*(?:Operations|Helper|Adapter|Repository|Mapper|Policy)UseCase\\.java$");
    private static final Pattern BACKEND_PORT_CONTRACT_FILE_PATTERN =
            Pattern.compile(".*(?:Repository|Lookup|Catalog|Search)\\.java$");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (!isDomainUseCaseSource(sourceFile.relativeSegments())) {
                continue;
            }
            validateDirectPlacement(sourceFile, violations);
            validateSpecificNaming(sourceFile, violations);
            validateNoBackendPortContracts(sourceFile, violations);
        }
    }

    private static boolean isDomainUseCaseSource(List<String> segments) {
        return segments.size() >= 4
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1))
                && "application".equals(segments.get(3));
    }

    private static void validateDirectPlacement(SourceFile sourceFile, ViolationSink violations) {
        if (sourceFile.relativeSegments().size() != 5 || !hasAllowedApplicationSuffix(sourceFile.fileName())) {
            violations.add(sourceFile.relativePath(), "domain-usecase-direct-file-placement",
                    "Domain application orchestration and narrow boundary helpers must stay as direct *UseCase.java, *BoundaryTranslator.java, *Projector.java, *RuntimeAccess.java, or *RuntimeAdapter.java files under src/domain/<context>/application/.");
        }
    }

    private static void validateSpecificNaming(SourceFile sourceFile, ViolationSink violations) {
        if (GENERIC_USE_CASE_FILE_PATTERN.matcher(sourceFile.fileName()).matches()) {
            violations.add(sourceFile.relativePath(), "domain-usecase-no-generic-bucket-names",
                    "Domain use cases must be named for a concrete user or application action, not generic operations, helper, adapter, repository, mapper, or policy buckets.");
        }
    }

    private static void validateNoBackendPortContracts(SourceFile sourceFile, ViolationSink violations) {
        if (BACKEND_PORT_CONTRACT_FILE_PATTERN.matcher(sourceFile.fileName()).matches()) {
            violations.add(sourceFile.relativePath(), "domain-usecase-no-backend-port-contract-files",
                    "Backend port contracts such as *Repository, *Lookup, *Catalog, or *Search belong in a named domain module port/ package, not in application/.");
        }
    }

    private static boolean hasAllowedApplicationSuffix(String fileName) {
        for (String suffix : ALLOWED_APPLICATION_FILE_SUFFIXES) {
            if (fileName.endsWith(suffix)) {
                return true;
            }
        }
        return false;
    }
}

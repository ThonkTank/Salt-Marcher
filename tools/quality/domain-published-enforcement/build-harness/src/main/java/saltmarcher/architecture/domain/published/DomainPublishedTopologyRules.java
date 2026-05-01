package saltmarcher.architecture.domain.published;

import java.util.List;
import java.util.regex.Pattern;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class DomainPublishedTopologyRules implements ArchitectureRule {

    private static final Pattern PUBLISHED_CALLABLE_CONTRACT_FILE_PATTERN =
            Pattern.compile(".*(?:ApplicationService|Service|Facade|Repository|Lookup|Catalog|Search|Port|Gateway|Factory|Locator|Policy)\\.java$");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (!isDomainPublishedSource(sourceFile.relativeSegments())) {
                continue;
            }
            validateDirectPlacement(sourceFile, violations);
            validateNoCallableContracts(sourceFile, violations);
        }
    }

    private static boolean isDomainPublishedSource(List<String> segments) {
        return segments.size() >= 4
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1))
                && "published".equals(segments.get(3));
    }

    private static void validateDirectPlacement(SourceFile sourceFile, ViolationSink violations) {
        if (sourceFile.relativeSegments().size() != 5) {
            violations.add(sourceFile.relativePath(), "domain-published-direct-file-placement",
                    "Domain published/ boundary carriers must stay as direct Java files under src/domain/<context>/published/.");
        }
    }

    private static void validateNoCallableContracts(SourceFile sourceFile, ViolationSink violations) {
        if (PUBLISHED_CALLABLE_CONTRACT_FILE_PATTERN.matcher(sourceFile.fileName()).matches()) {
            violations.add(sourceFile.relativePath(), "domain-published-no-callable-contracts",
                    "Domain published/ packages are exported boundary-carrier surfaces. Callable services, facades, repositories, ports, gateways, factories, locators, and policies belong outside published/.");
        }
    }
}

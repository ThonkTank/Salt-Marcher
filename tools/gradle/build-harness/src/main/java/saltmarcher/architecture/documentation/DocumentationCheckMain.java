package saltmarcher.architecture.documentation;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ArchitectureRuleLoader;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DocumentationCheckMain {

    private DocumentationCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            throw new IllegalArgumentException(
                    "Expected at least one argument: <repo-root> [--rule-class <fqcn>] [--coverage-spec <id>].");
        }

        Arguments parsed = parseArguments(args);
        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]).normalize().toAbsolutePath());
        ViolationSink sink = new ViolationSink();

        List<ArchitectureRule> rules = new ArrayList<>(ArchitectureRuleLoader.instantiateRules(
                parsed.ruleClasses(),
                "documentationEnforcementCheck"));
        rules.forEach(rule -> rule.check(context, sink));

        parsed.coverageSpecIds().stream()
                .map(DocumentationCoverageCatalog::specification)
                .forEach(specification -> MarkdownTableCoverageValidator.validateDocument(
                        context,
                        specification.documentPath(),
                        specification.coverageRule(),
                        specification.missingDocumentMessage(),
                        specification.unreadableMessagePrefix(),
                        specification.expectedRows(),
                        true,
                        sink));

        List<ArchitectureChecker.Violation> ordered = sink.violations().stream()
                .sorted(Comparator.comparing(ArchitectureChecker.Violation::source)
                        .thenComparing(ArchitectureChecker.Violation::rule)
                        .thenComparing(ArchitectureChecker.Violation::details))
                .toList();
        ArchitectureChecker.Result result = new ArchitectureChecker.Result(ordered);
        if (!result.isSuccess()) {
            System.err.println(result.render());
            System.exit(1);
        }

        System.out.println("Documentation checks passed.");
    }

    private static Arguments parseArguments(String[] args) {
        List<String> ruleClasses = new ArrayList<>();
        List<String> coverageSpecIds = new ArrayList<>();
        int index = 1;
        while (index < args.length) {
            String option = args[index];
            if ("--rule-class".equals(option)) {
                ruleClasses.add(requireValue(args, index, option));
                index += 2;
            } else if ("--coverage-spec".equals(option)) {
                coverageSpecIds.add(requireValue(args, index, option));
                index += 2;
            } else {
                throw new IllegalArgumentException("Unknown documentation option '" + option + "'.");
            }
        }
        return new Arguments(List.copyOf(ruleClasses), List.copyOf(coverageSpecIds));
    }

    private static String requireValue(String[] args, int optionIndex, String optionName) {
        int valueIndex = optionIndex + 1;
        if (valueIndex >= args.length) {
            throw new IllegalArgumentException("Missing value after " + optionName + ".");
        }
        return args[valueIndex];
    }

    private record Arguments(
            List<String> ruleClasses,
            List<String> coverageSpecIds
    ) {
    }
}

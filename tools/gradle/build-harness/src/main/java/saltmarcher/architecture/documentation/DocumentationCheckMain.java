package saltmarcher.architecture.documentation;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Predicate;
import java.util.stream.Stream;
import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ArchitectureRuleLoader;
import saltmarcher.architecture.ViolationSink;

public final class DocumentationCheckMain {

    private DocumentationCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            throw new IllegalArgumentException(
                    "Expected at least one argument: <repo-root> [--rule-class <fqcn>].");
        }

        Arguments parsed = parseArguments(args);
        runSelfTests();
        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]).normalize().toAbsolutePath());
        ViolationSink sink = new ViolationSink();

        List<ArchitectureRule> rules = new ArrayList<>(ArchitectureRuleLoader.instantiateRules(
                parsed.ruleClasses(),
                "documentationEnforcementCheck"));
        rules.forEach(rule -> rule.check(context, sink));

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

    private static void runSelfTests() {
        assertViolation(
                "large document without doc-split issue",
                DocumentationCheckMain::largeDocumentWithoutSplitIssue,
                violation -> "documentation-size-split-issue".equals(violation.rule()));
        assertNoViolation(
                "large document with doc-split issue",
                DocumentationCheckMain::largeDocumentWithSplitIssue,
                violation -> "documentation-size-split-issue".equals(violation.rule()));
        assertViolation(
                "unindexed document",
                DocumentationCheckMain::unindexedDocument,
                violation -> "documentation-index-completeness".equals(violation.rule()));
        assertNoViolation(
                "indexed document",
                DocumentationCheckMain::indexedDocument,
                violation -> "documentation-index-completeness".equals(violation.rule()));
        assertViolation(
                "duplicate source of truth",
                DocumentationCheckMain::duplicateSourceOfTruth,
                violation -> "documentation-source-of-truth-unique".equals(violation.rule()));
        System.out.println("Documentation self-tests passed.");
    }

    private static void assertViolation(
            String scenario,
            TempRepoSetup setup,
            Predicate<ArchitectureChecker.Violation> expectedViolation) {
        List<ArchitectureChecker.Violation> violations = runRuleOnTempRepo(scenario, setup);
        if (violations.stream().noneMatch(expectedViolation)) {
            throw new IllegalStateException("Documentation self-test failed to flag " + scenario + ".");
        }
    }

    private static void assertNoViolation(
            String scenario,
            TempRepoSetup setup,
            Predicate<ArchitectureChecker.Violation> rejectedViolation) {
        List<ArchitectureChecker.Violation> violations = runRuleOnTempRepo(scenario, setup);
        List<ArchitectureChecker.Violation> rejected = violations.stream()
                .filter(rejectedViolation)
                .toList();
        if (!rejected.isEmpty()) {
            throw new IllegalStateException("Documentation self-test unexpectedly flagged " + scenario + ": "
                    + new ArchitectureChecker.Result(rejected).render());
        }
    }

    private static List<ArchitectureChecker.Violation> runRuleOnTempRepo(
            String scenario,
            TempRepoSetup setup) {
        try {
            Path tempRoot = Files.createTempDirectory("saltmarcher-doc-check-");
            try {
                setup.apply(tempRoot);
                ViolationSink sink = new ViolationSink();
                new DocumentationHygieneRules(false).check(new ArchitectureContext(tempRoot), sink);
                return sink.violations();
            } finally {
                deleteRecursively(tempRoot);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Documentation self-test setup failed for " + scenario + ".", exception);
        }
    }

    private static void largeDocumentWithoutSplitIssue(Path repoRoot) throws IOException {
        writeMarkdown(repoRoot.resolve("docs/README.md"), "Root docs index", "Root documentation index.", "# Docs\n\n- [Large](large.md)\n");
        writeMarkdown(repoRoot.resolve("docs/large.md"), "Large doc", "Large document.", largeBody(""));
    }

    private static void largeDocumentWithSplitIssue(Path repoRoot) throws IOException {
        writeMarkdown(repoRoot.resolve("docs/README.md"), "Root docs index", "Root documentation index.", "# Docs\n\n- [Large](large.md)\n");
        writeMarkdown(repoRoot.resolve("docs/large.md"), "Large doc", "Large document.",
                largeBody("Split tracking: `doc-split` issue #123.\n"));
    }

    private static void unindexedDocument(Path repoRoot) throws IOException {
        writeMarkdown(repoRoot.resolve("docs/README.md"), "Root docs index", "Root documentation index.", "# Docs\n");
        writeMarkdown(repoRoot.resolve("docs/missing.md"), "Missing doc", "Missing index entry.", "# Missing\n");
    }

    private static void indexedDocument(Path repoRoot) throws IOException {
        writeMarkdown(repoRoot.resolve("docs/README.md"), "Root docs index", "Root documentation index.", "# Docs\n\n- [Indexed](indexed.md)\n");
        writeMarkdown(repoRoot.resolve("docs/indexed.md"), "Indexed doc", "Indexed document.", "# Indexed\n");
    }

    private static void duplicateSourceOfTruth(Path repoRoot) throws IOException {
        writeMarkdown(repoRoot.resolve("docs/README.md"), "Root docs index", "Root documentation index.", "# Docs\n\n- [One](one.md)\n- [Two](two.md)\n");
        writeMarkdown(repoRoot.resolve("docs/one.md"), "One", "Duplicate truth.", "# One\n");
        writeMarkdown(repoRoot.resolve("docs/two.md"), "Two", "Duplicate truth.", "# Two\n");
    }

    private static String largeBody(String trackingLine) {
        StringBuilder body = new StringBuilder("# Large\n\n").append(trackingLine);
        for (int index = 0; index < 402; index++) {
            body.append("Line ").append(index).append('\n');
        }
        return body.toString();
    }

    private static void writeMarkdown(Path path, String title, String sourceOfTruth, String body) throws IOException {
        Files.createDirectories(path.getParent());
        Files.writeString(path,
                "Status: Active\n"
                        + "Owner: SaltMarcher Team\n"
                        + "Last Reviewed: 2026-07-10\n"
                        + "Source of Truth: " + sourceOfTruth + "\n\n"
                        + body,
                StandardCharsets.UTF_8);
    }

    private static void deleteRecursively(Path root) throws IOException {
        if (!Files.exists(root)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(root)) {
            List<Path> paths = stream
                    .sorted(Comparator.reverseOrder())
                    .toList();
            for (Path path : paths) {
                Files.deleteIfExists(path);
            }
        }
    }

    private static Arguments parseArguments(String[] args) {
        List<String> ruleClasses = new ArrayList<>();
        int index = 1;
        while (index < args.length) {
            String option = args[index];
            if ("--rule-class".equals(option)) {
                ruleClasses.add(requireValue(args, index, option));
                index += 2;
            } else {
                throw new IllegalArgumentException("Unknown documentation option '" + option + "'.");
            }
        }
        return new Arguments(List.copyOf(ruleClasses));
    }

    private static String requireValue(String[] args, int optionIndex, String optionName) {
        int valueIndex = optionIndex + 1;
        if (valueIndex >= args.length) {
            throw new IllegalArgumentException("Missing value after " + optionName + ".");
        }
        return args[valueIndex];
    }

    private record Arguments(
            List<String> ruleClasses
    ) {
    }

    @FunctionalInterface
    private interface TempRepoSetup {
        void apply(Path repoRoot) throws IOException;
    }
}

package saltmarcher.architecture;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class HarnessSelfTestMain {

    private HarnessSelfTestMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <build-harness-root>");
        }

        Path fixturesRoot = Path.of(args[0]).resolve("src").resolve("fixtures");
        List<String> failures = new ArrayList<>();

        expectSuccess(fixturesRoot.resolve("good-minimal"), failures);
        expectSuccess(fixturesRoot.resolve("good-self-registering"), failures);
        expectSuccess(fixturesRoot.resolve("good-top-bar"), failures);
        expectSuccess(fixturesRoot.resolve("good-runtime-state"), failures);
        expectSuccess(fixturesRoot.resolve("good-editor-tab"), failures);
        expectFailure(fixturesRoot.resolve("bad-controller-to-domain"), "layer-dependency", failures);
        expectFailure(fixturesRoot.resolve("bad-bootstrap-to-view"), "bootstrap-view-coupling", failures);
        expectFailure(fixturesRoot.resolve("bad-interactor-to-usecase"), "interactor-boundary", failures);
        expectFailure(fixturesRoot.resolve("bad-domain-javafx"), "domain-framework-ban", failures);
        expectFailure(fixturesRoot.resolve("bad-domain-service-dir"), "domain-layout", failures);
        expectFailure(fixturesRoot.resolve("bad-missing-view-root-contract"), "view-root-contract", failures);
        expectFailure(fixturesRoot.resolve("bad-duplicate-view-root"), "view-root-entrypoint", failures);
        expectFailure(fixturesRoot.resolve("bad-wrong-view-root-name"), "view-root-name", failures);
        expectFailure(fixturesRoot.resolve("bad-legacy-view-wiring"), "view-legacy-wiring-path", failures);

        if (!failures.isEmpty()) {
            System.err.println("Harness self-test failed:");
            failures.forEach(failure -> System.err.println("- " + failure));
            System.exit(1);
        }

        System.out.println("Harness self-test passed.");
    }

    private static void expectSuccess(Path fixtureRoot, List<String> failures) {
        ArchitectureChecker.Result result = new ArchitectureChecker(fixtureRoot).check();
        if (!result.isSuccess()) {
            failures.add("Expected success for fixture '" + fixtureRoot.getFileName() + "' but got: " + result.render());
        }
    }

    private static void expectFailure(Path fixtureRoot, String expectedRule, List<String> failures) {
        ArchitectureChecker.Result result = new ArchitectureChecker(fixtureRoot).check();
        boolean found = result.violations().stream().anyMatch(violation -> violation.rule().equals(expectedRule));
        if (!found) {
            failures.add("Expected fixture '" + fixtureRoot.getFileName() + "' to fail with rule '" + expectedRule
                    + "' but got: " + result.render());
        }
    }
}

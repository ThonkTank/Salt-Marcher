package saltmarcher.architecture.documentation;

import saltmarcher.architecture.ArchitectureChecker;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

public final class DocumentationEnforcementCheckMain {

    private DocumentationEnforcementCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            throw new IllegalArgumentException("Expected at least one argument: <repo-root> [rule-class ...]");
        }

        List<String> optionalRuleClasses = Arrays.asList(args).subList(1, args.length);
        DocumentationEnforcementChecker checker = new DocumentationEnforcementChecker(Path.of(args[0]), optionalRuleClasses);
        ArchitectureChecker.Result result = checker.check();
        if (!result.isSuccess()) {
            System.err.println(result.render());
            System.exit(1);
        }

        System.out.println("Documentation enforcement checks passed.");
    }
}

package saltmarcher.architecture;

import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

public final class ArchitectureCheckMain {

    private ArchitectureCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            throw new IllegalArgumentException("Expected at least one argument: <repo-root> [rule-class ...]");
        }

        boolean includeDefaultRules = true;
        List<String> optionalRuleClasses;
        if (args.length >= 2 && "--only-rules".equals(args[1])) {
            includeDefaultRules = false;
            optionalRuleClasses = Arrays.asList(args).subList(2, args.length);
        } else {
            optionalRuleClasses = Arrays.asList(args).subList(1, args.length);
        }
        ArchitectureChecker checker = new ArchitectureChecker(Path.of(args[0]), optionalRuleClasses, includeDefaultRules);
        ArchitectureChecker.Result result = checker.check();
        if (!result.isSuccess()) {
            System.err.println(result.render());
            System.exit(1);
        }

        System.out.println("Architecture checks passed.");
    }
}

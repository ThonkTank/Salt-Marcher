package saltmarcher.architecture.documentation;

import saltmarcher.architecture.ArchitectureChecker;
import java.nio.file.Path;

public final class DocumentationEnforcementCheckMain {

    private DocumentationEnforcementCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        DocumentationEnforcementChecker checker = new DocumentationEnforcementChecker(Path.of(args[0]));
        ArchitectureChecker.Result result = checker.check();
        if (!result.isSuccess()) {
            System.err.println(result.render());
            System.exit(1);
        }

        System.out.println("Documentation enforcement checks passed.");
    }
}

package saltmarcher.architecture;

import java.nio.file.Path;

public final class ArchitectureCheckMain {

    private ArchitectureCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ArchitectureChecker checker = new ArchitectureChecker(Path.of(args[0]));
        ArchitectureChecker.Result result = checker.check();
        if (!result.isSuccess()) {
            System.err.println(result.render());
            System.exit(1);
        }

        System.out.println("Architecture checks passed.");
    }
}

package saltmarcher.architecture.data.query;

import java.nio.file.Path;
import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;

public final class DataQueryPublishedCarrierCandidatesCheckMain {

    private DataQueryPublishedCarrierCandidatesCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]).normalize().toAbsolutePath());
        DataQueryPublishedCarrierAnalysisReport report = DataQueryPublishedCarrierAnalysis.analyze(context);
        ArchitectureChecker.Result result = new ArchitectureChecker.Result(report.candidateViolations());
        if (result.isSuccess()) {
            System.out.println("Data query published carrier candidates: no candidate findings.");
            return;
        }

        System.out.println(result.render());
    }
}

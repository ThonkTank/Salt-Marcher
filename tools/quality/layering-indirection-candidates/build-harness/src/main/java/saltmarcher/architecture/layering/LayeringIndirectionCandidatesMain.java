package saltmarcher.architecture.layering;

import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

public final class LayeringIndirectionCandidatesMain {

    private LayeringIndirectionCandidatesMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        List<LayeringIndirectionScanner.Candidate> candidates =
                new LayeringIndirectionScanner(Path.of(args[0])).scan().stream()
                        .sorted(Comparator.comparing(LayeringIndirectionScanner.Candidate::role)
                                .thenComparing(LayeringIndirectionScanner.Candidate::source))
                        .toList();

        if (candidates.isEmpty()) {
            System.out.println("No layering indirection candidates found.");
            return;
        }

        System.out.println("Layering indirection candidates (" + candidates.size() + "):");
        for (LayeringIndirectionScanner.Candidate candidate : candidates) {
            System.out.println("- [" + candidate.role() + "] " + candidate.source()
                    + ": " + candidate.details());
        }
    }
}

package saltmarcher.quality.viewview.fxml;

import java.nio.file.Path;
import java.util.List;

public final class ViewFxmlResourceCheckMain {

    private ViewFxmlResourceCheckMain() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ViewFxmlResourceChecker checker = new ViewFxmlResourceChecker();
        List<String> violations = checker.check(Path.of(args[0]).normalize().toAbsolutePath());
        if (!violations.isEmpty()) {
            throw new IllegalStateException(
                    "View FXML resources must live under resources/view/{leftbartabs,statetabs,dropdowns}/<entry>/ "
                            + "or resources/view/slotcontent/<slot>/<entry>/ and must not contain inline scripts.\n"
                            + "Violations:\n - "
                            + String.join("\n - ", violations.stream().sorted().toList()));
        }

        System.out.println("View FXML resource checks passed.");
    }
}

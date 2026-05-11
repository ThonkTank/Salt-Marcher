package saltmarcher.architecture.documentation;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;

public final class DocumentationHygieneRules implements ArchitectureRule {

    private static final int MAX_MARKDOWN_LINES = 350;
    private static final Set<String> VALID_STATUS = Set.of("Active", "Draft", "Deprecated");
    private static final List<String> GOVERNED_MARKDOWN_ROOTS = List.of(
            "AGENTS.md",
            "docs",
            "src",
            "tools/quality");
    private static final List<String> LEGACY_DOCUMENTATION_ROOTS = List.of(
            "docs/architecture",
            "docs/standards",
            "docs/adr",
            "docs/features",
            "docs/compat");
    private static final List<String> DOMAIN_CONTEXT_REQUIRED_SECTIONS = List.of(
            "## Context Role",
            "## Published Language",
            "## Application Boundary",
            "## Ubiquitous Language");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        validateDocsMetadata(context, violations);
        validateLegacyDocumentationRoots(context, violations);
        validateSourceMarkdown(context, violations);
        validateMarkdownLineCaps(context, violations);
    }

    private static void validateDocsMetadata(ArchitectureContext context, ViolationSink violations) {
        for (Path document : markdownFiles(context, context.repoRoot().resolve("docs"))) {
            String documentPath = context.relativize(document);
            List<String> lines = readLines(document, documentPath, violations);
            if (lines.isEmpty()) {
                continue;
            }
            if (lines.size() < 4) {
                violations.add(documentPath, "documentation-metadata-presence",
                        "docs Markdown must start with Status, Owner, Last Reviewed, and Source of Truth metadata.");
                continue;
            }
            validateStatusLine(documentPath, lines.get(0), violations);
            validateMetadataPrefix(documentPath, "Owner: ", lines.get(1), "Owner", violations);
            validateMetadataPrefix(documentPath, "Last Reviewed: ", lines.get(2), "Last Reviewed", violations);
            validateMetadataPrefix(documentPath, "Source of Truth: ", lines.get(3), "Source of Truth", violations);
        }
    }

    private static void validateStatusLine(String documentPath, String line, ViolationSink violations) {
        String prefix = "Status: ";
        if (!line.startsWith(prefix)) {
            violations.add(documentPath, "documentation-metadata-presence",
                    "docs Markdown must start with a Status metadata line.");
            return;
        }
        String status = line.substring(prefix.length()).strip();
        if (!VALID_STATUS.contains(status)) {
            violations.add(documentPath, "documentation-status-value",
                    "Status must be Active, Draft, or Deprecated, not '" + status + "'.");
        }
    }

    private static void validateMetadataPrefix(
            String documentPath,
            String prefix,
            String line,
            String label,
            ViolationSink violations) {
        if (!line.startsWith(prefix) || line.substring(prefix.length()).isBlank()) {
            violations.add(documentPath, "documentation-metadata-presence",
                    "docs Markdown must include a non-empty " + label + " metadata line.");
        }
    }

    private static void validateLegacyDocumentationRoots(ArchitectureContext context, ViolationSink violations) {
        for (String root : LEGACY_DOCUMENTATION_ROOTS) {
            for (Path document : markdownFiles(context, context.repoRoot().resolve(root))) {
                violations.add(context.relativize(document), "documentation-legacy-root",
                        "Legacy documentation roots are non-canonical; move content under docs/project/** or docs/<feature>/**.");
            }
        }
    }

    private static void validateSourceMarkdown(ArchitectureContext context, ViolationSink violations) {
        for (Path document : markdownFiles(context, context.repoRoot().resolve("src"))) {
            String documentPath = context.relativize(document);
            if (!isDomainContextDocument(context, document)) {
                violations.add(documentPath, "documentation-source-markdown-owner",
                        "Source-tree Markdown is limited to src/domain/<context>/DOMAIN.md context documents.");
                continue;
            }
            validateDomainContextDocument(context, document, documentPath, violations);
        }
    }

    private static boolean isDomainContextDocument(ArchitectureContext context, Path document) {
        List<String> segments = context.relativeSegments(document);
        return segments.size() == 4
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1))
                && "DOMAIN.md".equals(segments.get(3));
    }

    private static void validateDomainContextDocument(
            ArchitectureContext context,
            Path document,
            String documentPath,
            ViolationSink violations) {
        String content = readString(document, documentPath, violations);
        if (content == null) {
            return;
        }
        for (String requiredSection : DOMAIN_CONTEXT_REQUIRED_SECTIONS) {
            if (!content.contains(requiredSection)) {
                violations.add(documentPath, "documentation-source-markdown-content",
                        "DOMAIN.md must remain a content-bearing context document with section '" + requiredSection + "'.");
            }
        }
    }

    private static void validateMarkdownLineCaps(ArchitectureContext context, ViolationSink violations) {
        for (String root : GOVERNED_MARKDOWN_ROOTS) {
            Path path = context.repoRoot().resolve(root);
            for (Path document : markdownFiles(context, path)) {
                String documentPath = context.relativize(document);
                List<String> lines = readLines(document, documentPath, violations);
                if (lines.size() > MAX_MARKDOWN_LINES) {
                    violations.add(documentPath, "documentation-line-cap",
                            "Markdown file has " + lines.size()
                                    + " lines; split, delete, or link before exceeding " + MAX_MARKDOWN_LINES + ".");
                }
            }
        }
    }

    private static List<Path> markdownFiles(ArchitectureContext context, Path root) {
        if (!Files.exists(root)) {
            return List.of();
        }
        if (Files.isRegularFile(root)) {
            return root.getFileName().toString().endsWith(".md") ? List.of(root) : List.of();
        }
        try (Stream<Path> stream = Files.walk(root)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> !context.isIgnoredRepositoryScanPath(path))
                    .filter(path -> path.getFileName().toString().endsWith(".md"))
                    .sorted()
                    .toList();
        } catch (IOException ignored) {
            return List.of();
        }
    }

    private static List<String> readLines(Path document, String documentPath, ViolationSink violations) {
        try {
            return Files.readAllLines(document, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(documentPath, "file-readable",
                    "Could not read Markdown file: " + exception.getMessage());
            return List.of();
        }
    }

    private static String readString(Path document, String documentPath, ViolationSink violations) {
        try {
            return Files.readString(document, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(documentPath, "file-readable",
                    "Could not read Markdown file: " + exception.getMessage());
            return null;
        }
    }
}

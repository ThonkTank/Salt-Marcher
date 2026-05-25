package saltmarcher.quality.pmd.support;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import net.sourceforge.pmd.lang.document.TextDocument;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;

public final class SaltMarcherSourceFacts {
    private final List<String> segments;
    private final String fileName;
    private final String simpleName;

    private SaltMarcherSourceFacts(List<String> segments, String fileName) {
        this.segments = segments;
        this.fileName = fileName;
        this.simpleName = fileName.endsWith(".java") ? fileName.substring(0, fileName.length() - 5) : fileName;
    }

    public static SaltMarcherSourceFacts from(ASTCompilationUnit node) {
        TextDocument textDocument = node.getAstInfo().getTextDocument();
        String absolutePath = textDocument.getFileId().getAbsolutePath().replace('\\', '/');
        String relativePath = relativizeToSourceRoot(absolutePath);
        List<String> segments = List.of(relativePath.split("/"));
        return new SaltMarcherSourceFacts(segments, segments.get(segments.size() - 1));
    }

    public String relativePath() {
        return String.join("/", segments);
    }

    private static String relativizeToSourceRoot(String absolutePath) {
        Path normalizedPath = Paths.get(absolutePath).normalize();
        int nameCount = normalizedPath.getNameCount();
        for (int index = 0; index < nameCount; index++) {
            String segment = normalizedPath.getName(index).toString();
            if (segment.equals("bootstrap") || segment.equals("shell") || segment.equals("src")) {
                return normalizedPath.subpath(index, nameCount).toString().replace('\\', '/');
            }
        }
        return normalizedPath.toString().replace('\\', '/');
    }

    public boolean isDataPersistenceSchemaSource() {
        return isDataModel() && isExpectedPersistenceSchemaFileName();
    }

    public boolean isDataSourceModelRecordSource() {
        return isDataModel() && simpleName.endsWith("Record");
    }

    public boolean isDomainPublishedSource() {
        return startsWith("src", "domain") && segments.size() >= 5 && segments.get(3).equals("published");
    }

    public boolean isDomainModelSource() {
        return startsWith("src", "domain") && segments.size() >= 5 && segments.get(3).equals("model");
    }

    public boolean isDomainModelOperationSource() {
        return isDomainModelSource() && simpleName.endsWith("Operation");
    }

    public boolean isDomainModelCarrierSource() {
        return isDomainModelSource() && (simpleName.endsWith("Data") || simpleName.endsWith("Values"));
    }

    public boolean isViewStateOnlySource() {
        return startsWith("src", "view")
                && (simpleName.endsWith("ContributionModel")
                || simpleName.endsWith("ContentModel")
                || simpleName.endsWith("ViewInputEvent")
                || simpleName.endsWith("PublishedEvent"));
    }

    private boolean isDataModel() {
        return startsWith("src", "data") && segments.size() >= 5 && segments.get(3).equals("model");
    }

    private boolean isExpectedPersistenceSchemaFileName() {
        return isFeatureFileName("PersistenceSchema");
    }

    private boolean startsWith(String... prefix) {
        if (segments.size() < prefix.length) {
            return false;
        }
        for (int index = 0; index < prefix.length; index++) {
            if (!segments.get(index).equals(prefix[index])) {
                return false;
            }
        }
        return true;
    }

    private boolean isFeatureFileName(String suffix) {
        String fullSuffix = suffix + ".java";
        if (!fileName.endsWith(fullSuffix)) {
            return false;
        }
        String prefix = fileName.substring(0, fileName.length() - fullSuffix.length());
        return normalizeFeatureToken(prefix).equals(normalizeFeatureToken(featureName()));
    }

    private String featureName() {
        if (startsWith("src", "data") && segments.size() >= 3) {
            return segments.get(2);
        }
        return "";
    }

    private static String normalizeFeatureToken(String value) {
        StringBuilder normalized = new StringBuilder();
        for (char character : value.toCharArray()) {
            if (Character.isLetterOrDigit(character)) {
                normalized.append(Character.toLowerCase(character));
            }
        }
        return normalized.toString();
    }
}

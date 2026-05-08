package saltmarcher.quality.pmd.data;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

final class DataQueryPmdSupport {

    static final Pattern IMPORT_PATTERN = Pattern.compile("(?m)^\\s*import\\s+([^;]+);");
    static final Pattern PACKAGE_PATTERN = Pattern.compile("(?m)^\\s*package\\s+([^;]+);");
    static final Pattern RECORD_PATTERN_TEMPLATE =
            Pattern.compile("public\\s+record\\s+%s\\s*\\((.*?)\\)\\s*\\{", Pattern.DOTALL);
    static final Pattern PUBLIC_NO_ARG_METHOD_PATTERN =
            Pattern.compile("(?m)^\\s*public\\s+(?!static\\b)([^\\n;=()]+?)\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\(\\s*\\)");
    static final Pattern FOREIGN_PUBLISHED_IMPORT =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published\\.([A-Za-z_][A-Za-z0-9_]*)$");
    static final Set<String> CANDIDATE_CARRIER_SUFFIXES = Set.of("Summary", "Snapshot", "Projection");
    static final Set<String> CONCRETE_SOURCE_TOKENS = Set.of(
            "java.sql.",
            "javax.sql.",
            "java.net.",
            "java.net.http.",
            "okhttp3.",
            "retrofit2.",
            "java.nio.file.",
            "java.io.");
    static final Set<String> QUERY_MUTATION_METHOD_PREFIXES = Set.of(
            "add",
            "create",
            "delete",
            "insert",
            "mutate",
            "persist",
            "remove",
            "save",
            "set",
            "store",
            "update",
            "upsert",
            "write");

    private DataQueryPmdSupport() {
    }

    static boolean isQuery(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.relativePath().startsWith("src/data/")
                && sourceFacts.relativePath().contains("/query/");
    }

    static boolean isMutationMethodName(String methodName) {
        String normalized = methodName.toLowerCase();
        return QUERY_MUTATION_METHOD_PREFIXES.stream().anyMatch(normalized::startsWith);
    }

    static Map<String, String> importedTypes(String sourceText) {
        Map<String, String> imports = new LinkedHashMap<>();
        Matcher matcher = IMPORT_PATTERN.matcher(sourceText);
        while (matcher.find()) {
            String qualifiedName = matcher.group(1).trim();
            int separator = qualifiedName.lastIndexOf('.');
            if (separator < 0 || qualifiedName.endsWith(".*")) {
                continue;
            }
            imports.put(qualifiedName.substring(separator + 1), qualifiedName);
        }
        return imports;
    }

    static String queryFeatureName(SaltMarcherSourceFacts sourceFacts) {
        List<String> segments = List.of(sourceFacts.relativePath().split("/"));
        return segments.size() >= 3 ? segments.get(2) : "";
    }

    static boolean isCarrierCandidateType(String simpleName) {
        return CANDIDATE_CARRIER_SUFFIXES.stream().anyMatch(simpleName::endsWith);
    }

    static Optional<CarrierMetadata> loadCarrierMetadata(SaltMarcherSourceFacts sourceFacts, String qualifiedName) {
        Path repoRoot = repoRoot(sourceFacts);
        Path sourceFile = repoRoot.resolve(qualifiedName.replace('.', '/') + ".java");
        if (!Files.isRegularFile(sourceFile)) {
            return Optional.empty();
        }

        String sourceText;
        try {
            sourceText = Files.readString(sourceFile, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            return Optional.empty();
        }

        String packageName = packageName(sourceText);
        String simpleName = simpleName(qualifiedName);
        Matcher recordMatcher = Pattern.compile(
                "public\\s+record\\s+" + Pattern.quote(simpleName) + "\\s*\\((.*?)\\)\\s*\\{",
                Pattern.DOTALL).matcher(sourceText);
        if (recordMatcher.find()) {
            List<String> accessors = new ArrayList<>();
            Map<String, String> chainedCarrierTypes = new LinkedHashMap<>();
            for (String component : splitRecordComponents(recordMatcher.group(1))) {
                ParsedComponent parsed = ParsedComponent.parse(component);
                if (parsed == null) {
                    continue;
                }
                accessors.add(parsed.name());
                String componentTypeSimpleName = simpleName(parsed.typeName());
                if (isCarrierCandidateType(componentTypeSimpleName)) {
                    chainedCarrierTypes.put(parsed.name(), qualifyPublishedType(packageName, parsed.typeName()));
                }
            }
            return Optional.of(new CarrierMetadata(qualifiedName, simpleName, List.copyOf(accessors), chainedCarrierTypes));
        }

        List<String> accessors = new ArrayList<>();
        Matcher methodMatcher = PUBLIC_NO_ARG_METHOD_PATTERN.matcher(sourceText);
        while (methodMatcher.find()) {
            accessors.add(methodMatcher.group(2));
        }
        return accessors.isEmpty()
                ? Optional.empty()
                : Optional.of(new CarrierMetadata(qualifiedName, simpleName, List.copyOf(accessors), Map.of()));
    }

    static Set<String> variableNamesForType(String sanitizedSourceText, String simpleTypeName) {
        Set<String> variableNames = new LinkedHashSet<>();
        Pattern pattern = Pattern.compile("\\b" + Pattern.quote(simpleTypeName) + "\\s+([A-Za-z_][A-Za-z0-9_]*)\\b");
        Matcher matcher = pattern.matcher(sanitizedSourceText);
        while (matcher.find()) {
            variableNames.add(matcher.group(1));
        }
        return variableNames;
    }

    static Set<String> usedAccessors(String sanitizedSourceText, String variableName) {
        return accessorMatches(sanitizedSourceText, "\\b" + Pattern.quote(variableName) + "\\.([A-Za-z_][A-Za-z0-9_]*)\\s*\\(");
    }

    static Set<String> usedChainedAccessors(String sanitizedSourceText, String variableName, String chainAccessor) {
        return accessorMatches(
                sanitizedSourceText,
                "\\b" + Pattern.quote(variableName) + "\\." + Pattern.quote(chainAccessor)
                        + "\\s*\\(\\s*\\)\\.([A-Za-z_][A-Za-z0-9_]*)\\s*\\(");
    }

    private static Set<String> accessorMatches(String sanitizedSourceText, String patternText) {
        Set<String> accessors = new LinkedHashSet<>();
        Matcher matcher = Pattern.compile(patternText).matcher(sanitizedSourceText);
        while (matcher.find()) {
            accessors.add(matcher.group(1));
        }
        return accessors;
    }

    private static String qualifyPublishedType(String packageName, String rawTypeName) {
        String normalized = normalizeTypeName(rawTypeName);
        if (normalized.contains(".")) {
            return normalized;
        }
        return packageName + "." + normalized;
    }

    private static String normalizeTypeName(String rawTypeName) {
        String normalized = rawTypeName.replace("@Nullable", "").trim();
        int genericStart = normalized.indexOf('<');
        if (genericStart >= 0) {
            normalized = normalized.substring(0, genericStart);
        }
        return normalized.trim();
    }

    private static String packageName(String sourceText) {
        Matcher matcher = PACKAGE_PATTERN.matcher(sourceText);
        return matcher.find() ? matcher.group(1).trim() : "";
    }

    private static String simpleName(String qualifiedName) {
        String normalized = normalizeTypeName(qualifiedName);
        int separator = normalized.lastIndexOf('.');
        return separator < 0 ? normalized : normalized.substring(separator + 1);
    }

    private static List<String> splitRecordComponents(String componentsText) {
        List<String> components = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int angleDepth = 0;
        for (int index = 0; index < componentsText.length(); index++) {
            char currentChar = componentsText.charAt(index);
            if (currentChar == '<') {
                angleDepth++;
            } else if (currentChar == '>') {
                angleDepth = Math.max(0, angleDepth - 1);
            } else if (currentChar == ',' && angleDepth == 0) {
                components.add(current.toString().trim());
                current.setLength(0);
                continue;
            }
            current.append(currentChar);
        }
        if (!current.isEmpty()) {
            components.add(current.toString().trim());
        }
        return components;
    }

    private static Path repoRoot(SaltMarcherSourceFacts sourceFacts) {
        Path absolutePath = Paths.get(sourceFacts.absolutePath()).normalize();
        Path relativePath = Paths.get(sourceFacts.relativePath()).normalize();
        Path repoRoot = absolutePath;
        for (int index = 0; index < relativePath.getNameCount(); index++) {
            repoRoot = repoRoot.getParent();
        }
        return repoRoot;
    }

    record CarrierMetadata(
            String qualifiedName,
            String simpleName,
            List<String> accessors,
            Map<String, String> chainedCarrierTypes
    ) {
    }

    private record ParsedComponent(String typeName, String name) {

        private static ParsedComponent parse(String componentText) {
            String normalized = componentText.replace("@Nullable", "").trim();
            if (normalized.isBlank()) {
                return null;
            }
            int separator = normalized.lastIndexOf(' ');
            if (separator < 0 || separator + 1 >= normalized.length()) {
                return null;
            }
            return new ParsedComponent(
                    normalized.substring(0, separator).trim(),
                    normalized.substring(separator + 1).trim());
        }
    }

    static String codeTextWithoutCommentsAndStrings(String text) {
        StringBuilder result = new StringBuilder(text.length());
        boolean inLineComment = false;
        boolean inBlockComment = false;
        boolean inString = false;
        boolean inChar = false;
        boolean escaped = false;
        for (int index = 0; index < text.length(); index++) {
            char current = text.charAt(index);
            char next = index + 1 < text.length() ? text.charAt(index + 1) : '\0';
            if (inLineComment) {
                if (current == '\n' || current == '\r') {
                    inLineComment = false;
                    result.append(current);
                } else {
                    result.append(' ');
                }
                continue;
            }
            if (inBlockComment) {
                if (current == '*' && next == '/') {
                    inBlockComment = false;
                    result.append("  ");
                    index++;
                } else {
                    result.append(current == '\n' || current == '\r' ? current : ' ');
                }
                continue;
            }
            if (escaped) {
                escaped = false;
                result.append(' ');
                continue;
            }
            if (current == '\\' && (inString || inChar)) {
                escaped = true;
                result.append(' ');
                continue;
            }
            if (inString) {
                if (current == '"') {
                    inString = false;
                }
                result.append(current == '\n' || current == '\r' ? current : ' ');
                continue;
            }
            if (inChar) {
                if (current == '\'') {
                    inChar = false;
                }
                result.append(current == '\n' || current == '\r' ? current : ' ');
                continue;
            }
            if (current == '/' && next == '/') {
                inLineComment = true;
                result.append("  ");
                index++;
                continue;
            }
            if (current == '/' && next == '*') {
                inBlockComment = true;
                result.append("  ");
                index++;
                continue;
            }
            if (current == '"') {
                inString = true;
                result.append(' ');
                continue;
            }
            if (current == '\'') {
                inChar = true;
                result.append(' ');
                continue;
            }
            result.append(current);
        }
        return result.toString();
    }
}

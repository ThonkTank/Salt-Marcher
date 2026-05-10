package saltmarcher.buildlogic.tasks

import java.io.File
import java.nio.file.Files
import java.util.Locale
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException

private val cssSelectorPattern = Regex("""\.([A-Za-z][A-Za-z0-9\-_]*)\b""")
private val stringLiteralPattern = Regex(""""([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"""")
private val styleClassNamePattern = Regex("""[A-Za-z][A-Za-z0-9\-_]*""")
private val methodDeclarationPattern = Regex(
    """(?m)^(?![ \t]*(?:if|for|while|switch|catch|try|do|else)\b)[ \t]*(?:(?:public|protected|private)[ \t]+)?(?:(?:static|final|abstract|synchronized|native|default|strictfp)[ \t]+)*(?:[A-Za-z0-9_<>, ?.@\[\]]+[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{"""
)
private val methodCallPattern = Regex("""(?<![\w$])([A-Za-z_][A-Za-z0-9_]*)\s*\(""")
private const val styleClassMarker = "getStyleClass()"
private val styleClassMethods = setOf("add", "addAll", "setAll")

private data class StyleClassUsage(
    val selectors: Set<String>,
    val dynamicExpressions: Set<String>
)

private data class MethodDefinition(
    val name: String,
    val parameters: List<String>,
    val body: String
) {
    val key: MethodKey = MethodKey(name, parameters.size)
}

private data class MethodKey(
    val name: String,
    val arity: Int
)

private data class CallDefinition(
    val key: MethodKey,
    val arguments: List<String>
)

@CacheableTask
abstract class CheckCentralizedStylesheetsTask : DefaultTask() {

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val stylesheetFiles: ConfigurableFileCollection

    @get:Input
    abstract val canonicalStylesheetRelativePath: Property<String>

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val canonicalStylesheetFile: RegularFileProperty

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun verify() {
        val canonicalPath = canonicalStylesheetRelativePath.get()
        val canonicalFile = canonicalStylesheetFile.get().asFile.canonicalFile
        val offendingFiles = stylesheetFiles.files.asSequence()
            .filter { file -> file.isFile }
            .map { file -> file.canonicalFile }
            .filter { file -> file != canonicalFile }
            .map { file -> file.invariantSeparatorsPath() }
            .sorted()
            .toList()

        if (offendingFiles.isNotEmpty()) {
            val details = offendingFiles.joinToString(separator = "\n") { " - $it" }
            throw VerificationException(
                "Stylesheet files must be centralized in $canonicalPath.\n" +
                    "Move approved visual rules into the central stylesheet instead of adding replacement style files.\n" +
                    "Offending files:\n$details"
            )
        }

        writeSuccessMarker(successMarker.get().asFile)
    }
}

@CacheableTask
abstract class CheckStylingCentralStylesheetOwnerTask : DefaultTask() {

    @get:Input
    abstract val configuredStylesheetPath: Property<String>

    @get:Input
    abstract val canonicalStylesheetRelativePath: Property<String>

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val canonicalStylesheetFile: RegularFileProperty

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun verify() {
        val canonicalRelativePath = canonicalStylesheetRelativePath.get()
        val configuredPath = configuredStylesheetPath.get()
        if (configuredPath != canonicalRelativePath) {
            throw VerificationException(
                "SaltMarcher styling must stay owned by $canonicalRelativePath.\n" +
                    "The configured saltMarcherStylesheet path was '$configuredPath'."
            )
        }

        val canonicalStylesheet = canonicalStylesheetFile.get().asFile
        if (!canonicalStylesheet.isFile) {
            throw VerificationException(
                "SaltMarcher styling must stay owned by $canonicalRelativePath.\n" +
                    "The canonical stylesheet file is missing: ${canonicalStylesheet.toPath().toAbsolutePath()}"
            )
        }

        writeSuccessMarker(successMarker.get().asFile)
    }
}

@CacheableTask
abstract class CheckDefinedStyleClassSelectorsTask : DefaultTask() {

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val stylesheetFiles: ConfigurableFileCollection

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val javaSourceFiles: ConfigurableFileCollection

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun verify() {
        val definedSelectors = stylesheetFiles.files.asSequence()
            .filter(File::isFile)
            .flatMap { file -> cssSelectorPattern.findAll(file.readText()).map { match -> match.groupValues[1] } }
            .toSet()

        val missingSelectors = linkedMapOf<String, MutableSet<String>>()
        val dynamicSelectors = linkedMapOf<String, MutableSet<String>>()
        val sourceTexts = javaSourceFiles.files.asSequence()
            .filter { it.isFile && it.extension == "java" }
            .associateWith(File::readText)
        sourceTexts.forEach { (file, sourceText) ->
            val helperMethods = resolveStyleClassHelperMethods(sourceText)
            val usage = extractStyleClassLiterals(sourceText, helperMethods)
            val missing = usage.selectors.filterNot(definedSelectors::contains)
            val relativePath = file.invariantSeparatorsPath
            if (missing.isNotEmpty()) {
                missingSelectors[relativePath] = missing.toMutableSet()
            }
            if (usage.dynamicExpressions.isNotEmpty()) {
                dynamicSelectors[relativePath] = usage.dynamicExpressions.toMutableSet()
            }
        }

        if (missingSelectors.isNotEmpty() || dynamicSelectors.isNotEmpty()) {
            val details = missingSelectors.entries.joinToString(separator = "\n") { (path, selectors) ->
                " - $path -> ${selectors.joinToString(", ")}"
            }
            val dynamicDetails = dynamicSelectors.entries.joinToString(separator = "\n") { (path, expressions) ->
                " - $path -> ${expressions.joinToString(", ")}"
            }
            throw VerificationException(
                "Style classes used from Java must resolve to centralized selectors in resources/salt-marcher.css.\n" +
                    "Add the missing selectors to a centralized stylesheet or stop using them from code.\n" +
                    "Build style classes from explicit, centrally defined selector names; dynamic selector construction is forbidden.\n" +
                    listOfNotNull(
                        details.takeIf(String::isNotBlank)?.let { "Missing selectors:\n$it" },
                        dynamicDetails.takeIf(String::isNotBlank)?.let { "Dynamic selector expressions:\n$it" }
                    ).joinToString("\n")
            )
        }

        writeSuccessMarker(successMarker.get().asFile)
    }
}

private fun writeSuccessMarker(markerFile: File) {
    markerFile.parentFile.mkdirs()
    markerFile.writeText("passed\n")
}

private fun extractStyleClassLiterals(
    sourceText: String,
    helperMethods: Map<MethodKey, Set<Int>>
): StyleClassUsage {
    val selectors = linkedSetOf<String>()
    val dynamicExpressions = linkedSetOf<String>()
    collectStyleClassCallLiterals(sourceText, selectors, dynamicExpressions)
    collectHelperCallLiterals(sourceText, helperMethods, selectors, dynamicExpressions)
    return StyleClassUsage(selectors, dynamicExpressions)
}

private fun collectStyleClassCallLiterals(
    sourceText: String,
    selectors: MutableSet<String>,
    dynamicExpressions: MutableSet<String>
) {
    var searchIndex = 0
    while (true) {
        val markerIndex = sourceText.indexOf(styleClassMarker, searchIndex)
        if (markerIndex < 0) {
            return
        }
        var cursor = markerIndex + styleClassMarker.length
        while (cursor < sourceText.length && sourceText[cursor].isWhitespace()) {
            cursor++
        }
        if (cursor >= sourceText.length || sourceText[cursor] != '.') {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        cursor++
        val methodStart = cursor
        while (cursor < sourceText.length && Character.isJavaIdentifierPart(sourceText[cursor])) {
            cursor++
        }
        val methodName = sourceText.substring(methodStart, cursor)
        if (methodName !in styleClassMethods) {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        while (cursor < sourceText.length && sourceText[cursor].isWhitespace()) {
            cursor++
        }
        if (cursor >= sourceText.length || sourceText[cursor] != '(') {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        val closingParenIndex = findClosingParen(sourceText, cursor)
        if (closingParenIndex < 0) {
            return
        }
        splitArguments(sourceText.substring(cursor + 1, closingParenIndex)).forEach { argument ->
            collectStyleArgument(argument, selectors, dynamicExpressions)
        }
        searchIndex = closingParenIndex + 1
    }
}

private fun collectHelperCallLiterals(
    sourceText: String,
    helperMethods: Map<MethodKey, Set<Int>>,
    selectors: MutableSet<String>,
    dynamicExpressions: MutableSet<String>
) {
    findMethodCalls(sourceText).forEach { call ->
        helperMethods[call.key]?.forEach { parameterIndex ->
            call.arguments.getOrNull(parameterIndex)?.let { argument ->
                collectStyleArgument(argument, selectors, dynamicExpressions)
            }
        }
    }
}

private fun collectStyleArgument(
    argument: String,
    selectors: MutableSet<String>,
    dynamicExpressions: MutableSet<String>
) {
    val trimmed = argument.trim()
    if (trimmed.isEmpty()) {
        return
    }
    val literalSelectors = stringLiteralPattern.findAll(trimmed)
        .map { match -> match.groupValues[1] }
        .filter(styleClassNamePattern::matches)
        .toList()
    if (literalSelectors.isEmpty()) {
        return
    }
    if (hasTopLevelConcatenation(trimmed)) {
        dynamicExpressions += trimmed
        return
    }
    literalSelectors.forEach(selectors::add)
}

private fun resolveStyleClassHelperMethods(sourceText: String): Map<MethodKey, Set<Int>> {
    val methods = parseMethodDefinitions(sourceText)
    val styleParameterIndexesByMethod = linkedMapOf<MethodKey, MutableSet<Int>>()

    methods.forEach { method ->
        val directIndexes = directStyleParameterIndexes(method)
        if (directIndexes.isNotEmpty()) {
            styleParameterIndexesByMethod.getOrPut(method.key) { linkedSetOf() }.addAll(directIndexes)
        }
    }

    var changed = true
    while (changed) {
        changed = false
        methods.forEach { method ->
            val currentIndexes = styleParameterIndexesByMethod.getOrPut(method.key) { linkedSetOf() }
            findMethodCalls(method.body).forEach { call ->
                styleParameterIndexesByMethod[call.key].orEmpty().forEach { calleeStyleIndex ->
                    val argument = call.arguments.getOrNull(calleeStyleIndex)?.trim() ?: return@forEach
                    val parameterIndex = method.parameters.indexOf(argument)
                    if (parameterIndex >= 0 && currentIndexes.add(parameterIndex)) {
                        changed = true
                    }
                }
            }
        }
    }

    return styleParameterIndexesByMethod
        .filterValues { it.isNotEmpty() }
        .mapValues { (_, indexes) -> indexes.toSet() }
}

private fun directStyleParameterIndexes(method: MethodDefinition): Set<Int> {
    val indexes = linkedSetOf<Int>()
    collectStyleClassCallArguments(method.body).forEach { arguments ->
        arguments.forEach { argument ->
            val parameterIndex = method.parameters.indexOf(argument.trim())
            if (parameterIndex >= 0) {
                indexes += parameterIndex
            }
        }
    }
    return indexes
}

private fun collectStyleClassCallArguments(sourceText: String): List<List<String>> = buildList {
    var searchIndex = 0
    while (true) {
        val markerIndex = sourceText.indexOf(styleClassMarker, searchIndex)
        if (markerIndex < 0) {
            return@buildList
        }
        var cursor = markerIndex + styleClassMarker.length
        while (cursor < sourceText.length && sourceText[cursor].isWhitespace()) {
            cursor++
        }
        if (cursor >= sourceText.length || sourceText[cursor] != '.') {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        cursor++
        val methodStart = cursor
        while (cursor < sourceText.length && Character.isJavaIdentifierPart(sourceText[cursor])) {
            cursor++
        }
        val methodName = sourceText.substring(methodStart, cursor)
        if (methodName !in styleClassMethods) {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        while (cursor < sourceText.length && sourceText[cursor].isWhitespace()) {
            cursor++
        }
        if (cursor >= sourceText.length || sourceText[cursor] != '(') {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        val closingParenIndex = findClosingParen(sourceText, cursor)
        if (closingParenIndex < 0) {
            return@buildList
        }
        add(splitArguments(sourceText.substring(cursor + 1, closingParenIndex)))
        searchIndex = closingParenIndex + 1
    }
}

private fun hasTopLevelConcatenation(expression: String): Boolean {
    var depth = 0
    var inString = false
    var escaped = false
    expression.forEach { character ->
        if (inString) {
            if (escaped) {
                escaped = false
            } else if (character == '\\') {
                escaped = true
            } else if (character == '"') {
                inString = false
            }
            return@forEach
        }
        when (character) {
            '"' -> inString = true
            '(', '[', '<' -> depth++
            ')', ']', '>' -> if (depth > 0) {
                depth--
            }
            '+' -> if (depth == 0) {
                return true
            }
        }
    }
    return false
}

private fun parseMethodDefinitions(sourceText: String): List<MethodDefinition> = buildList {
    methodDeclarationPattern.findAll(sourceText).forEach { match ->
        val methodName = match.groupValues[1]
        val parameters = splitArguments(match.groupValues[2])
            .mapNotNull { parameter ->
                parameter.substringBefore('=')
                    .trim()
                    .takeIf(String::isNotEmpty)
                    ?.substringAfterLast(' ')
                    ?.substringAfterLast("...")
                    ?.substringAfterLast('\t')
                    ?.trim()
            }
        val openingBraceIndex = sourceText.indexOf('{', match.range.first)
        if (openingBraceIndex < 0) {
            return@forEach
        }
        val closingBraceIndex = findMatchingBrace(sourceText, openingBraceIndex)
        if (closingBraceIndex < 0 || closingBraceIndex < openingBraceIndex) {
            return@forEach
        }
        val bodyStart = openingBraceIndex + 1
        add(
            MethodDefinition(
                name = methodName,
                parameters = parameters,
                body = sourceText.substring(bodyStart, closingBraceIndex)
            )
        )
    }
}

private fun findMethodCalls(sourceText: String): List<CallDefinition> = buildList {
    var searchIndex = 0
    while (searchIndex < sourceText.length) {
        val match = methodCallPattern.find(sourceText, searchIndex) ?: return@buildList
        val methodName = match.groupValues[1]
        val openParenIndex = match.range.last
        if (openParenIndex < 0) {
            return@buildList
        }
        val closeParenIndex = findClosingParen(sourceText, openParenIndex)
        if (closeParenIndex < 0) {
            return@buildList
        }
        add(
            CallDefinition(
                key = MethodKey(methodName, splitArguments(sourceText.substring(openParenIndex + 1, closeParenIndex)).size),
                arguments = splitArguments(sourceText.substring(openParenIndex + 1, closeParenIndex))
            )
        )
        searchIndex = closeParenIndex + 1
    }
}

private fun splitArguments(argumentText: String): List<String> {
    if (argumentText.isBlank()) {
        return emptyList()
    }

    val arguments = mutableListOf<String>()
    val current = StringBuilder()
    var parentheses = 0
    var angleBrackets = 0
    var braces = 0
    var inString = false
    var escaped = false

    argumentText.forEach { character ->
        current.append(character)
        if (inString) {
            if (escaped) {
                escaped = false
            } else if (character == '\\') {
                escaped = true
            } else if (character == '"') {
                inString = false
            }
            return@forEach
        }

        when (character) {
            '"' -> inString = true
            '(' -> parentheses++
            ')' -> parentheses--
            '<' -> angleBrackets++
            '>' -> angleBrackets = (angleBrackets - 1).coerceAtLeast(0)
            '{' -> braces++
            '}' -> braces--
            ',' -> if (parentheses == 0 && angleBrackets == 0 && braces == 0) {
                current.setLength(current.length - 1)
                arguments += current.toString().trim()
                current.setLength(0)
            }
        }
    }

    val trailing = current.toString().trim()
    if (trailing.isNotEmpty()) {
        arguments += trailing
    }

    return arguments
}

private fun findClosingParen(sourceText: String, openParenIndex: Int): Int {
    var depth = 0
    var inString = false
    var escaped = false
    for (index in openParenIndex until sourceText.length) {
        val character = sourceText[index]
        if (inString) {
            if (escaped) {
                escaped = false
            } else if (character == '\\') {
                escaped = true
            } else if (character == '"') {
                inString = false
            }
            continue
        }
        when (character) {
            '"' -> inString = true
            '(' -> depth++
            ')' -> {
                depth--
                if (depth == 0) {
                    return index
                }
            }
        }
    }
    return -1
}

private fun findMatchingBrace(sourceText: String, openBraceIndex: Int): Int {
    var depth = 0
    var inString = false
    var escaped = false
    for (index in openBraceIndex until sourceText.length) {
        val character = sourceText[index]
        if (inString) {
            if (escaped) {
                escaped = false
            } else if (character == '\\') {
                escaped = true
            } else if (character == '"') {
                inString = false
            }
            continue
        }
        when (character) {
            '"' -> inString = true
            '{' -> depth++
            '}' -> {
                depth--
                if (depth == 0) {
                    return index
                }
            }
        }
    }
    return -1
}

private fun File.invariantSeparatorsPath(): String = path.replace(File.separatorChar, '/')

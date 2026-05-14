package saltmarcher.buildlogic.tasks.hygiene

import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import kotlin.io.path.extension
import kotlin.io.path.invariantSeparatorsPathString
import kotlin.io.path.name
import kotlin.io.path.nameWithoutExtension
import kotlin.streams.asSequence

abstract class CleanStaleMainJavaClassesTask : DefaultTask() {

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceFiles: ConfigurableFileCollection

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:Internal
    abstract val compiledClassesDirectory: DirectoryProperty

    @get:OutputFile
    abstract val snapshotFile: RegularFileProperty

    @TaskAction
    fun cleanStaleClasses() {
        val projectRootPath = projectRoot.get().asFile.toPath()
        val classesPath = compiledClassesDirectory.get().asFile.toPath()
        val snapshotPath = snapshotFile.get().asFile.toPath()
        val previousSnapshot = SourceClassSnapshot.read(snapshotPath)
        val currentSnapshot = SourceClassSnapshot.from(projectRootPath, sourceFiles.files)

        val staleBinaryNames = linkedSetOf<String>()
        previousSnapshot.entries.forEach { previousEntry ->
            val currentEntry = currentSnapshot.entriesBySourcePath[previousEntry.sourcePath]
            if (currentEntry == null || currentEntry.fingerprint != previousEntry.fingerprint) {
                staleBinaryNames += previousEntry.binaryNames
                currentEntry?.let { staleBinaryNames += it.binaryNames }
            }
        }
        val sourceAdded = currentSnapshot.entries.any { currentEntry ->
            currentEntry.sourcePath !in previousSnapshot.entriesBySourcePath
        }
        if (previousSnapshot.entries.isEmpty() || sourceAdded) {
            staleBinaryNames += orphanedBinaryNames(classesPath, currentSnapshot.allBinaryNames)
        }

        staleBinaryNames.sorted().forEach { binaryName ->
            deleteClassOutputs(classesPath, binaryName)
        }
        currentSnapshot.write(snapshotPath)
    }

    private fun deleteClassOutputs(classesPath: Path, binaryName: String) {
        if (!Files.isDirectory(classesPath)) {
            return
        }
        val classPath = classesPath.resolve(binaryName.replace('.', '/') + ".class")
        val classFileName = classPath.fileName.toString()
        val nestedClassPrefix = classFileName.removeSuffix(".class") + "$"
        val parent = classPath.parent ?: return
        if (!Files.isDirectory(parent)) {
            return
        }
        Files.list(parent).use { stream ->
            stream.asSequence()
                .filter { candidate ->
                    val name = candidate.fileName.toString()
                    name == classFileName || name.startsWith(nestedClassPrefix) && name.endsWith(".class")
                }
                .sortedBy(Path::invariantSeparatorsPathString)
                .forEach(Files::deleteIfExists)
        }
    }

    private fun orphanedBinaryNames(classesPath: Path, currentBinaryNames: Set<String>): Set<String> {
        if (!Files.isDirectory(classesPath)) {
            return emptySet()
        }
        return Files.walk(classesPath).use { stream ->
            stream.asSequence()
                .filter { path -> Files.isRegularFile(path) && path.extension == "class" }
                .map { path -> topLevelBinaryName(classesPath, path) }
                .filterNot(currentBinaryNames::contains)
                .toSortedSet()
        }
    }

    private fun topLevelBinaryName(classesPath: Path, classFile: Path): String {
        val relativePath = classesPath.relativize(classFile)
        val binaryPath = relativePath.invariantSeparatorsPathString
            .removeSuffix(".class")
            .substringBefore("$")
        return binaryPath.replace('/', '.')
    }
}

private data class SourceClassSnapshot(
    val entries: List<SourceClassEntry>
) {
    val entriesBySourcePath: Map<String, SourceClassEntry> = entries.associateBy(SourceClassEntry::sourcePath)
    val allBinaryNames: Set<String> = entries.flatMap(SourceClassEntry::binaryNames).toSet()

    fun write(snapshotPath: Path) {
        Files.createDirectories(snapshotPath.parent)
        val text = entries
            .sortedBy(SourceClassEntry::sourcePath)
            .joinToString(System.lineSeparator()) { entry ->
                listOf(
                    entry.sourcePath,
                    entry.fingerprint,
                    entry.binaryNames.sorted().joinToString(",")
                ).joinToString("\t")
            }
        Files.writeString(snapshotPath, text.withTrailingLine())
    }

    companion object {
        fun read(snapshotPath: Path): SourceClassSnapshot {
            if (!Files.exists(snapshotPath)) {
                return SourceClassSnapshot(emptyList())
            }
            val entries = Files.readAllLines(snapshotPath)
                .filter(String::isNotBlank)
                .mapNotNull(SourceClassEntry::parse)
            return SourceClassSnapshot(entries)
        }

        fun from(projectRoot: Path, sources: Collection<File>): SourceClassSnapshot {
            val entries = sources
                .map(File::toPath)
                .filter { sourcePath -> Files.isRegularFile(sourcePath) && sourcePath.name.endsWith(".java") }
                .map { source ->
                    val sourceText = Files.readString(source)
                    val relativePath = projectRoot.relativize(source).invariantSeparatorsPathString
                    SourceClassEntry(
                        sourcePath = relativePath,
                        fingerprint = sha256(sourceText),
                        binaryNames = JavaTopLevelTypes.parse(source, sourceText)
                    )
                }
                .sortedBy(SourceClassEntry::sourcePath)
            return SourceClassSnapshot(entries)
        }
    }
}

private data class SourceClassEntry(
    val sourcePath: String,
    val fingerprint: String,
    val binaryNames: List<String>
) {
    companion object {
        fun parse(line: String): SourceClassEntry? {
            val parts = line.split('\t')
            if (parts.size != 3) {
                return null
            }
            val binaryNames = parts[2].split(',')
                .filter(String::isNotBlank)
            return SourceClassEntry(parts[0], parts[1], binaryNames)
        }
    }
}

private object JavaTopLevelTypes {
    private val typeKeywords = setOf("class", "interface", "enum", "record")

    fun parse(sourcePath: Path, sourceText: String): List<String> {
        val tokens = JavaTokenStream(sourceText).tokens()
        val packageName = packageName(tokens)
        val typeNames = mutableListOf<String>()
        var braceDepth = 0
        tokens.forEachIndexed { index, token ->
            when (token) {
                "{" -> braceDepth += 1
                "}" -> braceDepth = (braceDepth - 1).coerceAtLeast(0)
                in typeKeywords -> {
                    if (braceDepth == 0 && token.isTypeDeclarationKeyword(tokens, index)) {
                        tokens.getOrNull(index + 1)
                            ?.takeIf(::isJavaIdentifier)
                            ?.let(typeNames::add)
                    }
                }
            }
        }
        val fallbackName = fallbackTypeName(sourcePath)
        val resolvedTypeNames = if (typeNames.isEmpty() && fallbackName != null) listOf(fallbackName) else typeNames
        return resolvedTypeNames
            .map { typeName -> listOf(packageName, typeName).filter(String::isNotBlank).joinToString(".") }
            .sorted()
    }

    private fun String.isTypeDeclarationKeyword(tokens: List<String>, index: Int): Boolean {
        return this != "interface" || tokens.getOrNull(index - 1) != "."
    }

    private fun packageName(tokens: List<String>): String {
        val packageIndex = tokens.indexOf("package")
        if (packageIndex < 0) {
            return ""
        }
        return tokens.drop(packageIndex + 1)
            .takeWhile { token -> token != ";" }
            .filter { token -> token != "." }
            .joinToString(".")
    }

    private fun fallbackTypeName(sourcePath: Path): String? = when (sourcePath.name) {
        "package-info.java" -> "package-info"
        "module-info.java" -> "module-info"
        else -> sourcePath.nameWithoutExtension.takeIf(String::isNotBlank)
    }
}

private class JavaTokenStream(
    private val text: String
) {
    fun tokens(): List<String> {
        val tokens = mutableListOf<String>()
        var index = 0
        while (index < text.length) {
            val current = text[index]
            when {
                current.isWhitespace() -> index += 1
                current == '/' && text.getOrNull(index + 1) == '/' -> index = skipLineComment(index + 2)
                current == '/' && text.getOrNull(index + 1) == '*' -> index = skipBlockComment(index + 2)
                current == '"' -> index = skipQuoted(index + 1, '"')
                current == '\'' -> index = skipQuoted(index + 1, '\'')
                current.isJavaIdentifierStart() -> {
                    val start = index
                    index += 1
                    while (text.getOrNull(index)?.isJavaIdentifierPart() == true) {
                        index += 1
                    }
                    tokens += text.substring(start, index)
                }
                current in "{};.@()" -> {
                    tokens += current.toString()
                    index += 1
                }
                else -> index += 1
            }
        }
        return tokens
    }

    private fun skipLineComment(startIndex: Int): Int {
        var index = startIndex
        while (index < text.length && text[index] != '\n') {
            index += 1
        }
        return index
    }

    private fun skipBlockComment(startIndex: Int): Int {
        var index = startIndex
        while (index + 1 < text.length && !(text[index] == '*' && text[index + 1] == '/')) {
            index += 1
        }
        return (index + 2).coerceAtMost(text.length)
    }

    private fun skipQuoted(startIndex: Int, quote: Char): Int {
        var index = startIndex
        var escaped = false
        while (index < text.length) {
            val current = text[index]
            if (!escaped && current == quote) {
                return index + 1
            }
            escaped = !escaped && current == '\\'
            if (current != '\\') {
                escaped = false
            }
            index += 1
        }
        return index
    }
}

private fun isJavaIdentifier(value: String): Boolean =
    value.isNotBlank() && value.first().isJavaIdentifierStart() && value.drop(1).all(Char::isJavaIdentifierPart)

private fun sha256(value: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { byte -> "%02x".format(byte) }
}

private fun String.withTrailingLine(): String = if (isBlank()) "" else "$this${System.lineSeparator()}"

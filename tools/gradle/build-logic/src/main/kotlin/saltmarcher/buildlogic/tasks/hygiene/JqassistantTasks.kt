package saltmarcher.buildlogic.tasks.hygiene

import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.util.Comparator
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException
import org.gradle.process.ExecOperations
import javax.inject.Inject

abstract class AbstractJqassistantTask : DefaultTask() {

    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val cliFile: RegularFileProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val rulesDirectories: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val mainClassesDirectory: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceRoots: ConfigurableFileCollection

    @get:Input
    abstract val jvmOpens: Property<String>

    @get:Input
    abstract val ruleGroups: ListProperty<String>

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:Inject
    protected abstract val execOperations: ExecOperations

    protected fun materializeConfig(
        storeRootOverride: java.io.File,
        reportRootOverride: java.io.File?
    ): java.io.File {
        val scanEntries = buildList {
            add("java:classpath::${mainClassesDirectory.get().asFile.absoluteInvariantPath()}")
            addAll(sourceRoots.files.map(File::absoluteInvariantPath).sorted())
        }
        val storeUri = "file:${storeRootOverride.absoluteInvariantPath()}"
        val tempReportRoot = reportRootOverride?.toPath() ?: temporaryDir.toPath().resolve("reports")
        val rulesDirectoryPath = materializeRulesDirectory().absoluteInvariantPath()
        val configText = buildString {
            appendLine("\$schema: \"https://jqassistant.github.io/jqassistant/current/schema/jqassistant-configuration-cli-v2.6.schema.json\"")
            appendLine()
            appendLine("jqassistant:")
            appendLine("  store:")
            appendLine("    uri: $storeUri")
            appendLine("  scan:")
            appendLine("    reset: true")
            appendLine("    continue-on-error: false")
            appendLine("    include:")
            appendLine("      files:")
            scanEntries.forEach { entry -> appendLine("        - $entry") }
            appendLine("  analyze:")
            appendLine("    rule:")
            appendLine("      directory: $rulesDirectoryPath")
            appendLine("    baseline:")
            appendLine("      enabled: false")
            appendLine("    report:")
            appendLine("      continue-on-failure: false")
            appendLine("      fail-on-severity: BLOCKER")
            appendLine("      properties:")
            appendLine("        xml.report.file: ${tempReportRoot.resolve("jqassistant-report.xml").absoluteInvariantPath()}")
            appendLine("        xml.report.transform-to-html: false")
            appendLine("        junit.report.directory: ${tempReportRoot.resolve("junit").absoluteInvariantPath()}")
            appendLine("        junit.report.failureSeverity: BLOCKER")
            appendLine("        junit.report.errorSeverity: BLOCKER")
            appendLine("    groups:")
            ruleGroups.get().forEach { groupName -> appendLine("      - $groupName") }
        }
        val generatedConfig = temporaryDir.toPath().resolve("jqassistant-config.yml")
        Files.createDirectories(generatedConfig.parent)
        Files.writeString(generatedConfig, configText)
        return generatedConfig.toFile()
    }

    private fun materializeRulesDirectory(): File {
        val materializedRulesRoot = temporaryDir.toPath().resolve("jqassistant-rules").toFile()
        if (materializedRulesRoot.exists()) {
            materializedRulesRoot.deleteRecursively()
        }
        Files.createDirectories(materializedRulesRoot.toPath())
        rulesDirectories.files
            .sortedBy { file -> file.absolutePath }
            .forEachIndexed { index, rulesDirectory ->
                require(rulesDirectory.isDirectory) {
                    "jQAssistant rules input '${rulesDirectory.path}' is not a directory."
                }
                val copiedRulesRoot = materializedRulesRoot.resolve("${index.toString().padStart(2, '0')}-${rulesDirectory.name}")
                rulesDirectory.copyRecursively(copiedRulesRoot, overwrite = true)
            }
        return materializedRulesRoot
    }

    protected fun runJqassistant(generatedConfigFile: java.io.File, vararg arguments: String) {
        val outputBuffer = ByteArrayOutputStream()
        val execResult = execOperations.exec {
            workingDir = projectRoot.get().asFile
            environment("JQASSISTANT_OPTS", jvmOpens.get())
            commandLine(
                "/bin/bash",
                cliFile.get().asFile.absolutePath,
                *arguments,
                "-C",
                generatedConfigFile.absolutePath
            )
            isIgnoreExitValue = true
            standardOutput = outputBuffer
            errorOutput = outputBuffer
        }
        if (execResult.exitValue != 0) {
            val outputText = outputBuffer.toString(Charsets.UTF_8).trim()
            val suffix = if (outputText.isBlank()) "" else "\n$outputText"
            throw VerificationException("jQAssistant failed with exit code ${execResult.exitValue}.$suffix")
        }
    }
}

@CacheableTask
abstract class JqassistantScanTask : AbstractJqassistantTask() {

    @get:OutputDirectory
    abstract val storeDirectory: DirectoryProperty

    @TaskAction
    fun scan() {
        val storeDir = storeDirectory.get().asFile
        Files.createDirectories(storeDir.toPath().parent)
        val generatedConfigFile = materializeConfig(storeDir, null)
        runJqassistant(generatedConfigFile, "scan")
    }
}

@CacheableTask
abstract class JqassistantAnalyzeTask : AbstractJqassistantTask() {

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val storeDirectory: DirectoryProperty

    @get:OutputDirectory
    abstract val reportsDirectory: DirectoryProperty

    @TaskAction
    fun analyze() {
        val reportsDir = reportsDirectory.get().asFile
        if (reportsDir.exists()) {
            Files.walk(reportsDir.toPath())
                .sorted(Comparator.reverseOrder())
                .forEach(Files::deleteIfExists)
        }
        Files.createDirectories(reportsDir.toPath())
        Files.createDirectories(reportsDir.toPath().resolve("junit"))
        val generatedConfigFile = materializeConfig(storeDirectory.get().asFile, reportsDir)
        runJqassistant(generatedConfigFile, "analyze")
    }
}

abstract class JqassistantCommandTask : AbstractJqassistantTask() {

    @get:Input
    abstract val commandName: Property<String>

    @TaskAction
    fun runCommand() {
        val generatedConfigFile = materializeConfig(temporaryDir.toPath().resolve("jqassistant-store").toFile(), null)
        runJqassistant(generatedConfigFile, commandName.get())
    }
}

private fun java.nio.file.Path.absoluteInvariantPath(): String = toAbsolutePath().toString().replace('\\', '/')

private fun java.io.File.absoluteInvariantPath(): String = absolutePath.replace(File.separatorChar, '/')

package saltmarcher.buildlogic.tasks.hygiene

import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.util.Comparator
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
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
import org.gradle.work.DisableCachingByDefault
import javax.inject.Inject

abstract class AbstractJqassistantTask : DefaultTask() {

    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val cliFile: RegularFileProperty

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val rulesDirectory: DirectoryProperty

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

    protected fun materializeConfig(storeRootOverride: File, reportRootOverride: File?): File {
        val projectRootPath = projectRoot.get().asFile.toPath()
        val scanEntries = buildList {
            add("java:classpath::${projectRootPath.relativeInvariantPath(mainClassesDirectory.get().asFile)}")
            addAll(sourceRoots.files.map(projectRootPath::relativeInvariantPath).sorted())
        }
        val reportRoot = reportRootOverride?.toPath() ?: temporaryDir.toPath().resolve("reports")
        val generatedConfig = temporaryDir.toPath().resolve("jqassistant-config.yml")
        Files.createDirectories(generatedConfig.parent)
        Files.writeString(
            generatedConfig,
            buildString {
                appendLine("\$schema: \"https://jqassistant.github.io/jqassistant/current/schema/jqassistant-configuration-cli-v2.6.schema.json\"")
                appendLine()
                appendLine("jqassistant:")
                appendLine("  store:")
                appendLine("    uri: file:${projectRootPath.relativeInvariantPath(storeRootOverride)}")
                appendLine("  scan:")
                appendLine("    reset: true")
                appendLine("    continue-on-error: false")
                appendLine("    include:")
                appendLine("      files:")
                scanEntries.forEach { entry -> appendLine("        - $entry") }
                appendLine("  analyze:")
                appendLine("    rule:")
                appendLine("      directory: ${projectRootPath.relativeInvariantPath(rulesDirectory.get().asFile)}")
                appendLine("    baseline:")
                appendLine("      enabled: false")
                appendLine("    report:")
                appendLine("      continue-on-failure: false")
                appendLine("      fail-on-severity: BLOCKER")
                appendLine("      properties:")
                appendLine("        xml.report.file: ${reportRoot.resolve("jqassistant-report.xml").absoluteInvariantPath()}")
                appendLine("        xml.report.transform-to-html: false")
                appendLine("        junit.report.directory: ${reportRoot.resolve("junit").absoluteInvariantPath()}")
                appendLine("        junit.report.failureSeverity: BLOCKER")
                appendLine("        junit.report.errorSeverity: BLOCKER")
                appendLine("    groups:")
                ruleGroups.get().forEach { group -> appendLine("      - $group") }
            }
        )
        return generatedConfig.toFile()
    }

    protected fun runJqassistant(generatedConfigFile: File, vararg arguments: String) {
        val outputBuffer = ByteArrayOutputStream()
        val execResult = execOperations.exec {
            workingDir = projectRoot.get().asFile
            environment("JQASSISTANT_OPTS", jvmOpens.get())
            commandLine("/bin/bash", cliFile.get().asFile.absolutePath, *arguments, "-C", generatedConfigFile.absolutePath)
            isIgnoreExitValue = true
            standardOutput = outputBuffer
            errorOutput = outputBuffer
        }
        if (execResult.exitValue != 0) {
            val output = outputBuffer.toString(Charsets.UTF_8).trim()
            val suffix = if (output.isBlank()) "" else "\n$output"
            throw VerificationException("jQAssistant failed with exit code ${execResult.exitValue}.$suffix")
        }
    }
}

@DisableCachingByDefault(because = "jQAssistant's Neo4j store materializes checkout-specific source paths.")
abstract class JqassistantScanTask : AbstractJqassistantTask() {

    @get:OutputDirectory
    abstract val storeDirectory: DirectoryProperty

    @TaskAction
    fun scan() {
        val storeDir = storeDirectory.get().asFile
        Files.createDirectories(storeDir.toPath().parent)
        val configFile = materializeConfig(storeDir, null)
        runJqassistant(configFile, "scan")
    }
}

@DisableCachingByDefault(because = "jQAssistant's Neo4j store materializes checkout-specific source paths.")
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
        Files.createDirectories(reportsDir.toPath().resolve("junit"))
        val configFile = materializeConfig(storeDirectory.get().asFile, reportsDir)
        runJqassistant(configFile, "analyze")
    }
}

private fun java.nio.file.Path.absoluteInvariantPath(): String = toAbsolutePath().toString().replace('\\', '/')

private fun Path.relativeInvariantPath(file: File): String =
    relativize(file.toPath()).toString().replace(File.separatorChar, '/')

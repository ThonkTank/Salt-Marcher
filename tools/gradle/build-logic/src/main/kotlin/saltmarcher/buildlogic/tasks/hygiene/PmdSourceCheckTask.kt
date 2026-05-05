package saltmarcher.buildlogic.tasks.hygiene

import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException
import org.gradle.process.ExecOperations
import org.gradle.api.tasks.CacheableTask
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import javax.inject.Inject

@CacheableTask
abstract class PmdSourceCheckTask : DefaultTask() {

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceRoots: ConfigurableFileCollection

    @get:Classpath
    abstract val toolClasspath: ConfigurableFileCollection

    @get:Classpath
    abstract val auxClasspath: ConfigurableFileCollection

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val rulesetFiles: ConfigurableFileCollection

    @get:OutputFile
    abstract val reportFile: RegularFileProperty

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:Inject
    protected abstract val execOperations: ExecOperations

    @TaskAction
    fun runPmd() {
        val reportPath = reportFile.get().asFile.toPath()
        val outputBuffer = ByteArrayOutputStream()
        val projectRootPath = projectRoot.get().asFile.toPath()
        val configuredSourceDirs = sourceRoots.files
            .map { file -> projectRootPath.relativize(file.toPath()).toString().replace('\\', '/') }
            .sorted()
        val sourceDirs = configuredSourceDirs.ifEmpty {
            listOf("bootstrap", "shell", "src")
                .filter { relativePath -> Files.exists(projectRootPath.resolve(relativePath)) }
        }
        val rulesetPaths = rulesetFiles.files
            .map { file -> projectRootPath.relativize(file.toPath()).toString().replace('\\', '/') }
            .sorted()

        Files.createDirectories(reportPath.parent)
        Files.writeString(reportPath, "")
        val commandArgs = mutableListOf(
            "check",
            "-R",
            rulesetPaths.joinToString(","),
            "-f",
            "text",
            "-r",
            reportPath.toString(),
            "--fail-on-error",
            "--fail-on-violation"
        )
        if (sourceDirs.isNotEmpty()) {
            commandArgs.addAll(sourceDirs)
        }

        val execResult = execOperations.javaexec {
            workingDir = projectRoot.get().asFile
            classpath = toolClasspath
            mainClass.set("net.sourceforge.pmd.cli.PmdCli")
            args(commandArgs)
            val auxClasspathText = auxClasspath.files
                .distinct()
                .joinToString(File.pathSeparator)
            if (auxClasspathText.isNotBlank()) {
                args("--aux-classpath", auxClasspathText)
            }
            isIgnoreExitValue = true
            standardOutput = outputBuffer
            errorOutput = outputBuffer
        }

        val outputText = outputBuffer.toString(Charsets.UTF_8).trim()
        if (!Files.exists(reportPath)) {
            Files.writeString(reportPath, "")
        }

        if (execResult.exitValue != 0) {
            val reportText = Files.readString(reportPath).trim()
            if (reportText.isNotBlank()) {
                println(reportText)
            }
            if (outputText.isNotBlank()) {
                println(outputText)
            }
            logger.warn(
                "PMD source-smell report contains violations or analysis diagnostics. " +
                    "See the report at: file://${reportPath.toAbsolutePath()}"
            )
            throw VerificationException(
                "PMD source-smell violations were found. See the report at: " +
                    "file://${reportPath.toAbsolutePath()}"
            )
        }
    }
}

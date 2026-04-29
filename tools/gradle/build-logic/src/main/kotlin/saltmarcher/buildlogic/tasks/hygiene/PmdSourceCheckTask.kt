package saltmarcher.buildlogic.tasks.hygiene

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations
import org.gradle.work.DisableCachingByDefault
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import javax.inject.Inject

@DisableCachingByDefault(because = "Verification task whose result is a pass/fail report.")
abstract class PmdSourceCheckTask : DefaultTask() {

    init {
        outputs.upToDateWhen { false }
    }

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceRoots: ConfigurableFileCollection

    @get:Classpath
    abstract val toolClasspath: ConfigurableFileCollection

    @get:Classpath
    abstract val auxClasspath: ConfigurableFileCollection

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val rulesetFile: RegularFileProperty

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
        val sourceDirs = sourceRoots.files
            .map { file -> projectRootPath.relativize(file.toPath()).toString().replace('\\', '/') }
            .sorted()

        Files.createDirectories(reportPath.parent)

        val execResult = execOperations.javaexec {
            workingDir = projectRoot.get().asFile
            classpath = toolClasspath
            mainClass.set("net.sourceforge.pmd.cli.PmdCli")
            args(
                "check",
                "--rulesets",
                projectRootPath.relativize(rulesetFile.get().asFile.toPath()).toString().replace('\\', '/'),
                "--format",
                "text",
                "--report-file",
                reportPath.toString(),
                "--fail-on-error",
                "--fail-on-violation"
            )
            val auxClasspathText = auxClasspath.files
                .distinct()
                .joinToString(File.pathSeparator)
            if (auxClasspathText.isNotBlank()) {
                args("--aux-classpath", auxClasspathText)
            }
            sourceDirs.forEach { dir ->
                args("--dir", dir)
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
            throw GradleException(
                "PMD source-smell violations were found. See the report at: " +
                    "file://${reportPath.toAbsolutePath()}"
            )
        }
    }
}

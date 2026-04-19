package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations
import org.gradle.work.DisableCachingByDefault
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import javax.inject.Inject

@DisableCachingByDefault(because = "Verification task whose result is a pass/fail report.")
abstract class CpdCheckTask : DefaultTask() {

    init {
        outputs.upToDateWhen { false }
    }

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceRoots: ConfigurableFileCollection

    @get:Classpath
    abstract val toolClasspath: ConfigurableFileCollection

    @get:Input
    abstract val minimumTokens: Property<Int>

    @get:OutputFile
    abstract val reportFile: RegularFileProperty

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:Inject
    protected abstract val execOperations: ExecOperations

    @TaskAction
    fun runCpd() {
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
                "cpd",
                "--minimum-tokens",
                minimumTokens.get().toString(),
                "--language",
                "java",
                "--format",
                "text",
                "--report-file",
                reportPath.toString()
            )
            sourceDirs.forEach { dir ->
                args(listOf("--dir", dir))
            }
            isIgnoreExitValue = true
            standardOutput = outputBuffer
            errorOutput = outputBuffer
        }

        val outputText = outputBuffer.toString(Charsets.UTF_8).trim()
        if (execResult.exitValue != 0) {
            val reportText = if (Files.exists(reportPath)) Files.readString(reportPath).trim() else ""
            if (reportText.isNotBlank()) {
                println(reportText)
            }
            if (outputText.isNotBlank()) {
                println(outputText)
            }
            throw GradleException(
                "CPD duplicate-code violations were found. See the report at: file://${reportPath.toAbsolutePath()}"
            )
        }

        if (!Files.exists(reportPath)) {
            Files.writeString(reportPath, "")
        }
    }
}

package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.work.DisableCachingByDefault

@DisableCachingByDefault(because = "Verification task with no stable outputs.")
abstract class CheckNoCompiledArtifactsTask : DefaultTask() {

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceRoots: ConfigurableFileCollection

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @TaskAction
    fun checkCompiledArtifacts() {
        val projectRootPath = projectRoot.get().asFile.toPath()
        val offendingFiles = sourceRoots.asFileTree
            .matching { include("**/*.class") }
            .files
            .map { file -> projectRootPath.relativize(file.toPath()).toString().replace('\\', '/') }
            .sorted()

        if (offendingFiles.isNotEmpty()) {
            val details = offendingFiles.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "Compiled artifacts found in source directories.\n" +
                    "Remove them with: find bootstrap shell src -name '*.class' -delete\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

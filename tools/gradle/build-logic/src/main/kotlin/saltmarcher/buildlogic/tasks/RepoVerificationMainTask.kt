package saltmarcher.buildlogic.tasks

import java.nio.file.Files
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations
import javax.inject.Inject

@CacheableTask
abstract class RepoVerificationMainTask : DefaultTask() {

    @get:Classpath
    abstract val runtimeClasspath: ConfigurableFileCollection

    @get:Input
    abstract val verificationMainClass: Property<String>

    @get:Internal
    abstract val repoRootDirectory: DirectoryProperty

    @get:Input
    abstract val verificationArgs: ListProperty<String>

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val verificationInputs: ConfigurableFileCollection

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @get:Inject
    protected abstract val execOperations: ExecOperations

    init {
        verificationArgs.convention(emptyList())
    }

    @TaskAction
    fun verify() {
        val markerPath = successMarker.get().asFile.toPath()
        Files.createDirectories(markerPath.parent)
        Files.deleteIfExists(markerPath)

        execOperations.javaexec {
            val repoRoot = repoRootDirectory.get().asFile
            workingDir = repoRoot
            classpath = runtimeClasspath
            mainClass.set(verificationMainClass)
            System.getProperty("saltmarcher.focusedVerificationPaths")
                ?.takeIf(String::isNotBlank)
                ?.let { focusedPaths -> systemProperty("saltmarcher.focusedVerificationPaths", focusedPaths) }
            args(repoRoot.absolutePath)
            args(verificationArgs.get())
        }

        Files.createDirectories(markerPath.parent)
        Files.writeString(markerPath, "passed\n")
    }
}

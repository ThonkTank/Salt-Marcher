package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.work.DisableCachingByDefault
import java.nio.file.Files
import java.util.Locale

@DisableCachingByDefault(because = "Verification task with no stable outputs.")
abstract class CheckCentralizedStylesheetsTask : DefaultTask() {

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val stylesheetFiles: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val resourcesRoot: DirectoryProperty

    @get:Input
    abstract val styleExtensions: ListProperty<String>

    @get:Input
    abstract val allowedStylesheetRelativePath: Property<String>

    @TaskAction
    fun checkStylesheetPlacement() {
        val projectRootPath = projectRoot.get().asFile.toPath().normalize()
        val allowedStylesheetPath = projectRootPath.resolve(allowedStylesheetRelativePath.get()).normalize()
        val extensions = styleExtensions.get().map { it.lowercase(Locale.ROOT) }.toSet()

        val offendingFiles = stylesheetFiles.files.asSequence()
            .map { file -> file.toPath().normalize() }
            .filter(Files::isRegularFile)
            .filter { path ->
                val extension = path.fileName.toString().substringAfterLast('.', "").lowercase(Locale.ROOT)
                extension in extensions && path != allowedStylesheetPath
            }
            .map { path -> projectRootPath.relativize(path).toString().replace('\\', '/') }
            .sorted()
            .toList()

        if (offendingFiles.isNotEmpty()) {
            val details = offendingFiles.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "Stylesheet files must be centralized in ${allowedStylesheetRelativePath.get()}.\n" +
                    "Move approved visual rules into the central stylesheet instead of adding replacement style files.\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

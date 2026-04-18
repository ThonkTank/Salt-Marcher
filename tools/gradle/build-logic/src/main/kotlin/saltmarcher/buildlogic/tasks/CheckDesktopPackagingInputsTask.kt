package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.work.DisableCachingByDefault

@DisableCachingByDefault(because = "Verification task with no stable outputs.")
abstract class CheckDesktopPackagingInputsTask : DefaultTask() {

    @get:InputFile
    @get:Optional
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val mainClassSourceFile: RegularFileProperty

    @get:InputFile
    @get:Optional
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val preloaderClassSourceFile: RegularFileProperty

    @get:InputFile
    @get:Optional
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val desktopIconSourceFile: RegularFileProperty

    @get:InputFile
    @get:Optional
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val stylesheetFile: RegularFileProperty

    @get:Input
    abstract val mainClassName: Property<String>

    @get:Input
    abstract val preloaderClassName: Property<String>

    @get:Input
    abstract val desktopIconSourceRelativePath: Property<String>

    @get:Input
    abstract val desktopEntryIconRelativePath: Property<String>

    @get:Input
    abstract val windowIconRelativePath: Property<String>

    @get:Input
    abstract val stylesheetRelativePath: Property<String>

    @get:Input
    abstract val launcherName: Property<String>

    @get:Input
    abstract val startupWmClass: Property<String>

    @TaskAction
    fun checkPackagingInputs() {
        if (!mainClassSourceFile.get().asFile.isFile) {
            throw GradleException("Desktop packaging main class not found: ${mainClassName.get()}")
        }
        if (!preloaderClassSourceFile.get().asFile.isFile) {
            throw GradleException("Desktop packaging preloader class not found: ${preloaderClassName.get()}")
        }

        val iconSource = desktopIconSourceFile.get().asFile
        if (!iconSource.isFile) {
            throw GradleException("Desktop icon source is missing: ${iconSource.toPath().toAbsolutePath()}")
        }

        if (!desktopEntryIconRelativePath.get().endsWith(".svg")) {
            throw GradleException("Desktop entry icon must point at an SVG file but was '${desktopEntryIconRelativePath.get()}'.")
        }
        if (!windowIconRelativePath.get().endsWith(".png")) {
            throw GradleException("Window icon must point at a PNG file but was '${windowIconRelativePath.get()}'.")
        }

        val stylesheet = stylesheetFile.get().asFile
        if (!stylesheet.isFile) {
            throw GradleException("Desktop stylesheet is missing: ${stylesheet.toPath().toAbsolutePath()}")
        }

        val launcher = launcherName.get()
        if (!launcher.matches(Regex("[a-z0-9-]+"))) {
            throw GradleException("Launcher name must match [a-z0-9-]+ but was '$launcher'.")
        }
        if (startupWmClass.get().isBlank()) {
            throw GradleException("Desktop StartupWMClass must not be blank.")
        }
    }
}

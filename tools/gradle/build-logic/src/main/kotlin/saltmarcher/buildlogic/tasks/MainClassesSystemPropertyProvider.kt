package saltmarcher.buildlogic.tasks

import org.gradle.api.file.DirectoryProperty
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.process.CommandLineArgumentProvider
import javax.inject.Inject

abstract class MainClassesSystemPropertyProvider @Inject constructor() : CommandLineArgumentProvider {

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val mainClassesDirectory: DirectoryProperty

    override fun asArguments(): Iterable<String> = listOf(
        "-Dsaltmarcher.mainClassesDir=${mainClassesDirectory.get().asFile.absolutePath}"
    )
}

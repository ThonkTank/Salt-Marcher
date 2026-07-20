package saltmarcher.buildlogic.tasks

import org.gradle.api.GradleException
import org.gradle.api.provider.ListProperty
import org.gradle.api.tasks.Input
import org.gradle.process.CommandLineArgumentProvider
import javax.inject.Inject

/** Configuration-cache-safe bridge from required Gradle properties to JavaExec arguments. */
abstract class RequiredCommandLineArgumentsProvider @Inject constructor() :
    CommandLineArgumentProvider {

    @get:Input
    abstract val arguments: ListProperty<String>

    @get:Input
    abstract val propertyNames: ListProperty<String>

    override fun asArguments(): Iterable<String> {
        val values = arguments.get()
        val names = propertyNames.get()
        require(values.size == names.size) {
            "required argument values and property names must have the same size"
        }
        val missing = names.filterIndexed { index, _ -> values[index].isBlank() }
        if (missing.isNotEmpty()) {
            throw GradleException(
                "Set required Gradle property/properties: " +
                    missing.joinToString { "-P$it=/absolute/path" }
            )
        }
        return values
    }
}

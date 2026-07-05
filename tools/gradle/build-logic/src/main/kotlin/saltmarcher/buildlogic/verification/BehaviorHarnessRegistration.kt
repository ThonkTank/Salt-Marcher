package saltmarcher.buildlogic.verification

import org.gradle.api.Action
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.TaskContainer
import org.gradle.api.tasks.TaskProvider
import org.gradle.kotlin.dsl.register
import org.gradle.work.DisableCachingByDefault

enum class BehaviorHarnessClassification {
    FOCUSED,
    AGGREGATE,
    UTILITY
}

data class BehaviorHarnessRegistration(
    val taskName: String,
    val classification: BehaviorHarnessClassification,
    val conceptIds: List<String>,
    val suiteIds: List<String>,
    val setupDependencies: List<String>,
    val behaviorDependencies: List<String>,
    val aggregateOf: List<String>,
)

open class BehaviorHarnessRegistrationSpec(objects: ObjectFactory) {
    val classification: Property<BehaviorHarnessClassification> =
        objects.property(BehaviorHarnessClassification::class.java)
    val conceptIds: ListProperty<String> = objects.listProperty(String::class.java).convention(emptyList())
    val suiteIds: ListProperty<String> = objects.listProperty(String::class.java).convention(emptyList())
    val setupDependencies: ListProperty<String> = objects.listProperty(String::class.java).convention(emptyList())
    val behaviorDependencies: ListProperty<String> = objects.listProperty(String::class.java).convention(emptyList())
    val aggregateOf: ListProperty<String> = objects.listProperty(String::class.java).convention(emptyList())

    private val taskActions = mutableListOf<Action<JavaExec>>()

    fun task(action: Action<JavaExec>) {
        taskActions += action
    }

    internal fun configure(task: JavaExec) {
        taskActions.forEach { action -> action.execute(task) }
    }

    internal fun snapshot(taskName: String): BehaviorHarnessRegistration =
        BehaviorHarnessRegistration(
            taskName = taskName,
            classification = classification.orNull
                ?: throw GradleException("Behavior harness '$taskName' must declare a classification."),
            conceptIds = conceptIds.get(),
            suiteIds = suiteIds.get(),
            setupDependencies = setupDependencies.get(),
            behaviorDependencies = behaviorDependencies.get(),
            aggregateOf = aggregateOf.get()
        )
}

open class BehaviorHarnessRegistry(
    private val tasks: TaskContainer,
    private val objects: ObjectFactory
) {
    private val registeredHarnesses = mutableListOf<BehaviorHarnessRegistration>()

    val registrations: List<BehaviorHarnessRegistration>
        get() = registeredHarnesses.toList()

    fun javaExec(
        taskName: String,
        action: Action<BehaviorHarnessRegistrationSpec>
    ): TaskProvider<JavaExec> {
        val spec = BehaviorHarnessRegistrationSpec(objects)
        action.execute(spec)
        val registration = spec.snapshot(taskName)
        validate(registration)
        registeredHarnesses += registration
        return tasks.register<JavaExec>(taskName) {
            spec.configure(this)
        }
    }

    private fun validate(registration: BehaviorHarnessRegistration) {
        when (registration.classification) {
            BehaviorHarnessClassification.FOCUSED -> {
                if (registration.conceptIds.isEmpty()) {
                    throw GradleException(
                        "Focused behavior harness '${registration.taskName}' must declare at least one concept id."
                    )
                }
            }
            BehaviorHarnessClassification.AGGREGATE -> {
                if (registration.aggregateOf.isEmpty() && registration.suiteIds.isEmpty()) {
                    throw GradleException(
                        "Aggregate behavior harness '${registration.taskName}' must declare suite ids or aggregateOf."
                    )
                }
            }
            BehaviorHarnessClassification.UTILITY -> {
                if (registration.conceptIds.isNotEmpty() || registration.aggregateOf.isNotEmpty()) {
                    throw GradleException(
                        "Utility behavior harness '${registration.taskName}' must not claim focused concepts."
                    )
                }
            }
        }
    }
}

@DisableCachingByDefault(because = "Topology is checked against the configured task model.")
abstract class CheckBehaviorHarnessTopologyTask : DefaultTask() {
    @get:Input
    abstract val registeredTaskNames: ListProperty<String>

    @get:Input
    abstract val registeredHarnessMetadata: ListProperty<String>

    @get:Input
    abstract val discoveredHarnesses: ListProperty<String>

    @TaskAction
    fun checkBehaviorHarnessTopology() {
        val registeredNames = registeredTaskNames.get().toSet()
        val duplicateRegisteredNames = registeredTaskNames.get()
            .groupingBy { taskName -> taskName }
            .eachCount()
            .filterValues { count -> count > 1 }
            .keys
            .sorted()
        if (duplicateRegisteredNames.isNotEmpty()) {
            throw GradleException(
                "Behavior harness registry contains duplicate task names: " +
                    duplicateRegisteredNames.joinToString(", ")
                )
        }

        val registrations = registeredHarnessMetadata.get()
            .map(::parseRegistrationMetadata)
            .sortedBy(RegisteredBehaviorHarness::taskName)
        val graphViolations = registrations.flatMap(::focusedGraphViolations)
        if (graphViolations.isNotEmpty()) {
            throw GradleException(
                "Behavior harness topology violations found." +
                    System.lineSeparator() +
                    graphViolations.joinToString(System.lineSeparator())
            )
        }

        val unregisteredHarnesses = discoveredHarnesses.get()
            .filter { diagnostic -> diagnostic.substringBefore('\t') !in registeredNames }

        if (unregisteredHarnesses.isNotEmpty()) {
            val diagnostics = unregisteredHarnesses.joinToString(System.lineSeparator()) { diagnostic ->
                val parts = diagnostic.split('\t', limit = 3)
                "- ${parts.getOrElse(0) { "<unknown>" }} " +
                    "mainClass=${parts.getOrElse(1) { "<unknown>" }} " +
                    "description=${parts.getOrElse(2) { "" }}"
            }
            throw GradleException(
                "Unregistered behavior harness JavaExec tasks found. Register each through " +
                    "behaviorHarnesses.javaExec or narrow it so it no longer matches behavior-harness shape." +
                    System.lineSeparator() +
                    diagnostics
            )
        }
    }

    private fun focusedGraphViolations(registration: RegisteredBehaviorHarness): List<String> {
        val violations = mutableListOf<String>()
        if (registration.classification == BehaviorHarnessClassification.FOCUSED.name) {
            if (registration.conceptIds.size != 1) {
                violations += "- ${registration.taskName}: focused behavior harnesses must declare exactly one concept id."
            }
            if (registration.aggregateOf.isNotEmpty()) {
                violations += "- ${registration.taskName}: focused behavior harnesses must not declare aggregateOf."
            }
            if (registration.behaviorDependencies.isNotEmpty()) {
                violations += "- ${registration.taskName}: focused behavior harnesses must not depend on other " +
                    "behavior suites; move direct invariant/setup prerequisites to setupDependencies or mark the " +
                    "task AGGREGATE."
            }
        }
        if (registration.classification == BehaviorHarnessClassification.AGGREGATE.name &&
            registration.conceptIds.isNotEmpty()
        ) {
            violations += "- ${registration.taskName}: aggregate behavior harnesses must not claim focused concept ids."
        }
        if (registration.classification == BehaviorHarnessClassification.UTILITY.name &&
            (registration.behaviorDependencies.isNotEmpty() || registration.setupDependencies.isNotEmpty())
        ) {
            violations += "- ${registration.taskName}: utility behavior harnesses must not declare proof dependencies."
        }
        return violations
    }
}

@DisableCachingByDefault(because = "Harness-map consistency is checked against configured task metadata.")
abstract class CheckHarnessMapConsistencyTask : DefaultTask() {
    @get:Input
    abstract val registeredHarnessMetadata: ListProperty<String>

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val harnessMapFile: RegularFileProperty

    @TaskAction
    fun checkHarnessMapConsistency() {
        val registrations = registeredHarnessMetadata.get()
            .map(::parseRegistrationMetadata)
        val registeredNames = registrations.map(RegisteredBehaviorHarness::taskName).toSet()
        val proofHarnessNames = registrations
            .filter { registration -> registration.classification != BehaviorHarnessClassification.UTILITY.name }
            .map(RegisteredBehaviorHarness::taskName)
            .toSet()
        val mappedNames = parseHarnessMapTaskNames(harnessMapFile.get().asFile.readText())

        val unknown = mappedNames.filter { taskName -> taskName !in registeredNames }.sorted()
        val missing = proofHarnessNames.filter { taskName -> taskName !in mappedNames }.sorted()
        val listingUtilityMapped = registrations
            .filter { registration -> registration.classification == BehaviorHarnessClassification.UTILITY.name }
            .filter { registration -> registration.suiteIds.isEmpty() }
            .map(RegisteredBehaviorHarness::taskName)
            .filter { taskName -> taskName in mappedNames }
            .sorted()
        val violations = mutableListOf<String>()
        if (unknown.isNotEmpty()) {
            violations += "Unknown harness-map tasks: " + unknown.joinToString(", ")
        }
        if (missing.isNotEmpty()) {
            violations += "Registered FOCUSED/AGGREGATE harnesses missing from harness-map.json: " +
                missing.joinToString(", ")
        }
        if (listingUtilityMapped.isNotEmpty()) {
            violations += "Listing UTILITY harnesses must not appear in harness-map.json: " +
                listingUtilityMapped.joinToString(", ")
        }
        if (violations.isNotEmpty()) {
            throw GradleException(
                "Behavior harness map consistency violations found." +
                    System.lineSeparator() +
                    violations.joinToString(System.lineSeparator())
            )
        }
    }
}

private data class RegisteredBehaviorHarness(
    val taskName: String,
    val classification: String,
    val conceptIds: List<String>,
    val suiteIds: List<String>,
    val setupDependencies: List<String>,
    val behaviorDependencies: List<String>,
    val aggregateOf: List<String>
)

private fun parseRegistrationMetadata(metadata: String): RegisteredBehaviorHarness {
    val parts = metadata.split('\t')
    return RegisteredBehaviorHarness(
        taskName = parts.getOrElse(0) { "" },
        classification = parts.getOrElse(1) { "" },
        conceptIds = parts.getOrElse(2) { "" }.toMetadataList(),
        suiteIds = parts.getOrElse(3) { "" }.toMetadataList(),
        setupDependencies = parts.getOrElse(4) { "" }.toMetadataList(),
        behaviorDependencies = parts.getOrElse(5) { "" }.toMetadataList(),
        aggregateOf = parts.getOrElse(6) { "" }.toMetadataList()
    )
}

private fun parseHarnessMapTaskNames(json: String): Set<String> {
    val names = mutableSetOf<String>()
    val arrayPattern = Regex(":\\s*\\[(.*?)\\]", setOf(RegexOption.DOT_MATCHES_ALL))
    val stringPattern = Regex("\"([^\"]+)\"")
    for (arrayMatch in arrayPattern.findAll(json)) {
        val body = arrayMatch.groupValues[1]
        for (taskMatch in stringPattern.findAll(body)) {
            names += taskMatch.groupValues[1]
        }
    }
    return names
}

private fun String.toMetadataList(): List<String> =
    split(',')
        .map(String::trim)
        .filter(String::isNotEmpty)

internal fun behaviorHarnessDiagnostic(task: JavaExec): String? {
    if (task.group != "verification") {
        return null
    }
    val name = task.name.lowercase()
    val description = task.description.orEmpty().lowercase()
    val mainClassName = task.mainClass.orNull.orEmpty().lowercase()
    val hasHarnessName = name.endsWith("harness") || name.endsWith("harnesssuites")
    val hasBehaviorDescription = description.contains("behavior harness") ||
        description.contains("behavior suite")
    val hasBehaviorName = name.contains("behavior")
    val hasHarnessMainClass = mainClassName.substringAfterLast('.').endsWith("harness") ||
        mainClassName.substringAfterLast('.').endsWith("suiteharness")
    val hasBehaviorSignal = hasBehaviorName || hasBehaviorDescription
    if (!hasHarnessName && !hasBehaviorDescription && !(hasHarnessMainClass && hasBehaviorSignal)) {
        return null
    }
    return listOf(
        task.name,
        task.mainClass.orNull ?: "<unset>",
        task.description.orEmpty()
    ).joinToString("\t")
}

internal fun behaviorHarnessRegistrationMetadata(registration: BehaviorHarnessRegistration): String =
    listOf(
        registration.taskName,
        registration.classification.name,
        registration.conceptIds.joinToString(","),
        registration.suiteIds.joinToString(","),
        registration.setupDependencies.joinToString(","),
        registration.behaviorDependencies.joinToString(","),
        registration.aggregateOf.joinToString(",")
    ).joinToString("\t")

package saltmarcher.buildlogic.verification

import java.security.MessageDigest
import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.Directory
import org.gradle.api.file.FileCollection
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.SourceSet
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.enforcement.EnforcementBundleDescriptor
import saltmarcher.buildlogic.enforcement.EnforcementJqassistantTask
import saltmarcher.buildlogic.enforcement.EnforcementUtilityTaskKind
import saltmarcher.buildlogic.enforcement.focusedVerificationCompileTaskName
import saltmarcher.buildlogic.tasks.CheckCentralizedStylesheetsTask
import saltmarcher.buildlogic.tasks.CheckDefinedStyleClassSelectorsTask
import saltmarcher.buildlogic.tasks.CheckManualNodeStylingTask
import saltmarcher.buildlogic.tasks.CheckStylingCentralStylesheetOwnerTask
import saltmarcher.buildlogic.tasks.CheckViewFxmlResourcesTask
import saltmarcher.buildlogic.tasks.MainClassesSystemPropertyProvider

internal open class VerificationHarnessExtension(
    private val project: Project,
    private val sourceSets: SourceSetContainer,
    private val mainSourceSet: SourceSet,
    private val sourceJavaRoots: FileCollection,
    private val commonFocusedArchunitSupportIncludes: List<String>,
    private val jqassistantTaskRegistrar: JqassistantTaskRegistrar
) {
    private fun compileJavaTaskName(sourceSetName: String): String =
        "compile${sourceSetName.replaceFirstChar(Char::uppercaseChar)}Java"

    private fun classesTaskName(sourceSetName: String): String = "${sourceSetName}Classes"

    fun registerFocusedVerificationCompileAlias(
        bundleId: String,
        coalescedCompileTask: TaskProvider<JavaCompile>
    ): TaskProvider<Task> = project.tasks.register(focusedVerificationCompileTaskName(bundleId)) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Alias for the coalesced focused verification compile used by '$bundleId'."
        dependsOn(coalescedCompileTask)
    }

    fun registerFocusedVerificationCompileTask(
        sliceKey: FocusedVerificationSliceKey,
        checkerNames: List<String>,
        taskDescription: String
    ): TaskProvider<JavaCompile> {
        val sourceSetName = "focusedVerification${sliceKey.sliceId}"
        val roots = sliceKey.verificationSourceRoots
        val includes = sliceKey.verificationSourceIncludes
        sourceSets.register(sourceSetName) {
            java.setSrcDirs(roots)
            includes.forEach(java::include)
            resources.setSrcDirs(emptyList<String>())
            compileClasspath += mainSourceSet.compileClasspath
            runtimeClasspath += output + compileClasspath
        }
        return project.tasks.named<JavaCompile>(compileJavaTaskName(sourceSetName)) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = taskDescription
            setSource(project.files(roots).asFileTree.matching {
                includes.forEach(::include)
                exclude("**/build/**")
            })
            options.sourcepath = sourceJavaRoots
            destinationDirectory.set(project.layout.buildDirectory.dir("classes/java/verification/${sliceKey.sliceId}"))
            if (checkerNames.isEmpty()) {
                options.errorprone.enabled.set(false)
            } else {
                dependsOn(project.gradle.includedBuild("quality-rules-errorprone").task(":jar"))
                options.errorprone.enabled.set(true)
                options.errorprone.disableWarningsInGeneratedCode.set(true)
                options.errorprone.disableAllChecks.set(true)
                options.compilerArgs.add("-XDaddTypeAnnotationsToSymbol=true")
                checkerNames.forEach(options.errorprone::error)
            }
            inputs.property("focusedVerificationCheckerNames", checkerNames.joinToString(","))
        }
    }

    fun registerFocusedArchunitTestTask(
        bundleId: String,
        taskName: String,
        taskDescription: String,
        selectedCompileJava: TaskProvider<JavaCompile>,
        archunitIncludes: List<String>,
        includePatterns: List<String>
    ): TaskProvider<Test> {
        val sourceSetName = "${bundleId.replaceFirstChar(Char::lowercaseChar)}EnforcementArchunit"
        val mainClassesDirectory = selectedCompileJava.flatMap { task -> task.destinationDirectory }
        val archunitSourceSet = sourceSets.register(sourceSetName) {
            java.setSrcDirs(listOf("src/test/java"))
            commonFocusedArchunitSupportIncludes.forEach(java::include)
            archunitIncludes.forEach(java::include)
            resources.setSrcDirs(emptyList<String>())
            compileClasspath += project.files(project.configurations.named("testCompileClasspath"))
            runtimeClasspath += output +
                compileClasspath +
                project.files(project.configurations.named("testRuntimeClasspath"), mainClassesDirectory)
        }
        val archunitClassesDirs = project.files(archunitSourceSet.map(SourceSet::getOutput).map { output -> output.classesDirs })
        val archunitRuntimeClasspath = project.files(archunitSourceSet.map(SourceSet::getRuntimeClasspath))
        return project.tasks.register<Test>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = taskDescription
            dependsOn(selectedCompileJava)
            dependsOn(project.tasks.named(classesTaskName(sourceSetName)))
            inputs.dir(mainClassesDirectory)
                .withPropertyName("mainClassesDirectory")
                .withPathSensitivity(PathSensitivity.RELATIVE)
            testClassesDirs = archunitClassesDirs
            classpath = archunitRuntimeClasspath
            useJUnitPlatform()
            includePatterns.forEach(::include)
            jvmArgumentProviders += project.objects.newInstance(MainClassesSystemPropertyProvider::class.java).apply {
                this.mainClassesDirectory.set(mainClassesDirectory)
            }
        }
    }

    fun registerJqassistantTask(
        bundleId: String,
        taskSpec: EnforcementJqassistantTask
    ) = jqassistantTaskRegistrar.registerTaskPair(
        bundleId = bundleId,
        taskSpec = taskSpec,
        mainClassesDirectory = project.tasks.named<JavaCompile>("compileJava").flatMap(JavaCompile::getDestinationDirectory),
        sourceRoots = project.files(taskSpec.sourceRoots).asFileTree.matching {
            taskSpec.sourceIncludes.forEach(::include)
            exclude("**/build/**")
        },
        dependsOnTasks = listOf(project.tasks.named("classes"))
    ).analyzeTask

    fun registerUtilityVerificationTask(
        taskName: String,
        kind: EnforcementUtilityTaskKind
    ): TaskProvider<out Task> = when (kind) {
        EnforcementUtilityTaskKind.VIEW_FXML_RESOURCES -> project.tasks.register<CheckViewFxmlResourcesTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Validate declarative passive-view FXML resource placement and controller ownership."
            projectRoot.set(project.layout.projectDirectory)
            verificationInputs.from(
                project.layout.projectDirectory.asFileTree.matching {
                    include("resources/**")
                    include("shell/**")
                    include("src/**")
                    exclude("**/.gradle/**")
                    exclude("**/build/**")
                    exclude("**/.git/**")
                }
            )
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
        EnforcementUtilityTaskKind.CENTRALIZED_STYLESHEETS -> project.tasks.register<CheckCentralizedStylesheetsTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Fail if stylesheet files exist outside the central resources/salt-marcher.css file."
            stylesheetFiles.from(
                project.layout.projectDirectory.asFileTree.matching {
                    include("**/*.css", "**/*.scss", "**/*.sass", "**/*.less", "**/*.styl")
                    exclude("**/.git/**", "**/.gradle/**", "**/build/**")
                }
            )
            canonicalStylesheetRelativePath.set("resources/salt-marcher.css")
            canonicalStylesheetFile.set(project.layout.projectDirectory.file("resources/salt-marcher.css"))
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
        EnforcementUtilityTaskKind.STYLING_CENTRAL_STYLESHEET_OWNER -> project.tasks.register<CheckStylingCentralStylesheetOwnerTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Fail if SaltMarcher styling stops using the canonical resources/salt-marcher.css owner."
            configuredStylesheetPath.set(project.providers.gradleProperty("saltMarcherStylesheet").orElse("resources/salt-marcher.css"))
            canonicalStylesheetRelativePath.set("resources/salt-marcher.css")
            canonicalStylesheetFile.set(project.layout.projectDirectory.file("resources/salt-marcher.css"))
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
        EnforcementUtilityTaskKind.DEFINED_STYLE_CLASS_SELECTORS -> project.tasks.register<CheckDefinedStyleClassSelectorsTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Fail if Java-authored style classes are missing from resources/salt-marcher.css selectors."
            stylesheetFiles.from(
                project.layout.projectDirectory.asFileTree.matching {
                    include("**/*.css", "**/*.scss", "**/*.sass", "**/*.less", "**/*.styl")
                    exclude("**/.git/**", "**/.gradle/**", "**/build/**")
                }
            )
            javaSourceFiles.from(
                project.files("bootstrap", "shell", "src").asFileTree.matching {
                    include("**/*.java")
                    exclude("**/build/**")
                }
            )
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
        EnforcementUtilityTaskKind.MANUAL_NODE_STYLING -> project.tasks.register<CheckManualNodeStylingTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Fail if active code uses inline style backchannels or passive Views use manual node layout styling."
            javaSourceFiles.from(
                project.files("bootstrap", "shell", "src").asFileTree.matching {
                    include("**/*.java")
                    exclude("**/build/**")
                }
            )
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
    }
}

internal data class FocusedVerificationSliceKey(
    val verificationSourceRoots: List<String>,
    val verificationSourceIncludes: List<String>,
    val compileClasspathOwner: String
) {
    val sliceId: String = "Slice${stableHash(verificationSourceRoots, verificationSourceIncludes, compileClasspathOwner)}"

    companion object {
        private const val MAIN_COMPILE_CLASSPATH_OWNER = "mainCompileClasspath"

        fun from(descriptor: EnforcementBundleDescriptor): FocusedVerificationSliceKey {
            val roots = descriptor.verificationSourceRoots.normalized("verificationSourceRoots", descriptor.bundleId)
            val includes = descriptor.verificationSourceIncludes.normalized("verificationSourceIncludes", descriptor.bundleId)
            return FocusedVerificationSliceKey(
                verificationSourceRoots = roots,
                verificationSourceIncludes = includes,
                compileClasspathOwner = MAIN_COMPILE_CLASSPATH_OWNER
            )
        }

        private fun List<String>.normalized(metadataName: String, bundleId: String): List<String> {
            val normalized = map { value ->
                value.trim()
                    .replace('\\', '/')
                    .removePrefix("./")
                    .removeSuffix("/")
            }.filter(String::isNotEmpty)
                .distinct()
                .sorted()
            return normalized.ifEmpty {
                error("Missing $metadataName metadata for enforcement bundle '$bundleId'.")
            }
        }

        private fun stableHash(
            roots: List<String>,
            includes: List<String>,
            compileClasspathOwner: String
        ): String {
            val digest = MessageDigest.getInstance("SHA-256")
            roots.forEach { digest.update("root:$it\n".toByteArray()) }
            includes.forEach { digest.update("include:$it\n".toByteArray()) }
            digest.update("classpath:$compileClasspathOwner\n".toByteArray())
            return digest.digest()
                .take(6)
                .joinToString("") { byte -> "%02x".format(byte) }
                .replaceFirstChar(Char::uppercaseChar)
        }
    }
}

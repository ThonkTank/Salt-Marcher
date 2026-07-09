package saltmarcher.buildlogic.verification

import java.security.MessageDigest
import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.Project
import org.gradle.api.tasks.SourceSet
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.named
import org.gradle.language.base.plugins.LifecycleBasePlugin

internal open class VerificationHarnessExtension(
    private val project: Project,
    private val sourceSets: SourceSetContainer,
    private val mainSourceSet: SourceSet,
    private val includeQualityRulesErrorProne: Boolean
) {
    private fun compileJavaTaskName(sourceSetName: String): String =
        "compile${sourceSetName.replaceFirstChar(Char::uppercaseChar)}Java"

    fun registerFocusedVerificationCompileTask(
        sliceKey: FocusedVerificationSliceKey,
        checkerNames: List<String>,
        taskDescription: String
    ): TaskProvider<JavaCompile> {
        val sourceSetName = "focusedVerification${sliceKey.sliceId}"
        val roots = sliceKey.verificationSourceRoots
        val includes = sliceKey.verificationSourceIncludes
        val mainCompileJava = project.tasks.named<JavaCompile>("compileJava")
        val mainClassesSupportClasspath = project.files(mainSourceSet.output)
        sourceSets.register(sourceSetName) {
            java.setSrcDirs(roots)
            includes.forEach(java::include)
            resources.setSrcDirs(emptyList<String>())
            compileClasspath += mainClassesSupportClasspath + mainSourceSet.compileClasspath
            runtimeClasspath += output + compileClasspath
        }
        return project.tasks.named<JavaCompile>(compileJavaTaskName(sourceSetName)) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = taskDescription
            dependsOn(mainCompileJava)
            setSource(project.files(roots).asFileTree.matching {
                FocusedVerificationPaths.configureDefaultSourceFilter(this, includes)
            }.matching {
                FocusedVerificationPaths.configureFocusedCompileSourceFilter(this, roots, includes)
            })
            classpath = mainClassesSupportClasspath + mainSourceSet.compileClasspath
            options.sourcepath = project.files()
            destinationDirectory.set(project.layout.buildDirectory.dir("classes/java/verification/${sliceKey.sliceId}"))
            if (checkerNames.isEmpty()) {
                options.errorprone.enabled.set(false)
            } else {
                require(includeQualityRulesErrorProne) {
                    "Focused Error Prone verification requires the quality-rules-errorprone included build."
                }
                dependsOn(project.gradle.includedBuild("quality-rules-errorprone").task(":jar"))
                options.errorprone.enabled.set(true)
                options.errorprone.disableWarningsInGeneratedCode.set(true)
                options.errorprone.disableAllChecks.set(true)
                options.compilerArgs.add("-XDaddTypeAnnotationsToSymbol=true")
                FocusedVerificationPaths.errorProneExcludedPathsPattern()?.let { excludedPathsPattern ->
                    options.errorprone.excludedPaths.set(excludedPathsPattern)
                }
                checkerNames.forEach(options.errorprone::error)
            }
            inputs.property("focusedVerificationCheckerNames", checkerNames.joinToString(","))
            inputs.property("focusedVerificationPaths", FocusedVerificationPaths.propertyInput())
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
        fun stableHash(
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

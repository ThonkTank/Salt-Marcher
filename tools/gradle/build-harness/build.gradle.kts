import java.io.File
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.JavaExec
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the

plugins {
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.let(::File)
    ?: projectDir.parentFile.parentFile.parentFile

val sourceSets = the<SourceSetContainer>()

sourceSets.named("main") {
    java.setSrcDirs(listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath))
    resources.setSrcDirs(emptyList<String>())
}
val mainSourceSet = sourceSets["main"]

fun repoInputTree(includePatterns: List<String>) = fileTree(repoRootDir) {
    exclude(".git/**")
    exclude(".gradle/**")
    exclude("build/**")
    exclude("**/.gradle/**")
    exclude("**/build/**")
    includePatterns.forEach(::include)
}

fun documentationVerificationArgs(ruleClasses: List<String>): List<String> = buildList {
    ruleClasses.forEach { ruleClass ->
        add("--rule-class")
        add(ruleClass)
    }
}

fun registerRepoVerificationTask(
    taskName: String,
    taskDescription: String,
    verificationMainClassName: String,
    verificationArgs: List<String>,
    includePatterns: List<String>
) {
    tasks.register<JavaExec>(taskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = taskDescription
        dependsOn(tasks.named(mainSourceSet.classesTaskName))
        classpath = mainSourceSet.runtimeClasspath
        mainClass.set(verificationMainClassName)
        args(listOf(repoRootDir.absolutePath) + verificationArgs)
        inputs.files(repoInputTree(includePatterns))
            .withPropertyName("verificationInputs")
            .withPathSensitivity(PathSensitivity.RELATIVE)
    }
}

val documentationRootRuleClasses = listOf(
    "saltmarcher.architecture.documentation.DocumentationHygieneRules",
    "saltmarcher.architecture.documentation.domain.DomainDocumentationRules"
)
registerRepoVerificationTask(
    taskName = "documentationEnforcementCheck",
    taskDescription = "Run Markdown metadata, placement, and domain documentation consistency checks.",
    verificationMainClassName = "saltmarcher.architecture.documentation.DocumentationCheckMain",
    verificationArgs = documentationVerificationArgs(documentationRootRuleClasses),
    includePatterns = listOf(
        "AGENTS.md",
        "docs/**",
        "src/**/DOMAIN.md",
        "tools/quality/**/*.md"
    )
)

registerRepoVerificationTask(
    taskName = "architectureCheck",
    taskDescription = "Check residual outcome architecture rules not owned by behavior harnesses.",
    verificationMainClassName = "saltmarcher.architecture.ArchitectureCheckMain",
    verificationArgs = emptyList(),
    includePatterns = listOf(
        ".github/workflows/quality-platforms.yml",
        "AGENTS.md",
        "bootstrap/**",
        "docs/project/architecture/verification-core.md",
        "docs/project/verification/**",
        "shell/**",
        "src/**",
        "tools/gradle/**",
        "tools/gradle/build-harness/src/**"
    )
)

tasks.named("check") {
    dependsOn("architectureCheck")
}

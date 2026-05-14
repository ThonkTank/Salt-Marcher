package saltmarcher.buildlogic.tasks.hygiene

import java.io.BufferedInputStream
import java.io.DataInputStream
import java.io.File
import java.net.URLClassLoader
import java.nio.file.Files
import java.nio.file.Path
import javax.inject.Inject
import javax.xml.XMLConstants
import javax.xml.stream.XMLInputFactory
import javax.xml.stream.XMLStreamConstants
import org.gradle.api.Action
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException
import org.gradle.process.ExecOperations
import org.gradle.process.JavaExecSpec

@CacheableTask
abstract class CheckNoDeadCodeTask @Inject constructor(
    private val execOperations: ExecOperations
) : DefaultTask() {

    @get:Classpath
    abstract val toolClasspath: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val compiledClassesDirectory: DirectoryProperty

    @get:Classpath
    abstract val runtimeClasspath: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val javaHomeJmodsDirectory: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val resourceRoots: ConfigurableFileCollection

    @get:Optional
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val keepRulesFiles: ConfigurableFileCollection

    @get:Input
    abstract val mainClassName: Property<String>

    @get:Input
    abstract val preloaderClassName: Property<String>

    @get:OutputDirectory
    abstract val workingDirectory: DirectoryProperty

    @get:OutputFile
    abstract val reportFile: RegularFileProperty

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun check() {
        val compiledRoot = compiledClassesDirectory.get().asFile
        val classEntries = loadClassEntries(compiledRoot)
        val workDir = workingDirectory.get().asFile.toPath()
        val generatedKeepRulesFile = workDir.resolve("generated-keep-rules.pro")
        val configFile = workDir.resolve("proguard-deadcode.pro")
        val usageFile = workDir.resolve("usage.txt")
        val outputJar = workDir.resolve("deadcode-out.jar")

        resetDirectory(workDir)
        Files.createDirectories(workDir)
        writeGeneratedKeepRules(generatedKeepRulesFile, classEntries)
        writeProguardConfig(
            configFile = configFile,
            usageFile = usageFile,
            outputJar = outputJar,
            generatedKeepRulesFile = generatedKeepRulesFile
        )
        Files.deleteIfExists(successMarker.get().asFile.toPath())

        execOperations.javaexec(object : Action<JavaExecSpec> {
            override fun execute(spec: JavaExecSpec) {
                spec.classpath = toolClasspath
                spec.mainClass.set("proguard.ProGuard")
                spec.args(configFile.toString())
            }
        })

        val findings = parseFindings(classEntries, usageFile)
        writeReport(findings)
        if (findings.hasFailures()) {
            throw VerificationException(
                "Dead code remains in production sources. See ${reportFile.get().asFile.invariantPath()}."
            )
        }
        Files.writeString(successMarker.get().asFile.toPath(), "passed\n")
    }

    private fun writeGeneratedKeepRules(outputFile: Path, classEntries: List<ClassEntry>) {
        val resourceRootDirs = resourceRoots.files.filter(File::isDirectory).sortedBy(File::invariantPath)
        val fxmlRoots = loadFxmlRoots(resourceRootDirs)
        val serviceLoaderRoots = loadServiceLoaderRoots(resourceRootDirs)
        val (shellContributionRoots, serviceContributionRoots) = inspectContributionTypes { inspector ->
            loadShellContributionRoots(classEntries, inspector) to
                    loadServiceContributionRoots(classEntries, inspector)
        }
        val explicitKeepFiles = keepRulesFiles.files.filter(File::isFile).sortedBy(File::invariantPath)
        val lines = buildList {
            add("# Generated structural dead-code roots.")
            add("-keep class ${mainClassName.get()} {")
            add("    public <init>();")
            add("    public static void main(java.lang.String[]);")
            add("    public void init();")
            add("    public void start(javafx.stage.Stage);")
            add("    public void stop();")
            add("}")
            add("-keep class ${preloaderClassName.get()} {")
            add("    public <init>();")
            add("    public void init();")
            add("    public void start(javafx.stage.Stage);")
            add("    public void stop();")
            add("    public void handleApplicationNotification(javafx.application.Preloader\$PreloaderNotification);")
            add("    public void handleStateChangeNotification(javafx.application.Preloader\$StateChangeNotification);")
            add("}")
            shellContributionRoots.forEach { binaryName ->
                add("-keep class $binaryName {")
                add("    public <init>();")
                add("    public shell.api.ShellContributionSpec registrationSpec();")
                add("    public shell.api.ShellBinding bind(shell.api.ShellRuntimeContext);")
                add("}")
            }
            serviceContributionRoots.forEach { binaryName ->
                add("-keep class $binaryName {")
                add("    public <init>();")
                add("    public void register(shell.api.ServiceRegistry\$Builder);")
                add("}")
            }
            fxmlRoots.forEach { root ->
                add("-keep class ${root.binaryName} {")
                add("    public <init>();")
                add("    *** initialize(...);")
                root.methods.sorted().forEach { methodName ->
                    add("    *** $methodName(...);")
                }
                root.fields.sorted().forEach { fieldName ->
                    add("    *** $fieldName;")
                }
                add("}")
            }
            serviceLoaderRoots.sorted().forEach { binaryName ->
                add("-keep class $binaryName {")
                add("    public <init>();")
                add("}")
            }
            if (explicitKeepFiles.isNotEmpty()) {
                add("# Repo-owned fallback keep rules are included from the main config.")
            }
        }
        Files.writeString(outputFile, lines.joinToString(separator = "\n", postfix = "\n"))
    }

    private fun writeProguardConfig(
        configFile: Path,
        usageFile: Path,
        outputJar: Path,
        generatedKeepRulesFile: Path
    ) {
        val keepFiles = keepRulesFiles.files.filter(File::isFile).sortedBy(File::invariantPath)
        val runtimeJars = runtimeClasspath.files
            .asSequence()
            .filter(File::isFile)
            .sortedBy(File::invariantPath)
            .toList()
        val jmods = javaHomeJmodsDirectory.get().asFile.listFiles()
            ?.filter { file -> file.isFile && file.extension == "jmod" }
            ?.sortedBy(File::invariantPath)
            .orEmpty()

        val lines = buildList {
            add("-injars ${compiledClassesDirectory.get().asFile.invariantPath()}")
            add("-outjars ${outputJar.toFile().invariantPath()}")
            add("-printusage ${usageFile.toFile().invariantPath()}")
            add("-dontobfuscate")
            add("-dontoptimize")
            add("-dontpreverify")
            add("-dontnote")
            add("-dontwarn **")
            add("-ignorewarnings")
            add("-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod")
            jmods.forEach { file ->
                add("-libraryjars ${file.invariantPath()}")
            }
            runtimeJars.forEach { file ->
                add("-libraryjars ${file.invariantPath()}")
            }
            add("-include ${generatedKeepRulesFile.toFile().invariantPath()}")
            keepFiles.forEach { file ->
                add("-include ${file.invariantPath()}")
            }
        }
        Files.writeString(configFile, lines.joinToString(separator = "\n", postfix = "\n"))
    }

    private fun parseFindings(classEntries: List<ClassEntry>, usageFile: Path): DeadCodeFindings {
        val lines = if (Files.isRegularFile(usageFile)) {
            Files.readAllLines(usageFile)
                .map(String::trim)
                .filter(String::isNotEmpty)
                .sorted()
        } else {
            emptyList()
        }
        val classesByBinaryName = classEntries.associateBy(ClassEntry::binaryName)
        val deadTypes = mutableListOf<DeadType>()
        val deadConstructors = mutableListOf<DeadMember>()
        val deadMethods = mutableListOf<DeadMember>()
        val deadFields = mutableListOf<DeadMember>()

        lines.forEach { line ->
            if (':' !in line) {
                val entry = classesByBinaryName[line] ?: return@forEach
                deadTypes += DeadType(
                    sourceRelativePath = entry.sourceRelativePath,
                    name = entry.binaryName,
                    declarationKind = entry.declarationKind,
                    nestingKind = entry.nestingKind
                )
                return@forEach
            }
            val owner = line.substringBefore(':').trim()
            val member = line.substringAfter(':').trim()
            val entry = classesByBinaryName[owner] ?: return@forEach
            if ('(' in member) {
                when {
                    member.startsWith("<init>(") -> deadConstructors += DeadMember(entry.sourceRelativePath, "$owner#$member")
                    member.startsWith("<clinit>(") -> Unit
                    else -> deadMethods += DeadMember(entry.sourceRelativePath, "$owner#$member")
                }
            } else {
                deadFields += DeadMember(entry.sourceRelativePath, "$owner#$member")
            }
        }

        val deadTypeNames = deadTypes.map(DeadType::name).toSet()
        val deadFiles = classEntries
            .groupBy(ClassEntry::sourceRelativePath)
            .values
            .filter { sourceEntries -> sourceEntries.all { entry -> entry.binaryName in deadTypeNames } }
            .map { sourceEntries -> sourceEntries.first().sourceRelativePath }
            .distinct()
            .sorted()

        return DeadCodeFindings(
            deadFiles = deadFiles,
            deadTypes = deadTypes.sortedWith(compareBy(DeadType::sourceRelativePath, DeadType::name)),
            deadConstructors = deadConstructors.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name)),
            deadMethods = deadMethods.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name)),
            deadFields = deadFields.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name))
        )
    }

    private fun writeReport(findings: DeadCodeFindings) {
        val reportPath = reportFile.get().asFile.toPath()
        Files.createDirectories(reportPath.parent)
        Files.writeString(reportPath, findings.render())
    }

    private fun loadClassEntries(compiledRoot: File): List<ClassEntry> {
        if (!compiledRoot.isDirectory) {
            return emptyList()
        }
        val rootPath = compiledRoot.toPath()
        return compiledRoot.walkTopDown()
            .filter { file -> file.isFile && file.extension == "class" }
            .sortedBy(File::invariantPath)
            .mapNotNull { classFile ->
                val relativePath = rootPath.relativize(classFile.toPath()).invariantPath()
                val internalName = relativePath.removeSuffix(".class")
                loadClassEntry(classFile.toPath(), internalName)
            }
            .toList()
    }

    private fun loadClassEntry(classFile: Path, internalName: String): ClassEntry? {
        val metadata = loadClassMetadata(classFile, internalName)
        if (!metadata.shouldReport) {
            return null
        }
        val binaryName = internalName.replace('/', '.')
        val topLevelBinaryName = internalName.substringBefore('$').replace('/', '.')
        return ClassEntry(
            binaryName = binaryName,
            topLevelBinaryName = topLevelBinaryName,
            packageName = binaryName.substringBeforeLast('.', missingDelimiterValue = ""),
            sourceRelativePath = loadSourceRelativePath(internalName, metadata.sourceFileName),
            declarationKind = metadata.declarationKind,
            nestingKind = metadata.nestingKind
        )
    }

    private fun loadFxmlRoots(resourceRoots: List<File>): List<FxmlRoot> {
        val xmlFactory = XMLInputFactory.newFactory().apply {
            setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false)
            setProperty(XMLInputFactory.SUPPORT_DTD, false)
            setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "")
            setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "")
        }
        return resourceRoots
            .asSequence()
            .flatMap { root ->
                root.walkTopDown()
                    .asSequence()
                    .filter { file -> file.isFile && file.extension == "fxml" }
                    .sortedBy(File::invariantPath)
                    .mapNotNull { file ->
                        val methods = linkedSetOf<String>()
                        val fields = linkedSetOf<String>()
                        var controllerBinaryName: String? = null
                        file.inputStream().use { input ->
                            val reader = xmlFactory.createXMLStreamReader(input)
                            while (reader.hasNext()) {
                                if (reader.next() != XMLStreamConstants.START_ELEMENT) {
                                    continue
                                }
                                for (index in 0 until reader.attributeCount) {
                                    val value = reader.getAttributeValue(index) ?: continue
                                    val localName = reader.getAttributeLocalName(index)
                                    if (reader.getAttributePrefix(index) == "fx" && localName == "controller") {
                                        controllerBinaryName = value
                                    }
                                    if (value.startsWith("#")) {
                                        methods += value.removePrefix("#")
                                    }
                                    if (reader.getAttributePrefix(index) == "fx" && localName == "id") {
                                        fields += value
                                    }
                                }
                            }
                            reader.close()
                        }
                        controllerBinaryName?.let { binaryName ->
                            FxmlRoot(
                                binaryName = binaryName,
                                methods = methods,
                                fields = fields
                            )
                        }
                    }
            }
            .groupBy(FxmlRoot::binaryName)
            .values
            .map { roots ->
                FxmlRoot(
                    binaryName = roots.first().binaryName,
                    methods = roots.asSequence().flatMap { root -> root.methods.asSequence() }.toSortedSet(),
                    fields = roots.asSequence().flatMap { root -> root.fields.asSequence() }.toSortedSet()
                )
            }
            .sortedBy(FxmlRoot::binaryName)
            .toList()
    }

    private fun loadServiceLoaderRoots(resourceRoots: List<File>): Set<String> {
        return resourceRoots
            .asSequence()
            .map { root -> root.resolve("META-INF/services") }
            .filter(File::isDirectory)
            .flatMap { servicesDir ->
                servicesDir.walkTopDown()
                    .asSequence()
                    .filter(File::isFile)
                    .sortedBy(File::invariantPath)
                    .flatMap { file ->
                        file.readLines()
                            .asSequence()
                            .map(String::trim)
                            .filter { line -> line.isNotEmpty() && !line.startsWith("#") }
                    }
            }
            .toSortedSet()
    }

    private fun loadShellContributionRoots(
        classEntries: List<ClassEntry>,
        inspector: ContributionTypeInspector
    ): List<String> {
        return classEntries
            .asSequence()
            .filter(ClassEntry::isTopLevelClass)
            .filter { entry -> isShellContributionRoot(entry, inspector) }
            .map(ClassEntry::binaryName)
            .distinct()
            .sorted()
            .toList()
    }

    private fun loadServiceContributionRoots(
        classEntries: List<ClassEntry>,
        inspector: ContributionTypeInspector
    ): List<String> {
        return classEntries
            .asSequence()
            .filter(ClassEntry::isTopLevelClass)
            .mapNotNull { entry ->
                rootFeatureSegment(entry, "src.data")?.let { featureName -> featureName to entry }
            }
            .groupBy({ it.first }, { it.second })
            .values
            .mapNotNull { rootEntries ->
                rootEntries.singleOrNull()
                    ?.takeIf { entry -> isServiceContributionRoot(entry, inspector) }
                    ?.binaryName
            }
            .distinct()
            .sorted()
    }

    private fun isShellContributionRoot(entry: ClassEntry, inspector: ContributionTypeInspector): Boolean {
        return isContributionRoot(entry, inspector, "src.view.leftbartabs", "Contribution", ContributionKind.SHELL)
                || isContributionRoot(entry, inspector, "src.view.statetabs", "Contribution", ContributionKind.SHELL)
                || isContributionRoot(entry, inspector, "src.view.dropdowns", "Contribution", ContributionKind.SHELL)
    }

    private fun isServiceContributionRoot(entry: ClassEntry, inspector: ContributionTypeInspector): Boolean =
        isContributionRoot(entry, inspector, "src.data", "ServiceContribution", ContributionKind.SERVICE)

    private fun isContributionRoot(
        entry: ClassEntry,
        inspector: ContributionTypeInspector,
        rootPackage: String,
        classSuffix: String,
        contributionKind: ContributionKind
    ): Boolean {
        val featureName = rootFeatureSegment(entry, rootPackage) ?: return false
        if (featureName.isBlank()) {
            return false
        }
        if (!entry.binaryName.substringAfterLast('.').endsWith(classSuffix)) {
            return false
        }
        return when (contributionKind) {
            ContributionKind.SHELL -> inspector.isConcreteShellContribution(entry.binaryName)
            ContributionKind.SERVICE -> inspector.isConcreteServiceContribution(entry.binaryName)
        }
    }

    private fun rootFeatureSegment(entry: ClassEntry, rootPackage: String): String? {
        val prefix = "$rootPackage."
        if (!entry.packageName.startsWith(prefix)) {
            return null
        }
        val remainder = entry.packageName.removePrefix(prefix)
        if (remainder.isBlank() || '.' in remainder) {
            return null
        }
        return remainder
    }

    private fun loadSourceRelativePath(internalName: String, sourceFileName: String?): String {
        val packagePath = internalName.substringBeforeLast('/', missingDelimiterValue = "")
        val effectiveSourceFileName = sourceFileName
            ?: "${internalName.substringBefore('$').substringAfterLast('/')}.java"
        return if (packagePath.isBlank()) {
            effectiveSourceFileName
        } else {
            "$packagePath/$effectiveSourceFileName"
        }
    }

    private fun loadClassMetadata(classFile: Path, internalName: String): ClassMetadata {
        return try {
            DataInputStream(BufferedInputStream(Files.newInputStream(classFile))).use { input ->
                val magic = input.readInt()
                if (magic != 0xCAFEBABE.toInt()) {
                    throw IllegalStateException("Unexpected classfile header in ${classFile.invariantPath()}.")
                }
                input.readUnsignedShort()
                input.readUnsignedShort()
                val constantPool = readConstantPool(input)
                val accessFlags = input.readUnsignedShort()
                val thisClassIndex = input.readUnsignedShort()
                input.readUnsignedShort()
                repeat(input.readUnsignedShort()) {
                    input.readUnsignedShort()
                }
                skipMembers(input)
                skipMembers(input)

                val thisInternalName = constantPool.className(thisClassIndex)
                    ?: throw IllegalStateException("Missing class name for ${classFile.invariantPath()}.")
                var sourceFileName: String? = null
                var innerSimpleName: String? = null
                var hasEnclosingMethod = false
                var hasRecordAttribute = false

                repeat(input.readUnsignedShort()) {
                    val attributeName = constantPool.utf8(input.readUnsignedShort())
                    val attributeLength = input.readInt().toLong() and 0xffffffffL
                    when (attributeName) {
                        "SourceFile" -> {
                            if (attributeLength == 2L) {
                                sourceFileName = constantPool.utf8(input.readUnsignedShort())
                            } else {
                                input.skipNBytes(attributeLength)
                            }
                        }
                        "InnerClasses" -> {
                            var bytesRemaining = attributeLength
                            val entryCount = input.readUnsignedShort()
                            bytesRemaining -= 2
                            repeat(entryCount) {
                                val innerClassIndex = input.readUnsignedShort()
                                input.readUnsignedShort()
                                val innerNameIndex = input.readUnsignedShort()
                                input.readUnsignedShort()
                                bytesRemaining -= 8
                                if (constantPool.className(innerClassIndex) == thisInternalName) {
                                    innerSimpleName = constantPool.utf8OrNull(innerNameIndex)
                                }
                            }
                            if (bytesRemaining > 0L) {
                                input.skipNBytes(bytesRemaining)
                            }
                        }
                        "EnclosingMethod" -> {
                            hasEnclosingMethod = true
                            input.skipNBytes(attributeLength)
                        }
                        "Record" -> {
                            hasRecordAttribute = true
                            input.skipNBytes(attributeLength)
                        }
                        else -> input.skipNBytes(attributeLength)
                    }
                }

                ClassMetadata(
                    sourceFileName = sourceFileName,
                    declarationKind = declarationKind(accessFlags, hasRecordAttribute),
                    nestingKind = nestingKind(internalName, hasEnclosingMethod),
                    shouldReport = shouldReportClass(
                        internalName = internalName,
                        accessFlags = accessFlags,
                        hasEnclosingMethod = hasEnclosingMethod,
                        innerSimpleName = innerSimpleName
                    )
                )
            }
        } catch (exception: Exception) {
            throw IllegalStateException("Could not read class metadata from ${classFile.invariantPath()}.", exception)
        }
    }

    private fun shouldReportClass(
        internalName: String,
        accessFlags: Int,
        hasEnclosingMethod: Boolean,
        innerSimpleName: String?
    ): Boolean {
        val topLevelSimpleName = internalName.substringBefore('$').substringAfterLast('/')
        if (topLevelSimpleName.isBlank() || topLevelSimpleName == "package-info" || topLevelSimpleName == "module-info") {
            return false
        }
        if ("$$" in internalName) {
            return false
        }
        if (accessFlags and ACC_SYNTHETIC != 0) {
            return false
        }
        if (hasEnclosingMethod && innerSimpleName == null) {
            return false
        }
        return true
    }

    private fun declarationKind(accessFlags: Int, hasRecordAttribute: Boolean): DeclarationKind {
        return when {
            accessFlags and ACC_ANNOTATION != 0 -> DeclarationKind.ANNOTATION
            accessFlags and ACC_INTERFACE != 0 -> DeclarationKind.INTERFACE
            accessFlags and ACC_ENUM != 0 -> DeclarationKind.ENUM
            hasRecordAttribute -> DeclarationKind.RECORD
            accessFlags and ACC_ABSTRACT != 0 -> DeclarationKind.ABSTRACT_CLASS
            else -> DeclarationKind.CLASS
        }
    }

    private fun nestingKind(internalName: String, hasEnclosingMethod: Boolean): NestingKind {
        return when {
            '$' !in internalName -> NestingKind.TOP_LEVEL
            hasEnclosingMethod -> NestingKind.LOCAL
            else -> NestingKind.NESTED
        }
    }

    private fun <T> inspectContributionTypes(block: (ContributionTypeInspector) -> T): T {
        val urls = buildList {
            add(compiledClassesDirectory.get().asFile.toURI().toURL())
            runtimeClasspath.files
                .filter(File::exists)
                .sortedBy(File::invariantPath)
                .forEach { file -> add(file.toURI().toURL()) }
        }
        URLClassLoader(urls.toTypedArray(), ClassLoader.getPlatformClassLoader()).use { classLoader ->
            return block(ContributionTypeInspector(classLoader))
        }
    }

    private fun readConstantPool(input: DataInputStream): ConstantPool {
        val constantPoolCount = input.readUnsignedShort()
        val utf8Entries = arrayOfNulls<String>(constantPoolCount)
        val classNameIndexes = IntArray(constantPoolCount)
        var index = 1
        while (index < constantPoolCount) {
            when (val tag = input.readUnsignedByte()) {
                1 -> utf8Entries[index] = input.readUTF()
                3, 4 -> input.skipNBytes(4)
                5, 6 -> {
                    input.skipNBytes(8)
                    index += 1
                }
                7 -> classNameIndexes[index] = input.readUnsignedShort()
                8, 16, 19, 20 -> input.skipNBytes(2)
                9, 10, 11, 12, 17, 18 -> input.skipNBytes(4)
                15 -> input.skipNBytes(3)
                else -> throw IllegalStateException("Unsupported classfile constant-pool tag $tag.")
            }
            index += 1
        }
        return ConstantPool(utf8Entries, classNameIndexes)
    }

    private fun skipMembers(input: DataInputStream) {
        repeat(input.readUnsignedShort()) {
            input.readUnsignedShort()
            input.readUnsignedShort()
            input.readUnsignedShort()
            repeat(input.readUnsignedShort()) {
                input.readUnsignedShort()
                input.skipNBytes(input.readInt().toLong() and 0xffffffffL)
            }
        }
    }

    private fun resetDirectory(directory: Path) {
        if (!Files.exists(directory)) {
            return
        }
        Files.walk(directory)
            .sorted(Comparator.reverseOrder())
            .forEach(Files::deleteIfExists)
    }
}

private data class ClassEntry(
    val binaryName: String,
    val topLevelBinaryName: String,
    val packageName: String,
    val sourceRelativePath: String,
    val declarationKind: DeclarationKind,
    val nestingKind: NestingKind
) {
    val isTopLevelClass: Boolean
        get() = binaryName == topLevelBinaryName
}

private data class ClassMetadata(
    val sourceFileName: String?,
    val declarationKind: DeclarationKind,
    val nestingKind: NestingKind,
    val shouldReport: Boolean
)

private data class FxmlRoot(
    val binaryName: String,
    val methods: Set<String>,
    val fields: Set<String>
)

private data class DeadType(
    val sourceRelativePath: String,
    val name: String,
    val declarationKind: DeclarationKind,
    val nestingKind: NestingKind
)

private data class DeadMember(
    val sourceRelativePath: String,
    val name: String
)

private data class DeadCodeFindings(
    val deadFiles: List<String>,
    val deadTypes: List<DeadType>,
    val deadConstructors: List<DeadMember>,
    val deadMethods: List<DeadMember>,
    val deadFields: List<DeadMember>
) {
    fun hasFailures(): Boolean =
        deadFiles.isNotEmpty()
                || deadTypes.isNotEmpty()
                || deadConstructors.isNotEmpty()
                || deadMethods.isNotEmpty()
                || deadFields.isNotEmpty()

    fun render(): String = buildString {
        appendLine("# Dead Code Report")
        appendLine()
        appendLine("Files: ${deadFiles.size}")
        appendLine("Types: ${deadTypes.size}")
        appendLine("Constructors: ${deadConstructors.size}")
        appendLine("Methods: ${deadMethods.size}")
        appendLine("Fields: ${deadFields.size}")
        appendLine()
        appendSection("Dead Files", deadFiles)
        appendSection("Dead Types", deadTypes.map { deadType ->
            "${deadType.sourceRelativePath} :: ${deadType.declarationLabel} ${deadType.name}"
        })
        appendSection("Dead Constructors", deadConstructors.map { "${it.sourceRelativePath} :: ${it.name}" })
        appendSection("Dead Methods", deadMethods.map { "${it.sourceRelativePath} :: ${it.name}" })
        appendSection("Dead Fields", deadFields.map { "${it.sourceRelativePath} :: ${it.name}" })
    }

    private fun StringBuilder.appendSection(title: String, items: List<String>) {
        appendLine("## $title")
        if (items.isEmpty()) {
            appendLine("none")
        } else {
            items.forEach { item -> appendLine(item) }
        }
        appendLine()
    }
}

private val DeadType.declarationLabel: String
    get() {
        val baseLabel = declarationKind.label
        return when (nestingKind) {
            NestingKind.TOP_LEVEL -> baseLabel
            NestingKind.NESTED -> "nested $baseLabel"
            NestingKind.LOCAL -> "local $baseLabel"
        }
    }

private enum class DeclarationKind(val label: String) {
    CLASS("class"),
    ABSTRACT_CLASS("abstract class"),
    INTERFACE("interface"),
    ANNOTATION("annotation"),
    ENUM("enum"),
    RECORD("record")
}

private enum class NestingKind {
    TOP_LEVEL,
    NESTED,
    LOCAL
}

private enum class ContributionKind {
    SHELL,
    SERVICE
}

private data class ConstantPool(
    private val utf8Entries: Array<String?>,
    private val classNameIndexes: IntArray
) {
    fun utf8(index: Int): String? = utf8Entries.getOrNull(index)

    fun utf8OrNull(index: Int): String? =
        utf8(index)?.takeIf(String::isNotBlank)

    fun className(index: Int): String? {
        if (index <= 0 || index >= classNameIndexes.size) {
            return null
        }
        val nameIndex = classNameIndexes[index]
        return if (nameIndex <= 0) {
            null
        } else {
            utf8(nameIndex)
        }
    }
}

private class ContributionTypeInspector(
    private val classLoader: URLClassLoader
) {
    fun isConcreteShellContribution(binaryName: String): Boolean =
        isConcreteContribution(binaryName, shellContributionType)

    fun isConcreteServiceContribution(binaryName: String): Boolean =
        isConcreteContribution(binaryName, serviceContributionType)

    private val shellContributionType: Class<*>? = loadContractType("shell.api.ShellContribution")
    private val serviceContributionType: Class<*>? = loadContractType("shell.api.ServiceContribution")

    private fun loadContractType(contractTypeName: String): Class<*>? {
        return try {
            Class.forName(contractTypeName, false, classLoader)
        } catch (_: ReflectiveOperationException) {
            null
        } catch (_: LinkageError) {
            null
        }
    }

    private fun isConcreteContribution(binaryName: String, contractType: Class<*>?): Boolean {
        if (contractType == null) {
            return false
        }
        return try {
            val rawType = Class.forName(binaryName, false, classLoader)
            contractType.isAssignableFrom(rawType)
                    && !rawType.isInterface
                    && !java.lang.reflect.Modifier.isAbstract(rawType.modifiers)
                    && runCatching { rawType.getConstructor() }.isSuccess
        } catch (_: ReflectiveOperationException) {
            false
        } catch (_: LinkageError) {
            false
        }
    }
}

private const val ACC_ABSTRACT = 0x0400
private const val ACC_INTERFACE = 0x0200
private const val ACC_ANNOTATION = 0x2000
private const val ACC_ENUM = 0x4000
private const val ACC_SYNTHETIC = 0x1000

private fun Path.invariantPath(): String = toString().replace(File.separatorChar, '/')

private fun File.invariantPath(): String = path.replace(File.separatorChar, '/')

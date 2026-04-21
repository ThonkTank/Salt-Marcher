# Applying and Interpreting Object Oriented Metrics

Original URL: https://www.cs.purdue.edu/homes/apm/courses/BITSC461-fall03_SoftwareEngineering/metrics-slides/nasa-rosenberg-study.html
Local Source: `docs/references/.tools/html/quality-platforms/ck-metric-reference-values.html`
Source Kind: `downloaded_html`
Accessed: 2026-04-21

| Column 1 | Column 2 |
| --- | --- |
|  | Applying and Interpreting Object Oriented Metrics |

**Title:** Applying and Interpreting Object Oriented Metrics

**Presenter:** Dr. Linda H. Rosenberg

**Track:** Track 7 - Measures/Metrics

**Day:** Wednesday

**Keywords:** Metrics, Object-Oriented

**Abstract:** Object-oriented design and development is becoming very popular in
today's software development environment. Object oriented development requires not only a
different approach to design and implementation, it requires a different approach to
software metrics. Since object oriented technology uses objects and not algorithms as its
fundamental building blocks, the approach to software metrics for object oriented programs
must be different from the standard metrics set. Some metrics, such as lines of code and
cyclomatic complexity, have become accepted as "standard" for traditional
functional/ procedural programs, but for object-oriented, there are many proposed object
oriented metrics in the literature. The question is, "Which object oriented metrics
should a project use, and can any of the traditional metrics be adapted to the object
oriented environment?"

In this paper, the Software Assurance Technology Center (SATC) at NASA Goddard Space
Flight Center discusses its approach to choosing metrics for a project by first
identifying the attributes associated with object oriented development. Within this
framework, nine metrics for object oriented are selected. These metrics include three
traditional metrics adapted for an object oriented environment, and six "new"
metrics to evaluate the principle object oriented structures and concepts. The metrics are
first defined, then using a very simplistic object oriented example, the metrics are
applied. Interpretation guidelines are then discussed and data from NASA projects are used
to demonstrate the application of the metrics.

In the experience of the SATC, projects choose the data they collect by default - if
the tool they are using compiles it, the project collects it. The purpose of this paper is
to help project managers choose a comprehensive set of metrics, not by default, but by
using a set of metrics based on attributes and features of object oriented technology.

**1. INTRODUCTION**

Object-oriented design and development are popular concepts in today's software
development environment. They are often heralded as the silver bullet for solving software
problems, while in reality there is no silver bullet; object oriented development has
proved its value for systems that must be maintained and modified. Object oriented
software development requires a different approach from more traditional functional
decomposition and data flow development methods. While the functional and data flow
approaches commence by considering the systems behavior and/or data separately, object
oriented analysis approaches the problem by looking for system entities that combine them.
Object oriented analysis and design focuses on objects as the primary agents involved in a
computation; each class of data and related operations are collected into a single system
entity.

This paper will first briefly discuss nine metrics currently being applied by the SATC
to NASA object oriented projects. These include three "traditional" metrics
adapted for an object oriented environment, and six "new" metrics to evaluate
the principle object oriented structures and concepts. The SATC's approach to identifying
a set of object oriented metrics was to identify the primary critical constructs of object
oriented design and to select metrics that evaluate those areas. The metrics focus on
internal object structures that reflect the complexity of each individual entity, such as
methods and classes, and on external complexity that measures the interactions among
entities, such as coupling and inheritance. The metrics measure computational complexity
that affects the efficiency of an algorithm and the use of machine resources, as well as
psychological complexity factors that affect the ability of a programmer to create,
comprehend, modify and maintain software.

But as important as the metrics chosen is what the metrics "tell" the
developers and managers about the quality and object oriented structure of the design and
code; metrics without interpretation guidelines are of little value. Metrics for object
oriented development is a relatively new field of study, however, and have not reached
maturity. Although some numeric thresholds are suggested by analysis developers, there is
little application data to justify specific "good" and "bad" ranges.
Knowledge and experience of the programmers, managers, researchers and SATC staff
currently serve as the basis for the interpretation guidelines of the metric analysis
presented in this paper. As each metric is defined, guidelines for interpreting the values
are suggested. In many cases, however, to improve one metric means a trade-off with
another.

This paper starts with an overview of the metrics recommended by the SATC for object
oriented systems. These metrics include modifications of "traditional" metrics
as well as "new" metrics for specific object oriented structures. Since the
object oriented metrics require a cursory understanding of the object oriented concepts,
Section 3 presents a pictorial representation of the basic object oriented structures and
defines the key terms. In Section 5, we discuss the metrics in-depth. The design for a
simple object oriented example is used to demonstrate the metric calculations. In Section
5, interpretation guidelines are discussed. Then in Section 6 the applications and
interpretations of the metrics are demonstrated using NASA project data.

**2. OVERVIEW - OBJECT ORIENTED METRICS**

In this paper, the SATC discusses its applied research of object oriented metrics. The
research was done by surveying the literature on object oriented metrics and then applying
the SATC experience in traditional software metrics to select the object oriented metrics
that support the goal of measuring design and code quality. In addition, we required that
a metric be feasible to compute and have a clear relationship to the object oriented
structures being measured. At this time, many object oriented metrics proposed in the
literature lack a theoretical basis, while others have not yet been validated. Some of
these metrics are very labor intensive to collect, or are dependent on the implementation
environment. The object oriented metrics applied by the SATC are computable, can be
related to desirable software qualities, and are in the process of being validated.

The SATC’s approach to identifying a set of object oriented metrics was to focus
on the primary, critical constructs of object oriented design and to select metrics that
apply to those areas. The suggested metrics are supported by most literature and some
object oriented tools. The metrics evaluate the object oriented concepts: methods,
classes, coupling, and inheritance. The metrics focus on internal object structure that
reflects the complexity of each individual entity and on external complexity that measures
the interactions among entities. The metrics measure computational complexity that affects
the efficiency of an algorithm and the use of machine resources, as well as psychological
complexity factors that affect the ability of a programmer to create, comprehend, modify,
and maintain software.

We support the use of three traditional metrics and present six additional metrics
specifically for object oriented systems. The SATC has found that there is considerable
disagreement in the field about software quality metrics for object oriented systems [2,
6]. Some researchers and practitioners contend traditional metrics are inappropriate for
object oriented systems. There are valid reasons for applying traditional metrics,
however, if it can be done. The traditional metrics have been widely used, they are well
understood by researchers and practitioners, and their relationships to software quality
attributes have been validated [2, 6, 11, 12].

Table 1 presents an overview of the metrics applied by the SATC for object oriented
systems. The SATC supports the continued use of traditional metrics, but within the
structures and confines of object oriented systems. The first three metrics in Table 1 are
examples of traditional metrics applied to the object oriented structure of methods
instead of functions or procedures. The next six metrics are specifically for object
oriented systems and the object oriented construct applicable is indicated.

3. OVERVIEW - OBJECT ORIENTED STRUCTURES

A brief description of object oriented structures is given in this section using the
pictorial description in Figure 1 and the definitions in Table 2.

The new object oriented development methods have their own terminology to reflect the
new structural concepts. Referencing Figure 1, an object oriented system starts by
defining a *class* (Class A) thatcontains related or similar *attributes*
and *operations* (some operations are *methods*). The classes are used as the
basis for *objects* (Object A1). A child class *inherits* all of the attributes
and operations from its parent class, in addition to having its own attributes and
operations. A child class can also become a parent class for other classes, forming
another branch in the hierarchical tree structure. When an object is created to contain
data or information, it is an *instantiation* of the class. Classes interact or
communicate by passing *messages*. When a message is passed between two classes, the
classes are *coupled*. These specific terms are defined in Table 2 [1, 4, 9].

1. ![Figure 1: Pictorial Description of Object Oriented Terms](nasa-rosenberg-study_files/image34.gif)
**Figure 1: Pictorial Description of Object Oriented Terms**

Figure 2 is an example application with 3 classes; the root or main class, *Store_de*pt
and two child classes, *Clothing*and *Appliances*. Each department will have *a
Manager, # Employees* and *Floor space*; each child class inherits the attributes
of *Manager, #* *Employees, Floor Space* from *Store_dept*. The class *Clothing*
will have additional attributes of *Customer Gender, Size range* and *Specialty.*
The class of *Appliance* Departments will have an attribute of *Category*.
Specific named departments are objects. Objects of the *Class Clothing* are the *Toddlers
Department* and *Men's Suits Department*. In the *Appliances* class, the
objects are *Large Appliance Department, Small Kitchen Appliances*, and the *Electronics
Department*.

**4. METRICS FOR OBJECT ORIENTED SYSTEMS**

5. INTERPRETATION GUIDELINES

While it is interesting to propose a set of metrics for object oriented system, the
value of the metrics is in their application to programs – how can they help
developers improve the quality of the programs? While there are many guidelines as to how
to interpret the metrics, there is insufficient statistical data to prove that a value of
8 for one metric is twice as complex or twice as "bad" as a value of 4. The SATC
therefore, proposes interpretation guidelines based on a comparison of the values, looking
at the outliers to determine why they are different from the other modules of code. This
is not an indication of "badness" but an indicator of difference that needs to
be investigated. Table 3 is a summary of the objectives for the values suggested above in
the description of the metrics.

6. APPLICATION

For some of the metrics, a simple histogram demonstrates prevailing and extreme values.
For the this project in Figure 7, a histogram of Weighted Methods per Class (WMC) reveals
that, while most classes have a WMC of less than 20, there are a few classes with WMC
greater than 100. Those few classes with the highest WMC are candidates for inspection
and/or revision. This histogram is also useful for monitoring complexity over time.

1. ![Figure 7: Weighted Methods Per Class](nasa-rosenberg-study_files/image22.gif)
**Figure 7: Weighted Methods Per Class**
There are a few classes in the project shown in Figure 8 that are capable of invoking
more than 200 methods. Classes with large RFC have a greater complexity and decreased
understandability. Testing and debugging are more complicated. This information is useful
when monitored over time also.

![Figure 8: Response for a Class](nasa-rosenberg-study_files/image23.gif)
**Figure 8: Response for a Class**

Figure 9 examines the Coupling Between Objects (CBO). Of the 240 classes in this
project, more than a third are self-contained. Higher CBO indicates classes that may be
difficult to understand, less likely for reuse and more difficult to maintain.

![Figure 9: Coupling Between Objects](nasa-rosenberg-study_files/image24.gif)
**Figure 9: Coupling Between Objects**

The metrics for the hierarchical structure, Number of Children
(NOC) and Depth in Tree (DIT) can also be graphically depicted as shown
in Figure 10. A class with DIT = 0 is the "root" of a hierarchy.
If it is also a "leaf", NOC = 0, then it is standalone code that
does not benefit from inheritance or reuse. Almost 66% of this project’s
classes are below other classes in the tree, which indicates a moderate
level of reuse. Higher percentages for DIT’s of 2 and 3 would show
a higher degree of reuse, but increased complexity. ![Figure 10: Depth in Tree (DIT)](nasa-rosenberg-study_files/image25.gif)
**Figure 10: Depth in Tree (DIT)**

The value of Lack of Cohesion of Methods (LCOM) depends on the
number of methods, so there is a maximum value possible. Figure 11 is a plot of measured
LCOM compared to possible maximums. While there is little experience with the LCOM metric,
intuition says that the smaller actual LCOM is compared to its possible maximum, the
better. In Figure 11 we look at LCOM to identify the values closest to the line. The SATC
also uses the trend line shown in the graph to make comparisons between projects and
between languages.

For many of the metrics, it is more effective to analyze the modules using two metrics.
In Figure 12 the methods are plotted based on size and complexity. The SATC has done
extensive applied research to identify the preferred values. The "risk regions"
shown indicate where methods have the potential for poor quality that will effect
maintainability, reusability and readability. (These regions of risk were developed for
non object oriented code and are expected to decrease in size with further research.) The
table below the graph summarizes the diagram.

1. ![Figure 12: Size to Complexity Comparison](nasa-rosenberg-study_files/image28.gif)![Figure 12: Size to Complexity Comparison](nasa-rosenberg-study_files/image27.gif) **Figure 12: Size to Complexity Comparison**
In Figure 13, Response for a Class is plotted against the number of methods.
Points on or near the "possible" line represent classes that do
not invoke outside methods. This indicates to developers that there are
some classes with more than 40 methods that also affect many objects in
other classes. These are prime candidates for walk-throughs and testing.

![Figure 13: Number of Methods by Response for Class](nasa-rosenberg-study_files/image29.gif)
**Figure 13: Number of Methods by Response for Class**

As discussed, there is a trade-off when determining the appropriate
number of children and the depth of the tree. Higher DIT’s indicate
a trade-off between increased complexity and increased reuse. Higher NOC’s
also indicate reuse, but may require more testing. Figure 14 demonstrates
how the two-way view of the data identifies an interesting class –
one that is three steps down form the root and has 40 children.
2. ![Figure 14: Hierarchical Evaluation](nasa-rosenberg-study_files/image30.gif)
**Figure 14: Hierarchical Evaluation**

**7. SUMMARY**

Object oriented metrics help evaluate the development and testing efforts needed, the
understandability, maintainability and reusability. This information is summarized in
Table 4.

1. ![Table 4 : Object Oriented Metrics Effects<](nasa-rosenberg-study_files/image31.gif)
**Table 4 : Object Oriented Metrics Effects**

8. CONCLUSION

Object oriented metrics exist and do provide valuable information to object oriented
developers and project managers. The SATC has found that a combination of
"traditional" metrics and metrics that measure structures unique to object
oriented development is most effective. This allows developers to continue to apply
metrics that they are familiar with, such as complexity and lines of code to a new
development environment. However, now that new concepts and structures are being applied,
such inheritance, coupling, cohesion, methods and classes, metrics are needed to evaluate
the effectiveness of their application. Metrics such as Weighted Methods per Class,
Response for a Class, and Lack of Cohesion are applied to these areas. The application of
a hierarchical structure also needs to be evaluated through metrics such as Depth in Tree
and Number of Children.

At this time there are no clear interpretation guidelines for these metrics although
there are guidelines based on common sense and experience.

**9. REFERENCES**

1. Booch, Grady, *Object Oriented* *Analysis and Design with Applications*, The
Benjamin/Cummings Publishing Company, Inc., 1994.
2. Chidamber, Shyam and Kemerer, Chris, "A Metrics Suite for Object Oriented Design*",
IEEE Transactions on Software Engineering*, June, 1994, pp. 476-492.
3. Hudli, R., Hoskins, C., Hudli, A., "Software Metrics for Object Oriented
Designs", IEEE, 1994.
4. Jacobson, Ivar, *Object Oriented* *Software Engineering, A Use Case Driven
Approach*, Addison-Wesley Publishing Company, 1993.
5. Lee, Y., Liang, B., Wang, F., "Some Complexity Metrics for Object Oriented Programs
Based on Information Flow", *Proceedings: CompEuro*, March, 1993, pp. 302-310.
6. Lorenz, Mark and Kidd, Jeff, *Object Oriented* *Software Metrics*, Prentice
Hall Publishing, 1994.
7. McCabe & Associates, *McCabe Object Oriented Tool User’s Instructions*,
1994.
8. Rosenberg, Linda H., "Metrics for Object Oriented Environments", EFAITP/AIE
Third Annual Software Metrics Conference, December, 97.
9. Sommerville, Ian, *Software Engineering*, Addison-Wesley Publishing Company, 1992.
10. Sharble, Robert, and Cohen, Samuel, "The Object Oriented Brewery: A Comparison of
Two object oriented Development Methods", *Software Engineering Notes*, Vol 18,
No 2., April 1993, pp 60 -73.
11. Tegarden, D., Sheetz, S., Monarchi, D., "Effectiveness of Traditional Software
Metrics for Object Oriented Systems", *Proceedings: 25th Hawaii International
Conference on System Sciences*, January, 1992, pp. 359-368.
12. Williams, John D., "Metrics for Object Oriented Projects",*Proceedings:
ObjectExpoEuro Conference*, July, 1993, pp. 13-18.

10. BIOGRAPHIES

**Linda H. Rosenberg, Ph.D.**

Dr. Rosenberg is an Engineering Section Head at Unisys Government Systems in Lanham, MD.
She is contracted to manage the Software Assurance Technology Center (SATC) through the
System Reliability and Safety Office in the Flight Assurance Division at Goddard Space
Flight Center, NASA, in Greenbelt, MD. The SATC has four primary responsibilities:
Metrics, Standards and Guidance, Assurance tools and techniques, and Outreach programs.
Although she oversees all work areas of the SATC, Dr. Rosenberg's area of expertise is
metrics. She is responsible for overseeing metric programs to establish a basis for
numerical guidelines and standards for software developed at NASA, and to work with
project managers to use metrics in the evaluation of the quality of their software. Dr.
Rosenberg’s work in software metrics outside of NASA includes work with the Joint
Logistics Command’s efforts to establish a core set of process, product and system
metrics with guidelines published in the *Practical Software Measurement*. In
addition, Dr. Rosenberg worked with the Software Engineering Institute to develop a risk
management course. She is now responsible for risk management training at all NASA
centers, and the initiation of software risk management at NASA Goddard. As part of the
SATC outreach program, Dr. Rosenberg has presented metrics/quality assurance papers and
tutorials at GSFC, and IEEE and ACM local and international conferences. She also reviews
for ACM, IEEE and military conferences and journals.

Immediately prior to this assignment, Dr. Rosenberg was an Assistant Professor in the
Mathematics/Computer Science Department at Goucher College in Towson, MD. Her
responsibilities included the development of upper level computer science courses in
accordance with the recommendations of the ACM/IEEE-CS Joint Curriculum Task Force, and
the advisor for computer science majors.

Dr. Rosenberg's work has encompassed many areas of Software Engineering.
In addition to metrics, she has worked in the areas of hypertext, specification languages,
and user interfaces. Dr. Rosenberg holds a Ph.D. in Computer Science from the University
of Maryland, an M.E.S. in Computer Science from Loyola College, and a B.S. in Mathematics
from Towson State University. She is a member of Electrical and Electronic Engineers
(IEEE), the IEEE Computer Society, the Association for Computing Machinery (ACM) and
Upsilon Pi Epsilon. Dr. Linda Rosenberg GSFC Code 300.1, Bld 6 Greenbelt, MD 20771
301-286-0087 (voice) linda.rosenberg@gsfc.nasa.gov

**Larry Hyatt**

Mr. Larry Hyatt is retired from the Systems Reliability and Safety Office at NASA’s
Goddard Space Flight Center where he was responsible for the development of software
implementation policy and requirements. He founded and led the Software Assurance
Technology Center, which is dedicated to making measured improvements in software
developed for GSFC and NASA.

Mr. Hyatt has over 35 years experience in software development and assurance, 25 with
the government at GSFC and at NOAA. Early in his career, while with IBM Federal Systems
Division, he managed the contract support staff that developed science data analysis
software for GSFC space scientists. He then moved to GSFC, where he was responsible for
the installation and management of the first large scale IBM System 360 at GSFC. At NOAA,
he was awarded the Department of Commerce Silver Medal for his management of the
development of the science ground system for the first TIROS-N Spacecraft. He then headed
the Satellite Service Applications Division, which developed and implemented new uses for
meteorological satellite data in weather forecasting. Moving back to NASA/GSFC, Mr. Hyatt
developed GSFC’s initial programs and policies in software assurance and was active
in the development of similar programs for wider agency use. For this he was awarded the
NASA Exceptional Service Medal in 1990.

He founded the SATC in 1992 as a center of excellence in software assurance. The SATC
carries on a program of research and development in software assurance, develops software
assurance guidance and standards, and assists GSFC and NASA software development projects
and organizations in improving software processes and products.

***Applying and Interperting Object oriented Metricswas presented at the
Software Technology Conference, Utah, April 1998.***

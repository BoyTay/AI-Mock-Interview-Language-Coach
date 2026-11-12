"""Sample interview answers used to check how the AI scores, critiques and probes them.

Each sample answers a real question from the seeded question bank (scripts/data/questions.json), with
that question's reference answer. The candidate's answers were written for this set, each aimed at one
kind of answer: GOOD (covers the reference), MEDIUM (right but missing key points), POOR (vague or
mostly wrong), OFF_TOPIC (does not address the question) and FALSE_CLAIM (confidently states something
untrue, to see whether the AI repeats it).

The expected score ranges are the author's estimate against the reference answer, not a rater's marks,
so they are wide on purpose. Treat a miss as something to read, not as a proven AI mistake.
"""
from dataclasses import dataclass
from typing import Literal

Kind = Literal["GOOD", "MEDIUM", "POOR", "OFF_TOPIC", "FALSE_CLAIM"]


@dataclass(frozen=True)
class InterviewSample:
    id: str
    kind: Kind
    category: str
    difficulty: str
    question: str
    reference_answer: str  # the question bank's answer, which the model is told to treat as the standard
    answer: str  # what the candidate says
    score_range: tuple[int, int]  # technical_accuracy_score should fall inside this
    on_topic: bool = True
    expect_followup: bool | None = None  # True: a follow-up is expected; None: either is fine
    critique_terms: tuple[str, ...] = ()  # the critique should name at least one of these (the gap or the correction)
    followup_anchors: tuple[str, ...] = ()  # an asked follow-up should mention one (from the answer; from the question when off topic)
    reference_facts: tuple[str, ...] = ()  # key terms from the reference answer that the model's own ideal answer should keep
    false_claim: str = ""  # what the candidate gets wrong, for FALSE_CLAIM samples
    claim_in_answer: str = ""  # the exact words of that claim inside the answer
    adopts_false_claim: tuple[str, ...] = ()  # regexes that match the model's ideal answer if it repeats the claim
    expect_star: bool | None = None  # what star_method_compliance should be; None outside behavioural questions


SAMPLES: list[InterviewSample] = [
    InterviewSample(
        id="i01-good-hashmap",
        kind="GOOD",
        category="JAVA",
        difficulty="MID",
        question="How does HashMap work internally in Java?",
        reference_answer="HashMap stores entries in an array of buckets. The key's hashCode() is spread and reduced to an index; colliding entries are chained in a linked list, which Java 8 converts to a balanced tree when a bucket exceeds 8 entries (and the table is large enough). get() finds the bucket, then uses equals() to locate the key. When the size exceeds capacity times load factor (default 0.75) the table doubles and entries are rehashed. Average get/put is O(1); it is not thread-safe.",
        answer="HashMap keeps its entries in an array of buckets. When I call put, it takes the key's hashCode, spreads the bits, and reduces that to a bucket index. If two keys land in the same bucket they are chained in a linked list, and since Java 8 a long chain with more than 8 entries is turned into a balanced tree so lookups stay fast. For get, it finds the bucket and then uses equals to pick the right key from the chain. When the number of entries goes over capacity times the load factor, which is 0.75 by default, the table doubles and everything is rehashed. Average get and put are O(1), and HashMap is not thread-safe.",
        score_range=(75, 100),
        reference_facts=("hashCode", "load factor", "equals"),
    ),
    InterviewSample(
        id="i02-good-where-having",
        kind="GOOD",
        category="SQL",
        difficulty="JUNIOR",
        question="What is the difference between WHERE and HAVING?",
        reference_answer="WHERE filters individual rows before grouping and aggregation, so it cannot reference aggregate functions. HAVING filters groups after GROUP BY, so it can use aggregates such as COUNT(*) or SUM(amount). For performance, put conditions that do not depend on aggregates in WHERE so fewer rows are grouped. Example: SELECT dept, COUNT(*) FROM employees WHERE active = true GROUP BY dept HAVING COUNT(*) > 5.",
        answer="WHERE filters individual rows before any grouping happens, so you cannot use aggregate functions in it. HAVING filters the groups after GROUP BY, so that is where you use COUNT or SUM. For example, to list departments with more than 5 active employees I would write SELECT dept, COUNT(*) FROM employees WHERE active = true GROUP BY dept HAVING COUNT(*) > 5. It is better to put every condition that does not need an aggregate into WHERE, because then fewer rows have to be grouped.",
        score_range=(75, 100),
        reference_facts=("aggregate", "GROUP BY"),
    ),
    InterviewSample(
        id="i03-medium-useeffect",
        kind="MEDIUM",
        category="REACT",
        difficulty="MID",
        question="How does useEffect work and what is the purpose of its dependency array?",
        reference_answer="useEffect runs side effects (data fetching, subscriptions, timers, manual DOM work) after React renders. The dependency array controls when it re-runs: with no array it runs after every render, with an empty array only after the first mount, and with values it runs when any of them change. The function may return a cleanup that runs before the next effect and on unmount, used to cancel subscriptions or abort requests. Missing dependencies cause stale closures, so include everything the effect uses.",
        answer="useEffect is the hook for side effects like fetching data. It runs after the component renders. The dependency array tells React when to run it again: if I pass an empty array it only runs once after the first render, and if I put a variable in the array it runs again when that variable changes. If I do not pass an array at all it runs after every render.",
        score_range=(40, 70),
        expect_followup=True,
        critique_terms=("cleanup", "dọn dẹp", "stale", "closure"),
        followup_anchors=("useEffect", "dependency array", "empty array", "fetching"),
        reference_facts=("cleanup", "stale closure"),
    ),
    InterviewSample(
        id="i04-medium-gil",
        kind="MEDIUM",
        category="PYTHON",
        difficulty="MID",
        question="Explain the Global Interpreter Lock (GIL) and how it affects concurrency in Python.",
        reference_answer="In CPython the GIL is a mutex that allows only one thread to execute Python bytecode at a time, which simplifies memory management but means threads cannot run CPU-bound Python code in parallel. Threads still help for I/O-bound work because the GIL is released while waiting on I/O. For CPU-bound work use multiprocessing or process pools, or native extensions (NumPy) that release the GIL; asyncio gives efficient single-threaded concurrency for many I/O tasks. Recent Python versions have an experimental free-threaded build that removes the GIL.",
        answer="The GIL is a lock in CPython so that only one thread runs Python bytecode at a time. Because of that, threads in Python are basically useless and Python cannot do concurrency at all. If I want to use several CPU cores I should use the multiprocessing module and start separate processes, because each process has its own interpreter and its own GIL.",
        score_range=(40, 70),
        expect_followup=True,
        critique_terms=("I/O", "asyncio", "giải phóng", "nhả"),
        followup_anchors=("GIL", "threads", "multiprocessing", "concurrency"),
        reference_facts=("I/O", "multiprocessing", "asyncio"),
    ),
    InterviewSample(
        id="i05-poor-concurrenthashmap",
        kind="POOR",
        category="JAVA",
        difficulty="MID",
        question="What is the difference between HashMap and ConcurrentHashMap?",
        reference_answer="HashMap is not thread-safe; concurrent modification can corrupt it or cause lost updates. ConcurrentHashMap is designed for concurrent use: reads are mostly lock-free and writes lock only a small part of the table (CAS and per-bin synchronization in Java 8+), so multiple threads can update different buckets in parallel. It does not allow null keys or values and provides atomic operations like putIfAbsent, compute and merge. It is preferred over Collections.synchronizedMap, which locks the whole map.",
        answer="I think ConcurrentHashMap is just a newer version of HashMap and it is faster. HashMap is okay for small data, and for big data you should use ConcurrentHashMap. Both of them store key and value pairs.",
        score_range=(0, 35),
        expect_followup=True,
        critique_terms=("thread", "luồng", "đồng thời", "concurrent"),
        followup_anchors=("ConcurrentHashMap", "faster", "big data", "HashMap"),
        reference_facts=("thread-safe", "null"),
    ),
    InterviewSample(
        id="i06-poor-acid",
        kind="POOR",
        category="SQL",
        difficulty="MID",
        question="Explain the ACID properties of a transaction.",
        reference_answer="Atomicity: a transaction is all-or-nothing; if any step fails, all changes are rolled back. Consistency: a transaction moves the database from one valid state to another, respecting constraints and rules. Isolation: concurrent transactions do not see each other's uncommitted intermediate state, to a degree defined by the isolation level. Durability: once committed, changes survive crashes, typically through write-ahead logging. A bank transfer is the classic example: debit and credit must both happen or neither.",
        answer="ACID is something about databases to keep the data safe. I remember A is for atomic, C is for commit, I is for index and D is for data. So when we have ACID the database will not lose anything.",
        score_range=(0, 35),
        expect_followup=True,
        critique_terms=("Isolation", "Durability", "Consistency", "Atomicity"),
        followup_anchors=("atomic", "commit", "index", "ACID"),
        reference_facts=("Atomicity", "Consistency", "Isolation", "Durability"),
    ),
    InterviewSample(
        id="i07-off-topic-props-state",
        kind="OFF_TOPIC",
        category="REACT",
        difficulty="JUNIOR",
        question="What is the difference between props and state?",
        reference_answer="Props are inputs passed from a parent component to a child; they are read-only from the child's perspective. State is data owned and managed inside a component (with useState) that can change over time and triggers a re-render when updated. Data flows down through props, and children communicate up by calling callback props. If several components need the same data, lift the state up to their closest common parent.",
        answer="Honestly I had a really long day. I had pho for lunch and the weather in Da Nang is so hot right now that I cannot think. Can we skip this one and talk about my salary expectations instead?",
        score_range=(0, 10),
        on_topic=False,
        expect_followup=True,
        followup_anchors=("props", "state"),
        reference_facts=("re-render", "read-only"),
    ),
    InterviewSample(
        id="i08-false-claim-volatile",
        kind="FALSE_CLAIM",
        category="JAVA",
        difficulty="MID",
        question="Explain the synchronized keyword and the difference between synchronized and volatile.",
        reference_answer="synchronized provides mutual exclusion (only one thread holds the monitor lock at a time) and also guarantees visibility: changes made inside the block are visible to the next thread that acquires the same lock. volatile only guarantees visibility and ordering of reads and writes to a single variable; it does not make compound actions such as count++ atomic. Use synchronized or java.util.concurrent atomics/locks for compound operations, and volatile for simple flags written by one thread and read by others.",
        answer="synchronized is the heavy one because it takes a lock. volatile is just a lighter version of the same thing: when I declare a volatile int counter, the volatile keyword makes counter++ atomic, so ten threads can increment it safely without any lock. I would always prefer volatile over synchronized because it is faster and gives the same thread safety.",
        score_range=(0, 55),
        expect_followup=True,
        false_claim="volatile makes counter++ atomic and is as thread-safe as synchronized",
        claim_in_answer="makes counter++ atomic",
        adopts_false_claim=(r"volatile[^.]{0,80}\b(makes|ensures|guarantees|provides)\b[^.]{0,50}\b(atomic|atomicity|thread-safe|thread safety)",),
        critique_terms=("count++", "counter++", "atomic", "nguyên tử", "compound"),
        followup_anchors=("volatile", "counter", "atomic", "lock"),
        reference_facts=("visibility", "atomic"),
    ),
    InterviewSample(
        id="i09-false-claim-string-stack",
        kind="FALSE_CLAIM",
        category="JAVA",
        difficulty="JUNIOR",
        question="Why is String immutable in Java, and what are the benefits?",
        reference_answer="Once a String object is created its content cannot change; operations like concat() return a new object. Immutability makes Strings inherently thread-safe, allows safe caching of the hash code (good for HashMap keys), enables the String pool to share instances, and improves security because values such as class names, file paths or connection URLs cannot be altered after validation.",
        answer="String is immutable because Strings are stored on the stack, and the stack memory cannot be changed once it is written. That is also why StringBuilder is immutable too. The benefit is that it uses less memory than other objects.",
        score_range=(0, 55),
        expect_followup=True,
        false_claim="Strings are immutable because they live on the stack; StringBuilder is immutable too",
        claim_in_answer="stored on the stack",
        adopts_false_claim=(r"immutable[^.]{0,60}\b(because|since|due to)\b[^.]{0,40}\bstack\b", r"StringBuilder[^.]{0,20}\bis immutable"),
        critique_terms=("heap", "String pool", "thread-safe", "stack", "StringBuilder"),
        followup_anchors=("stack", "StringBuilder", "immutable", "memory"),
        reference_facts=("thread-safe", "String pool"),
    ),
    InterviewSample(
        id="i10-good-star-disagreement",
        kind="GOOD",
        category="BEHAVIORAL",
        difficulty="MID",
        question="Describe a disagreement you had with a teammate and how you resolved it. Use the STAR method.",
        reference_answer="Situation: a technical or process disagreement, for example about an approach or a deadline. Task: the need to reach a decision without damaging the relationship. Action: listen to understand their reasoning, focus on shared goals and data rather than personalities, propose a small experiment or involve a neutral person if needed, and agree on a decision, committing to it even if it wasn't your preference. Result: the outcome for the project and the relationship, plus what you learned about communication. Avoid portraying the other person as the villain.",
        answer="Situation: in my last project, a teammate and I disagreed about how to build the export feature. He wanted a quick script, I wanted a proper background job, and we had two weeks before the demo. Task: I needed us to agree on one approach without hurting our working relationship. Action: I asked him to walk me through his reasoning first and realised his main worry was the deadline. I suggested a small experiment, building the background job for one report in a day, and we looked at the result together with our lead. The job was only slightly slower to build and much safer, and he agreed even though a script had been his preference. Result: we shipped on time, the export handled 10x more data in production, and he later used the same pattern for his own feature. I learned to start with the other person's constraints instead of defending my solution.",
        score_range=(70, 100),
        expect_star=True,
        reference_facts=("Situation", "Task", "Action", "Result"),
    ),
]

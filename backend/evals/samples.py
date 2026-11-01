"""Sample IELTS Task 2 essays used to check how close the AI's band is to a reference band.

The essays were written for this set, each aimed at one band and given a deliberate mix of errors.
The reference band is the author's own estimate against the public IELTS Writing Task 2 band
descriptors, not an official examiner's mark, so treat the comparison as a sanity check on the
scoring, with roughly +/- 0.5 of noise in the reference itself.

planted_errors are phrases that are wrong on purpose and copied exactly into the essay. A good
evaluation should flag a sentence containing each of them.
"""
from dataclasses import dataclass

from app.schemas.english import SubmissionType


@dataclass(frozen=True)
class Sample:
    id: str
    prompt_topic: str
    essay: str
    reference_band: float
    planted_errors: tuple[str, ...]
    task_type: SubmissionType = SubmissionType.IELTS_TASK2


SAMPLES: list[Sample] = [
    Sample(
        id="w01-band-5.0",
        prompt_topic=(
            "Some people believe that artificial intelligence will replace most human jobs in the near future. "
            "To what extent do you agree or disagree?"
        ),
        reference_band=5.0,
        planted_errors=(
            "I am agree with this opinion",
            "it is cheap more than worker",
            "they does not need many staff",
            "Old people is difficult to learn the computer",
        ),
        essay="""Nowadays many people talk about AI and robot. I think AI will take many jobs in future and it is not good for people. I am agree with this opinion.

First, AI can work very fast and they not need to rest. In the factory, the machine can make many product in one day but a worker can make only little. So the company want to use machine because it is cheap more than worker. For example my uncle work in a car factory, and last year the factory use robot so he lose his job. This is very sad thing for his family.

Second, AI is smart now. It can drive car, it can write the letter and even it can talk with customers. Many bank use the chatbot, so they does not need many staff. People who do simple job will have no job and they can not find the new one easily.

However, some people say AI will make new jobs. This maybe true but the new job need high skill and not every people can learn it. Old people is difficult to learn the computer.

In conclusion, I think AI will replace many jobs and the government should do something to help people. If not, there will be many problem in the society and people will be poor.""",
    ),
    Sample(
        id="w02-band-5.5",
        prompt_topic=(
            "Social media has changed the way people communicate. Do the advantages of this development "
            "outweigh the disadvantages?"
        ),
        reference_band=5.5,
        planted_errors=(
            "people can keeps in touch",
            "which make them lonely",
            "there is many fake news",
            "a lot of informations",
        ),
        essay="""Social media like Facebook and Instagram are very popular today, and they have changed how people communicate with each other. In my opinion, the advantages are bigger than the disadvantages, but there are some problems that we should think about.

The first advantage is that people can keeps in touch with family and friends easily. In the past, if a person lived in another country, he must write a letter or make an expensive phone call. Now he can send a message or make a video call for free in a few seconds. This is very useful for students who study abroad, because they can talk with their parents every day and they do not feel so far from home.

Another advantage is that social media helps people to get information quickly. When something important happens, for example a natural disaster, people can share news and ask for help at once. Also, small businesses can advertise their products on social media with a low cost, so they can find more customers.

On the other hand, there are some disadvantages. Many young people spend too much time on their phones and they do not talk face to face with their family, which make them lonely. Moreover, there is many fake news on social media, and some people believe it without checking. They can find a lot of informations but not all of it is true.

In conclusion, social media gives people many chances to connect and learn, so I think the advantages are more important. However, users should limit their time online and be careful about what they read.""",
    ),
    Sample(
        id="w03-band-6.0",
        prompt_topic=(
            "Many companies now allow employees to work from home using digital tools. "
            "Discuss the advantages and disadvantages of this trend."
        ),
        reference_band=6.0,
        planted_errors=(
            "less distractions",
            "can makes it difficult",
        ),
        essay="""In recent years, more and more companies let their staff work from home with the help of digital tools such as video calls and shared documents. This essay will discuss both the benefits and the drawbacks of this trend before giving my own opinion.

One clear benefit is that employees save a lot of time and money. An employee who lives far from the office often spends two hours a day on a crowded train, but at home he can use that time to rest or to start work earlier. In addition, many people find that they have less distractions at home than in a noisy open-plan office, so they can concentrate on difficult tasks. Companies also gain, because they can rent smaller offices and pay lower costs.

However, working from home also has some disadvantages. Firstly, it can be lonely, because workers do not meet their colleagues in person and they miss the casual conversations that often lead to new ideas. Secondly, the boundary between work and private life becomes unclear. When the laptop is always on the kitchen table, people tend to answer emails late in the evening, and this can cause stress and tiredness. Finally, some jobs need teamwork, and the poor internet connection or time differences can makes it difficult to solve problems quickly.

In my opinion, the advantages are greater if the company uses a flexible system. For example, employees could work at home for three days and come to the office for two days. This way they enjoy the freedom of remote work while still keeping good relationships with their team. To sum up, working from home is a useful trend as long as companies and employees manage it carefully.""",
    ),
    Sample(
        id="w04-band-6.0",
        prompt_topic=(
            "Some people think that children should learn to code at primary school. "
            "To what extent do you agree or disagree?"
        ),
        reference_band=6.0,
        planted_errors=(
            "the children is introduced",
            "much more fun then",
            "depend on the teachers",
        ),
        essay="""Computers are part of almost every job today, so some people argue that primary school pupils should be taught programming. I partly agree with this view, because coding has real benefits for young learners, although it should not replace other important subjects.

The main reason to support early coding lessons is that they develop thinking skills. When the children is introduced to simple programs, they learn to break a big problem into small steps and to test their ideas until the program works. These habits are useful not only for future programmers but also for solving everyday problems. Furthermore, modern tools like Scratch make coding much more fun then traditional classes, because pupils can create their own games and animations and see the results immediately. This keeps them motivated and gives them confidence with technology.

Nevertheless, there are good reasons for caution. Primary school children need to develop basic reading, writing and mathematics first, and a crowded timetable could leave less time for these subjects. In addition, the quality of the lessons would depend on the teachers, and many schools do not have staff who are trained to teach programming. If the lessons are poor, pupils may become bored and decide that coding is too difficult before they have even started.

In my view, coding should be offered in primary schools, but as a short activity once a week and not as a main subject. Schools should also train their teachers and provide suitable equipment. In conclusion, early coding education can be valuable if it is introduced in a balanced way.""",
    ),
    Sample(
        id="w05-band-6.5",
        prompt_topic=(
            "As more services move online, some people argue that cash will soon disappear. "
            "Is this a positive or negative development?"
        ),
        reference_band=6.5,
        planted_errors=("this lead to",),
        essay="""With the rapid growth of mobile payment applications and online banking, many experts predict that physical money will vanish within a few decades. Although a cashless society offers genuine convenience, I believe that on balance this development would be more harmful than beneficial.

There are certainly some attractive advantages. Electronic payments are fast and simple, as customers only need to tap their phones to pay for goods, and this reduces queues in shops. Moreover, digital transactions leave a record, which makes it harder for criminals to launder money or avoid taxes. Governments could therefore collect revenue more efficiently and use it for public services.

Despite these benefits, the disappearance of cash would create serious problems for vulnerable groups. The elderly who are not familiar with smartphones, as well as people on low incomes who do not own a bank account, could find themselves unable to buy even basic necessities. A society that depends entirely on technology also becomes fragile: during a power cut or a cyber-attack, nobody would be able to pay for food or fuel. In addition, every purchase would be tracked by banks and technology companies, which raises concerns about personal privacy. Finally, spending money that you cannot physically see makes it easier to overspend, and this lead to debt among young consumers.

In conclusion, while cashless payments are efficient and help to fight crime, the risks of exclusion, system failure and loss of privacy are significant. A sensible compromise would be for governments to encourage digital payments but to guarantee that cash remains available for everyone who needs it.""",
    ),
    Sample(
        id="w06-band-6.5",
        prompt_topic=(
            "Some people believe that university education should be free for everyone. Others think students "
            "should pay for it. Discuss both views and give your own opinion."
        ),
        reference_band=6.5,
        planted_errors=(
            "the quality of teaching have",
            "whom can not afford",
        ),
        essay="""The question of who should pay for higher education is widely debated. Some argue that universities ought to be free, while others believe that students should cover the cost themselves. This essay will consider both positions before explaining why I favour a mixed approach.

Supporters of free education claim that it creates equal opportunities. Talented teenagers from poor families, whom can not afford high tuition fees, would be able to study medicine or engineering and later contribute to the economy. Countries such as Germany, which charge very little, also tend to have a highly skilled workforce. In addition, graduates would not start their careers with heavy debts, so they could take risks such as starting a business.

On the other hand, there are strong arguments for charging fees. Universities need substantial funding, and if the entire bill is paid by taxpayers, then people who never attended university are subsidising those who will earn higher salaries. Furthermore, students who pay for their courses tend to be more committed, because they understand the value of their investment. There is also a risk that, without income from fees, the quality of teaching have to fall as budgets are cut.

In my opinion, the fairest solution is a system in which students pay fees after graduation, in proportion to their income. This protects access for low-income applicants while sharing the cost between society and those who benefit directly. To conclude, completely free education is attractive but difficult to sustain, whereas income-based repayment balances fairness and financial reality.""",
    ),
    Sample(
        id="w07-band-7.0",
        prompt_topic=(
            "Online courses are becoming a popular alternative to classroom learning. Do the benefits of "
            "online education outweigh the drawbacks?"
        ),
        reference_band=7.0,
        planted_errors=("the amount of dropouts are",),
        essay="""The rise of online platforms has transformed the way people acquire knowledge, and many learners now prefer a video course to a traditional lecture hall. In my view, the advantages of online education outweigh its weaknesses, provided that learners are self-disciplined.

The most significant benefit is flexibility. Adults who work full time can study in the evenings, and parents of young children can pause a lesson whenever necessary. Online courses also remove geographical barriers: a student in a remote village can follow a lecture delivered by a professor from a leading university, something that was unthinkable a generation ago. Cost is another consideration, since many courses are free or far cheaper than a full degree, which makes lifelong learning achievable for people on modest incomes.

Nevertheless, online learning is not without drawbacks. Without a fixed timetable and a teacher's supervision, many students lose motivation, and the amount of dropouts are much higher than in conventional classes. Practical subjects such as chemistry or nursing are also hard to master through a screen, as they require laboratory equipment and hands-on feedback. Moreover, learners may feel isolated, missing the discussions and friendships that make campus life so rewarding.

These problems can, however, be reduced. Many platforms now offer live discussion groups, mentors and deadlines that keep students engaged, and universities increasingly combine online lectures with occasional practical sessions on campus. Taking all of this into account, I believe that online education offers more benefits than drawbacks, and that blended models, which combine the best of both approaches, represent the most promising future for learning.""",
    ),
    Sample(
        id="w08-band-7.0",
        prompt_topic=(
            "Some people think schools should focus on practical skills rather than academic subjects. "
            "To what extent do you agree or disagree?"
        ),
        reference_band=7.0,
        planted_errors=("less teachers",),
        essay="""A growing number of employers complain that graduates lack the skills needed in the workplace, and this has led some commentators to argue that schools should concentrate on practical training instead of academic subjects. I agree to a certain extent, but I believe that the two types of learning are complementary rather than competing.

Practical skills undoubtedly deserve more attention than they currently receive. Teenagers who learn to cook, manage a budget, repair simple equipment or write a professional email leave school better prepared for independent life. For students who are not inclined towards academic study, vocational courses in carpentry or electronics can also open the door to well-paid, rewarding careers, which reduces unemployment and the sense of failure that some of these young people experience.

However, an education that ignores academic subjects would be seriously flawed. Mathematics, science and literature develop analytical reasoning, creativity and the ability to communicate complex ideas, which are valuable in every profession and are more durable than any specific technical skill. Technology changes so quickly that a machine operated by today's apprentices may be obsolete within a decade, whereas the capacity to learn and adapt remains useful throughout a career. Furthermore, if schools abandoned academic study too early, children from poorer families might be channelled into manual work before they had discovered their potential. In practice, many schools already suffer from less teachers and limited funding, so any reform must be realistic about resources.

In conclusion, schools should expand practical education, yet they should do so alongside, not instead of, academic subjects. A balanced curriculum prepares young people both for their first job and for the changes that will follow.""",
    ),
    Sample(
        id="w09-band-7.5",
        prompt_topic=(
            "Some people say that the growing use of smartphones makes people less sociable. "
            "Do you agree or disagree?"
        ),
        reference_band=7.5,
        planted_errors=("number of researchers has",),
        essay="""Few inventions have altered daily life as swiftly as the smartphone, and critics frequently claim that it is eroding our social skills. While I accept that excessive use can damage face-to-face interaction, I do not believe that the device is inherently antisocial; in many respects it has widened, rather than narrowed, our social circles.

The concern is understandable. Anyone who has watched a family sit in silence at a restaurant, each member absorbed in a separate screen, will recognise how a phone can displace conversation. An increasing number of researchers has also linked heavy social media use to feelings of loneliness, particularly among teenagers who compare their ordinary lives with the curated images posted by others. Constant notifications fragment attention, so even when people are physically together, they are seldom fully present.

Nevertheless, this is only one side of the picture. Smartphones allow relatives separated by thousands of kilometres to share everyday moments through video calls, and they enable people with niche interests, or those living in isolated communities, to find like-minded companions who would otherwise be out of reach. Shy individuals often find it easier to build confidence through messaging before meeting in person, and the same technology is used to organise sports clubs, volunteer groups and neighbourhood events that bring people together offline.

Ultimately, the effect of a smartphone depends on how it is used. A phone that is put away during meals and meetings can strengthen relationships, while one that is allowed to dominate every moment weakens them. Rather than blaming the technology, society should promote healthier habits, such as phone-free family time and digital education in schools. In short, smartphones are tools whose social impact is determined by the people who hold them.""",
    ),
    Sample(
        id="w10-band-8.0",
        prompt_topic=(
            "Some people believe that learning a foreign language is essential for career success. "
            "To what extent do you agree or disagree?"
        ),
        reference_band=8.0,
        planted_errors=("translation rarely achieve",),
        essay="""In an economy where teams collaborate across continents, it is tempting to conclude that fluency in a foreign language is a prerequisite for professional success. Although I accept that language skills can open doors, I would argue that they are advantageous rather than essential, and that their value depends heavily on the career in question.

There is no denying that multilingual employees enjoy tangible benefits. Companies that trade internationally prize staff who can negotiate with clients in their own language, since this builds trust in a way that translation rarely achieve. Diplomats, interpreters and tourism professionals could scarcely perform their duties without such ability, and even in a handful of fields where it is not formally required, bilingual candidates often stand out in a crowded job market and may be entrusted with more responsibility.

Nevertheless, the claim that languages are indispensable overlooks several realities. English has become the common medium of science, aviation and information technology, so a software engineer in Seoul or Stockholm can build a distinguished career without mastering a third tongue. Moreover, rapid advances in machine translation are steadily lowering the cost of communication; real-time subtitles and instant document translation now allow colleagues to collaborate with surprisingly little friction. For many roles, deep technical expertise, reliability and creativity will therefore carry far more weight than the ability to hold a conversation in a second language.

Learning a language also yields benefits that extend beyond the curriculum vitae, including improved memory and a greater cultural empathy, and these may indirectly enhance a person's effectiveness at work. On balance, however, I believe that a foreign language is a valuable asset for ambitious professionals but not a universal condition of success.""",
    ),
]

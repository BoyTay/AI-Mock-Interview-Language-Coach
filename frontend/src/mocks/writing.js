// Sample feedback from design/Writing.dc.html, used as a fixture by the feedback panel tests.

// The essay as a sequence of plain strings, paragraph breaks (null) and mistakes.
// k: 'Grammar' | 'Vocabulary'; w: what the student wrote; f: the correction.
const E = (id, w, f, k, title, why) => ({ id, w, f, k, title, why })

export const segments = [
  'In recent years, technology has changed the way students learn. Because of this debate, it is important to examine how digital tools actually affect the classroom. While some people argue that digital tools make education ',
  E(1, 'more easy', 'easier', 'Grammar', 'Comparative form', 'Short adjectives form the comparative with -er and never take "more" as well. Write "easier", not "more easy".'),
  ', others claim that they are a major source of distraction. In my opinion, both views have merit, but the benefits outweigh the drawbacks.',
  null,
  'On the one hand, online platforms give learners access to ',
  E(2, 'a lot of informations', 'a wealth of information', 'Vocabulary', 'Uncountable noun and register', '"Information" is uncountable and has no plural form. "A wealth of" is also a more academic quantifier than the informal "a lot of".'),
  ' from all over the world. Students can watch lectures ',
  E(3, 'at anytime', 'at any time', 'Grammar', 'Compound word', '"Any time" is written as two words after a preposition. "Anytime" is informal and does not follow "at".'),
  ' and repeat difficult parts until they understand them. Interactive quizzes and instant feedback also keep learners motivated. For example, a student in a small village can now learn programming from the best teachers, which was impossible twenty years ago. Furthermore, teachers can share materials with a whole class in seconds.',
  null,
  'On the other hand, smartphones and social media can easily distract students from their studies. Many learners ',
  E(4, 'spends', 'spend', 'Grammar', 'Subject-verb agreement', '"Learners" is plural, so the verb takes no -s: "learners spend".'),
  ' hours scrolling instead of reading, and this ',
  E(5, 'reduce', 'reduces', 'Grammar', 'Subject-verb agreement', '"This" refers to one idea, a singular subject, so the verb needs -s: "this reduces".'),
  ' their concentration. In addition, notifications constantly interrupt deep work, which makes it hard to finish long tasks. Moreover, the quality of online sources ',
  E(6, 'are', 'is', 'Grammar', 'Finding the true subject', 'The subject is "the quality", which is singular. Ignore the plural noun "sources" inside the prepositional phrase.'),
  ' sometimes poor, so students may learn ',
  E(7, 'wrong things', 'inaccurate information', 'Vocabulary', 'Precision and register', '"Wrong things" is vague and conversational. "Inaccurate information" is exact and suits academic writing.'),
  '.',
  null,
  'In conclusion, technology is ',
  E(8, 'very useful', 'highly beneficial', 'Vocabulary', 'Avoid "very + adjective"', 'A stronger adjective modified by "highly" sounds more academic than "very" plus a basic adjective.'),
  ' for education if students use it ',
  E(9, 'in a good way', 'responsibly', 'Vocabulary', 'Vague phrase', 'One precise adverb replaces a vague phrase and tightens the sentence.'),
  '. Schools should teach learners how to manage their time online, so that technology ',
  E(10, 'help', 'helps', 'Grammar', 'Subject-verb agreement', '"Technology" is singular here, so the verb is "helps".'),
  ' them rather than harm them. With clear rules and good habits, students can enjoy the advantages while avoiding the risks.',
]

export const vocab = [
  { basic: 'a lot of', c1: 'a wealth of', c2: 'a plethora of', example: 'Online platforms give learners a wealth of resources they could never access before.' },
  { basic: 'very useful', c1: 'highly beneficial', c2: 'invaluable', example: 'Instant feedback is invaluable for self-paced learning.' },
  { basic: 'wrong things', c1: 'inaccurate information', c2: 'misinformation', example: 'Unchecked sources can spread misinformation among students.' },
  { basic: 'poor', c1: 'unreliable', c2: 'substandard', example: 'Some websites publish substandard explanations that confuse beginners.' },
  { basic: 'difficult', c1: 'challenging', c2: 'formidable', example: 'Debugging concurrency issues can be a formidable task for juniors.' },
  { basic: 'good habits', c1: 'sound habits', c2: 'exemplary habits', example: 'Sound study habits matter more than any single tool.' },
]

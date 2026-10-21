export type Step = { them: string; hint: string };
export type Scenario = {
  slug: string; emoji: string; title: string; blurb: string; setting: string; steps: Step[];
};

/** Scripted practice conversations. No AI or paid API: you read the other person's line, then reply in your own words. */
export const scenarios: Scenario[] = [
  {
    slug: "casual-conversation", emoji: "🏠", title: "Casual conversation",
    blurb: "Everyday small talk with a friend or neighbour.",
    setting: "You bump into a neighbour in the corridor. They are friendly and in no rush.",
    steps: [
      { them: "Hey! How's your week going so far?", hint: "Share one thing that went well, or one thing that's been busy." },
      { them: "Nice. Did you do anything fun at the weekend?", hint: "Describe one thing you did. Two or three sentences is plenty." },
      { them: "That sounds good. Any plans for the next few days?", hint: "Say what you're planning, even if it's just resting." },
      { them: "Well, it was lovely to catch up. Take care!", hint: "Say goodbye in your own way. Pausing is welcome." },
    ],
  },
  {
    slug: "classroom", emoji: "🏫", title: "Classroom",
    blurb: "Answering and asking questions in class.",
    setting: "You are in a seminar. The teacher is encouraging and gives you time.",
    steps: [
      { them: "Good morning, everyone. Could you tell the class your name and what you're studying?", hint: "Say your name first. A slow start is fine." },
      { them: "Thanks. Can anyone summarise the main idea from yesterday's reading?", hint: "Put up your hand and give a short summary, or say what you remember." },
      { them: "Interesting point. Does anyone have a question for them?", hint: "Practise asking: 'Could you explain what you meant by…?'" },
      { them: "Is there anything you'd like me to repeat or clarify?", hint: "Ask for one thing to be repeated, politely and clearly." },
    ],
  },
  {
    slug: "job-interview", emoji: "💼", title: "Job interview",
    blurb: "Introductions, strengths and questions for the interviewer.",
    setting: "A friendly interviewer welcomes you. You are allowed to take your time.",
    steps: [
      { them: "Welcome, please take a seat. Could you start by telling me a bit about yourself?", hint: "Name, what you do, and one thing you enjoy about it." },
      { them: "What would you say is your biggest strength?", hint: "Pick one strength and give a short example." },
      { them: "Tell me about a time you solved a difficult problem.", hint: "Situation, what you did, how it ended. Pause between parts." },
      { them: "Do you have any questions for me?", hint: "Ask about the team or what a typical day looks like." },
    ],
  },
  {
    slug: "telephone-call", emoji: "📞", title: "Telephone call",
    blurb: "Calling a business to ask a question or book something.",
    setting: "You are phoning a dentist's reception to make an appointment.",
    steps: [
      { them: "Good afternoon, Riverside Dental. How can I help?", hint: "Say why you're calling. You can start with 'Hello, I'd like to…'" },
      { them: "Of course. Can I take your full name, please?", hint: "Say your name clearly. You can spell it if that's easier." },
      { them: "And what day works best for you?", hint: "Give a day and a rough time, or ask what's available." },
      { them: "Great, you're booked in. Is there anything else?", hint: "Say thank you and goodbye, or ask one last question." },
    ],
  },
  {
    slug: "shopping", emoji: "🛒", title: "Shopping",
    blurb: "Asking for help, prices and paying at the till.",
    setting: "You are in a clothes shop and an assistant comes over.",
    steps: [
      { them: "Hi there, are you looking for anything in particular?", hint: "Say what you're after, or 'Just browsing, thanks'." },
      { them: "That one comes in blue and green. Would you like to try it?", hint: "Ask about a size or a changing room." },
      { them: "How does it fit?", hint: "Tell them if you'd like a different size, or that you'll take it." },
      { them: "That'll be forty pounds. Cash or card?", hint: "Answer, then say thank you." },
    ],
  },
  {
    slug: "doctors-appointment", emoji: "🏥", title: "Doctor's appointment",
    blurb: "Explaining how you feel and asking questions.",
    setting: "You are at a GP appointment. The doctor is calm and has time for you.",
    steps: [
      { them: "Come in and sit down. What brings you in today?", hint: "Describe the main thing in a sentence or two." },
      { them: "How long has this been going on?", hint: "Give a rough time: days, weeks or months." },
      { them: "Have you tried anything to help with it?", hint: "Mention anything you've tried, or say you haven't." },
      { them: "Do you have any questions before we finish?", hint: "Ask one question you want answered." },
    ],
  },
  {
    slug: "public-speaking", emoji: "🎤", title: "Public speaking",
    blurb: "A short talk to a small, supportive audience.",
    setting: "You are giving a two-minute talk at a team meeting. People are on your side.",
    steps: [
      { them: "Over to you. Please begin whenever you're ready.", hint: "Take a breath, smile, and say hello. Begin at your own pace." },
      { them: "(The audience listens.) Tell us what your talk is about.", hint: "State your topic in one sentence." },
      { them: "(The audience nods.) Give us your main point.", hint: "Make one clear point and give a reason." },
      { them: "(Time to wrap up.) Please conclude and thank the room.", hint: "Sum up in one sentence and say thank you." },
    ],
  },
  {
    slug: "meeting-someone-new", emoji: "❤️", title: "Meeting someone new",
    blurb: "Introductions and getting to know a new person.",
    setting: "You are at a friend's party and someone comes over to say hello.",
    steps: [
      { them: "Hi, I don't think we've met. I'm Sam.", hint: "Say hello and your name. Offer a handshake or a smile." },
      { them: "How do you know the host?", hint: "Say how you know them in a sentence." },
      { them: "What do you like to do when you're not working?", hint: "Share a hobby and say why you like it." },
      { them: "That sounds great. I should go and find a drink, but nice to meet you!", hint: "Say it was nice to meet them too." },
    ],
  },
];

export const bySlug = (slug: string) => scenarios.find((s) => s.slug === slug);

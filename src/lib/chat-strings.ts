export type Language = "en" | "roman";

export type Category = "pricing" | "services" | "timings" | "location";

export const STRINGS = {
  en: {
    clinicName: "Nexen Strategy",
    tagline: "Digital Agency & AI Solutions",
    langButton: "Roman Urdu",
    languagePrompt: "Please choose your language to continue.",
    languageOptions: { en: "English", roman: "Roman Urdu" },
    welcome:
      "Hi! I'm the Nex, Nexen Strategy assistant. Ask me about our services, or I can help you request a quotation or book a meeting.",
    menuOptions: {
      pricing: "Pricing",
      services: "Services",
      timings: "Availability",
      location: "Location",
      human: "Talk to Human",
    },
    inputPlaceholder: "Type a message...",
    send: "Send",
    fallback:
      "I couldn't quite understand that. Let me connect you with our team.",
    liveConnecting: "Sure! Please wait connecting you to a human agent.",
    liveReviewing: "Please wait few minutes human agent is reviewing your chat.",
    liveActive: "You are now chatting with our team.",
    afterAnswer: "Anything else I can help with?",
    langSwitched: "Language switched to English.",
    error: "Something went wrong. Please try again.",
    chatEnded: "Chat ended. Thank you for reaching out to Nexen Strategy — talk soon!",
    startNewChat: "Start New Chat",
    form: {
      title: "Before we connect you",
      usernameLabel: "Your name",
      usernamePlaceholder: "Enter your name",
      topicLabel: "Topic",
      topicPlaceholder: "Select a topic",
      queriesLabel: "Your query",
      queriesPlaceholder: "Type your question in detail...",
      submit: "Submit Request",
      submitting: "Submitting...",
      required: "Please fill all fields.",
    },
  },
  roman: {
    clinicName: "Nexen Strategy",
    tagline: "Digital Agency & AI Solutions",
    langButton: "English",
    languagePrompt: "Barah-e-karam apni zaban muntakhib karain.",
    languageOptions: { en: "English", roman: "Roman Urdu" },
    welcome:
      "Assalam-o-Alaikum! Main Nexen Strategy ka assistant hoon. Humari services ke baare mein poochein, ya main aap ki quotation ya meeting booking mein madad kar sakta hoon.",
    menuOptions: {
      pricing: "Pricing",
      services: "Services",
      timings: "Availability",
      location: "Location",
      human: "Insan se Baat Karain",
    },
    inputPlaceholder: "Message likhein...",
    send: "Bhejain",
    fallback:
      "Maazrat, main yeh samajh nahi paya. Aap ko humari team se milata hoon.",
    liveConnecting: "Barah-e-karam intezar karein — aap ko human agent se connect kiya ja raha hai.",
    liveReviewing: "Barah-e-karam thoda intezar karein, human agent aap ka chat review kar raha hai.",
    liveActive: "Aap ab humari team se baat kar rahe hain.",
    afterAnswer: "Aur kis cheez mein madad chahiye?",
    langSwitched: "Zaban Roman Urdu ho gayi.",
    error: "Kuch masla hua. Dobara try karain.",
    chatEnded: "Chat khatam ho gayi. Nexen Strategy se rabta karne ka shukriya — phir milenge!",
    startNewChat: "Nayi Chat Shuru Karein",
    form: {
      title: "Connect karne se pehle",
      usernameLabel: "Aap ka naam",
      usernamePlaceholder: "Apna naam likhein",
      topicLabel: "Mauzu",
      topicPlaceholder: "Mauzu chunein",
      queriesLabel: "Aap ka sawal",
      queriesPlaceholder: "Apna sawal tafseel se likhein...",
      submit: "Request Bhejein",
      submitting: "Bheja ja raha hai...",
      required: "Sab fields bharain.",
    },
  },
} as const;

export const TOPIC_OPTIONS = [
  "Brand & Design",
  "Web & App Development",
  "Software Solutions",
  "AI & Automation",
  "Marketing & Growth",
  "Media Production",
  "Quotation",
  "Meeting",
  "Others",
] as const;
export type TopicOption = (typeof TOPIC_OPTIONS)[number];

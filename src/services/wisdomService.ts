/**
 * Daily Wisdom Service
 * Provides one themed quote per day of the year
 * Themes rotate: Monday=Gratitude, Tuesday=Courage, etc.
 */

export interface DailyWisdom {
  date: string; // YYYY-MM-DD
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  theme: 'gratitude' | 'courage' | 'wonder' | 'purpose' | 'compassion' | 'joy' | 'peace';
  quote: string;
  author: string;
  tradition: string; // Stoic, Buddhist, Christian, Islamic, Jewish, Indigenous, Secular
  reflection: string;
  meditationTheme?: string;
}

// Curated quotes organized by theme
const QUOTES_BY_THEME = {
  gratitude: [
    {
      quote: "Gratitude is the antidote to suffering. What you appreciate appreciates in value.",
      author: "Rumi",
      tradition: "Islamic/Sufi",
      reflection: "Today, notice three small things you typically overlook.",
    },
    {
      quote: "At the end of the day, it's not the years in your life that count. It's the life in your years.",
      author: "Abraham Lincoln",
      tradition: "Secular",
      reflection: "How much presence are you bringing to today?",
    },
    {
      quote: "Blessed is the person who finds joy in the small things.",
      author: "Proverb",
      tradition: "Jewish",
      reflection: "What small moment brought you joy this week?",
    },
    {
      quote: "The more you have, the more you are occupied. The less you have, the more free you are.",
      author: "Mother Teresa",
      tradition: "Christian",
      reflection: "What possession weighs heaviest on your mind?",
    },
    {
      quote: "In the practice of gratitude, we find freedom.",
      author: "Epictetus",
      tradition: "Stoic",
      reflection: "What freedom comes from accepting what you cannot change?",
    },
  ],
  courage: [
    {
      quote: "Courage is not the absence of fear, but action despite it.",
      author: "Marcus Aurelius",
      tradition: "Stoic",
      reflection: "What would you do if fear were not a factor?",
    },
    {
      quote: "Be like the rock that the waves keep crashing over. It stands firm and the raging of the water subsides around it.",
      author: "Marcus Aurelius",
      tradition: "Stoic",
      reflection: "Where can you stand firm today?",
    },
    {
      quote: "The cave you fear to enter holds the treasure you seek.",
      author: "Joseph Campbell",
      tradition: "Secular",
      reflection: "What challenge holds your next growth?",
    },
    {
      quote: "Fear knocked on the door. Faith answered. Nobody was there.",
      author: "George Bernard Shaw",
      tradition: "Secular",
      reflection: "How often do fears fail to materialize?",
    },
    {
      quote: "In the middle of difficulty lies opportunity.",
      author: "Albert Einstein",
      tradition: "Secular",
      reflection: "What opportunity is hidden in today's challenge?",
    },
  ],
  wonder: [
    {
      quote: "The world is full of magic things, patiently waiting for our senses to grow sharper.",
      author: "W.B. Yeats",
      tradition: "Secular/Poetry",
      reflection: "What wonder can you discover in the ordinary today?",
    },
    {
      quote: "Curiosity is the engine of achievement.",
      author: "Ken Robinson",
      tradition: "Secular",
      reflection: "What question can you ask today that opens new possibility?",
    },
    {
      quote: "In every person, there is something no one else knows or has ever known.",
      author: "Paul Bowles",
      tradition: "Secular",
      reflection: "What hidden depths might you explore in someone you know?",
    },
    {
      quote: "The most beautiful thing we can experience is the mysterious.",
      author: "Albert Einstein",
      tradition: "Secular",
      reflection: "What remains beautifully inexplicable in your life?",
    },
    {
      quote: "Not all those who wander are lost.",
      author: "J.R.R. Tolkien",
      tradition: "Secular/Literature",
      reflection: "Where is wandering actually leading you?",
    },
  ],
  purpose: [
    {
      quote: "The purpose of our lives is to be happy.",
      author: "Dalai Lama",
      tradition: "Buddhist",
      reflection: "What brings you authentic happiness today?",
    },
    {
      quote: "Your time is limited. Don't waste it living someone else's life.",
      author: "Steve Jobs",
      tradition: "Secular",
      reflection: "Whose expectations are you living by?",
    },
    {
      quote: "The privilege of a lifetime is to become who you truly are.",
      author: "Carl Jung",
      tradition: "Secular/Psychology",
      reflection: "Who are you becoming?",
    },
    {
      quote: "Do what you can, with what you have, where you are.",
      author: "Theodore Roosevelt",
      tradition: "Secular",
      reflection: "What is within your power to do right now?",
    },
    {
      quote: "Your mission is to find your gift, and then use it to serve the world.",
      author: "Unknown",
      tradition: "Secular",
      reflection: "What gift do you have to offer?",
    },
  ],
  compassion: [
    {
      quote: "Compassion is not a relationship between the healer and the wounded. It's a relationship between equals.",
      author: "Pema Chödrön",
      tradition: "Buddhist",
      reflection: "How can you meet others with radical equality?",
    },
    {
      quote: "In recognizing the humanity of our fellow beings, we pay homage to the beauty of creation.",
      author: "Desmond Tutu",
      tradition: "Christian/Secular",
      reflection: "Who's humanity have you overlooked?",
    },
    {
      quote: "The wound is the place where the Light enters you.",
      author: "Rumi",
      tradition: "Islamic/Sufi",
      reflection: "How can pain become an opening to compassion?",
    },
    {
      quote: "Kindness is the language which the deaf can hear and the blind can see.",
      author: "Mark Twain",
      tradition: "Secular",
      reflection: "Who needs your kindness today?",
    },
    {
      quote: "We are here for one another. That's the essence of everything.",
      author: "Thich Nhat Hanh",
      tradition: "Buddhist",
      reflection: "How are you present for others?",
    },
  ],
  joy: [
    {
      quote: "Joy is a net of love by which you can catch souls.",
      author: "Mother Teresa",
      tradition: "Christian",
      reflection: "How can joy become your offering to others?",
    },
    {
      quote: "The purpose of dancing is not to arrive at a particular spot on the floor. It is to enjoy every step along the way.",
      author: "Wayne Dyer",
      tradition: "Secular",
      reflection: "Where can you find joy in the process today?",
    },
    {
      quote: "Laughter is the shortest distance between two people.",
      author: "Victor Borge",
      tradition: "Secular",
      reflection: "When did you last laugh freely?",
    },
    {
      quote: "Play is the exultation of the possible.",
      author: "Martin Buber",
      tradition: "Jewish/Philosophy",
      reflection: "What brings out your playfulness?",
    },
    {
      quote: "Life is either a daring adventure or nothing at all.",
      author: "Helen Keller",
      tradition: "Secular",
      reflection: "Where is adventure calling you?",
    },
  ],
  peace: [
    {
      quote: "Peace comes from within. Do not seek it without.",
      author: "Buddha",
      tradition: "Buddhist",
      reflection: "What inner peace are you cultivating?",
    },
    {
      quote: "The mind is like water. When it is turbulent, it is difficult to see. When it is calm, everything becomes clear.",
      author: "Thich Nhat Hanh",
      tradition: "Buddhist",
      reflection: "How can you still your mind today?",
    },
    {
      quote: "Silence is a source of great strength.",
      author: "Lao Tzu",
      tradition: "Taoist",
      reflection: "What can silence teach you?",
    },
    {
      quote: "In quietness and confidence shall be your strength.",
      author: "Isaiah 30:15",
      tradition: "Christian",
      reflection: "Where can you find quiet confidence?",
    },
    {
      quote: "The greatest revelation is stillness.",
      author: "Laozi",
      tradition: "Taoist",
      reflection: "What is revealed when you are still?",
    },
  ],
};

const THEMES_BY_DAY = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
} as const;

const THEME_TO_KEY = {
  Sunday: 'peace',
  Monday: 'gratitude',
  Tuesday: 'courage',
  Wednesday: 'wonder',
  Thursday: 'purpose',
  Friday: 'compassion',
  Saturday: 'joy',
} as const;

export const wisdomService = {
  /**
   * Get today's wisdom quote
   */
  getTodayWisdom(): DailyWisdom {
    return this.getWisdomForDate(new Date());
  },

  /**
   * Get wisdom quote for a specific date
   */
  getWisdomForDate(date: Date): DailyWisdom {
    const dateISO = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const dayName = THEMES_BY_DAY[dayOfWeek as keyof typeof THEMES_BY_DAY] as keyof typeof THEME_TO_KEY;
    const themeKey = THEME_TO_KEY[dayName];

    // Deterministic selection: use day of year to pick from theme array
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const themeQuotes = QUOTES_BY_THEME[themeKey as keyof typeof QUOTES_BY_THEME];
    const quoteIndex = dayOfYear % themeQuotes.length;
    const selectedQuote = themeQuotes[quoteIndex];

    return {
      date: dateISO,
      dayOfWeek: dayName,
      theme: themeKey as any,
      quote: selectedQuote.quote,
      author: selectedQuote.author,
      tradition: selectedQuote.tradition,
      reflection: selectedQuote.reflection,
      meditationTheme: 'open-awareness',
    };
  },

  /**
   * Get next N days of wisdom
   */
  getUpcomingWisdom(days: number = 7): DailyWisdom[] {
    const wisdom: DailyWisdom[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      wisdom.push(this.getWisdomForDate(date));
    }

    return wisdom;
  },
};

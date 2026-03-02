import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERSONALITY_STORAGE_KEY = 'oracle-pet-personality';

// ── Types ──

export interface PersonalityTraits {
  playful: number;     // 0-100, increases with play
  foodie: number;      // 0-100, increases with feeding
  sleepy: number;      // 0-100, increases with rest
  adventurous: number; // 0-100, increases with adventures
  social: number;      // 0-100, increases with reflections
}

export type MemoryType =
  | 'fed' | 'played' | 'rested' | 'reflected'
  | 'adventure_start' | 'adventure_complete'
  | 'evolved' | 'leveled' | 'long_absence'
  | 'touched_headpat' | 'touched_poke' | 'touched_hug'
  | 'event' | 'equipped' | 'all_stats_max';

export interface PetMemory {
  type: MemoryType;
  timestamp: number;
  detail?: string;
}

export interface DiaryEntry {
  id: string;
  date: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  text: string;
  mood: string;
  illustration: string;
  statsSnapshot: { hunger: number; happiness: number; energy: number };
  read: boolean;
}

export interface DialogueLine {
  text: string;
  priority: number;
  category: string;
}

// ── State ──

interface PersonalityState {
  traits: PersonalityTraits;
  memories: PetMemory[];
  diaryEntries: DiaryEntry[];
  lastDialogueAt: number;
  lastIdleDialogueAt: number;
  lastGreetingDate: string;
  currentDialogue: string | null;
  touchInteractionCooldownAt: number;
}

interface PersonalityActions {
  updateTraits: (action: string, amount?: number) => void;
  recordMemory: (type: MemoryType, detail?: string) => void;
  generateDialogue: (context: DialogueContext) => string | null;
  generateIdleDialogue: (context: DialogueContext) => string | null;
  generateDiaryEntry: (context: DiaryContext) => void;
  markDiaryRead: () => void;
  setCurrentDialogue: (text: string | null) => void;
  setTouchCooldown: () => void;
  canTouch: () => boolean;
  getUnreadDiaryCount: () => number;
  hydratePersonality: () => Promise<void>;
}

export interface DialogueContext {
  hunger: number;
  happiness: number;
  energy: number;
  mood: string;
  name: string;
  ownerName: string;
  streakDays: number;
  equippedSkin: string;
  level: number;
  hoursSinceLastOpen: number;
  isFirstOpenToday: boolean;
}

export interface DiaryContext {
  hunger: number;
  happiness: number;
  energy: number;
  mood: string;
  equippedSkin: string;
  hoursAway: number;
  activeAdventureZone?: string;
  ownerName?: string;
}

type PersonalityStore = PersonalityState & PersonalityActions;

// ── Dialogue Templates ──

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDialogueLines(ctx: DialogueContext, traits: PersonalityTraits, memories: PetMemory[]): DialogueLine[] {
  const lines: DialogueLine[] = [];
  const time = getTimeOfDay();
  const { hunger, happiness, energy, name, ownerName, streakDays, equippedSkin, hoursSinceLastOpen, isFirstOpenToday } = ctx;
  const o = ownerName || 'friend';

  // ── Time-of-day greetings (high priority on first open) ──
  if (isFirstOpenToday) {
    if (time === 'morning') {
      lines.push(
        { text: `Good morning, ${o}! I dreamed about butterflies...`, priority: 100, category: 'greeting' },
        { text: `Rise and shine, ${o}! Ready for a new day?`, priority: 100, category: 'greeting' },
        { text: `${o}! You're up early! I like that about you.`, priority: 95, category: 'greeting' },
        { text: `Morning, ${o}~ I saved you a spot next to me.`, priority: 95, category: 'greeting' },
      );
    } else if (time === 'afternoon') {
      lines.push(
        { text: `Oh, ${o}! There you are! I've been waiting~`, priority: 100, category: 'greeting' },
        { text: `Afternoon, ${o}! Want to hang out?`, priority: 95, category: 'greeting' },
        { text: `Hey ${o}! I was just thinking about you.`, priority: 95, category: 'greeting' },
      );
    } else if (time === 'evening') {
      lines.push(
        { text: `Good evening, ${o}! The stars are coming out~`, priority: 100, category: 'greeting' },
        { text: `Hey ${o}, you're back! Perfect timing for some fun.`, priority: 95, category: 'greeting' },
        { text: `Evening vibes, ${o}~ let's chill together.`, priority: 95, category: 'greeting' },
      );
    } else {
      lines.push(
        { text: `It's late, ${o}... but I'm happy you're here!`, priority: 100, category: 'greeting' },
        { text: `Night owl mode activated! Hi ${o}~`, priority: 95, category: 'greeting' },
        { text: `Can't sleep either, ${o}? Let's keep each other company.`, priority: 95, category: 'greeting' },
      );
    }
  }

  // ── Long absence messages ──
  if (hoursSinceLastOpen >= 12) {
    lines.push(
      { text: `${o}!! Where were you?! I missed you SO much...`, priority: 110, category: 'absence' },
      { text: `I was starting to worry, ${o}... but you came back!`, priority: 110, category: 'absence' },
      { text: `${o}, it felt like forever... don't leave me that long again!`, priority: 105, category: 'absence' },
      { text: 'I counted every minute... okay maybe I lost count at 47.', priority: 100, category: 'absence' },
    );
  } else if (hoursSinceLastOpen >= 6) {
    lines.push(
      { text: `I missed you, ${o}! It's been so quiet here...`, priority: 90, category: 'absence' },
      { text: `Finally, ${o}! I was looking at the door, waiting...`, priority: 90, category: 'absence' },
      { text: `${o}! You're back! I have so much to tell you.`, priority: 85, category: 'absence' },
    );
  } else if (hoursSinceLastOpen >= 2) {
    lines.push(
      { text: `Oh, hi again ${o}! I took a little nap while you were gone.`, priority: 70, category: 'absence' },
      { text: `Welcome back, ${o}~ I barely noticed you were gone. ...okay I totally noticed.`, priority: 70, category: 'absence' },
    );
  }

  // ── Stat-based dialogue ──
  if (hunger < 25) {
    lines.push(
      { text: "I'm SO hungry... my tummy is making whale sounds!", priority: 85, category: 'need' },
      { text: 'Is that... food I smell? Oh wait, no. Please feed me?', priority: 85, category: 'need' },
      { text: "If I don't eat soon I might start nibbling the furniture...", priority: 80, category: 'need' },
    );
  } else if (hunger < 50) {
    lines.push(
      { text: "Getting a little hungry... snack time maybe?", priority: 60, category: 'need' },
      { text: 'My tummy just growled. Did you hear that?', priority: 55, category: 'need' },
    );
  }

  if (happiness < 25) {
    lines.push(
      { text: "I'm feeling really lonely... are you busy?", priority: 85, category: 'need' },
      { text: "Everything feels gray today... can we play?", priority: 85, category: 'need' },
      { text: 'I just need a hug right now...', priority: 80, category: 'need' },
    );
  } else if (happiness < 50) {
    lines.push(
      { text: "I could use some fun... want to play?", priority: 60, category: 'need' },
      { text: "Things are okay but... I'd be happier if we did something together.", priority: 55, category: 'need' },
    );
  }

  if (energy < 25) {
    lines.push(
      { text: "So... tired... can barely... keep eyes... open...", priority: 85, category: 'need' },
      { text: '*yaaawns* I need a serious nap...', priority: 80, category: 'need' },
    );
  } else if (energy < 50) {
    lines.push(
      { text: "Feeling a bit sleepy... a short rest would be nice.", priority: 55, category: 'need' },
    );
  }

  // All stats high
  if (hunger >= 80 && happiness >= 80 && energy >= 80) {
    lines.push(
      { text: 'I feel AMAZING today! Life is great!', priority: 75, category: 'happy' },
      { text: `${o}, you take such good care of me~ this is the best!`, priority: 75, category: 'happy' },
      { text: "I'm so full of energy! Let's do something fun!", priority: 70, category: 'happy' },
      { text: `You know what, ${o}? You're the best human ever.`, priority: 70, category: 'happy' },
    );
  }

  if (hunger >= 100 && happiness >= 100 && energy >= 100) {
    lines.push(
      { text: 'PERFECT! All stats maxed! I feel like I could fly!', priority: 90, category: 'perfect' },
      { text: `${o}!! I'm literally glowing right now! Thank you!!!`, priority: 90, category: 'perfect' },
    );
  }

  // ── Personality trait dialogue ──
  if (traits.playful > 60) {
    lines.push(
      { text: "Tag! You're it! ...oh wait, you can't reach me.", priority: 40, category: 'trait' },
      { text: 'I bet I can do a backflip! Watch! ...okay maybe not.', priority: 35, category: 'trait' },
      { text: "Let's play a game! I'm so bored right now~", priority: 40, category: 'trait' },
    );
  }
  if (traits.foodie > 60) {
    lines.push(
      { text: "I've been thinking about food again... is that weird?", priority: 40, category: 'trait' },
      { text: 'You know what sounds good right now? Everything.', priority: 35, category: 'trait' },
      { text: "I wonder what premium pet food tastes like...", priority: 35, category: 'trait' },
    );
  }
  if (traits.sleepy > 60) {
    lines.push(
      { text: "Is it nap time yet? It's always nap time for me~", priority: 40, category: 'trait' },
      { text: '*stretches* Five more minutes...', priority: 35, category: 'trait' },
      { text: 'I had the coziest dream last night...', priority: 35, category: 'trait' },
    );
  }
  if (traits.adventurous > 60) {
    lines.push(
      { text: 'I wonder what\'s beyond the mountains...', priority: 40, category: 'trait' },
      { text: "Let's go on an adventure! I want to explore!", priority: 40, category: 'trait' },
      { text: 'I can smell adventure in the air!', priority: 35, category: 'trait' },
    );
  }
  if (traits.social > 60) {
    lines.push(
      { text: `I love when we talk, ${o}... it makes me happy.`, priority: 40, category: 'trait' },
      { text: `Tell me about your day, ${o}! I want to know everything.`, priority: 35, category: 'trait' },
    );
  }

  // ── Streak dialogue ──
  if (streakDays >= 30) {
    lines.push({ text: `${streakDays} days together, ${o}! We're inseparable!`, priority: 65, category: 'streak' });
  } else if (streakDays >= 7) {
    lines.push({ text: `${streakDays} day streak! ${o} never forgets about me~`, priority: 60, category: 'streak' });
  } else if (streakDays >= 3) {
    lines.push({ text: `${streakDays} days in a row, ${o}! You really do care!`, priority: 55, category: 'streak' });
  }

  // ── Equipped item dialogue ──
  if (equippedSkin === 'headphones') {
    lines.push(
      { text: 'These headphones are BUMPING! Want to dance?', priority: 50, category: 'equip' },
      { text: '~ la la la ~ Can you hear the music too?', priority: 45, category: 'equip' },
    );
  } else if (equippedSkin === 'crown') {
    lines.push(
      { text: 'Do I look royal? I feel royal.', priority: 50, category: 'equip' },
      { text: 'Bow before the mighty Nomi! ...just kidding. Or am I?', priority: 45, category: 'equip' },
    );
  } else if (equippedSkin === 'hoodie') {
    lines.push(
      { text: "This hoodie is so cozy~ I never want to take it off.", priority: 50, category: 'equip' },
      { text: 'Hoodie weather is the best weather.', priority: 45, category: 'equip' },
    );
  }

  // ── Memory-based dialogue ──
  const recentAdventure = memories.find(m => m.type === 'adventure_complete' && Date.now() - m.timestamp < 24 * 60 * 60 * 1000);
  if (recentAdventure?.detail) {
    lines.push(
      { text: `Remember ${recentAdventure.detail}? That was so cool!`, priority: 55, category: 'memory' },
      { text: `I keep thinking about our trip to ${recentAdventure.detail}...`, priority: 50, category: 'memory' },
    );
  }

  const recentLevel = memories.find(m => m.type === 'leveled' && Date.now() - m.timestamp < 2 * 60 * 60 * 1000);
  if (recentLevel) {
    lines.push(
      { text: 'I leveled up! I can feel myself getting stronger~', priority: 65, category: 'memory' },
    );
  }

  const feedCount24h = memories.filter(m => m.type === 'fed' && Date.now() - m.timestamp < 24 * 60 * 60 * 1000).length;
  if (feedCount24h >= 3) {
    lines.push(
      { text: `${o} fed me ${feedCount24h} times today! I love you!`, priority: 50, category: 'memory' },
    );
  }

  const touchCount24h = memories.filter(m =>
    (m.type === 'touched_headpat' || m.type === 'touched_hug') &&
    Date.now() - m.timestamp < 24 * 60 * 60 * 1000
  ).length;
  if (touchCount24h >= 5) {
    lines.push(
      { text: `${o} gave me ${touchCount24h} pats today! I'm the luckiest pet~`, priority: 50, category: 'memory' },
    );
  }

  // ── Time-of-day ambient ──
  if (!isFirstOpenToday) {
    if (time === 'morning') {
      lines.push({ text: "The morning sun feels so warm~", priority: 20, category: 'ambient' });
    } else if (time === 'afternoon') {
      lines.push({ text: 'What should we do this afternoon?', priority: 20, category: 'ambient' });
    } else if (time === 'evening') {
      lines.push({ text: 'The sunset is so pretty today...', priority: 20, category: 'ambient' });
    } else {
      lines.push({ text: 'The stars are beautiful tonight...', priority: 20, category: 'ambient' });
    }
  }

  // ── Generic filler (always available) ──
  lines.push(
    { text: `Hi ${o}! What are we doing today?`, priority: 10, category: 'filler' },
    { text: `I like spending time with you, ${o}.`, priority: 10, category: 'filler' },
    { text: "Just vibing~ don't mind me.", priority: 10, category: 'filler' },
    { text: `Did you know, ${o}? Pets in apps dream about their humans!`, priority: 10, category: 'filler' },
    { text: "I wonder what other pets are doing right now...", priority: 10, category: 'filler' },
  );

  return lines;
}

// ── Idle dialogue (lighter, shorter) ──

function generateIdleLines(ctx: DialogueContext, traits: PersonalityTraits): DialogueLine[] {
  const lines: DialogueLine[] = [];
  const time = getTimeOfDay();

  // Time-based idle
  if (time === 'morning') {
    lines.push(
      { text: '*stretches* Ahhh~', priority: 10, category: 'idle' },
      { text: 'What a nice morning!', priority: 10, category: 'idle' },
    );
  } else if (time === 'evening') {
    lines.push(
      { text: '*yawns*', priority: 10, category: 'idle' },
      { text: 'Getting sleepy...', priority: 10, category: 'idle' },
    );
  } else if (time === 'night') {
    lines.push(
      { text: '*nods off* ...huh? I\'m awake!', priority: 10, category: 'idle' },
      { text: 'zZz... oh! Hi!', priority: 10, category: 'idle' },
    );
  }

  // Generic idle
  lines.push(
    { text: 'La la la~', priority: 5, category: 'idle' },
    { text: 'Hmm hmm hmm...', priority: 5, category: 'idle' },
    { text: 'I wonder what\'s for dinner...', priority: 5, category: 'idle' },
    { text: 'Did you see that cloud? It looked like a bone!', priority: 5, category: 'idle' },
    { text: '*wiggles ears*', priority: 5, category: 'idle' },
    { text: '*looks around curiously*', priority: 5, category: 'idle' },
    { text: '~ do do do ~', priority: 5, category: 'idle' },
    { text: '*blinks slowly*', priority: 5, category: 'idle' },
    { text: 'I love this spot right here.', priority: 5, category: 'idle' },
    { text: 'What are you thinking about?', priority: 5, category: 'idle' },
  );

  // Trait-influenced idle
  if (traits.playful > 50) {
    lines.push(
      { text: '*bounces around*', priority: 8, category: 'idle' },
      { text: 'Catch me if you can!', priority: 8, category: 'idle' },
    );
  }
  if (traits.foodie > 50) {
    lines.push(
      { text: '*sniff sniff* ...food?', priority: 8, category: 'idle' },
    );
  }
  if (traits.sleepy > 50) {
    lines.push(
      { text: '*curls up into a ball*', priority: 8, category: 'idle' },
    );
  }

  // Stat-influenced idle
  if (ctx.hunger < 40) {
    lines.push({ text: '*tummy grumbles*', priority: 12, category: 'idle' });
  }
  if (ctx.happiness >= 80) {
    lines.push({ text: '*happy wiggle*', priority: 8, category: 'idle' });
  }

  return lines;
}

// ── Diary Generation ──

function generateDiaryText(ctx: DiaryContext, traits: PersonalityTraits, memories: PetMemory[]): { text: string; illustration: string } {
  const time = getTimeOfDay();
  const o = ctx.ownerName || 'my human';
  const templates: { text: string; illustration: string }[] = [];

  // Absence-based
  if (ctx.hoursAway >= 8) {
    templates.push(
      { text: `Dear diary, it's been so long since ${o} visited. I stared at the door for hours. I hope ${o} comes back soon...`, illustration: '\u{1F6AA}\u{1F43E}\u{1F4AD}' },
      { text: "I've been alone for a while now. I practiced my wiggle dance to pass the time. Nobody was here to see it though...", illustration: '\u{1F483}\u{1F3B6}\u{1F4AD}' },
    );
  } else if (ctx.hoursAway >= 4) {
    templates.push(
      { text: `Dear diary, I took a nice long nap today. When I woke up, ${o} wasn't here yet. I played with my shadow to keep busy!`, illustration: '\u{1F634}\u{2600}\u{FE0F}\u{1F43E}' },
      { text: "I spent the afternoon looking out the window. A bird flew by and I tried to wave but I don't think it noticed me.", illustration: '\u{1F426}\u{1F44B}\u{1F3E0}' },
    );
  } else {
    templates.push(
      { text: `Dear diary, today was a chill day with ${o}. I mostly just vibed and thought about snacks.`, illustration: '\u{1F60C}\u{2728}\u{1F355}' },
    );
  }

  // Stat-based entries
  if (ctx.hunger < 30) {
    templates.push(
      { text: `I'm so hungry... I keep looking at the food bowl but it's empty. ${o}, please feed me soon!`, illustration: '\u{1F372}\u{1F622}\u{1F58D}\u{FE0F}' },
    );
  }
  if (ctx.happiness < 30) {
    templates.push(
      { text: `Everything feels a bit sad today. I drew a picture of me and ${o} together to cheer myself up. It's not very good but it made me smile.`, illustration: '\u{1F3A8}\u{1F496}\u{1F62D}' },
    );
  }
  if (ctx.happiness >= 80 && ctx.hunger >= 80) {
    templates.push(
      { text: `What a wonderful day! ${o} takes such good care of me. I did a little dance and sang a song about cookies.`, illustration: '\u{1F389}\u{1F36A}\u{1F3B5}' },
      { text: "Today I tried to learn a new trick! I can almost do a somersault now. Almost.", illustration: '\u{1F938}\u{2728}\u{1F605}' },
    );
  }

  // Equipped item entries
  if (ctx.equippedSkin === 'headphones') {
    templates.push(
      { text: "Dear diary, I tried on my headphones and danced ALL afternoon! The music makes everything better. I wish someone could see my moves!", illustration: '\u{1F3A7}\u{1F483}\u{1F3B6}' },
    );
  } else if (ctx.equippedSkin === 'crown') {
    templates.push(
      { text: "I wore my crown all day and pretended to be royalty. I declared it National Treat Day. Nobody listened.", illustration: '\u{1F451}\u{1F36C}\u{1F4DC}' },
    );
  }

  // Adventure entries
  if (ctx.activeAdventureZone) {
    templates.push(
      { text: `I'm on an adventure to ${ctx.activeAdventureZone}! It's scary but exciting. I packed extra snacks just in case.`, illustration: '\u{1F30D}\u{1F392}\u{1F355}' },
    );
  }

  // Night-specific dreamy entries
  if (time === 'night') {
    templates.push(
      { text: "I had the most amazing dream! I was flying over sparkling mountains and everything was made of candy. Then I woke up and it was just my pillow.", illustration: '\u{1F4AB}\u{1F36D}\u{2601}\u{FE0F}' },
      { text: "Dear diary, I dreamed I could talk to butterflies. They told me secrets about the clouds. I wish I could remember what they said...", illustration: '\u{1F98B}\u{2601}\u{FE0F}\u{1F4AD}' },
    );
  }

  // Trait-based entries
  if (traits.playful > 60) {
    templates.push(
      { text: "I invented a new game today! It's called 'spin until dizzy then try to walk straight.' My high score is 3 spins!", illustration: '\u{1F300}\u{1F4AB}\u{1F602}' },
    );
  }
  if (traits.foodie > 60) {
    templates.push(
      { text: "Dear diary, I've been planning my ideal menu. Breakfast: treats. Lunch: more treats. Dinner: fancy treats with garnish.", illustration: '\u{1F37D}\u{FE0F}\u{1F36A}\u{2728}' },
    );
  }

  // Pick a random entry from templates
  const entry = pick(templates);
  return entry;
}

// ── Care action dialogue responses ──

export function getActionDialogue(action: string, traits: PersonalityTraits, ownerName?: string): string {
  const o = ownerName || 'friend';
  const responses: Record<string, string[]> = {
    fed: [
      'Yummy! That was delicious!',
      `Thank you, ${o}! I was getting hungry~`,
      "Mmm! You know exactly what I like.",
      'My tummy is so happy right now!',
      "Best. Meal. Ever! ...okay I say that every time.",
      ...(traits.foodie > 50 ? [
        `FOOD! My favorite thing! After you, ${o}.`,
        "Chef's kiss! You're amazing!",
      ] : []),
    ],
    played: [
      "That was SO fun! Again! Again!",
      `Hehe, I love playing with you, ${o}!`,
      "Best playtime ever!",
      "I'm a little tired now but that was worth it!",
      ...(traits.playful > 50 ? [
        "WOOHOO! Let's go again!",
        "I could play forever!",
      ] : []),
    ],
    rested: [
      'Ahh, that was a nice rest~',
      "I feel so refreshed!",
      "Zzz... huh? Oh, that was a good nap!",
      `So cozy, ${o}... I could stay like this forever.`,
      ...(traits.sleepy > 50 ? [
        "The BEST nap. No notes.",
        "Five more minutes... just kidding. I'm good!",
      ] : []),
    ],
    reflected: [
      `Thanks for talking with me, ${o}. I feel better.`,
      "That was nice... I like when we chat.",
      `${o}, you always know what to say~`,
      "I feel so understood right now.",
      ...(traits.social > 50 ? [
        "I love our deep conversations!",
        `Let's talk again soon, ${o}, okay?`,
      ] : []),
    ],
  };

  const pool = responses[action] ?? responses.fed;
  return pick(pool);
}

// ── Persistence ──

const PERSISTED_KEYS = ['traits', 'memories', 'diaryEntries', 'lastGreetingDate'] as const;

function savePersonalityState(state: PersonalityState) {
  const data: Record<string, any> = {};
  for (const key of PERSISTED_KEYS) {
    data[key] = state[key];
  }
  AsyncStorage.setItem(PERSONALITY_STORAGE_KEY, JSON.stringify(data)).catch(() => {});
}

// ── Store ──

export const usePersonalityStore = create<PersonalityStore>((set, get) => ({
  traits: { playful: 20, foodie: 20, sleepy: 20, adventurous: 20, social: 20 },
  memories: [],
  diaryEntries: [],
  lastDialogueAt: 0,
  lastIdleDialogueAt: 0,
  lastGreetingDate: '',
  currentDialogue: null,
  touchInteractionCooldownAt: 0,

  updateTraits: (action: string, amount = 3) => {
    const { traits } = get();
    const traitMap: Record<string, keyof PersonalityTraits> = {
      fed: 'foodie',
      feed: 'foodie',
      played: 'playful',
      play: 'playful',
      rested: 'sleepy',
      rest: 'sleepy',
      reflected: 'social',
      reflect: 'social',
      adventure_start: 'adventurous',
      adventure_complete: 'adventurous',
    };
    const trait = traitMap[action];
    if (!trait) return;

    const updated = {
      ...traits,
      [trait]: Math.min(100, traits[trait] + amount),
    };

    // Slight decay on other traits (keeps personality dynamic)
    for (const key of Object.keys(updated) as (keyof PersonalityTraits)[]) {
      if (key !== trait) {
        updated[key] = Math.max(0, updated[key] - 0.5);
      }
    }

    set({ traits: updated });
    savePersonalityState(get());
  },

  recordMemory: (type: MemoryType, detail?: string) => {
    const { memories } = get();
    const memory: PetMemory = { type, timestamp: Date.now(), detail };
    const updated = [memory, ...memories].slice(0, 20); // keep last 20
    set({ memories: updated });
    savePersonalityState(get());
  },

  generateDialogue: (ctx: DialogueContext) => {
    const { traits, memories, lastDialogueAt, lastGreetingDate } = get();
    const now = Date.now();

    // Don't generate too frequently (min 8 seconds between dialogue changes)
    if (now - lastDialogueAt < 8000) return get().currentDialogue;

    const today = new Date().toISOString().slice(0, 10);
    const isFirstOpenToday = lastGreetingDate !== today;
    const fullCtx = { ...ctx, isFirstOpenToday };

    const lines = generateDialogueLines(fullCtx, traits, memories);
    if (lines.length === 0) return null;

    // Weight selection by priority
    const totalPriority = lines.reduce((sum, l) => sum + l.priority, 0);
    let roll = Math.random() * totalPriority;
    let selected = lines[0];
    for (const line of lines) {
      roll -= line.priority;
      if (roll <= 0) {
        selected = line;
        break;
      }
    }

    if (isFirstOpenToday) {
      set({ lastGreetingDate: today });
    }
    set({ lastDialogueAt: now, currentDialogue: selected.text });
    savePersonalityState(get());
    return selected.text;
  },

  generateIdleDialogue: (ctx: DialogueContext) => {
    const { traits, lastIdleDialogueAt } = get();
    const now = Date.now();

    // Min 30 seconds between idle dialogue
    if (now - lastIdleDialogueAt < 30000) return null;

    const lines = generateIdleLines(ctx, traits);
    const selected = pick(lines);

    set({ lastIdleDialogueAt: now, currentDialogue: selected.text });
    return selected.text;
  },

  generateDiaryEntry: (ctx: DiaryContext) => {
    const { traits, memories, diaryEntries } = get();
    const today = new Date().toISOString().slice(0, 10);
    const time = getTimeOfDay();

    // Don't generate more than 2 entries per day
    const todayEntries = diaryEntries.filter(e => e.date === today);
    if (todayEntries.length >= 2) return;

    const { text, illustration } = generateDiaryText(ctx, traits, memories);

    const entry: DiaryEntry = {
      id: `diary_${Date.now()}`,
      date: today,
      timeOfDay: time,
      text,
      mood: ctx.mood,
      illustration,
      statsSnapshot: { hunger: ctx.hunger, happiness: ctx.happiness, energy: ctx.energy },
      read: false,
    };

    // Keep max 7 entries
    const updated = [entry, ...diaryEntries].slice(0, 7);
    set({ diaryEntries: updated });
    savePersonalityState(get());
  },

  markDiaryRead: () => {
    const { diaryEntries } = get();
    const updated = diaryEntries.map(e => ({ ...e, read: true }));
    set({ diaryEntries: updated });
    savePersonalityState(get());
  },

  setCurrentDialogue: (text: string | null) => {
    set({ currentDialogue: text, lastDialogueAt: Date.now() });
  },

  setTouchCooldown: () => {
    set({ touchInteractionCooldownAt: Date.now() });
  },

  canTouch: () => {
    return Date.now() - get().touchInteractionCooldownAt >= 10000;
  },

  getUnreadDiaryCount: () => {
    return get().diaryEntries.filter(e => !e.read).length;
  },

  hydratePersonality: async () => {
    try {
      const raw = await AsyncStorage.getItem(PERSONALITY_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const patch: Record<string, any> = {};
      for (const key of PERSISTED_KEYS) {
        if (data[key] !== undefined) {
          patch[key] = data[key];
        }
      }
      set(patch);
    } catch {}
  },
}));

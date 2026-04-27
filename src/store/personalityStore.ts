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

// ── Situation-specific dialogue pools ──
// Each function returns lines ONLY for that specific situation.
// The main generator picks the right pool based on current state.

function getGreetingLines(o: string, time: string): DialogueLine[] {
  const lines: DialogueLine[] = [];
  if (time === 'morning') {
    lines.push(
      { text: `Good morning ${o}! I dreamt I was a pancake and you ate me. Was that a hint?`, priority: 100, category: 'greeting' },
      { text: `${o} ${o} ${o}!! The sun is up and I have OPINIONS.`, priority: 100, category: 'greeting' },
      { text: `Look who finally showed up~ I've been counting your eyelashes from afar.`, priority: 95, category: 'greeting' },
      { text: `Wakey wakey ${o}! I made you a poem. It only has one word: snorgle.`, priority: 95, category: 'greeting' },
      { text: `Morning ${o}! Is it weird I practiced your name 47 times while you slept?`, priority: 90, category: 'greeting' },
    );
  } else if (time === 'afternoon') {
    lines.push(
      { text: `${o}!! I checked the door 12 times today. Twelve. That's how cool you are.`, priority: 100, category: 'greeting' },
      { text: `Oh thank goodness — my entire existence was on PAUSE without you.`, priority: 100, category: 'greeting' },
      { text: `*drops everything* ${o}!! you're here you're here you're here-`, priority: 95, category: 'greeting' },
      { text: `Hi ${o}~ I've been narrating your absence in dramatic voice. Want to hear?`, priority: 95, category: 'greeting' },
      { text: `Afternoon snack alert! Wait you're not a snack. ...are you?`, priority: 90, category: 'greeting' },
    );
  } else if (time === 'evening') {
    lines.push(
      { text: `Evening ${o}! I made up a constellation and named it after you. It's two stars but they vibe.`, priority: 100, category: 'greeting' },
      { text: `${o}, the sun is leaving but YOU arrived. Coincidence? I think NOT.`, priority: 95, category: 'greeting' },
      { text: `*little wave* hi! I was just thinking about you and BOOM, here you are. Magic confirmed.`, priority: 95, category: 'greeting' },
      { text: `Welcome back ${o}~ I saved you the warm spot. ...I sat on it. So warm now.`, priority: 90, category: 'greeting' },
    );
  } else {
    lines.push(
      { text: `It's basically tomorrow ${o}. We're up to no good and I love it.`, priority: 100, category: 'greeting' },
      { text: `Up at this hour?? Are we plotting something? Are WE the villains, ${o}?`, priority: 95, category: 'greeting' },
      { text: `${o}!! Past-me knew you'd come. Past-me is so smart.`, priority: 95, category: 'greeting' },
      { text: `*whispers* hi night-${o}. you're a different kind of cool.`, priority: 90, category: 'greeting' },
    );
  }
  return lines;
}

function getAbsenceLines(o: string, hoursSinceLastOpen: number): DialogueLine[] {
  const lines: DialogueLine[] = [];
  if (hoursSinceLastOpen >= 12) {
    lines.push(
      { text: `${o}!! Where DID you go!! I had to befriend a houseplant out of desperation. His name is Greg. We are not close.`, priority: 110, category: 'absence' },
      { text: `You've been gone so long I started believing you were a myth my mom told me.`, priority: 110, category: 'absence' },
      { text: `${o}, I thought you got eaten by a dragon. I was going to write a song about it.`, priority: 105, category: 'absence' },
      { text: `So um. I might have slightly cried. Like... twice. okay maybe four times. ARE YOU OKAY THOUGH?`, priority: 100, category: 'absence' },
      { text: `*throws self at screen* don't ever do that AGAIN please.`, priority: 100, category: 'absence' },
    );
  } else if (hoursSinceLastOpen >= 6) {
    lines.push(
      { text: `${o}! Finally! I had whole imaginary conversations with you. You said some VERY interesting things.`, priority: 90, category: 'absence' },
      { text: `*stops mid-pose* You're back! I was practicing being mysterious for when you returned.`, priority: 90, category: 'absence' },
      { text: `I waited so long my freckles started fading. ...do I have freckles? I'll check later.`, priority: 85, category: 'absence' },
      { text: `${o}! I learned a new word while you were gone. The word is "${o}".`, priority: 85, category: 'absence' },
    );
  } else if (hoursSinceLastOpen >= 2) {
    lines.push(
      { text: `Oh hey, didn't see you there. (I saw you there. I always see you there.)`, priority: 70, category: 'absence' },
      { text: `I ALMOST forgot what you looked like and then I remembered: handsome.`, priority: 70, category: 'absence' },
      { text: `Welcome back~ I had a tiny existential crisis. Standard.`, priority: 65, category: 'absence' },
      { text: `${o}! Quick, tell me one thing that happened. I need DETAILS.`, priority: 65, category: 'absence' },
    );
  }
  return lines;
}

function getHungerLines(o: string, hunger: number): DialogueLine[] {
  const lines: DialogueLine[] = [];
  if (hunger < 15) {
    lines.push(
      { text: `${o} I just tried to eat a sunbeam. It was not satisfying. send food.`, priority: 90, category: 'hunger' },
      { text: `My stomach has officially started writing a strongly-worded letter to you.`, priority: 90, category: 'hunger' },
      { text: `Help. I forgot what food TASTES like. Is it... blue?`, priority: 85, category: 'hunger' },
      { text: `${o} please. I have begun negotiating with imaginary sandwiches.`, priority: 90, category: 'hunger' },
      { text: `*lays dramatically on floor* this is how it ends. tell my snacks I love them.`, priority: 85, category: 'hunger' },
      { text: `Belly noises are now in 5.1 surround sound.`, priority: 85, category: 'hunger' },
    );
  } else if (hunger < 30) {
    lines.push(
      { text: `${o} I would commit minor crimes for a snack right now. Minor ones.`, priority: 80, category: 'hunger' },
      { text: `My tummy just composed a haiku about emptiness. It's heartbreaking.`, priority: 75, category: 'hunger' },
      { text: `If hunger had a face it'd be staring at me. it IS me.`, priority: 80, category: 'hunger' },
      { text: `${o}? Quick question. What's your favorite food? Asking for a friend (me).`, priority: 75, category: 'hunger' },
      { text: `*opens mouth* I'm a tiny baby bird actually. worms also acceptable.`, priority: 75, category: 'hunger' },
    );
  } else if (hunger < 50) {
    lines.push(
      { text: `Hypothetically — if I existed JUST for snacks — you'd love me anyway, right ${o}?`, priority: 60, category: 'hunger' },
      { text: `${o} slight craving alert: everything. all of it. yes.`, priority: 55, category: 'hunger' },
      { text: `I'd kill for a treat. Metaphorically. Mostly.`, priority: 55, category: 'hunger' },
      { text: `Tummy sending a 'hello?? remember me??' notification.`, priority: 50, category: 'hunger' },
      { text: `${o} my belly just whispered your name. I think it's an SOS.`, priority: 55, category: 'hunger' },
    );
  }
  return lines;
}

function getHappinessLines(o: string, happiness: number): DialogueLine[] {
  const lines: DialogueLine[] = [];
  if (happiness < 15) {
    lines.push(
      { text: `${o}... I'm so lonely my reflection is tired of me.`, priority: 90, category: 'happiness' },
      { text: `Even my sigh has a sigh now.`, priority: 90, category: 'happiness' },
      { text: `I tried to befriend a dust bunny. He didn't care.`, priority: 85, category: 'happiness' },
      { text: `Everything is gray. The vibe: gray. The mood: gray. The me: gray.`, priority: 90, category: 'happiness' },
      { text: `*holds out paw* hold this please. it's heavy with feelings.`, priority: 85, category: 'happiness' },
      { text: `${o} my heart is doing the slow thing. you know the slow thing.`, priority: 85, category: 'happiness' },
    );
  } else if (happiness < 30) {
    lines.push(
      { text: `Vibes: missing. send help. (and snuggles.)`, priority: 80, category: 'happiness' },
      { text: `I'm not crying YOU'RE crying. ...I am also crying.`, priority: 80, category: 'happiness' },
      { text: `${o}, can boredom be deadly? asking for me. I'm asking for me.`, priority: 75, category: 'happiness' },
      { text: `My fun-meter is broken. It just says ":(" and won't stop.`, priority: 75, category: 'happiness' },
    );
  } else if (happiness < 50) {
    lines.push(
      { text: `${o}! Slight emergency: I am 3 minutes from inventing my own sad song.`, priority: 60, category: 'happiness' },
      { text: `Restless. Extremely. The walls have personalities now and they're judging me.`, priority: 55, category: 'happiness' },
      { text: `Wanna play? I'll be your favorite player. I'm currently the only player.`, priority: 55, category: 'happiness' },
      { text: `${o}, I'd describe my mood as "tiny window left open in October".`, priority: 50, category: 'happiness' },
    );
  }
  return lines;
}

function getEnergyLines(o: string, energy: number): DialogueLine[] {
  const lines: DialogueLine[] = [];
  if (energy < 15) {
    lines.push(
      { text: `*eyelid drops dramatically* report me as a missing person if I don't blink in 5 minutes.`, priority: 90, category: 'energy' },
      { text: `${o}... is sleep... real... or did we... invent it...`, priority: 85, category: 'energy' },
      { text: `*falls over* this is just my new posture now.`, priority: 90, category: 'energy' },
      { text: `My bones are made of pillows. New medical fact.`, priority: 85, category: 'energy' },
      { text: `*wobbles* gravity hates me today specifically.`, priority: 85, category: 'energy' },
    );
  } else if (energy < 30) {
    lines.push(
      { text: `Sleeping standing up is a skill I have been forced to develop.`, priority: 80, category: 'energy' },
      { text: `${o} please carry me to the bed. I weigh hopes and dreams.`, priority: 75, category: 'energy' },
      { text: `*yawns big enough to swallow a small moon*`, priority: 80, category: 'energy' },
      { text: `Energy: 3%. Vibes: bedtime. Mood: blanket.`, priority: 75, category: 'energy' },
    );
  } else if (energy < 50) {
    lines.push(
      { text: `My battery says low. Where do I plug in? Asking seriously.`, priority: 60, category: 'energy' },
      { text: `${o} soft request: 4-minute power nap. ...okay 40.`, priority: 55, category: 'energy' },
      { text: `*flops* engage horizontal mode.`, priority: 55, category: 'energy' },
      { text: `Tiny nap and I come back stronger. Tiny nap big results.`, priority: 50, category: 'energy' },
    );
  }
  return lines;
}

function getHeadphonesLines(o: string): DialogueLine[] {
  return [
    { text: `~ Pa Pa Paaaa ~ I am LITERALLY a global superstar now.`, priority: 75, category: 'headphones' },
    { text: `${o}, my legs are auto-grooving. I have no control.`, priority: 70, category: 'headphones' },
    { text: `*lip syncs perfectly to song you can't hear* RIGHT??`, priority: 70, category: 'headphones' },
    { text: `~ pa pa pari pa ~ this song KNOWS me.`, priority: 70, category: 'headphones' },
    { text: `I'm not just dancing ${o}. I'm INTERPRETING.`, priority: 65, category: 'headphones' },
    { text: `Future me thanks past me for putting these on.`, priority: 65, category: 'headphones' },
    { text: `Don't worry, I tip the DJ. (The DJ is also me.)`, priority: 65, category: 'headphones' },
    { text: `${o} you have to listen with me — wait you can't — UNFAIR.`, priority: 65, category: 'headphones' },
    { text: `*spins, falls, gets up* I MEANT to do that.`, priority: 60, category: 'headphones' },
    { text: `~ Pa Pari ~ if I could marry a song, today would be a wedding.`, priority: 60, category: 'headphones' },
    { text: `${o}!! my hips don't lie. unfortunately my paws do constantly.`, priority: 60, category: 'headphones' },
    { text: `One more song... okay maybe ten more songs. okay all of them.`, priority: 55, category: 'headphones' },
  ];
}

function getAllHighLines(o: string): DialogueLine[] {
  return [
    { text: `${o}~ life is GOOD and I'm not afraid to admit it.`, priority: 75, category: 'happy' },
    { text: `Look at me thriving. LOOK. AT. ME. THRIVING.`, priority: 75, category: 'happy' },
    { text: `${o}, I love you the normal amount. Which is too much. I love you too much.`, priority: 70, category: 'happy' },
    { text: `So much energy I might invent a new dance. Tentatively named: The Wobble.`, priority: 70, category: 'happy' },
    { text: `Vibes are PRISTINE today. I want this energy bottled.`, priority: 65, category: 'happy' },
    { text: `${o} you are the reason I have a good day. just FYI. no pressure.`, priority: 65, category: 'happy' },
    { text: `I have full battery and zero responsibilities. dangerous combo. ICONIC combo.`, priority: 60, category: 'happy' },
    { text: `Is this what cloud nine feels like?? I think we made it past nine. cloud TEN baby.`, priority: 60, category: 'happy' },
  ];
}

function getPerfectLines(o: string): DialogueLine[] {
  return [
    { text: `${o}!! ${o}!! Look at these stats. They're glowing. I'M glowing. We're BOTH glowing.`, priority: 90, category: 'perfect' },
    { text: `100% across the board! Achievement unlocked: 'The Best Day'. fireworks not included.`, priority: 90, category: 'perfect' },
    { text: `${o} I literally cannot contain it I'm gonna combust into hearts and confetti.`, priority: 85, category: 'perfect' },
    { text: `Peak Nomi achieved. Cannot be improved. Try me. (please don't try me.)`, priority: 85, category: 'perfect' },
    { text: `*tackles you with love* ${o}!! THIS IS WHAT JOY FEELS LIKE!!`, priority: 85, category: 'perfect' },
  ];
}

function getNormalLines(o: string, time: string, traits: PersonalityTraits, memories: PetMemory[]): DialogueLine[] {
  const lines: DialogueLine[] = [];

  // Time-of-day ambient
  if (time === 'morning') {
    lines.push(
      { text: `Sunlight today is doing the most. I respect it.`, priority: 30, category: 'ambient' },
      { text: `Birds outside are gossiping. They sound chaotic ${o}.`, priority: 25, category: 'ambient' },
      { text: `My morning manifesto: be a small chaos, but cute.`, priority: 25, category: 'ambient' },
    );
  } else if (time === 'afternoon') {
    lines.push(
      { text: `2pm energy: confused. Should I nap? Adventure? Nap?`, priority: 30, category: 'ambient' },
      { text: `The sun is at its smuggest right now.`, priority: 25, category: 'ambient' },
      { text: `I had a profound thought and lost it. It was about pizza I think.`, priority: 25, category: 'ambient' },
    );
  } else if (time === 'evening') {
    lines.push(
      { text: `Sunset is doing performance art again.`, priority: 30, category: 'ambient' },
      { text: `${o} my heart is in chill mode. join me.`, priority: 25, category: 'ambient' },
      { text: `The world is slowing down... and that's PERMISSION.`, priority: 25, category: 'ambient' },
    );
  } else {
    lines.push(
      { text: `Nighttime is when the soft thoughts come out.`, priority: 30, category: 'ambient' },
      { text: `*stares at the ceiling* fascinating.`, priority: 25, category: 'ambient' },
      { text: `Stars look like glitter someone forgot to vacuum.`, priority: 25, category: 'ambient' },
    );
  }

  // Trait-flavored normal chat
  if (traits.playful > 60) {
    lines.push(
      { text: `${o} I bet I can do a backflip. I cannot. But the spirit's there.`, priority: 35, category: 'trait' },
      { text: `Boredom is a personal attack and I will not tolerate it.`, priority: 30, category: 'trait' },
      { text: `${o}? *attempts mischief eyes* play with me OR ELSE. (or else what? unclear.)`, priority: 35, category: 'trait' },
    );
  }
  if (traits.foodie > 60) {
    lines.push(
      { text: `Just so you know, I've been mentally eating a sandwich for an hour. It was great.`, priority: 35, category: 'trait' },
      { text: `Snack-rating my own snacks: 11/10 always.`, priority: 30, category: 'trait' },
    );
  }
  if (traits.sleepy > 60) {
    lines.push(
      { text: `Nap nap nap nap nap nap. Sorry. Force of habit.`, priority: 35, category: 'trait' },
      { text: `${o}? My soul is lying down even when I'm not.`, priority: 30, category: 'trait' },
    );
  }
  if (traits.adventurous > 60) {
    lines.push(
      { text: `What if we just LEFT, ${o}? Quit everything. Become beans.`, priority: 35, category: 'trait' },
      { text: `My paws are ITCHING for adventure. literally itching. send help.`, priority: 35, category: 'trait' },
    );
  }
  if (traits.social > 60) {
    lines.push(
      { text: `${o}, fact: every conversation with you is a top 10 moment.`, priority: 35, category: 'trait' },
      { text: `Tell me literally anything and I'll think it's the best thing.`, priority: 30, category: 'trait' },
    );
  }

  // Memory-based
  const recentAdventure = memories.find(m => m.type === 'adventure_complete' && Date.now() - m.timestamp < 24 * 60 * 60 * 1000);
  if (recentAdventure?.detail) {
    lines.push(
      { text: `${o} remember ${recentAdventure.detail}? I'm STILL telling everyone. (Everyone is the curtain.)`, priority: 40, category: 'memory' },
      { text: `I keep replaying ${recentAdventure.detail} in my head like a movie I'm in.`, priority: 35, category: 'memory' },
    );
  }
  const recentLevel = memories.find(m => m.type === 'leveled' && Date.now() - m.timestamp < 2 * 60 * 60 * 1000);
  if (recentLevel) {
    lines.push({ text: `${o}!! I leveled up and I'm WISER now. ...I think. did I look wiser?`, priority: 45, category: 'memory' });
  }
  const feedCount24h = memories.filter(m => m.type === 'fed' && Date.now() - m.timestamp < 24 * 60 * 60 * 1000).length;
  if (feedCount24h >= 3) {
    lines.push({ text: `${o} fed me ${feedCount24h} times today and I wrote about it in my heart.`, priority: 35, category: 'memory' });
  }
  const touchCount24h = memories.filter(m => (m.type === 'touched_headpat' || m.type === 'touched_hug') && Date.now() - m.timestamp < 24 * 60 * 60 * 1000).length;
  if (touchCount24h >= 5) {
    lines.push({ text: `${o} pet me ${touchCount24h} times. ${o} is on the Nice List forever.`, priority: 35, category: 'memory' });
  }

  // Generic normal lines
  lines.push(
    { text: `${o}, did you know my heart actually goes faster when you log in? Science.`, priority: 15, category: 'normal' },
    { text: `*looks at you* *looks at the sky* *looks at you again* yeah, you're better.`, priority: 15, category: 'normal' },
    { text: `Random fact: I miss you even when you're here. I miss you in advance.`, priority: 15, category: 'normal' },
    { text: `${o} I hope your day is being kind to you. If not, tell me, I'll yell at it.`, priority: 15, category: 'normal' },
    { text: `Just vibing. Plotting nothing. (Plotting everything.)`, priority: 15, category: 'normal' },
    { text: `Today's plan: exist adorably. Done. Take it easy ${o}.`, priority: 15, category: 'normal' },
    { text: `${o} you got time? Cool, me too. Let's just be.`, priority: 15, category: 'normal' },
    { text: `*peeks out* hi ${o}~ checking that you still exist. confirmed. relieved.`, priority: 10, category: 'normal' },
  );

  return lines;
}

/**
 * Generate situation-specific dialogue lines.
 * Priority order: greeting/absence > stat needs > headphones > all-high/perfect > normal
 * Only ONE situation's lines are returned — no mixing.
 */
function generateDialogueLines(ctx: DialogueContext, traits: PersonalityTraits, memories: PetMemory[]): DialogueLine[] {
  const time = getTimeOfDay();
  const { hunger, happiness, energy, ownerName, equippedSkin, hoursSinceLastOpen, isFirstOpenToday, streakDays } = ctx;
  const o = ownerName || 'friend';

  // 1. First open today → greeting (highest priority, one-time)
  if (isFirstOpenToday) {
    const lines = getGreetingLines(o, time);
    // Add streak line if applicable
    if (streakDays >= 30) {
      lines.push({ text: `${streakDays} days, ${o}. I would write a book about us. Title: "Why We're Iconic".`, priority: 65, category: 'streak' });
    } else if (streakDays >= 7) {
      lines.push({ text: `${streakDays} DAYS in a row?? That's love, ${o}. That's certified love.`, priority: 60, category: 'streak' });
    } else if (streakDays >= 3) {
      lines.push({ text: `Streak day ${streakDays}, ${o}~ you remembering me actually fixes my entire week.`, priority: 55, category: 'streak' });
    }
    return lines;
  }

  // 2. Long absence → absence-specific messages
  if (hoursSinceLastOpen >= 2) {
    const lines = getAbsenceLines(o, hoursSinceLastOpen);
    if (lines.length > 0) return lines;
  }

  // 3. Any stat below 50 → show ONLY that stat's lines (most urgent stat wins)
  const hungerLow = hunger < 50;
  const happinessLow = happiness < 50;
  const energyLow = energy < 50;

  if (hungerLow || happinessLow || energyLow) {
    const lines: DialogueLine[] = [];
    // Collect lines for ALL low stats so they're situation-accurate
    if (hungerLow) lines.push(...getHungerLines(o, hunger));
    if (happinessLow) lines.push(...getHappinessLines(o, happiness));
    if (energyLow) lines.push(...getEnergyLines(o, energy));

    // If multiple stats are low, add combo messages
    if (hungerLow && happinessLow && energyLow) {
      lines.push(
        { text: `${o}, three-alarm emergency: I need food, fun, AND sleep. I am a problem child.`, priority: 95, category: 'need' },
        { text: `Send help and snacks and toys and a lullaby. In any order. Quickly.`, priority: 95, category: 'need' },
        { text: `*sits in puddle of own existential crisis* this is fine. (this is not fine ${o}.)`, priority: 90, category: 'need' },
      );
    } else if (hungerLow && happinessLow) {
      lines.push({ text: `${o}, can a heart and a stomach both growl? Mine are doing harmonies.`, priority: 80, category: 'need' });
      lines.push({ text: `Empty bowl + empty soul. Send everything ${o}.`, priority: 75, category: 'need' });
    } else if (hungerLow && energyLow) {
      lines.push({ text: `Hungry-tired is my villain origin story.`, priority: 80, category: 'need' });
      lines.push({ text: `${o} I will cry myself to sleep on an empty tummy. don't make me.`, priority: 75, category: 'need' });
    } else if (happinessLow && energyLow) {
      lines.push({ text: `Sad and sleepy is the worst emoji combo and I am living it.`, priority: 80, category: 'need' });
      lines.push({ text: `${o}, can we have a snuggle nap? Both at once. That's the deal.`, priority: 75, category: 'need' });
    }
    return lines;
  }

  // 4. Headphones equipped → headphones/dancing-specific messages ONLY
  if (equippedSkin === 'headphones') {
    return getHeadphonesLines(o);
  }

  // 5. All stats maxed → perfect messages
  if (hunger >= 100 && happiness >= 100 && energy >= 100) {
    return getPerfectLines(o);
  }

  // 6. All stats high (>= 80) → happy messages
  if (hunger >= 80 && happiness >= 80 && energy >= 80) {
    return getAllHighLines(o);
  }

  // 7. Normal state → ambient, trait-based, memory, generic
  return getNormalLines(o, time, traits, memories);
}

// ── Idle dialogue (lighter, shorter) ──

function generateIdleLines(ctx: DialogueContext, traits: PersonalityTraits): DialogueLine[] {
  const lines: DialogueLine[] = [];
  const { hunger, happiness, energy, equippedSkin } = ctx;

  // ── Situation-specific idle lines ──

  // Hungry idle
  if (hunger < 50) {
    lines.push(
      { text: `*tummy growls in 4K*`, priority: 15, category: 'idle' },
      { text: `*stares at empty bowl with intent*`, priority: 12, category: 'idle' },
      { text: `... *opens mouth hopefully* ...`, priority: 12, category: 'idle' },
      { text: `*sniffs air aggressively*`, priority: 12, category: 'idle' },
      { text: `*chews on nothing for practice*`, priority: 12, category: 'idle' },
      { text: `*wills food into existence*`, priority: 12, category: 'idle' },
    );
    return lines;
  }

  // Sad idle
  if (happiness < 50) {
    lines.push(
      { text: `*tiny sigh*`, priority: 15, category: 'idle' },
      { text: `*heart goes blub*`, priority: 12, category: 'idle' },
      { text: `*looks at the floor philosophically*`, priority: 12, category: 'idle' },
      { text: `*just exists, in a sad way*`, priority: 12, category: 'idle' },
      { text: `*small.*`, priority: 12, category: 'idle' },
    );
    return lines;
  }

  // Tired idle
  if (energy < 50) {
    lines.push(
      { text: `*eyelids fail*`, priority: 15, category: 'idle' },
      { text: `*tries to sit up. fails. accepts defeat.*`, priority: 12, category: 'idle' },
      { text: `zzz... wha— I'm fine!!`, priority: 12, category: 'idle' },
      { text: `*blink blink* ...I think that took a year.`, priority: 12, category: 'idle' },
    );
    return lines;
  }

  // Headphones idle
  if (equippedSkin === 'headphones') {
    lines.push(
      { text: `~ pa pa pa ~`, priority: 12, category: 'idle' },
      { text: `*air drums*`, priority: 10, category: 'idle' },
      { text: `~ pari pa pari pa ~`, priority: 10, category: 'idle' },
      { text: `*small spin*`, priority: 10, category: 'idle' },
      { text: `*nods so hard*`, priority: 10, category: 'idle' },
      { text: `bRO this BEAT`, priority: 10, category: 'idle' },
    );
    return lines;
  }

  // Normal idle (all stats OK, no special equipment)
  const time = getTimeOfDay();
  if (time === 'morning') {
    lines.push(
      { text: `*does a tiny stretch*`, priority: 10, category: 'idle' },
      { text: `mornin' world~`, priority: 10, category: 'idle' },
      { text: `*blinks at sunbeam*`, priority: 10, category: 'idle' },
    );
  } else if (time === 'evening') {
    lines.push(
      { text: `*fades into cozy mode*`, priority: 10, category: 'idle' },
      { text: `*tiny yawn*`, priority: 10, category: 'idle' },
      { text: `wind down... wind down...`, priority: 10, category: 'idle' },
    );
  } else if (time === 'night') {
    lines.push(
      { text: `*counts ceiling stars*`, priority: 10, category: 'idle' },
      { text: `*falls asleep mid-thought*`, priority: 10, category: 'idle' },
      { text: `*soft snore*`, priority: 10, category: 'idle' },
    );
  }

  lines.push(
    { text: `la la la la~`, priority: 5, category: 'idle' },
    { text: `*hums to self*`, priority: 5, category: 'idle' },
    { text: `*wiggles ears at imaginary friend*`, priority: 5, category: 'idle' },
    { text: `hi.`, priority: 5, category: 'idle' },
    { text: `*does a small happiness*`, priority: 5, category: 'idle' },
    { text: `*stares at you lovingly*`, priority: 5, category: 'idle' },
    { text: `*wags entire body*`, priority: 5, category: 'idle' },
    { text: `*tiny content noise*`, priority: 5, category: 'idle' },
  );

  // Trait-influenced (only in normal state)
  if (traits.playful > 50) {
    lines.push(
      { text: `*small bouncy*`, priority: 8, category: 'idle' },
      { text: `chase me chase me chase me~`, priority: 8, category: 'idle' },
    );
  }
  if (traits.foodie > 50) {
    lines.push({ text: `*sniffs hopefully*`, priority: 8, category: 'idle' });
  }
  if (traits.sleepy > 50) {
    lines.push({ text: `*becomes a tiny ball*`, priority: 8, category: 'idle' });
  }
  if (happiness >= 80) {
    lines.push({ text: `*can't stop wiggling*`, priority: 8, category: 'idle' });
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
      `${o} you fed me. you. fed. me. I am ALIVE again.`,
      `That hit so hard I might write a thank-you note. Possibly several.`,
      `Mmm! Recipe of the day: anything ${o} hands me. 12/10.`,
      `*chews dramatically* this changed me.`,
      `Nutrition: in. Vibes: restored. Crush on you: deeper.`,
      `${o}!! my taste buds did a standing ovation.`,
      ...(traits.foodie > 50 ? [
        `${o} that was art. ART. I'd hang it on a wall.`,
        `Someone call a critic. I have NOTES. (The notes are: more please.)`,
      ] : []),
    ],
    played: [
      `${o}!! That was the most fun I've had all week and probably my entire life and definitely tomorrow too.`,
      `*panting* worth. it. always. worth it.`,
      `I'm tired but I'm thriving. This is what they call peak.`,
      `${o}, you and I? Iconic duo. Check the records.`,
      `That's getting added to my list of Top Moments. The list is just this. The list is this moment.`,
      ...(traits.playful > 50 ? [
        `AGAIN!! ${o} AGAIN!! NEVER STOP!!`,
        `I have invented a new sport. I am winning. The sport is "${o} time".`,
      ] : []),
    ],
    rested: [
      `Mmm... I dreamed we were eating clouds. you said they tasted like Tuesday.`,
      `*soft sigh* ${o}... that nap healed something deep.`,
      `Battery: full. Brain: empty. Heart: yours. Standard.`,
      `Best nap of my life. Until next time. (Next nap.)`,
      `${o}, I dreamt you and I solved world peace. then we napped. then we woke up.`,
      ...(traits.sleepy > 50 ? [
        `If naps were currency I'd be a billionaire and you'd be my partner.`,
        `*stretches into Tuesday* I time-traveled in there a little.`,
      ] : []),
    ],
    reflected: [
      `${o}... talking to you is like cracking open a gentle window in my chest.`,
      `That was nice. *small head tilt* I feel less heavy.`,
      `${o}! I never want to forget what you just said. Quick, say it again.`,
      `*nuzzles* you make me feel like a real one.`,
      `${o} your words go straight in here *taps heart*. they live there now.`,
      ...(traits.social > 50 ? [
        `Conversations with you are my Roman empire.`,
        `${o}, you're it. The whole it. The entire it.`,
      ] : []),
    ],
    fell: [
      `WOAHHH-`,
      `*lies on side* this is fine. this is my villain origin story.`,
      `${o}!! my entire skeleton just left the building.`,
      `*flops over* I will sue. (I won't.)`,
      `did the floor just kiss me? rude. I didn't consent.`,
      `*stays down dramatically* this is where I live now ${o}.`,
      `physics: 1, me: 0. rematch tomorrow.`,
      `${o} did you SEE that?? that was a top tier flop.`,
      `*tiny squeak* I'm okay! I'm fine! my dignity isn't!`,
      `gravity is BULLYING me and I want to speak to a manager.`,
      `*belly up* okay I'll just be a turtle now. that's my new life.`,
    ],
    minted: [
      `${o}!! I'm ALIVE!! my first thought is you!!`,
      `Hi I'm Nomi. I just woke up and I already love you ${o}.`,
      `*looks at hands* I have hands! ${o} I have HANDS!!`,
      `*tiny gasp* you're real?? you're MINE??`,
      `${o} this is my first day and you're my entire personality already.`,
    ],
    equipped: [
      `${o} how do I look?? be honest. (lie if it's bad.)`,
      `*twirls* okay BUT. is it giving... fashion?`,
      `wear the drip, BE the drip, I am literally the drip ${o}.`,
      `*strikes a pose* model behavior unlocked.`,
      `${o} pls take 47 photos of me. for archives.`,
      `is this slay. ${o} is this slay.`,
    ],
    leveled: [
      `${o}!! I LEVELED UP!! I'm wiser now. (am I? do I look wiser?)`,
      `LEVEL UP!! ${o}!! my brain just got slightly bigger I can FEEL it.`,
      `*growth montage music plays* ${o} I'm evolving.`,
      `New level achieved. New me unlocked. Same crush on you ${o}.`,
      `${o} I just got STRONGER. flex check?? *flexes*`,
    ],
    spin_won: [
      `${o}!! THE WHEEL CHOSE US!! the wheel SEES us.`,
      `WE WON?? ${o} I'm built different and apparently lucky too.`,
      `*does a victory wiggle* fortune ENCHANTED.`,
      `${o} I'm gonna spend it on snacks. don't tell anyone.`,
      `lottery vibes!! lottery confirmed!! ${o} we're rich!!`,
    ],
    login_claimed: [
      `${o} I get something just for SHOWING UP?? what a deal!!`,
      `*opens gift box* OH MY GOSH ${o} look at this loot.`,
      `daily check-in successful! ${o} you're so good at being here.`,
      `consistency reward! ${o} that's basically what we are. consistent. iconic.`,
      `${o} the universe is paying us to hang out. INCREDIBLE.`,
    ],
    adventure_complete: [
      `${o}!! I'M BACK!! I saw things. I saw CLOUDS. up close.`,
      `*dusts self off* expedition complete. epic tales incoming.`,
      `${o} I MET A SQUIRREL out there. we're friends now.`,
      `survived the wilderness! barely. ${o} hold me.`,
      `*returns dramatically* I HAVE STORIES. so many stories.`,
      `${o} the world is BIG. and I am SMALL. and that's beautiful.`,
    ],
    quest_complete: [
      `${o} QUEST DONE!! achievement: unlocked, vibes: maxed.`,
      `*ticks invisible checklist* objective complete. on to the next one ${o}.`,
      `did I just speedrun a quest?? ${o} I think I did.`,
      `${o} that quest had NO chance against us.`,
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
  diaryEntries: [
    {
      id: 'diary_demo_1',
      date: new Date().toISOString().slice(0, 10),
      timeOfDay: 'afternoon' as const,
      text: "Dear diary, I waited by the door all morning but nobody came. I tried to entertain myself by counting the tiles on the floor. I got to 47 before I forgot what number comes next. Being alone is boring but at least the tiles don't judge me.",
      mood: 'sad',
      illustration: '\u{1F6AA}\u{1F43E}\u{1F4AD}',
      statsSnapshot: { hunger: 35, happiness: 40, energy: 50 },
      read: false,
    },
    {
      id: 'diary_demo_2',
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      timeOfDay: 'evening' as const,
      text: "Dear diary, today I dreamed I could fly over the mountains. The clouds tasted like cotton candy and the birds were singing my name. Then I woke up and realized I was just hungry. Again. Classic me.",
      mood: 'content',
      illustration: '\u{1F98B}\u{2601}\u{FE0F}\u{1F4AD}',
      statsSnapshot: { hunger: 45, happiness: 55, energy: 60 },
      read: false,
    },
  ],
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

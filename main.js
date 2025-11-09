const BUILD_VERSION = "0.2.0";

const GAME_CONFIG = {
  runLength: 5,
  startingSanity: 100,
  baseDrain: 1,
  tickIntervalMs: 1400,
  momentumCap: 100,
};

const rarityWeights = {
  common: 6,
  uncommon: 4,
  rare: 2,
  mythic: 0.75,
  timeless: 0.25,
};

const MOMENTUM_RATIO = 0.4;
const PASSIVE_COOL_RATE = 1.2;
const CALM_COOL_RATE = 2.8;
const ACTIVE_HEAT_RATE = 2.4;
const SURGE_HEAT_RATE = 4.2;

const SEARCH_VERBS = [
  "Sweep",
  "Harmonize",
  "Pulse",
  "Trace",
  "Amplify",
  "Coax",
  "Invert",
  "Entangle",
  "Focus",
  "Disperse",
];

const SEARCH_TOOLS = [
  "chrono brush",
  "resonator fork",
  "ghostlight filament",
  "brass familiar",
  "memory coil",
  "steam lens",
  "sand sifter",
  "auric prism",
  "echo lantern",
  "clockwork beetle",
];

const SEARCH_FOCUSES = [
  "along the glass seam",
  "beneath the drifting gears",
  "within the suspended sands",
  "at the fractured glyphs",
  "through the inner lattice",
  "around the temporal eddies",
  "near the mirrored basin",
  "over the gravity fissure",
  "by the suspended pendulums",
  "under the shadowed arch",
];

const SEARCH_SUCCESS_LINES = [
  "Sand funnels toward {artifact}, outlining its frame.",
  "A brass glow pulses in rhythm with {artifact}.",
  "Echoes converge and the form of {artifact} resolves.",
  "The chamber exhales as {artifact} surfaces from the drift.",
  "Temporal frost melts away, revealing {artifact}.",
  "Concentric ripples unveil the hidden {artifact}.",
];

const SEARCH_FAILURE_LINES = [
  "The sands snarl and scatter from your reach.",
  "A surge of static pushes your senses back.",
  "The pattern collapses, leaving only stale echoes.",
  "Pressure builds; the hourglass rejects that motion.",
  "Your approach fractures into useless vibrations.",
];

const STORY_ALIASES = [
  "Echo Runner",
  "Glass Scribe",
  "Sand Cartographer",
  "Flux Warden",
  "Paradox Courier",
];

const STORY_COMPANIONS = [
  "fractured echo",
  "brass familiar",
  "clockwork shade",
  "memory twin",
  "signal phantom",
];

const STORY_OMENS = [
  "copper storms",
  "glass avalanches",
  "magnetic rain",
  "soft chimes",
  "distant bells",
];

const STORY_DESTINATIONS = [
  "the Silent Apex",
  "the Hourwarden's Heart",
  "the Meridian Vault",
  "the Final Balcony",
  "the Stillpoint Atrium",
];

const STORY_MOTIFS = [
  "ember-lit spires",
  "rosin smoke",
  "floating glyphs",
  "auric frost",
  "drifting cogs",
];

const STORY_VERBS = ["whispers", "warns", "murmurs", "sings", "taps"];
const STORY_TEXTURES = ["glass dust", "clockwork pollen", "chronal mist", "brass filings", "suspended sparks"];
const STORY_POSITIVE_LINES = [
  "Your {companion} hums in rhythm, lending a breath of calm.",
  "{companionCap} scatters {texture}, soothing the flux.",
  "A gentle chord from {companion} steadies your breathing.",
];
const STORY_NEGATIVE_LINES = [
  "Your {companion} winces as {omen} gnaw at your focus.",
  "{companionCap} hisses about {omen} brewing in the glass.",
  "Static from {omen} rattles against your thoughts.",
];

const CORE_ARTIFACTS = [
  {
    id: "chronoLens",
    name: "Chrono Lens",
    rarity: "uncommon",
    summary: "Reveals phase-bloomed passages while taxing your focus.",
    positive: "Highlights hidden mechanisms in the current chamber.",
    negative: "The heightened perception drags at your composure, raising drain.",
    neutral: "You glimpse flickers of alternate flows overlapping the room.",
    apply: (gameState, context) => {
      context.sceneState.flags.revealedPaths = true;
      gameState.drainRate = Math.min(3.5, gameState.drainRate + 0.25);
      addLog(
        `${context.artifact.name} reveals phase-bloomed passageways within ${context.scene.name}.`,
        "positive"
      );
      addLog("The clarity is dizzying; the flux claws at your attention.", "negative");
    },
  },
  {
    id: "brassFamiliar",
    name: "Brass Familiar",
    rarity: "common",
    summary: "A mechanical sparrow that offers help while siphoning stored calm.",
    positive: "Restores a portion of sanity and provides a hint for intricate puzzles.",
    negative: "Siphons ambient calm to power its tiny gears.",
    neutral: "Its ticking harmonizes with the hourglass pulse.",
    apply: (gameState, context) => {
      adjustSanity(gameState, +8, "The familiar chirps soothingly.");
      adjustTime(gameState, -20, "The sparrow siphons the flux to power itself.");
      context.sceneState.flags.hintAvailable = true;
    },
  },
  {
    id: "temporalAnchor",
    name: "Temporal Anchor",
    rarity: "rare",
    summary: "Stabilizes the slipping present without exacting a toll.",
    positive: "Significantly slows sanity decay for the remainder of the run.",
    negative: null,
    neutral: "You feel the ground stop swaying for a precious moment.",
    apply: (gameState) => {
      gameState.drainRate = Math.max(0.35, gameState.drainRate - 0.6);
      addLog("The anchor steadies your thoughts; sanity ebbs more slowly.", "positive");
    },
  },
  {
    id: "cauterizedSand",
    name: "Cauterized Sand",
    rarity: "common",
    summary: "A fistful of glowing grains that can seal fractures or burn your resolve.",
    positive: "Bolsters your sanity and shields against the next sanity loss.",
    negative: "The scorching touch accelerates future sanity decay.",
    neutral: null,
    apply: (gameState, context) => {
      adjustSanity(gameState, +6, "The heated sand sears closed your fear.");
      gameState.drainRate = Math.min(3.5, gameState.drainRate + 0.15);
      context.sceneState.flags.sandWard = true;
      addLog("A lingering warmth coils around you; one shock may be absorbed.", "positive");
    },
  },
  {
    id: "paradoxPrism",
    name: "Paradox Prism",
    rarity: "uncommon",
    summary: "Splits flux-lines, gifting you calm while rending your composure.",
    positive: "Extends the calm with borrowed echoes.",
    negative: "Each reflection scrapes at your sanity.",
    neutral: null,
    apply: (gameState) => {
      adjustTime(gameState, +30, "Flux branches outward in shimmering arcs.");
      adjustSanity(gameState, -5, "Your thoughts echo uncomfortably.");
    },
  },
  {
    id: "mnemonicCoil",
    name: "Mnemonic Coil",
    rarity: "common",
    summary: "Stores puzzle solutions at the price of buried memories.",
    positive: "Unlocks an insight that solves complex machinery.",
    negative: "Forgets stabilizing thoughts, lowering sanity.",
    neutral: null,
    apply: (gameState, context) => {
      adjustSanity(gameState, -6, "Memories slough away to feed the coil.");
      context.sceneState.flags.autoSolve = true;
      addLog("New pathways unfold in your mind; some mechanisms seem trivial now.", "positive");
    },
  },
  {
    id: "hourwardenSigil",
    name: "Hourwarden Sigil",
    rarity: "rare",
    summary: "A keeper's emblem that commands the sands without backlash.",
    positive: "Unlocks a guaranteed escape route from one chamber.",
    negative: null,
    neutral: "The sigil vibrates with an ancient vow.",
    apply: (gameState) => {
      gameState.flags.freeEscape = true;
      addLog("The sigil hums--one barrier this run will yield without question.", "positive");
    },
  },
];

function createArtifact(definition) {
  return {
    id: definition.id,
    name: definition.name,
    rarity: definition.rarity,
    summary: definition.summary,
    positive: definition.positive,
    negative: definition.negative ?? null,
    neutral: definition.neutral ?? null,
    apply: (gameState, context) => {
      runArtifactEffects(definition.effects || [], gameState, context);
    },
  };
}

function runArtifactEffects(effects, gameState, context) {
  if (!effects || !effects.length) return;
  for (const effect of effects) {
    switch (effect.type) {
      case "sanity": {
        adjustSanity(gameState, effect.amount, effect.message);
        break;
      }
      case "momentum": {
        const amount = Math.abs(effect.amount ?? 0);
        if (!amount) break;
        if (effect.direction === "cool") {
          coolMomentum(amount);
          if (effect.message && !gameState.gameOver) {
            addLog(effect.message, effect.tone ?? "positive");
          }
        } else {
          heatMomentum(amount);
          if (effect.message && !gameState.gameOver) {
            addLog(effect.message, effect.tone ?? "negative");
          }
        }
        break;
      }
      case "drain": {
        const amount = effect.amount ?? 0;
        const floor = effect.floor ?? 0.1;
        const ceiling = effect.ceiling ?? 4;
        gameState.drainRate = Math.min(ceiling, Math.max(floor, gameState.drainRate + amount));
        if (effect.message && !gameState.gameOver) {
          addLog(effect.message, amount <= 0 ? "positive" : "negative");
        }
        break;
      }
      case "hint": {
        context.sceneState.flags.hintAvailable = true;
        if (effect.message && !gameState.gameOver) {
          addLog(effect.message, "positive");
        }
        break;
      }
      case "scanAssist": {
        gameState.flags.scanAssist = true;
        if (effect.message && !gameState.gameOver) {
          addLog(effect.message, effect.tone ?? "system");
        }
        break;
      }
      case "sceneFlag": {
        context.sceneState.flags[effect.key] = effect.value ?? true;
        if (effect.message && !gameState.gameOver) {
          addLog(effect.message, effect.tone ?? "system");
        }
        break;
      }
      case "globalFlag": {
        gameState.flags[effect.key] = effect.value ?? true;
        if (effect.message && !gameState.gameOver) {
          addLog(effect.message, effect.tone ?? "system");
        }
        break;
      }
      case "shield": {
        context.sceneState.flags.sandWard = true;
        if (effect.message && !gameState.gameOver) {
          addLog(effect.message, "positive");
        }
        break;
      }
      case "autoSolve": {
        context.sceneState.flags.autoSolve = true;
        if (effect.message && !gameState.gameOver) {
          addLog(effect.message, "positive");
        }
        break;
      }
      case "freeEscape": {
        gameState.flags.freeEscape = true;
        if (effect.message && !gameState.gameOver) {
          addLog(effect.message, "positive");
        }
        break;
      }
      case "event": {
        const state = effect.state ?? "active";
        if (state === "calm") {
          settleTemporalFlow("calm", effect.ticks ?? 3);
        } else {
          triggerTemporalEvent(state === "surge" ? "surge" : "active", {
            ticks: effect.ticks ?? 4,
            bump: effect.bump,
          });
        }
        if (effect.message && !gameState.gameOver) {
          addLog(effect.message, effect.tone ?? "system");
        }
        break;
      }
      case "settle": {
        settleTemporalFlow(effect.state ?? "calm", effect.ticks ?? 3);
        if (effect.message && !gameState.gameOver) {
          addLog(effect.message, effect.tone ?? "system");
        }
        break;
      }
      case "log": {
        if (effect.message) {
          addLog(effect.message, effect.tone ?? "system");
        }
        break;
      }
      default:
        break;
    }
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function createRng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(key) {
  return createRng(hashString(key));
}

function seededPick(rng, array) {
  if (!array.length) return null;
  const index = Math.floor(rng() * array.length) % array.length;
  return array[index];
}

function generateStoryContext(seed) {
  const rng = seededRandom(`${seed}:story`);
  const alias = seededPick(rng, STORY_ALIASES);
  const companion = seededPick(rng, STORY_COMPANIONS);
  const omen = seededPick(rng, STORY_OMENS);
  const destination = seededPick(rng, STORY_DESTINATIONS);
  const motif = seededPick(rng, STORY_MOTIFS);
  return { alias, companion, omen, destination, motif };
}

function formatStoryLine(template, extra = {}) {
  if (!template || !gameState.storyContext) return template || "";
  const { companion, omen, destination } = gameState.storyContext;
  const companionCap = companion ? companion.charAt(0).toUpperCase() + companion.slice(1) : "";
  const texture = extra.texture || seededPick(createRng(hashString(template)), STORY_TEXTURES) || "sandlight";
  return template
    .replace("{companion}", companion || "echo")
    .replace("{companionCap}", companionCap || "Echo")
    .replace("{omen}", omen || "restless sand")
    .replace("{destination}", destination || "the exit")
    .replace("{texture}", texture);
}

const EXPANDED_ARTIFACTS = [
  // Common
  createArtifact({
    id: "gildedCompass",
    name: "Gilded Compass",
    rarity: "common",
    summary: "A brass compass that locks onto micro currents within the hourglass.",
    positive: "Restores composure and pulls stray sands into orderly routes.",
    negative: "Its whining needle erodes your focus, nudging sanity drain upward.",
    neutral: "Copper filings orbit in lazy spirals around the casing.",
    effects: [
      { type: "sanity", amount: 6, message: "Breathing steadies as the compass clicks into a true bearing." },
      { type: "momentum", direction: "cool", amount: 6, message: "Stray sands collapse into a disciplined ring." },
      { type: "drain", amount: 0.1, message: "The needle's whine gnaws at your concentration." },
    ],
  }),
  createArtifact({
    id: "rustedChronoKey",
    name: "Rusted Chrono Key",
    rarity: "common",
    summary: "A corroded winding key that can brace stuck mechanisms for a moment.",
    positive: "Spits out a pragmatic hint for mechanical puzzles.",
    negative: "Winding it jolts the chamber, stirring the sands into a quick surge.",
    neutral: "Rust flakes drift upward as if the key remembers other gravity.",
    effects: [
      { type: "hint", message: "Blueprint schematics sketch themselves across your thoughts." },
      { type: "momentum", direction: "heat", amount: 4, message: "The jammed gears kick the hourglass into a jitter." },
      { type: "sanity", amount: -2, message: "Metal grit scrapes across your knuckles." },
    ],
  }),
  createArtifact({
    id: "windupMender",
    name: "Windup Mender",
    rarity: "common",
    summary: "A pocket kit of gears and tea steam that soothes frayed nerves.",
    positive: "Restores sanity and primes a sand ward.",
    negative: "The frantic winding agitates the surrounding sands.",
    neutral: "It hums a lullaby from forgotten workshops when wound.",
    effects: [
      { type: "sanity", amount: 8, message: "Warm clockwork steam laps at your senses." },
      { type: "shield", message: "A sleeve of coiled springs braces you against the next shock." },
      { type: "momentum", direction: "heat", amount: 3, message: "Spare cogs scatter, rattling the temporal drift." },
    ],
  }),
  createArtifact({
    id: "amberEchoPin",
    name: "Amber Echo Pin",
    rarity: "common",
    summary: "Fossilized sand that vibrates with faint resonant echoes.",
    positive: "Bleeds momentum away into a patient hum.",
    negative: "Each vibration steals a fragment of memory.",
    neutral: "Within the amber a miniature hourglass rotates slowly.",
    effects: [
      { type: "momentum", direction: "cool", amount: 5, message: "The pin drinks in restless waves of sand." },
      { type: "sanity", amount: -3, message: "Fragments of your own echo crumble with it." },
      { type: "log", message: "Soft humming trails along the glass, tracing the relic's outline.", tone: "neutral" },
    ],
  }),
  createArtifact({
    id: "brassLoomSpool",
    name: "Brass Loom Spool",
    rarity: "common",
    summary: "A spool of filament that stitches stray grains into braided patterns.",
    positive: "Steadies the drain for a spell by winding fear into tidy knots.",
    negative: "The rewoven threads tug the sands into a warmer current.",
    neutral: "Numbers etched along the filament tick down as it unwinds.",
    effects: [
      { type: "drain", amount: -0.15, message: "Tension slides away as you bind loose thoughts." },
      { type: "momentum", direction: "heat", amount: 2, message: "The rewoven grain hums with latent energy." },
    ],
  }),
  createArtifact({
    id: "buzzingValve",
    name: "Buzzing Valve",
    rarity: "common",
    summary: "A sputtering valve that vents compressed chronal pressure.",
    positive: "Releases a chunk of stored momentum in a single hiss.",
    negative: "The screech jars your mind loose from its moorings.",
    neutral: "It warms in your palm whenever pressure is about to spike.",
    effects: [
      { type: "momentum", direction: "cool", amount: 7, message: "A plume of glittering sand blasts outward and settles calm." },
      { type: "sanity", amount: -4, message: "The valve's shriek rattles your teeth." },
    ],
  }),
  createArtifact({
    id: "smokedSundial",
    name: "Smoked Sundial",
    rarity: "common",
    summary: "A smoked glass sundial gauged for the diffuse light inside the hourglass.",
    positive: "Tempers the drain as you chart a steadier tempo.",
    negative: "Fixating on the dim light saps a bit of resolve.",
    neutral: "Faint rays crawl across the dial like angled constellations.",
    effects: [
      { type: "drain", amount: -0.2, message: "A measured cadence replaces frantic breaths." },
      { type: "settle", state: "calm", ticks: 2, message: "The sundial rests on the sand, inviting a brief stillness.", tone: "neutral" },
      { type: "sanity", amount: -2, message: "Staring into the dim glow leaves specks dancing in your vision." },
    ],
  }),
  createArtifact({
    id: "whisperCoil",
    name: "Whisper Coil",
    rarity: "common",
    summary: "A coil that murmurs the near future in barely audible tones.",
    positive: "Offers a pointed hint when you face intricate logic.",
    negative: "Each whisper plucks away a thread of memory.",
    neutral: "It rattles quietly whenever the hourglass tilts.",
    effects: [
      { type: "hint", message: "The coil sketches a clean solution across the sand." },
      { type: "sanity", amount: -3, message: "The whispers claim a comforting recollection as payment." },
    ],
  }),
  createArtifact({
    id: "clockdustSachet",
    name: "Clockdust Sachet",
    rarity: "common",
    summary: "A pouch of gray dust that slows whatever it coats.",
    positive: "Smothers a swell of momentum and invites a calm pocket.",
    negative: "The dust seeps into your lungs, stinging the mind.",
    neutral: "When released it hangs in midair like a suspended fog.",
    effects: [
      { type: "momentum", direction: "cool", amount: 8, message: "Dust blankets the chamber, damping every motion." },
      { type: "settle", state: "calm", ticks: 2, message: "For a blink the chamber moves as if submerged.", tone: "neutral" },
      { type: "sanity", amount: -2, message: "You cough as metallic grit scratches your throat." },
    ],
  }),
  createArtifact({
    id: "lanternBeetle",
    name: "Lantern Beetle",
    rarity: "common",
    summary: "A palm-sized beetle whose thorax glows with clocklight.",
    positive: "Highlights hidden relic traces during searches.",
    negative: "Its bright trail attracts curious sands, warming the flow.",
    neutral: "It blinks in a rhythm matching your heartbeat.",
    effects: [
      { type: "scanAssist", message: "The beetle's light maps subtle seams across the chamber.", tone: "positive" },
      { type: "momentum", direction: "heat", amount: 2, message: "Glittering motes swarm toward the beetle's glow." },
    ],
  }),
  createArtifact({
    id: "resonantChalk",
    name: "Resonant Chalk",
    rarity: "common",
    summary: "Chalk that hums at the same pitch as the hourglass shell.",
    positive: "Marks stable paths that ease future searches.",
    negative: "The resonance lingers in your skull, slightly increasing drain.",
    neutral: "Lines drawn with it shimmer before settling solid.",
    effects: [
      { type: "sceneFlag", key: "searchAssist", value: true, message: "Resonant guidelines etch themselves across the floor.", tone: "positive" },
      { type: "drain", amount: 0.05, message: "The residual hum vibrates behind your eyes." },
    ],
  }),
  createArtifact({
    id: "steamDraught",
    name: "Steam Draught",
    rarity: "common",
    summary: "A vial of spiced steam collected from engine vents.",
    positive: "Restores warmth and knocks a bit of momentum loose.",
    negative: "Leaves you jittery, hastening the drain that follows.",
    neutral: "The vapor curls into tiny gear shapes as it escapes.",
    effects: [
      { type: "sanity", amount: 5, message: "Heat blooms through your chest, chasing away the chill." },
      { type: "momentum", direction: "cool", amount: 3, message: "Exhaled steam slows the swirling sands." },
      { type: "drain", amount: 0.2, message: "Your pulse races, burning through composure faster." },
    ],
  }),
  createArtifact({
    id: "panelHarmonizer",
    name: "Panel Harmonizer",
    rarity: "common",
    summary: "A tuning fork tuned to the hourglass panels.",
    positive: "Auto-synchronizes a stubborn mechanism.",
    negative: "The resonance rattles sanity and heats the tempo.",
    neutral: "It leaves hairline waves shimmering across the glass.",
    effects: [
      { type: "autoSolve", message: "The fork thrums until the mechanism falls into place." },
      { type: "sanity", amount: -4, message: "The vibration crawls through your jaw." },
      { type: "momentum", direction: "heat", amount: 2, message: "Shockwaves race through the suspended sand." },
    ],
  }),
  createArtifact({
    id: "stitchlightThread",
    name: "Stitchlight Thread",
    rarity: "common",
    summary: "Thread drawn from a loom of frozen lightning.",
    positive: "Weaves a protective ward and restores a touch of focus.",
    negative: "The crackling strand raises the drain slightly.",
    neutral: "It flickers between solid filament and blue flame.",
    effects: [
      { type: "sanity", amount: 3, message: "You breathe easier as the thread tightens around your shoulders." },
      { type: "shield", message: "The stitchlight hardens into a brief barrier." },
      { type: "drain", amount: 0.1, message: "Residual sparks nip at your clarity." },
    ],
  }),
  createArtifact({
    id: "gearlingKit",
    name: "Gearling Kit",
    rarity: "common",
    summary: "A tin of tiny clockwork assistants eager to help.",
    positive: "Cools momentum as the gearlings tidy the floor.",
    negative: "Their chatter distracts you, shaving off sanity.",
    neutral: "They salute and scramble to obey each gesture.",
    effects: [
      { type: "momentum", direction: "cool", amount: 4, message: "Clockwork hands sweep away unstable dunes." },
      { type: "sanity", amount: -2, message: "The gearlings' overlapping voices grow a bit much." },
    ],
  }),

  // Uncommon
  createArtifact({
    id: "prismDiver",
    name: "Prism Diver",
    rarity: "uncommon",
    summary: "A refractive probe that dives into splintered timelines and drags them together.",
    positive: "Bleeds a heavy swell of momentum into a steady prismatic hum.",
    negative: "The dive scrapes at your memories, leaving a fresh scar.",
    neutral: "When activated it refracts the chamber into six offset copies.",
    effects: [
      { type: "momentum", direction: "cool", amount: 10, message: "The diver burrows through turbulence and seals it behind mirrored light." },
      { type: "settle", state: "calm", ticks: 3, message: "Prismatic echoes pulse until the chamber exhales.", tone: "neutral" },
      { type: "sanity", amount: -6, message: "Fragments of a timeline you never lived linger painfully." },
    ],
  }),
  createArtifact({
    id: "sandScribe",
    name: "Sand Scribe",
    rarity: "uncommon",
    summary: "A stylus that engraves instructions directly into falling sand.",
    positive: "Reveals hidden pathways and grants a precise hint.",
    negative: "Each etched line accelerates the grains around you.",
    neutral: "Glyphs hang in the air before collapsing into readable steps.",
    effects: [
      { type: "sceneFlag", key: "revealedPaths", value: true, message: "Glyphs flare across the walls, revealing latent routes.", tone: "positive" },
      { type: "hint", message: "The stylus sketches the most efficient alignment." },
      { type: "momentum", direction: "heat", amount: 4, message: "Sand surges to refill the lines you carved." },
    ],
  }),
  createArtifact({
    id: "chronoLoomBand",
    name: "Chrono Loom Band",
    rarity: "uncommon",
    summary: "A loop of woven time fiber that tightens around stray impulses.",
    positive: "Depresses the sanity drain for as long as the band holds.",
    negative: "Snaps back with stored energy, heating the hourglass.",
    neutral: "It faintly ticks in triple time while it works.",
    effects: [
      { type: "drain", amount: -0.25, message: "The band cinches distractions into a disciplined rhythm." },
      { type: "momentum", direction: "heat", amount: 5, message: "When it releases, a surge ripples through the sand." },
    ],
  }),
  createArtifact({
    id: "emberGyroscope",
    name: "Ember Gyroscope",
    rarity: "uncommon",
    summary: "A warm gyroscope that spins out sparks of stabilized time.",
    positive: "Grants a protective ward while you keep it spinning.",
    negative: "Its ignition whips the chamber into a brief surge.",
    neutral: "Trails of ember light trace perfect circles in midair.",
    effects: [
      { type: "shield", message: "Sparks form a halo, ready to deflect the next shock." },
      { type: "event", state: "surge", ticks: 3, bump: 4, message: "The gyroscope howls, stirring the sands into a roaring orbit.", tone: "negative" },
      { type: "sanity", amount: 4, message: "The steady spin anchors your breathing." },
    ],
  }),
  createArtifact({
    id: "hourglassFiddle",
    name: "Hourglass Fiddle",
    rarity: "uncommon",
    summary: "A fiddle strung with threads of powdered sand and brass.",
    positive: "Its song restores sanity and coaxes the chamber toward calm.",
    negative: "Playing it demands focus, slightly raising the drain afterward.",
    neutral: "Notes hang in the air as shimmering grains.",
    effects: [
      { type: "sanity", amount: 9, message: "The melody drowns out the hourglass's frantic hiss." },
      { type: "settle", state: "calm", ticks: 3, message: "Notes settle onto the sand, urging it to stillness.", tone: "neutral" },
      { type: "drain", amount: 0.15, message: "Your bow arm aches from holding the tempo steady." },
    ],
  }),
  createArtifact({
    id: "twilightPeriscope",
    name: "Twilight Periscope",
    rarity: "uncommon",
    summary: "A periscope that peers through dim layers of adjacent time.",
    positive: "Highlights hidden relic traces and whispers a tactical hint.",
    negative: "Straining to focus costs a measure of sanity.",
    neutral: "At each glance twilight colors bleed into the chamber.",
    effects: [
      { type: "scanAssist", message: "The periscope paints weak glows wherever relics hide.", tone: "positive" },
      { type: "hint", message: "Faint silhouettes trace the safest approach." },
      { type: "sanity", amount: -4, message: "Peering too long leaves you dizzy and hollow." },
    ],
  }),
  createArtifact({
    id: "aeonCapsule",
    name: "Aeon Capsule",
    rarity: "uncommon",
    summary: "A capsule filled with stabilized hourglass sand.",
    positive: "On release it devours a surge of momentum and ushers in calm.",
    negative: "The capsule hairline cracks add a lingering drain penalty.",
    neutral: "Condensed frost beads on the glass whenever danger nears.",
    effects: [
      { type: "momentum", direction: "cool", amount: 9, message: "Stabilized sand floods outward, damping every swirl." },
      { type: "settle", state: "calm", ticks: 4, message: "A cool mist settles over the chamber.", tone: "neutral" },
      { type: "drain", amount: 0.2, message: "Tiny fractures hiss, leeching focus over time." },
    ],
  }),
  createArtifact({
    id: "riftStitcher",
    name: "Rift Stitcher",
    rarity: "uncommon",
    summary: "A needle threaded with luminescent sand for sealing micro rifts.",
    positive: "Sews shut a large chunk of runaway momentum.",
    negative: "The work taxes you, increasing drain and shaving sanity.",
    neutral: "Stitched seams glow before blending back into glass.",
    effects: [
      { type: "momentum", direction: "cool", amount: 12, message: "You cinch the needle through each wild eddy until it quiets." },
      { type: "drain", amount: 0.25, message: "Fine motor focus leaves your hands trembling." },
      { type: "sanity", amount: -3, message: "A needle prick of lost time stings your thoughts." },
    ],
  }),
  createArtifact({
    id: "latticeCompass",
    name: "Lattice Compass",
    rarity: "uncommon",
    summary: "A compass with interlocking needles mapping vector fields.",
    positive: "Charts an immediate hint and cools momentum as you realign.",
    negative: "The intricate lattice taxes the mind with geometric strain.",
    neutral: "Tiny gears slide into place to display impossible angles.",
    effects: [
      { type: "hint", message: "Lines of force converge, outlining the optimal path." },
      { type: "momentum", direction: "cool", amount: 5, message: "Needles spin until the chamber finds a milder flow." },
      { type: "sanity", amount: -3, message: "The compass's impossible geometry presses against your temples." },
    ],
  }),
  createArtifact({
    id: "serenadeHorn",
    name: "Serenade Horn",
    rarity: "uncommon",
    summary: "A brass horn tuned to lull spiraling sands.",
    positive: "Pours warmth into your sanity and invites a soft lull.",
    negative: "The resonant blast stirs a later resurgence.",
    neutral: "Polished valves gleam like captured sunsets.",
    effects: [
      { type: "sanity", amount: 10, message: "The horn's song cushions every sharp thought." },
      { type: "settle", state: "calm", ticks: 3, message: "Echoes hang like velvet in the air.", tone: "neutral" },
      { type: "momentum", direction: "heat", amount: 4, message: "Afterglow ripples outward, priming a future rise." },
    ],
  }),
  createArtifact({
    id: "echoMask",
    name: "Echo Mask",
    rarity: "uncommon",
    summary: "A mask that steals stray voices and feeds them back as guidance.",
    positive: "Guides searches with uncanny precision.",
    negative: "Borrowed voices nibble at your own sense of self.",
    neutral: "The mask's mouth opens and closes without sound.",
    effects: [
      { type: "sceneFlag", key: "searchAssist", value: true, message: "Captured whispers point toward hidden hollows.", tone: "positive" },
      { type: "sanity", amount: -5, message: "Your voice returns a shade thinner." },
      { type: "momentum", direction: "heat", amount: 2, message: "Trapped echoes rattle inside the mask." },
    ],
  }),
  createArtifact({
    id: "memorySpindle",
    name: "Memory Spindle",
    rarity: "uncommon",
    summary: "A spindle that winds puzzle steps around a crystalline core.",
    positive: "Auto-resolves a complex puzzle while venting some momentum.",
    negative: "Feeding it costs a chunk of recollection.",
    neutral: "Stories etched along the spindle glow as it turns.",
    effects: [
      { type: "autoSolve", message: "The spindle unwinds and the mechanism obeys." },
      { type: "momentum", direction: "cool", amount: 5, message: "Captured steps release as a soothing pulse." },
      { type: "sanity", amount: -6, message: "Names of old friends slip just out of reach." },
    ],
  }),

  // Rare
  createArtifact({
    id: "timestepChalice",
    name: "Timestep Chalice",
    rarity: "rare",
    summary: "A chalice that condenses errant grains into drinkable focus.",
    positive: "Greatly restores sanity and lowers the drain while calming the chamber.",
    negative: "Each sip leaves a faint aftertaste of lost speed.",
    neutral: "Liquid sand swirls lazily inside the cup.",
    effects: [
      { type: "sanity", amount: 12, message: "Cool quartz liquid steadies every nerve." },
      { type: "drain", amount: -0.3, message: "Your heartbeat syncs with a slower tempo." },
      { type: "settle", state: "calm", ticks: 4, message: "A ring of frost forms on the chalice rim.", tone: "neutral" },
      { type: "momentum", direction: "heat", amount: 3, message: "Once the calm fades, eager grains rush back in." },
    ],
  }),
  createArtifact({
    id: "cognitionBell",
    name: "Cognition Bell",
    rarity: "rare",
    summary: "A handbell whose tone sharpens perception at a high cost.",
    positive: "Rings out a precise hint and highlights every hidden seam.",
    negative: "The piercing note bites deep into your sanity.",
    neutral: "Its tone never fully stops echoing.",
    effects: [
      { type: "hint", message: "Resonant overtones sketch the cleanest approach." },
      { type: "scanAssist", message: "Struck harmonics light up concealed anchors.", tone: "positive" },
      { type: "sanity", amount: -6, message: "The bell's sting rattles through your skull." },
      { type: "momentum", direction: "cool", amount: 4, message: "Shockwaves herd the sands into a tidy orbit." },
    ],
  }),
  createArtifact({
    id: "temporalLoomframe",
    name: "Temporal Loomframe",
    rarity: "rare",
    summary: "A portable loomframe that can weave supportive timelines.",
    positive: "Grants lasting search insight and softens the drain.",
    negative: "Weaving alternate threads excites the ambient flow.",
    neutral: "Threads shimmer with afterimages of paths not taken.",
    effects: [
      { type: "scanAssist", message: "Parallel threads reveal where relics are likely to fall.", tone: "positive" },
      { type: "drain", amount: -0.2, message: "Woven support eases the strain on your nerves." },
      { type: "momentum", direction: "heat", amount: 4, message: "Alternate strands tug at the present, quickening the sands." },
    ],
  }),
  createArtifact({
    id: "phaseAnchorShard",
    name: "Phase Anchor Shard",
    rarity: "rare",
    summary: "A shard chipped from a massive phase anchor.",
    positive: "Slams a surging flow to a halt.",
    negative: "The shard hums dangerously, raising future drain.",
    neutral: "Frost and sparks cling to its edges simultaneously.",
    effects: [
      { type: "momentum", direction: "cool", amount: 12, message: "The shard locks the chamber in place." },
      { type: "settle", state: "calm", ticks: 4, message: "A resonant thud ripples outward.", tone: "neutral" },
      { type: "drain", amount: 0.15, message: "Residual vibrations thrash against your pulse." },
    ],
  }),
  createArtifact({
    id: "continuumFlute",
    name: "Continuum Flute",
    rarity: "rare",
    summary: "A flute that slides through the continuum with each breath.",
    positive: "Yields a burst of sanity and a protective ward.",
    negative: "The melody invites a fierce but predictable surge.",
    neutral: "Each note leaves a ribbon of light spiraling upward.",
    effects: [
      { type: "sanity", amount: 8, message: "The flute's song quiets anxious echoes." },
      { type: "shield", message: "A resonant chord coats you in shielding harmonics." },
      { type: "event", state: "surge", ticks: 5, bump: 6, message: "The continuum answers with a roaring crescendo.", tone: "negative" },
    ],
  }),
  createArtifact({
    id: "starlitOrrery",
    name: "Starlit Orrery",
    rarity: "rare",
    summary: "A miniature orrery tracking distant hourglass shards.",
    positive: "Grants a free escape route and redraws momentum gently.",
    negative: "Studying its stars drains a measure of your stamina.",
    neutral: "Planets of sand orbit in precise miniature ellipses.",
    effects: [
      { type: "freeEscape", message: "A safe trajectory unfolds from the orrery." },
      { type: "momentum", direction: "cool", amount: 5, message: "Orbital adjustments bleed energy away." },
      { type: "sanity", amount: -5, message: "Celestial calculus leaves you glassy-eyed." },
    ],
  }),
  createArtifact({
    id: "chronalPanoply",
    name: "Chronal Panoply",
    rarity: "rare",
    summary: "Layered plates of timeworn armor that absorb temporal shocks.",
    positive: "Shields you and trims the drain while it holds.",
    negative: "Weighty plating heats the surrounding sands.",
    neutral: "Its plates click gently like distant clock hands.",
    effects: [
      { type: "shield", message: "Chronal plating unfurls, absorbing the next blow." },
      { type: "sanity", amount: 5, message: "The armor's weight grounds your racing thoughts." },
      { type: "drain", amount: -0.15, message: "You march forward with measured certainty." },
      { type: "momentum", direction: "heat", amount: 5, message: "The plating's mass displaces sand in a wide arc." },
    ],
  }),
  createArtifact({
    id: "mirrorheartLocket",
    name: "Mirrorheart Locket",
    rarity: "rare",
    summary: "A locket containing a mirror shard that reflects possible futures.",
    positive: "Restores sanity and provides a targeted hint when needed.",
    negative: "Dwelling on reflections heats the sands.",
    neutral: "Each opening reveals a different version of you.",
    effects: [
      { type: "sanity", amount: 10, message: "You see a calmer self and borrow their poise." },
      { type: "hint", message: "Reflected futures point toward the surest choice." },
      { type: "momentum", direction: "heat", amount: 5, message: "Futures resonate, agitating the present flow." },
    ],
  }),
  createArtifact({
    id: "gearwrightGauntlet",
    name: "Gearwright Gauntlet",
    rarity: "rare",
    summary: "A gauntlet packed with micro tools for on-the-fly repairs.",
    positive: "Auto-completes a complex mechanism and reduces drain modestly.",
    negative: "Its heavy actuation pushes the sands faster.",
    neutral: "Tiny pistons flex along your fingers.",
    effects: [
      { type: "autoSolve", message: "The gauntlet dismantles and reassembles the mechanism instantly." },
      { type: "drain", amount: -0.1, message: "You work with confident efficiency." },
      { type: "momentum", direction: "heat", amount: 3, message: "Spent pistons vent steam into the chamber." },
    ],
  }),
  createArtifact({
    id: "pulseEngineCore",
    name: "Pulse Engine Core",
    rarity: "rare",
    summary: "A shuddering engine core salvaged from a time skiff.",
    positive: "Slashes the drain while it spins, venting pressure outward.",
    negative: "The core radiates instability, heating momentum and bruising sanity.",
    neutral: "It pulses in sync with the hourglass heartbeat.",
    effects: [
      { type: "drain", amount: -0.3, message: "A rhythmic thrum steadies your breathing." },
      { type: "momentum", direction: "heat", amount: 6, message: "Energy ripples outward from the spinning core." },
      { type: "sanity", amount: -4, message: "The vibration bruises your ribs from within." },
    ],
  }),

  // Mythic
  createArtifact({
    id: "paradoxAtlas",
    name: "Paradox Atlas",
    rarity: "mythic",
    summary: "An atlas mapping recursive layouts of the hourglass.",
    positive: "Devours a massive swell of momentum and yields a long calm stretch.",
    negative: "The map's contradictions cost a chunk of sanity.",
    neutral: "Its pages rearrange themselves every time you blink.",
    effects: [
      { type: "momentum", direction: "cool", amount: 18, message: "You fold the atlas until turbulence collapses into flat lines." },
      { type: "settle", state: "calm", ticks: 5, message: "Layered maps settle into a stable rhythm.", tone: "neutral" },
      { type: "sanity", amount: -8, message: "Your sense of direction fractures around impossible corridors." },
    ],
  }),
  createArtifact({
    id: "celestialEscapement",
    name: "Celestial Escapement",
    rarity: "mythic",
    summary: "A gleaming escapement that syncs with distant constellations.",
    positive: "Greatly lowers drain and ushers in a deep calm.",
    negative: "The enforced order stores up a later burst of heat.",
    neutral: "Star motes orbit the escapement in perfect cadence.",
    effects: [
      { type: "drain", amount: -0.5, message: "Each tick lines up with a calming stellar beat." },
      { type: "settle", state: "calm", ticks: 5, message: "Cosmic rhythm hushes the hourglass.", tone: "neutral" },
      { type: "momentum", direction: "heat", amount: 7, message: "Stored starlight crackles along the glass." },
    ],
  }),
  createArtifact({
    id: "aeonChoirMatrix",
    name: "Aeon Choir Matrix",
    rarity: "mythic",
    summary: "A crystalline matrix that harmonizes your thoughts with the hourglass.",
    positive: "Provides enduring search insight, a hint, and a surge of sanity.",
    negative: "The choir's chord raises the drain slightly afterward.",
    neutral: "Voices echo from inside the crystal even when silenced.",
    effects: [
      { type: "scanAssist", message: "Choir harmonics trace every hidden seam.", tone: "positive" },
      { type: "hint", message: "A chorus chants the exact sequence you require." },
      { type: "sanity", amount: 8, message: "The harmonies strengthen your resolve." },
      { type: "drain", amount: 0.2, message: "Residual reverberations keep your pulse elevated." },
    ],
  }),
  createArtifact({
    id: "hourwardenCrown",
    name: "Hourwarden Crown",
    rarity: "mythic",
    summary: "The ceremonial crown of the hourglass wardens.",
    positive: "Guarantees an escape route and a sturdy ward.",
    negative: "Its authority carries a heavy weight of momentum.",
    neutral: "Sandstorms inside the crown settle when you wear it.",
    effects: [
      { type: "freeEscape", message: "The crown commands a gate to open when needed." },
      { type: "shield", message: "Authority condenses into a radiant barrier." },
      { type: "momentum", direction: "heat", amount: 5, message: "Opposing forces bristle against the crown's decree." },
      { type: "sanity", amount: 6, message: "Duty steels your mind despite the strain." },
    ],
  }),
  createArtifact({
    id: "glasswindCloak",
    name: "Glasswind Cloak",
    rarity: "mythic",
    summary: "A cloak woven from gasified sand cooled into thread.",
    positive: "Wraps you in calm and bolsters sanity.",
    negative: "The cloak siphons a bit more drain as it flutters.",
    neutral: "It ripples like liquid glass caught in a breeze.",
    effects: [
      { type: "sanity", amount: 12, message: "The cloak's chill clears every anxious tremor." },
      { type: "settle", state: "calm", ticks: 6, message: "Glasswind eddies hush the chamber.", tone: "neutral" },
      { type: "drain", amount: 0.25, message: "Maintaining the cloak's shimmer taxes you." },
    ],
  }),
  createArtifact({
    id: "sunderedMeridian",
    name: "Sundered Meridian",
    rarity: "mythic",
    summary: "A broken meridian rod that redirects the flow of time itself.",
    positive: "Converts a surge of momentum into renewed clarity.",
    negative: "Using it hurts, carving away sanity.",
    neutral: "Hairline cracks glow whenever danger looms.",
    effects: [
      { type: "momentum", direction: "cool", amount: 14, message: "The meridian reroutes violent currents into distant space." },
      { type: "sanity", amount: -7, message: "Crosscurrents scald your thoughts as they pass." },
      { type: "settle", state: "calm", ticks: 4, message: "Redirected flows leave the chamber in rare equilibrium.", tone: "neutral" },
    ],
  }),
  createArtifact({
    id: "goldenSingularity",
    name: "Golden Singularity",
    rarity: "mythic",
    summary: "A compressed singularity of gilded sand chained to a ring.",
    positive: "Collapses vast momentum instantly.",
    negative: "The singularity hungers, raising drain and costing sanity.",
    neutral: "Tiny arcs of lightning crawl across its surface.",
    effects: [
      { type: "momentum", direction: "cool", amount: 20, message: "The singularity devours every turbulent eddy nearby." },
      { type: "drain", amount: 0.3, message: "Feeding it leaves you hollow and accelerated." },
      { type: "sanity", amount: -8, message: "You feel something permanent slip away." },
    ],
  }),
  createArtifact({
    id: "chronoOracleLens",
    name: "Chrono Oracle Lens",
    rarity: "mythic",
    summary: "An oracle lens that glimpses multiple outcomes at once.",
    positive: "Combines hint, search insight, and a puzzle auto-solution.",
    negative: "The cascading visions batter your sanity.",
    neutral: "Reflections branch into countless possibilities.",
    effects: [
      { type: "hint", message: "Possible outcomes collapse into a single clear directive." },
      { type: "scanAssist", message: "Refractions highlight every hidden resonant point.", tone: "positive" },
      { type: "autoSolve", message: "The lens shows the exact motions before you execute them." },
      { type: "sanity", amount: -7, message: "The torrent of futures leaves your thoughts raw." },
    ],
  }),

  // Timeless
  createArtifact({
    id: "primeHourSeed",
    name: "Prime Hour Seed",
    rarity: "timeless",
    summary: "A seed containing the primordial cadence of the hourglass.",
    positive: "Resets momentum to near zero and blankets the chamber in calm.",
    negative: "The seed roots into you, raising drain afterward.",
    neutral: "It pulses with the rhythm of an unseen giant heart.",
    effects: [
      { type: "momentum", direction: "cool", amount: 30, message: "The seed germinates, devouring turbulent sand in one breath." },
      { type: "settle", state: "calm", ticks: 8, message: "New growth of possibility steadies every grain.", tone: "neutral" },
      { type: "drain", amount: 0.35, message: "Roots tap into your stamina to keep growing." },
    ],
  }),
  createArtifact({
    id: "eternumCoil",
    name: "Eternum Coil",
    rarity: "timeless",
    summary: "A coil that can store entire timelines if given enough resolve.",
    positive: "Grants scan insight, a free escape, and a protective ward.",
    negative: "The coil insists on constant attention, accelerating drain and shaving sanity.",
    neutral: "Its loops glow with slow-moving constellations.",
    effects: [
      { type: "scanAssist", message: "Coiled timelines illuminate every hidden route.", tone: "positive" },
      { type: "freeEscape", message: "One stored timeline guarantees an exit when you demand it." },
      { type: "shield", message: "Layered loops wrap around you like armor." },
      { type: "drain", amount: 0.3, message: "Maintaining the coil's tension quickens your pulse." },
      { type: "sanity", amount: -5, message: "Keeping so many timelines balanced wears at you." },
    ],
  }),
  createArtifact({
    id: "sandsongHeartstone",
    name: "Sandsong Heartstone",
    rarity: "timeless",
    summary: "A heartstone that sings harmonics older than recorded time.",
    positive: "Floods you with sanity and hushes the hourglass for a long stretch.",
    negative: "Its resonance risks igniting a later surge.",
    neutral: "A steady song vibrates through your bones when you hold it.",
    effects: [
      { type: "sanity", amount: 20, message: "Ancient harmonics rebuild your resolve from the ground up." },
      { type: "settle", state: "calm", ticks: 7, message: "For a span the hourglass listens in reverent silence.", tone: "neutral" },
      { type: "momentum", direction: "heat", amount: 10, message: "Stored song energy eventually cascades outward." },
    ],
  }),
  createArtifact({
    id: "infinityLoom",
    name: "Infinity Loom",
    rarity: "timeless",
    summary: "A loom that weaves threads across endless variations of the run.",
    positive: "Severely reduces drain and grants a decisive calm pocket.",
    negative: "Working the loom stirs an undercurrent of momentum.",
    neutral: "Threads stretch beyond sight before snapping back.",
    effects: [
      { type: "drain", amount: -0.6, message: "You stitch countless outcomes into a single, manageable pace." },
      { type: "settle", state: "calm", ticks: 6, message: "Woven threads cradle the chamber in stillness.", tone: "neutral" },
      { type: "momentum", direction: "heat", amount: 8, message: "Residual threads lash outward once the loom stills." },
    ],
  }),
  createArtifact({
    id: "lastArchiveFragment",
    name: "Last Archive Fragment",
    rarity: "timeless",
    summary: "The final fragment of the hourglass chronicle, etched across mirrored sand.",
    positive: "Auto-solves a challenge, grants insight, and chills momentum deeply.",
    negative: "Reading it strips away precious sanity.",
    neutral: "Lines of script rearrange themselves as you watch.",
    effects: [
      { type: "autoSolve", message: "Recorded knowledge guides your hands without hesitation." },
      { type: "hint", message: "Footnotes unveil alternate routes and hidden doors." },
      { type: "momentum", direction: "cool", amount: 16, message: "Documented procedures calm the volatile flow." },
      { type: "sanity", amount: -9, message: "Ingesting history leaves you hollow and ancient." },
    ],
  }),
];

const ARTIFACTS = [...CORE_ARTIFACTS, ...EXPANDED_ARTIFACTS];

const SCENES = [
  {
    id: "pendulum-atrium",
    name: "Pendulum Atrium",
    description:
      "A cathedral of swinging weights and mirrored sand basins stretches above. Each pendulum whispers a different second.",
    objective: "Stabilize the atrium's master pendulum to unlock the fracture gate.",
    boardStyle: "radial-gradient(circle at 30% 20%, rgba(246,197,107,0.18), transparent), rgba(20,22,30,0.85)",
    hotspots: [
      {
        id: "atrium-artifact",
        label: "Suspended Relic",
        x: 24,
        y: 32,
        type: "artifact",
        artifactPool: ["chronoLens", "brassFamiliar", "cauterizedSand"],
      },
      {
        id: "atrium-puzzle",
        label: "Calibrate Weights",
        x: 58,
        y: 46,
        type: "puzzle",
        puzzle: {
          id: "atrium-tuning",
          prompt:
            "The master pendulum thrashes. Choose a counterweight phase to lock it into harmony.",
          options: [
            {
              id: "phase-align",
              title: "Align opposite crescents",
              description: "Match the slowest pendulum to the fastest clock tick.",
              outcome: "success",
              effect: (gameState, context) => {
                context.sceneState.puzzles["atrium-tuning"] = true;
                addLog("The atrium hushes as the pendulums settle into rhythm.", "positive");
              },
            },
            {
              id: "phase-freeze",
              title: "Freeze the center weight",
              description: "Lock the center mass in place and hope the rest follow.",
              outcome: "failure",
              effect: (gameState) => {
                adjustSanity(gameState, -10, "The backlash rattles through your mind.");
              },
            },
            {
              id: "phase-reverse",
              title: "Reverse the flow",
              description: "Spin the hourglass to invert its gravity.",
              outcome: "failure",
              effect: (gameState) => {
                adjustTime(gameState, -25, "The sands surge back violently.");
              },
            },
          ],
        },
        requires: {
          hintFlag: "revealedPaths",
          fallbackArtifact: "hourwardenSigil",
        },
      },
      {
        id: "atrium-dialogue",
        label: "Echoed Engineer",
        x: 32,
        y: 74,
        type: "dialogue",
        dialogue: {
          id: "engineer",
          title: "An Echoed Engineer",
          body:
            "A translucent engineer mirrors your stance, offering two conflicting calibration rituals.",
          choices: [
            {
              id: "listen",
              title: "Follow the engineer",
              description: "Adopt their methodical rhythm.",
              effect: (gameState, context) => {
                context.sceneState.flags.revealedPaths = true;
                adjustSanity(gameState, +5, "The mirrored breathing calms you.");
              },
              log: "The engineer nods--hidden struts slide into view.",
            },
            {
              id: "reject",
              title: "Reject the echo",
              description: "Trust your own improvisation.",
              effect: (gameState) => {
                adjustTime(gameState, +15, "You seize control of the tempo.");
                adjustSanity(gameState, -4, "Doubt nips at your focus.");
              },
              log: "The echo fractures, leaving drifting sparks.",
            },
          ],
        },
      },
      {
        id: "atrium-exit",
        label: "Fracture Gate",
        x: 76,
        y: 58,
        type: "exit",
        requirements: {
          puzzles: ["atrium-tuning"],
        },
        successText: "The gate dilates, releasing you deeper into the hourglass.",
      },
    ],
  },
  {
    id: "gearworks-gallery",
    name: "Gearworks Gallery",
    description:
      "Spiral staircases wind around suspended paintings that rearrange themselves with every tick.",
    objective: "Reorient the gallery's mural to chart an escape path.",
    boardStyle: "linear-gradient(135deg, rgba(246,197,107,0.18), transparent), rgba(18,20,28,0.85)",
    hotspots: [
      {
        id: "gallery-artifact",
        label: "Portrait Alcove",
        x: 62,
        y: 28,
        type: "artifact",
        artifactPool: ["paradoxPrism", "mnemonicCoil", "brassFamiliar"],
      },
      {
        id: "gallery-puzzle",
        label: "Align Mural",
        x: 28,
        y: 42,
        type: "puzzle",
        puzzle: {
          id: "gallery-mural",
          prompt: "Three panels rotate independently. Which pattern completes the escape route?",
          options: [
            {
              id: "spiral",
              title: "Spiral of constellations",
              description: "A swirl that meets at the center glyph.",
              outcome: "success",
              effect: (gameState, context) => {
                context.sceneState.puzzles["gallery-mural"] = true;
                addLog("The mural locks--stairs slide to reveal a passage.", "positive");
              },
            },
            {
              id: "cascade",
              title: "Cascading gears",
              description: "Layer the gears in descending size.",
              outcome: "failure",
              effect: (gameState) => adjustSanity(gameState, -7, "Grinding gears shriek through your skull."),
            },
            {
              id: "eclipse",
              title: "Twin eclipses",
              description: "Align the moons to swallow the sun.",
              outcome: "failure",
              effect: (gameState) => adjustTime(gameState, -15, "The gallery shutters and resets."),
            },
          ],
        },
        requires: {
          autoSolveFlag: "autoSolve",
          fallbackArtifact: "hourwardenSigil",
        },
      },
      {
        id: "gallery-dialogue",
        label: "Curator Whisper",
        x: 44,
        y: 70,
        type: "dialogue",
        dialogue: {
          id: "curator",
          title: "A Whispering Curator",
          body: "The curator offers to shuffle the exhibit in your favor--at a price.",
          choices: [
            {
              id: "deal",
              title: "Seal the bargain",
              description: "Trade a sliver of sanity for progress.",
              effect: (gameState, context) => {
                adjustSanity(gameState, -5, "A contract sigil brands your palm.");
                context.sceneState.puzzles["gallery-mural"] = true;
              },
              log: "The gallery rearranges itself obediently.",
            },
            {
              id: "decline",
              title: "Decline",
              description: "Rely on your own deductions.",
              effect: (gameState) => adjustTime(gameState, +10, "You study the patterns patiently."),
              log: "The curator fades, leaving clues etched in the floor.",
            },
          ],
        },
      },
      {
        id: "gallery-exit",
        label: "Displaced Stair",
        x: 78,
        y: 60,
        type: "exit",
        requirements: {
          puzzles: ["gallery-mural"],
        },
        successText: "You ascend the reformed staircase toward the next chamber.",
      },
    ],
  },
  {
    id: "sandforge-workshop",
    name: "Sandforge Workshop",
    description:
      "Worktables grind luminous sand into delicate cogs. Anvils ring with trapped thunder.",
    objective: "Charge the sandforge conduits to melt the sealed hatch.",
    boardStyle: "linear-gradient(180deg, rgba(246,197,107,0.2), transparent), rgba(19,19,26,0.88)",
    hotspots: [
      {
        id: "workshop-artifact",
        label: "Forge Crucible",
        x: 20,
        y: 38,
        type: "artifact",
        artifactPool: ["cauterizedSand", "paradoxPrism", "temporalAnchor"],
      },
      {
        id: "workshop-puzzle",
        label: "Charge Conduits",
        x: 48,
        y: 52,
        type: "puzzle",
        puzzle: {
          id: "workshop-conduits",
          prompt: "Three conduits hum at different pitches. Which sequence completes the circuit?",
          options: [
            {
              id: "low-mid-high",
              title: "Low -> Mid -> High",
              description: "Balance the flow progressively.",
              outcome: "success",
              effect: (gameState, context) => {
                context.sceneState.puzzles["workshop-conduits"] = true;
                addLog("The conduits blaze, liquefying the hatch seals.", "positive");
              },
            },
            {
              id: "high-low-mid",
              title: "High -> Low -> Mid",
              description: "Shock then stabilize.",
              outcome: "failure",
              effect: (gameState) => adjustSanity(gameState, -8, "The surge whiplashes across your mind."),
            },
            {
              id: "simultaneous",
              title: "All at once",
              description: "Overwhelm the forge.",
              outcome: "failure",
              effect: (gameState) => adjustTime(gameState, -20, "The conduits short and reset."),
            },
          ],
        },
        requires: {
          artifactsAny: ["cauterizedSand", "temporalAnchor"],
          fallbackArtifact: "hourwardenSigil",
        },
      },
      {
        id: "workshop-dialogue",
        label: "Apprentice Shade",
        x: 66,
        y: 70,
        type: "dialogue",
        dialogue: {
          id: "apprentice",
          title: "A Nervous Apprentice",
          body: "The apprentice pleads for guidance, offering either fuel or focus.",
          choices: [
            {
              id: "grant-fuel",
              title: "Offer encouragement",
              description: "Boost their confidence to hasten the melt.",
              effect: (gameState, context) => {
                adjustTime(gameState, +12, "The apprentice quickens their work.");
                context.sceneState.flags.extraFuel = true;
              },
              log: "Molten sand courses brighter through the conduits.",
            },
            {
              id: "take-focus",
              title: "Take their focus",
              description: "Absorb their discipline for yourself.",
              effect: (gameState) => {
                adjustSanity(gameState, +6, "Clarity sharpens your resolve.");
                adjustTime(gameState, -10, "Their hesitation slows the forge.");
              },
              log: "The apprentice falters but you feel composed.",
            },
          ],
        },
      },
      {
        id: "workshop-exit",
        label: "Melted Hatch",
        x: 84,
        y: 54,
        type: "exit",
        requirements: {
          puzzles: ["workshop-conduits"],
        },
        successText: "The hatch drips open, revealing a stair carved of cooled glass.",
      },
    ],
  },
  {
    id: "memory-conservatory",
    name: "Memory Conservatory",
    description:
      "Shelves of bottled recollections float among vines of copper tubing.",
    objective: "Restore a fractured memory strand to reveal the concealed door.",
    boardStyle: "radial-gradient(circle at 70% 20%, rgba(246,197,107,0.16), transparent), rgba(17,19,27,0.9)",
    hotspots: [
      {
        id: "conservatory-artifact",
        label: "Bottled Echo",
        x: 30,
        y: 28,
        type: "artifact",
        artifactPool: ["mnemonicCoil", "brassFamiliar", "chronoLens"],
      },
      {
        id: "conservatory-puzzle",
        label: "Weave Strand",
        x: 58,
        y: 40,
        type: "puzzle",
        puzzle: {
          id: "conservatory-strand",
          prompt: "Three memories shimmer--choose the fragment that completes the escape vision.",
          options: [
            {
              id: "childhood-clock",
              title: "A childhood clock",
              description: "Warm, steady ticking.",
              outcome: "success",
              effect: (gameState, context) => {
                context.sceneState.puzzles["conservatory-strand"] = true;
                addLog("The memories braid into a guiding thread of light.", "positive");
              },
            },
            {
              id: "storm-sky",
              title: "A stormy sky",
              description: "Lightning etched across sand dunes.",
              outcome: "failure",
              effect: (gameState) => adjustSanity(gameState, -6, "The memory lashes you with dissonance."),
            },
            {
              id: "silent-hall",
              title: "A silent hall",
              description: "Empty frames and echoing footsteps.",
              outcome: "failure",
              effect: (gameState) => adjustTime(gameState, -15, "The memory loops without progress."),
            },
          ],
        },
        requires: {
          hintFlag: "hintAvailable",
          fallbackArtifact: "hourwardenSigil",
        },
      },
      {
        id: "conservatory-dialogue",
        label: "Archivist Shade",
        x: 44,
        y: 72,
        type: "dialogue",
        dialogue: {
          id: "archivist",
          title: "The Archivist",
          body: "The archivist offers to secure a memory in exchange for a sacrifice.",
          choices: [
            {
              id: "offer-memory",
              title: "Offer a memory",
              description: "Trade sanity for a solid clue.",
              effect: (gameState, context) => {
                adjustSanity(gameState, -7, "You relinquish a cherished recollection.");
                context.sceneState.flags.hintAvailable = true;
              },
              log: "An illuminated sigil marks the correct strand.",
            },
            {
              id: "refuse",
              title: "Refuse",
              description: "Protect your mind; extend the calm instead.",
              effect: (gameState) => adjustTime(gameState, +12, "You map alternative routes with patience."),
              log: "The archivist shrugs, letting the bottles rearrange themselves.",
            },
          ],
        },
      },
      {
        id: "conservatory-exit",
        label: "Hidden Door",
        x: 78,
        y: 58,
        type: "exit",
        requirements: {
          puzzles: ["conservatory-strand"],
        },
        successText: "The door exhales starlit dust as it swings open.",
      },
    ],
  },
  {
    id: "obsidian-dials",
    name: "Obsidian Dials",
    description:
      "Massive dials of obsidian rotate beneath glass floors, each etched with constellations.",
    objective: "Synchronize the dials to align with a fleeting constellation.",
    boardStyle: "radial-gradient(circle at 20% 80%, rgba(246,197,107,0.16), transparent), rgba(15,17,25,0.92)",
    hotspots: [
      {
        id: "dials-artifact",
        label: "Dial Pedestal",
        x: 22,
        y: 36,
        type: "artifact",
        artifactPool: ["temporalAnchor", "paradoxPrism", "cauterizedSand"],
      },
      {
        id: "dials-puzzle",
        label: "Set Constellation",
        x: 50,
        y: 48,
        type: "puzzle",
        puzzle: {
          id: "dials-constellation",
          prompt: "Choose the dial orientation that matches the Hourwarden's path.",
          options: [
            {
              id: "triad",
              title: "Triad Alignment",
              description: "Dial 1 to 3, Dial 2 to 7, Dial 3 to 11.",
              outcome: "success",
              effect: (gameState, context) => {
                context.sceneState.puzzles["dials-constellation"] = true;
                addLog("The constellations ignite, freezing the dials into place.", "positive");
              },
            },
            {
              id: "cascade",
              title: "Cascade Alignment",
              description: "Dial 1 to 12, Dial 2 to 4, Dial 3 to 8.",
              outcome: "failure",
              effect: (gameState) => adjustSanity(gameState, -9, "A pulse of void energy shocks you."),
            },
            {
              id: "mirror",
              title: "Mirror Alignment",
              description: "Mirror the previous chamber's pattern.",
              outcome: "failure",
              effect: (gameState) => adjustTime(gameState, -18, "The dials spin wildly before resetting."),
            },
          ],
        },
        requires: {
          puzzles: ["atrium-tuning"],
          fallbackArtifact: "hourwardenSigil",
        },
      },
      {
        id: "dials-dialogue",
        label: "Astral Voice",
        x: 68,
        y: 68,
        type: "dialogue",
        dialogue: {
          id: "astral",
          title: "Voice of the Constellation",
          body: "A chorus invites you to trade calm for absolute precision.",
          choices: [
            {
              id: "trade-calm",
              title: "Surrender calm",
              description: "Buy certainty by draining the calm.",
              effect: (gameState, context) => {
                adjustTime(gameState, -20, "The dials drink deeply of your calm reserves.");
                context.sceneState.puzzles["dials-constellation"] = true;
              },
              log: "The constellation locks into place above you.",
            },
            {
              id: "hold-calm",
              title: "Hold your ground",
              description: "Trust your instinct instead.",
              effect: (gameState) => adjustSanity(gameState, +4, "Confidence steels you."),
              log: "The voices fade, leaving subtle markings as hints.",
            },
          ],
        },
      },
      {
        id: "dials-exit",
        label: "Star Gate",
        x: 82,
        y: 56,
        type: "exit",
        requirements: {
          puzzles: ["dials-constellation"],
        },
        successText: "You stride through a corridor of still constellations.",
      },
    ],
  },
  {
    id: "starlit-observatory",
    name: "Starlit Observatory",
    description:
      "An inverted dome shows a night sky beneath your feet; comets trace trails of molten sand.",
    objective: "Chart the comet's arc to unlock a descending lift.",
    boardStyle: "linear-gradient(160deg, rgba(246,197,107,0.14), transparent), rgba(13,15,23,0.94)",
    hotspots: [
      {
        id: "observatory-artifact",
        label: "Comet Fragment",
        x: 32,
        y: 24,
        type: "artifact",
        artifactPool: ["paradoxPrism", "chronoLens", "hourwardenSigil"],
      },
      {
        id: "observatory-puzzle",
        label: "Chart Arc",
        x: 54,
        y: 46,
        type: "puzzle",
        puzzle: {
          id: "observatory-arc",
          prompt: "Where should the comet impact to shatter the lower gate?",
          options: [
            {
              id: "south",
              title: "Southern ridge",
              description: "Aim for the densest sand shelf.",
              outcome: "success",
              effect: (gameState, context) => {
                context.sceneState.puzzles["observatory-arc"] = true;
                addLog("The comet's path engraves a precise fracture.", "positive");
              },
            },
            {
              id: "zenith",
              title: "Zenith",
              description: "Drop it straight down.",
              outcome: "failure",
              effect: (gameState) => adjustSanity(gameState, -7, "The blast reverberates painfully."),
            },
            {
              id: "east",
              title: "Eastern ledge",
              description: "Strike the crystalline lattice.",
              outcome: "failure",
              effect: (gameState) => adjustTime(gameState, -20, "The lattice deflects the comet astray."),
            },
          ],
        },
        requires: {
          artifactsAny: ["chronoLens", "hourwardenSigil"],
        },
      },
      {
        id: "observatory-dialogue",
        label: "Navigator Echo",
        x: 42,
        y: 72,
        type: "dialogue",
        dialogue: {
          id: "navigator",
          title: "Navigator Echo",
          body: "The navigator promises a shortcut if you surrender composure or stored calm.",
          choices: [
            {
              id: "calm",
              title: "Maintain calm",
              description: "Protect your sanity, accept the long path.",
              effect: (gameState) => adjustTime(gameState, +10, "You carefully plot the course."),
              log: "The navigator nods, granting subtle chart markings.",
            },
            {
              id: "rush",
              title: "Rush the arc",
              description: "Spend sanity to finish quickly.",
              effect: (gameState, context) => {
                adjustSanity(gameState, -6, "The rush leaves you shaking.");
                context.sceneState.puzzles["observatory-arc"] = true;
              },
              log: "The comet obeys your frantic command.",
            },
          ],
        },
      },
      {
        id: "observatory-exit",
        label: "Descending Lift",
        x: 80,
        y: 58,
        type: "exit",
        requirements: {
          puzzles: ["observatory-arc"],
        },
        successText: "The lift lowers you toward the hourglass base.",
      },
    ],
  },
  {
    id: "forgotten-engine",
    name: "Forgotten Engine Room",
    description:
      "Colossal pistons breathe steam while fractured glass conduits pulse with light.",
    objective: "Reignite the core engine to drive open the hourglass throat.",
    boardStyle: "linear-gradient(200deg, rgba(246,197,107,0.16), transparent), rgba(14,16,24,0.93)",
    hotspots: [
      {
        id: "engine-artifact",
        label: "Core Vault",
        x: 28,
        y: 30,
        type: "artifact",
        artifactPool: ["temporalAnchor", "mnemonicCoil", "cauterizedSand"],
      },
      {
        id: "engine-puzzle",
        label: "Ignite Core",
        x: 54,
        y: 48,
        type: "puzzle",
        puzzle: {
          id: "engine-core",
          prompt: "Choose the ignition sequence to awaken the engine.",
          options: [
            {
              id: "spark-fuel-air",
              title: "Spark -> Fuel -> Air",
              description: "Classic ignition chain.",
              outcome: "success",
              effect: (gameState, context) => {
                context.sceneState.puzzles["engine-core"] = true;
                addLog("The engine rumbles to life, powering the throat gears.", "positive");
              },
            },
            {
              id: "fuel-air-spark",
              title: "Fuel -> Air -> Spark",
              description: "Prime before lighting.",
              outcome: "failure",
              effect: (gameState) => adjustSanity(gameState, -8, "A misfire rattles your senses."),
            },
            {
              id: "air-fuel-spark",
              title: "Air -> Fuel -> Spark",
              description: "Purge the chamber first.",
              outcome: "failure",
              effect: (gameState) => adjustTime(gameState, -18, "The chamber cycles uselessly."),
            },
          ],
        },
        requires: {
          artifactsAny: ["temporalAnchor", "mnemonicCoil"],
        },
      },
      {
        id: "engine-dialogue",
        label: "Engineer Shade",
        x: 68,
        y: 70,
        type: "dialogue",
        dialogue: {
          id: "engineer-core",
          title: "Ghostly Mechanic",
          body: "The mechanic demands either your calm or sanity to fine-tune the ignition.",
          choices: [
            {
              id: "trade-sanity",
              title: "Spare sanity",
              description: "Give up clarity for a perfect tune.",
              effect: (gameState, context) => {
                adjustSanity(gameState, -7, "You stagger as they take your focus.");
                context.sceneState.puzzles["engine-core"] = true;
              },
              log: "The mechanic completes the ignition flawlessly.",
            },
            {
              id: "trade-calm",
              title: "Spend calm",
              description: "Meticulously calibrate it yourself.",
              effect: (gameState) => adjustTime(gameState, +15, "Patience yields understanding."),
              log: "The mechanic observes silently, grudgingly impressed.",
            },
          ],
        },
      },
      {
        id: "engine-exit",
        label: "Hourglass Throat",
        x: 82,
        y: 56,
        type: "exit",
        requirements: {
          puzzles: ["engine-core"],
        },
        successText: "The core drives open a path toward freedom.",
      },
    ],
  },
  {
    id: "celestial-archives",
    name: "Celestial Archives",
    description:
      "An infinite library of star charts stacked within translucent hourglasses.",
    objective: "Decode the escape sigil hidden among interwoven constellations.",
    boardStyle: "radial-gradient(circle at 50% 10%, rgba(246,197,107,0.18), transparent), rgba(12,14,22,0.94)",
    hotspots: [
      {
        id: "archives-artifact",
        label: "Sigil Case",
        x: 30,
        y: 26,
        type: "artifact",
        artifactPool: ["hourwardenSigil", "chronoLens", "paradoxPrism"],
      },
      {
        id: "archives-puzzle",
        label: "Decode Sigil",
        x: 54,
        y: 44,
        type: "puzzle",
        puzzle: {
          id: "archives-sigil",
          prompt: "Select the star sequence that unlocks the archive elevator.",
          options: [
            {
              id: "spiral",
              title: "Spiral of dawn",
              description: "Trace the morning stars inward.",
              outcome: "success",
              effect: (gameState, context) => {
                context.sceneState.puzzles["archives-sigil"] = true;
                addLog("The sigil resonates, summoning an elevator of light.", "positive");
              },
            },
            {
              id: "cascade",
              title: "Cascade of dusk",
              description: "Link the twilight constellations.",
              outcome: "failure",
              effect: (gameState) => adjustSanity(gameState, -8, "The archive punishes the misread."),
            },
            {
              id: "lattice",
              title: "Lattice of noon",
              description: "Grid the stars geometrically.",
              outcome: "failure",
              effect: (gameState) => adjustTime(gameState, -22, "Sands clog the machinery as it resets."),
            },
          ],
        },
        requires: {
          artifactsAny: ["hourwardenSigil", "chronoLens"],
        },
      },
      {
        id: "archives-dialogue",
        label: "Librarian Shade",
        x: 44,
        y: 70,
        type: "dialogue",
        dialogue: {
          id: "librarian",
          title: "Custodian of Records",
          body: "Choose whether to study carefully or sign a dangerous shortcut.",
          choices: [
            {
              id: "study",
              title: "Study",
              description: "Invest calm to ensure correctness.",
              effect: (gameState) => adjustTime(gameState, +18, "You pore over charts with diligence."),
              log: "The sigil glows steadily as you finish studying.",
            },
            {
              id: "sign",
              title: "Sign the pact",
              description: "Sacrifice sanity to gain immediate decoding.",
              effect: (gameState, context) => {
                adjustSanity(gameState, -8, "The pact sears your name into the records.");
                context.sceneState.puzzles["archives-sigil"] = true;
              },
              log: "The librarian seals the shortcut with a nod.",
            },
          ],
        },
      },
      {
        id: "archives-exit",
        label: "Archive Elevator",
        x: 82,
        y: 58,
        type: "exit",
        requirements: {
          puzzles: ["archives-sigil"],
        },
        successText: "You rise on a column of starlight toward the hourglass peak.",
      },
    ],
  },
];

const template = document.getElementById("hotspot-template");
const actionTemplate = document.getElementById("action-card-template");
const sceneBoard = document.getElementById("scene-board");
const sceneHotspots = document.getElementById("scene-hotspots");
const sceneTitle = document.getElementById("scene-title");
const sceneDescription = document.getElementById("scene-description");
const sceneObjective = document.getElementById("scene-objective");
const sceneActions = document.getElementById("scene-actions");
const sceneActionsHeader = document.getElementById("scene-actions-header");
const inventoryList = document.getElementById("inventory-items");
const logPanel = document.getElementById("log");
const sanityFill = document.getElementById("sanity-fill");
const sanityValue = document.getElementById("sanity-value");
const fluxIndicator = document.getElementById("flux-indicator");
const fluxStateLabel = document.getElementById("flux-state");
const proceedBtn = document.getElementById("proceed-btn");
const restartBtn = document.getElementById("restart-btn");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalChoices = document.getElementById("modal-choices");
const modalClose = document.getElementById("modal-close");
const sceneArtCanvas = document.getElementById("scene-art");
const sceneArtCtx = sceneArtCanvas ? sceneArtCanvas.getContext("2d") : null;
const versionLabel = document.getElementById("game-version");

if (versionLabel) {
  versionLabel.textContent = `v${BUILD_VERSION}`;
}

const gameState = {
  sanity: GAME_CONFIG.startingSanity,
  drainRate: GAME_CONFIG.baseDrain,
  scenesQueue: [],
  sceneAssignments: {},
  currentSceneIndex: 0,
  inventory: [],
  inventoryIds: new Set(),
  sceneState: {},
  flags: {},
  loop: null,
  gameOver: false,
  temporalState: "frozen",
  temporalMomentum: 0,
  temporalEventTicks: 0,
  tickCount: 0,
  seed: 0,
  storyContext: null,
  storyCache: {},
};

function resetGameState() {
  gameState.sanity = GAME_CONFIG.startingSanity;
  gameState.drainRate = GAME_CONFIG.baseDrain;
  gameState.scenesQueue = chooseScenes(GAME_CONFIG.runLength);
  gameState.sceneAssignments = assignArtifacts(gameState.scenesQueue);
  gameState.currentSceneIndex = 0;
  gameState.inventory = [];
  gameState.inventoryIds = new Set();
  gameState.sceneState = {};
  gameState.flags = {};
  gameState.gameOver = false;
  gameState.temporalState = "frozen";
  gameState.temporalMomentum = 0;
  gameState.temporalEventTicks = 0;
  gameState.tickCount = 0;
  gameState.seed = Math.floor(Math.random() * 1_000_000_000);
  gameState.storyContext = generateStoryContext(gameState.seed);
  gameState.storyCache = {};
  clearLog();
  addLog("The hourglass seals around you. Find the artifacts and escape.", "system");
  if (gameState.storyContext) {
    const { alias, companion, destination } = gameState.storyContext;
    addLog(
      `Codename ${alias} charts a path toward ${destination}. Your ${companion} stirs at your side.`,
      "system"
    );
  }
  updateInventoryUI();
  proceedBtn.disabled = true;
  stopLoop();
  closeModal();
  startLoop();
  renderScene();
  updateHud();
}

function chooseScenes(count) {
  const pool = [...SCENES];
  shuffle(pool);
  return pool.slice(0, count);
}

function assignArtifacts(scenes) {
  const assignments = {};
  for (const scene of scenes) {
    const map = {};
    for (const hotspot of scene.hotspots) {
      if (hotspot.type !== "artifact") continue;
      const pool = hotspot.artifactPool
        ? ARTIFACTS.filter((a) => hotspot.artifactPool.includes(a.id))
        : ARTIFACTS;
      map[hotspot.id] = chooseArtifact(pool);
    }
    assignments[scene.id] = map;
  }
  return assignments;
}

function chooseArtifact(pool) {
  const weightedPool = pool.map((artifact) => ({
    artifact,
    weight: rarityWeights[artifact.rarity] ?? 1,
  }));
  const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of weightedPool) {
    if ((roll -= item.weight) <= 0) {
      return item.artifact;
    }
  }
  return weightedPool[weightedPool.length - 1].artifact;
}

function getArtifactById(id) {
  return ARTIFACTS.find((artifact) => artifact.id === id) || null;
}

function ensureSceneFlavor(scene) {
  if (!gameState.storyContext) return "";
  const cache = gameState.storyCache[scene.id] || {};
  if (!cache.flavor) {
    const rng = seededRandom(`${gameState.seed}:${scene.id}:flavor`);
    const { companion, omen, motif } = gameState.storyContext;
    const verb = seededPick(rng, STORY_VERBS) || "whispers";
    const texture = seededPick(rng, STORY_TEXTURES) || "sandlight";
    const sentence =
      rng() > 0.5
        ? `Your ${companion} ${verb} about ${omen}.`
        : `Suspended ${texture} drift toward ${motif}.`;
    cache.flavor = sentence;
    gameState.storyCache[scene.id] = cache;
  }
  return cache.flavor;
}

function generateSceneIntro(scene) {
  if (!gameState.storyContext) {
    return `You enter ${scene.name}.`;
  }
  const cache = gameState.storyCache[scene.id] || {};
  if (!cache.intro) {
    const rng = seededRandom(`${gameState.seed}:${scene.id}:intro`);
    const { companion, omen, destination } = gameState.storyContext;
    const mood = seededPick(rng, ["hums", "glows", "shivers", "thrums"]) || "hums";
    const texture = seededPick(rng, STORY_TEXTURES) || "glimmering sand";
    cache.intro = `${scene.name} ${mood} with ${texture}; your ${companion} murmurs about ${omen} on the road to ${destination}.`;
    gameState.storyCache[scene.id] = cache;
  }
  return cache.intro;
}

function renderSceneArt(scene) {
  if (!sceneArtCanvas || !sceneArtCtx || !sceneBoard) return;
  const width = sceneBoard.clientWidth;
  const height = sceneBoard.clientHeight;
  if (!width || !height) return;
  const ratio = window.devicePixelRatio || 1;
  const targetWidth = Math.floor(width * ratio);
  const targetHeight = Math.floor(height * ratio);
  if (sceneArtCanvas.width !== targetWidth || sceneArtCanvas.height !== targetHeight) {
    sceneArtCanvas.width = targetWidth;
    sceneArtCanvas.height = targetHeight;
    sceneArtCanvas.style.width = `${width}px`;
    sceneArtCanvas.style.height = `${height}px`;
  }
  sceneArtCtx.save();
  sceneArtCtx.scale(ratio, ratio);
  sceneArtCtx.clearRect(0, 0, width, height);

  const rng = seededRandom(`${gameState.seed}:${scene.id}:art`);
  drawArtBackdrop(sceneArtCtx, width, height, rng);
  drawHourglassSilhouette(sceneArtCtx, width, height, rng);
  drawGearCluster(sceneArtCtx, width, height, rng);
  drawSandRibbons(sceneArtCtx, width, height, rng);
  sceneArtCtx.restore();
}

function drawArtBackdrop(ctx, width, height, rng) {
  const hue = 34 + Math.floor(rng() * 30) - 15;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsla(${hue}, 62%, 18%, 0.92)`);
  gradient.addColorStop(1, `hsla(${(hue + 180) % 360}, 48%, 10%, 0.96)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawHourglassSilhouette(ctx, width, height, rng) {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "rgba(246, 197, 107, 0.35)";
  ctx.beginPath();
  ctx.moveTo(width * 0.25, 0);
  ctx.quadraticCurveTo(width * 0.5, height * 0.2, width * 0.75, 0);
  ctx.lineTo(width * 0.62, height * 0.46);
  ctx.quadraticCurveTo(width * 0.5, height * 0.52, width * 0.38, height * 0.46);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width * 0.25, height);
  ctx.quadraticCurveTo(width * 0.5, height * 0.8, width * 0.75, height);
  ctx.lineTo(width * 0.62, height * 0.56);
  ctx.quadraticCurveTo(width * 0.5, height * 0.48, width * 0.38, height * 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "rgba(246, 197, 107, 0.25)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.3, 0);
  ctx.lineTo(width * 0.5, height * 0.42);
  ctx.lineTo(width * 0.7, 0);
  ctx.moveTo(width * 0.3, height);
  ctx.lineTo(width * 0.5, height * 0.58);
  ctx.lineTo(width * 0.7, height);
  ctx.stroke();
  ctx.restore();
}

function drawGearCluster(ctx, width, height, rng) {
  const gearCount = 4;
  for (let i = 0; i < gearCount; i++) {
    const x = width * (0.15 + rng() * 0.7);
    const y = height * (i < 2 ? 0.18 + rng() * 0.25 : 0.58 + rng() * 0.3);
    const radius = 18 + rng() * 36;
    const teeth = 6 + Math.floor(rng() * 6);
    const rotation = rng() * Math.PI;
    const alpha = 0.1 + rng() * 0.15;
    drawGear(ctx, x, y, radius, teeth, rotation, `rgba(246, 197, 107, ${alpha})`);
  }
}

function drawGear(ctx, x, y, radius, teeth, rotation, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (Math.PI * i) / teeth;
    const r = i % 2 === 0 ? radius : radius * 0.65;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(12, 14, 18, 0.6)";
  ctx.fill();
  ctx.restore();
}

function drawSandRibbons(ctx, width, height, rng) {
  ctx.save();
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    const startX = width * (0.35 + rng() * 0.3);
    const endX = width * (0.35 + rng() * 0.3);
    const cp1x = width * (0.2 + rng() * 0.6);
    const cp1y = height * (0.18 + rng() * 0.2);
    const cp2x = width * (0.2 + rng() * 0.6);
    const cp2y = height * (0.62 + rng() * 0.2);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(246, 197, 107, ${0.18 + rng() * 0.15})`;
    ctx.moveTo(startX, height * 0.06);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, height * 0.94);
    ctx.stroke();
  }
  ctx.restore();
}

function buildAmbientMessage(mode, direction) {
  if (!gameState.storyContext) return null;
  if (Math.random() > 0.35) return null;
  const templates = direction < 0 ? STORY_NEGATIVE_LINES : STORY_POSITIVE_LINES;
  const template = randomFrom(templates);
  if (!template) return null;
  return formatStoryLine(template, { texture: randomFrom(STORY_TEXTURES) });
}

function renderScene() {
  const scene = gameState.scenesQueue[gameState.currentSceneIndex];
  if (!scene) {
    completeRun();
    return;
  }
  const sceneState = ensureSceneState(scene.id);
  sceneHotspots.innerHTML = "";
  sceneActions.innerHTML = "";
  sceneBoard.style.background = scene.boardStyle;
  renderSceneArt(scene);
  sceneTitle.textContent = scene.name;
  const flavorText = ensureSceneFlavor(scene);
  sceneDescription.textContent = flavorText ? `${scene.description} ${flavorText}` : scene.description;
  sceneObjective.textContent = describeObjective(scene, sceneState);
  proceedBtn.disabled = !sceneState.flags.exitReady;
  if (!sceneState.visited) {
    sceneState.visited = true;
    const intro = generateSceneIntro(scene);
    addLog(intro, "system");
  }

  for (const hotspot of scene.hotspots) {
    const button = template.content.firstElementChild.cloneNode(true);
    button.textContent = hotspot.label;
    button.style.left = `${hotspot.x}%`;
    button.style.top = `${hotspot.y}%`;
    if (sceneState.resolvedHotspots.has(hotspot.id)) {
      button.classList.add("resolved");
    }
    if (hotspot.type === "artifact") {
      const discovered = sceneState.discoveredArtifacts.has(hotspot.id);
      const resolved = sceneState.resolvedHotspots.has(hotspot.id);
      button.dataset.state = resolved ? "claimed" : discovered ? "revealed" : "hidden";
      if (!discovered) {
        button.classList.add("undiscovered");
        button.textContent = `Search ${hotspot.label}`;
      }
    }
    button.addEventListener("click", () => handleHotspot(scene, hotspot));
    sceneHotspots.appendChild(button);

    if (actionTemplate) {
      const actionButton = actionTemplate.content.firstElementChild.cloneNode(true);
      const label = actionButton.querySelector(".action-label");
      const context = actionButton.querySelector(".action-context");
      const discovered =
        hotspot.type === "artifact" && sceneState.discoveredArtifacts.has(hotspot.id);
      const resolved = sceneState.resolvedHotspots.has(hotspot.id);
      if (hotspot.type === "artifact" && !resolved && !discovered) {
        label.textContent = `Search ${hotspot.label}`;
        actionButton.classList.add("undiscovered");
      } else {
        label.textContent = hotspot.label;
      }
      context.textContent = hotspotContext(hotspot, sceneState);
      if (sceneState.resolvedHotspots.has(hotspot.id)) {
        actionButton.classList.add("resolved");
        actionButton.disabled = true;
      }
      actionButton.addEventListener("click", () => handleHotspot(scene, hotspot));
      sceneActions.appendChild(actionButton);
    }
  }

  const hasActions = sceneActions.children.length > 0;
  if (sceneActionsHeader) {
    sceneActionsHeader.style.display = hasActions ? "block" : "none";
  }
  sceneActions.style.display = hasActions ? "grid" : "none";
}

function describeObjective(scene, sceneState) {
  const solved = Object.values(sceneState.puzzles).filter(Boolean).length;
  const total = scene.hotspots.filter((h) => h.type === "puzzle").length;
  const summary = `${solved}/${total} mechanisms stabilized.`;
  if (sceneState.flags.exitReady) {
    return `${scene.objective} The escape route is primed.`;
  }
  return `${scene.objective} ${summary}`;
}

function hotspotContext(hotspot, sceneState) {
  if (hotspot.type === "artifact") {
    if (sceneState.resolvedHotspots.has(hotspot.id)) {
      return "Relic | Claimed";
    }
    if (sceneState.discoveredArtifacts.has(hotspot.id)) {
      return "Relic | Revealed";
    }
    return "Relic | Hidden";
  }
  const typeLabels = {
    artifact: "Relic",
    puzzle: "Mechanism",
    dialogue: "Echo",
    exit: "Escape",
  };
  const label = typeLabels[hotspot.type] || "Interaction";
  const resolved = sceneState.resolvedHotspots.has(hotspot.id);
  return resolved ? `${label} | Resolved` : `${label} | Available`;
}

function ensureSceneState(sceneId) {
  if (!gameState.sceneState[sceneId]) {
    gameState.sceneState[sceneId] = {
      resolvedHotspots: new Set(),
      puzzles: {},
      flags: {},
      dialogues: {},
      discoveredArtifacts: new Set(),
      searchProfiles: {},
      visited: false,
    };
  }
  return gameState.sceneState[sceneId];
}

function handleHotspot(scene, hotspot) {
  if (gameState.gameOver) return;
  const sceneState = ensureSceneState(scene.id);
  if (sceneState.resolvedHotspots.has(hotspot.id)) {
    addLog("Nothing more to do here.");
    return;
  }
  switch (hotspot.type) {
    case "artifact":
      collectArtifact(scene, hotspot, sceneState);
      break;
    case "puzzle":
      attemptPuzzle(scene, hotspot, sceneState);
      break;
    case "dialogue":
      triggerDialogue(scene, hotspot, sceneState);
      break;
    case "exit":
      attemptExit(scene, hotspot, sceneState);
      break;
    default:
      break;
  }
}

function collectArtifact(scene, hotspot, sceneState) {
  if (sceneState.resolvedHotspots.has(hotspot.id)) return;
  const artifact = gameState.sceneAssignments[scene.id]?.[hotspot.id];
  if (!artifact) return;
  if (!sceneState.discoveredArtifacts.has(hotspot.id)) {
    initiateArtifactSearch(scene, hotspot, sceneState, artifact);
    return;
  }
  markTemporalInteraction("artifact");
  sceneState.resolvedHotspots.add(hotspot.id);
  gameState.inventory.push({ artifact, sceneId: scene.id });
  gameState.inventoryIds.add(artifact.id);

  const context = { scene, hotspot, sceneState, artifact };
  artifact.apply(gameState, context);

  updateInventoryUI();
  updateHud();
  addLog(`${artifact.name} claimed.`, "system");
  renderScene();
}

function initiateArtifactSearch(scene, hotspot, sceneState, artifact) {
  markTemporalInteraction("artifact");
  const profile = ensureSearchProfile(sceneState, hotspot, artifact);
  const globalAssist = Boolean(gameState.flags.scanAssist);
  const localAssist = Boolean(sceneState.flags.searchAssist);
  const hintActive = Boolean(sceneState.flags.hintAvailable || globalAssist || localAssist);

  if (hintActive && !profile.hinted) {
    profile.hinted = true;
    const action = profile.actions[profile.successIndex];
    action.description = `${action.description} The prior hint vibrates toward this method.`;
    if (sceneState.flags.hintAvailable) {
      sceneState.flags.hintAvailable = false;
    }
  }

  const bodySegments = [
    "You sweep the chamber for buried resonance.",
    profile.clue,
  ];
  if (gameState.storyContext) {
    const rng = seededRandom(`${gameState.seed}:${scene.id}:${hotspot.id}:search`);
    const companion = gameState.storyContext.companion;
    const omen = gameState.storyContext.omen;
    const motif = gameState.storyContext.motif;
    const whisper =
      rng() > 0.5
        ? `Your ${companion} ${seededPick(rng, STORY_VERBS) || "whispers"} about ${omen}.`
        : `Tiny motes of ${seededPick(rng, STORY_TEXTURES) || "sandlight"} drift toward ${motif}.`;
    bodySegments.push(whisper);
  }
  if (hintActive) {
    bodySegments.push("Guiding murmurs tug at one particular pattern.");
  }

  openModal({
    title: hotspot.label,
    body: bodySegments.join(" "),
    choices: profile.actions.map((action, index) => ({
      id: action.id,
      title: action.label,
      description: action.description,
      handler: () =>
        resolveSearchAttempt(scene, hotspot, sceneState, artifact, profile, index),
    })),
  });
}

function ensureSearchProfile(sceneState, hotspot, artifact) {
  const existing = sceneState.searchProfiles[hotspot.id];
  if (existing) {
    return existing;
  }

  const verbs = [...SEARCH_VERBS];
  const tools = [...SEARCH_TOOLS];
  const focuses = [...SEARCH_FOCUSES];
  shuffle(verbs);
  shuffle(tools);
  shuffle(focuses);

  const successIndex = Math.floor(Math.random() * 3);
  const actions = Array.from({ length: 3 }, (_, index) => ({
    id: `${hotspot.id}-search-${index}`,
    label: `${verbs[index]} the ${tools[index]}`,
    description: `Focus ${focuses[index]}.`,
    success: index === successIndex,
  }));

  const profile = {
    actions,
    successIndex,
    attempts: 0,
    hinted: false,
    clue: generateSearchClue(artifact),
  };
  sceneState.searchProfiles[hotspot.id] = profile;
  return profile;
}

function generateSearchClue(artifact) {
  return `${artifact.name} leaves a faint wake through the suspended sands.`;
}

function resolveSearchAttempt(scene, hotspot, sceneState, artifact, profile, index) {
  closeModal();
  if (gameState.gameOver) return;
  profile.attempts += 1;
  const action = profile.actions[index];
  if (action.success) {
    sceneState.discoveredArtifacts.add(hotspot.id);
    const message = randomFrom(SEARCH_SUCCESS_LINES).replace("{artifact}", artifact.name);
    addLog(message, "positive");
    coolMomentum(3 + Math.random() * 2);
    collectArtifact(scene, hotspot, sceneState);
    return;
  }

  addLog(randomFrom(SEARCH_FAILURE_LINES), "negative");
  heatMomentum(2);
  adjustSanity(gameState, -3);
  if (profile.attempts >= 2 && !profile.hinted && !sceneState.flags.hintAvailable) {
    const hintAction = profile.actions[profile.successIndex];
    hintAction.description = `${hintAction.description} The sands linger near this motion.`;
  }
  updateHud();
}

function attemptPuzzle(scene, hotspot, sceneState) {
  const puzzle = hotspot.puzzle;
  if (!puzzle) return;
  if (sceneState.puzzles[puzzle.id]) {
    addLog("That mechanism is already stabilized.");
    return;
  }

  if (!meetsRequirements(scene, hotspot, sceneState)) {
    return;
  }

  markTemporalInteraction("puzzle");

  const autoSolve = checkAutoSolve(scene, hotspot, sceneState);
  if (autoSolve) {
    sceneState.puzzles[puzzle.id] = true;
    sceneState.resolvedHotspots.add(hotspot.id);
    addLog("Insight floods in-- the puzzle resolves itself.", "positive");
    sceneObjective.textContent = describeObjective(scene, sceneState);
    renderScene();
    return;
  }

  openModal({
    title: hotspot.label,
    body: puzzle.prompt,
    choices: puzzle.options.map((option) => ({
      id: option.id,
      title: option.title,
      description: option.description,
      handler: () => {
        option.effect(gameState, { scene, sceneState });
        if (option.outcome === "success") {
          sceneState.puzzles[puzzle.id] = true;
          sceneState.resolvedHotspots.add(hotspot.id);
          sceneObjective.textContent = describeObjective(scene, sceneState);
        }
        updateHud();
        renderScene();
        closeModal();
      },
    })),
  });
}

function checkAutoSolve(scene, hotspot, sceneState) {
  const requires = hotspot.requires || {};
  if (requires.autoSolveFlag && sceneState.flags[requires.autoSolveFlag]) {
    sceneState.flags[requires.autoSolveFlag] = false;
    return true;
  }
  if (gameState.flags.freeEscape) {
    gameState.flags.freeEscape = false;
    return true;
  }
  return false;
}

function triggerDialogue(scene, hotspot, sceneState) {
  const dialogue = hotspot.dialogue;
  if (!dialogue) return;
  if (sceneState.dialogues[dialogue.id]) {
    addLog("The echo has already spoken.");
    return;
  }
  markTemporalInteraction("dialogue");
  openModal({
    title: dialogue.title,
    body: dialogue.body,
    choices: dialogue.choices.map((choice) => ({
      id: choice.id,
      title: choice.title,
      description: choice.description,
      handler: () => {
        choice.effect(gameState, { scene, sceneState });
        addLog(choice.log, "system");
        sceneState.dialogues[dialogue.id] = choice.id;
        sceneState.resolvedHotspots.add(hotspot.id);
        updateHud();
        renderScene();
        closeModal();
      },
    })),
  });
}

function attemptExit(scene, hotspot, sceneState) {
  if (sceneState.flags.exitReady) {
    addLog("The path already stands open.");
    return;
  }
  if (!meetsRequirements(scene, hotspot, sceneState, true)) {
    return;
  }
  sceneState.resolvedHotspots.add(hotspot.id);
  sceneState.flags.exitReady = true;
  markTemporalInteraction("exit");
  proceedBtn.disabled = false;
  addLog(hotspot.successText, "positive");
  sceneObjective.textContent = describeObjective(scene, sceneState);
  renderScene();
}

function meetsRequirements(scene, hotspot, sceneState, isExit = false) {
  const requires = hotspot.requires;
  if (!requires) return true;

  const fallbackId = requires.fallbackArtifact;
  const fallbackArtifact = fallbackId ? getArtifactById(fallbackId) : null;
  const hasFallback = fallbackArtifact ? gameState.inventoryIds.has(fallbackId) : false;
  const fallbackKey = `fallback-${hotspot.id}`;

  const tryFallback = (message) => {
    if (!hasFallback) {
      addLog(message);
      return false;
    }
    if (!sceneState.flags[fallbackKey]) {
      addLog(`${fallbackArtifact.name} resonates, overriding the chamber's demand.`, "positive");
      sceneState.flags[fallbackKey] = true;
    }
    return true;
  };

  if (requires.puzzles) {
    const missing = requires.puzzles.filter((puzzleId) => !sceneState.puzzles[puzzleId]);
    if (missing.length && !tryFallback("Mechanisms remain unsolved.")) {
      return false;
    }
  }

  if (requires.artifactsAny) {
    const hasAny = requires.artifactsAny.some((id) => gameState.inventoryIds.has(id));
    if (!hasAny && !tryFallback("You need a suitable artifact.")) {
      return false;
    }
  }

  if (requires.hintFlag && !sceneState.flags[requires.hintFlag]) {
    if (!tryFallback("You lack the insight to attempt this yet.")) {
      return false;
    }
  }

  if (requires.artifactAll) {
    const missingAll = requires.artifactAll.filter((id) => !gameState.inventoryIds.has(id));
    if (missingAll.length && !tryFallback("Additional artifacts are required.")) {
      return false;
    }
  }

  return true;
}

function proceedScene() {
  if (gameState.gameOver) return;
  const scene = gameState.scenesQueue[gameState.currentSceneIndex];
  const sceneState = ensureSceneState(scene.id);
  if (!sceneState.flags.exitReady) {
    addLog("The exit resists--resolve the chamber first.");
    return;
  }
  gameState.currentSceneIndex += 1;
  if (gameState.currentSceneIndex >= gameState.scenesQueue.length) {
    completeRun();
  } else {
    addLog("You descend deeper into the hourglass.", "system");
    proceedBtn.disabled = true;
    settleTemporalFlow("frozen");
    renderScene();
  }
}

function updateInventoryUI() {
  inventoryList.innerHTML = "";
  for (const entry of gameState.inventory) {
    const li = document.createElement("li");
    li.className = `inventory-item rarity-${entry.artifact.rarity}`;
    const artifact = entry.artifact;
    li.innerHTML = `
      <span class="name">${artifact.name}</span>
      <span class="tags">${artifact.rarity.toUpperCase()}</span>
      <span class="effects">${[artifact.positive, artifact.neutral, artifact.negative]
        .filter(Boolean)
        .map((text) => `- ${text}`)
        .join("<br>")}</span>
    `;
    inventoryList.appendChild(li);
  }
}

function addLog(message, tone = "") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${tone}`.trim();
  entry.innerHTML = `<strong>${timestamp()}</strong> ${message}`;
  logPanel.appendChild(entry);
  logPanel.scrollTop = logPanel.scrollHeight;
}

function clearLog() {
  logPanel.innerHTML = "";
}

function timestamp() {
  const phase = (gameState.temporalState || "frozen").charAt(0).toUpperCase();
  return `T${phase}+${String(gameState.tickCount).padStart(3, "0")}`;
}

function updateHud() {
  const sanity = Math.max(0, Math.min(100, gameState.sanity));
  sanityFill.style.width = `${sanity}%`;
  sanityValue.textContent = `${Math.round(sanity)}%`;
  if (fluxStateLabel) {
    fluxStateLabel.textContent = formatFluxState(gameState.temporalState);
  }
  if (fluxIndicator) {
    fluxIndicator.dataset.state = gameState.temporalState;
    fluxIndicator.dataset.charge = String(Math.round(gameState.temporalMomentum));
    const level = gameState.temporalMomentum / GAME_CONFIG.momentumCap;
    fluxIndicator.style.setProperty("--flux-level", level.toFixed(2));
  }
}

function formatFluxState(state) {
  switch (state) {
    case "active":
      return "Flowing";
    case "surge":
      return "Surging";
    case "calm":
      return "Calm";
    case "frozen":
    default:
      return "Frozen";
  }
}

function adjustSanity(gameState, amount, message) {
  if (gameState.gameOver) return;
  const scene = currentScene();
  const sceneState = scene ? ensureSceneState(scene.id) : null;
  if (amount < 0 && sceneState?.flags.sandWard) {
    sceneState.flags.sandWard = false;
    addLog("The sand ward absorbs the mental backlash.", "positive");
    return;
  }
  gameState.sanity = Math.max(0, Math.min(100, gameState.sanity + amount));
  if (message) {
    addLog(message, amount >= 0 ? "positive" : "negative");
  }
  if (gameState.sanity <= 0) {
    endRun("Your sanity shatters. The hourglass closes.");
  }
}

function adjustTime(gameState, amount, message) {
  if (!amount) {
    if (message) {
      addLog(message, "neutral");
    }
    return;
  }

  const magnitude = Math.abs(amount);
  const momentumShift = magnitude * MOMENTUM_RATIO;

  if (amount > 0) {
    coolMomentum(momentumShift);
    settleTemporalFlow("calm", Math.max(2, Math.round(magnitude / 10)));
    if (message) {
      addLog(message, "positive");
    }
  } else {
    heatMomentum(momentumShift);
    if (!gameState.gameOver) {
      const intensity = magnitude >= 20 ? "surge" : "active";
      triggerTemporalEvent(intensity, { ticks: Math.max(3, Math.round(magnitude / 8)) });
    }
    if (message) {
      addLog(message, "negative");
    }
  }
}

function currentScene() {
  return gameState.scenesQueue[gameState.currentSceneIndex];
}

function startLoop() {
  stopLoop();
  gameState.loop = setInterval(() => {
    if (gameState.gameOver) return;
    tickTemporalFlow();
    updateHud();
  }, GAME_CONFIG.tickIntervalMs);
}

function stopLoop() {
  if (gameState.loop) {
    clearInterval(gameState.loop);
    gameState.loop = null;
  }
}

function tickTemporalFlow() {
  gameState.tickCount += 1;
  switch (gameState.temporalState) {
    case "frozen":
      coolMomentum(PASSIVE_COOL_RATE);
      emitAmbientTick(0.08, "frozen");
      break;
    case "calm":
      coolMomentum(CALM_COOL_RATE);
      emitAmbientTick(0.15, "calm");
      decayEventTicks();
      break;
    case "active":
      heatMomentum(ACTIVE_HEAT_RATE);
      applyDrift(0.9);
      emitAmbientTick(0.3, "active");
      decayEventTicks();
      break;
    case "surge":
      heatMomentum(SURGE_HEAT_RATE);
      applyDrift(1.35);
      emitAmbientTick(0.42, "surge");
      decayEventTicks();
      break;
    default:
      gameState.temporalState = "frozen";
      break;
  }
}

function emitAmbientTick(chance, mode) {
  if (Math.random() > chance || gameState.gameOver) return;
  const negativeBias =
    mode === "surge" ? 0.85 : mode === "active" ? 0.65 : mode === "calm" ? 0.35 : 0.5;
  const direction = Math.random() < negativeBias ? -1 : 1;
  const scale =
    mode === "surge" ? 4.5 : mode === "active" ? 3 : mode === "calm" ? 2.2 : 1.5;
  const delta = direction * (0.8 + Math.random() * scale);
  const message = buildAmbientMessage(mode, direction);
  adjustSanity(gameState, delta, message);
}

function applyDrift(multiplier) {
  if (!multiplier || gameState.gameOver) return;
  const drift = -gameState.drainRate * multiplier;
  if (Math.abs(drift) < 0.01) return;
  adjustSanity(gameState, drift);
}

function heatMomentum(amount) {
  if (!amount || gameState.gameOver) return;
  gameState.temporalMomentum = Math.min(
    GAME_CONFIG.momentumCap,
    gameState.temporalMomentum + amount
  );
  if (gameState.temporalMomentum >= GAME_CONFIG.momentumCap) {
    endRun("A temporal surge overwhelms you. The hourglass floods in a single breath.");
    return;
  }
}

function coolMomentum(amount) {
  if (!amount || gameState.gameOver) return;
  gameState.temporalMomentum = Math.max(0, gameState.temporalMomentum - amount);
}

function decayEventTicks() {
  if (gameState.temporalEventTicks > 0) {
    gameState.temporalEventTicks -= 1;
    if (gameState.temporalEventTicks <= 0) {
      if (gameState.temporalState === "active" || gameState.temporalState === "surge") {
        settleTemporalFlow("calm", 3);
      } else {
        settleTemporalFlow("frozen");
      }
    }
  } else if (gameState.temporalState === "calm") {
    settleTemporalFlow("frozen");
  }
}

function triggerTemporalEvent(intensity = "active", options = {}) {
  if (gameState.gameOver) return;
  const state = intensity === "surge" ? "surge" : "active";
  const ticks = Math.max(1, options.ticks ?? 4);
  gameState.temporalState = state;
  gameState.temporalEventTicks = Math.max(gameState.temporalEventTicks, ticks);
  if (options.bump) {
    heatMomentum(options.bump);
  }
  updateHud();
}

function settleTemporalFlow(state = "frozen", ticks = 0) {
  if (gameState.gameOver) return;
  if (state === "calm") {
    gameState.temporalState = "calm";
    gameState.temporalEventTicks = Math.max(1, ticks || 2);
  } else {
    gameState.temporalState = "frozen";
    gameState.temporalEventTicks = 0;
  }
  updateHud();
}

function markTemporalInteraction(kind) {
  switch (kind) {
    case "puzzle":
      triggerTemporalEvent("surge", { ticks: 5, bump: 3 });
      break;
    case "artifact":
      triggerTemporalEvent("active", { ticks: 4 });
      break;
    case "dialogue":
      triggerTemporalEvent("active", { ticks: 3 });
      break;
    case "exit":
      settleTemporalFlow("calm", 3);
      break;
    default:
      triggerTemporalEvent("active", { ticks: 3 });
      break;
  }
}

function endRun(message) {
  if (gameState.gameOver) return;
  gameState.gameOver = true;
  stopLoop();
  gameState.temporalState = "frozen";
  gameState.temporalEventTicks = 0;
  proceedBtn.disabled = true;
  openModal({
    title: "Run Failed",
    body: message,
    choices: [],
  });
  updateHud();
}

function completeRun() {
  if (gameState.gameOver) return;
  gameState.gameOver = true;
  stopLoop();
  gameState.temporalState = "frozen";
  gameState.temporalEventTicks = 0;
  openModal({
    title: "You Escaped",
    body: "You emerge from the hourglass, artifacts humming with untapped potential.",
    choices: [],
  });
  updateHud();
}

function openModal({ title, body, choices }) {
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalChoices.innerHTML = "";
  if (choices && choices.length) {
    modalChoices.style.display = "flex";
    for (const choice of choices) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.innerHTML = `<span class="choice-title">${choice.title}</span><span class="choice-effect">${choice.description}</span>`;
      btn.addEventListener("click", () => choice.handler());
      modalChoices.appendChild(btn);
    }
  } else {
    modalChoices.style.display = "none";
  }
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

proceedBtn.addEventListener("click", proceedScene);
restartBtn.addEventListener("click", resetGameState);
modalClose.addEventListener("click", closeModal);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
});

resetGameState();























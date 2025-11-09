const GAME_CONFIG = {
  runLength: 5,
  startingSanity: 100,
  baseDrain: 1,
  startingTimeSeconds: 5 * 60,
};

const rarityWeights = {
  common: 3,
  uncommon: 2,
  rare: 1,
};

const ARTIFACTS = [
  {
    id: "chronoLens",
    name: "Chrono Lens",
    rarity: "uncommon",
    summary: "Reveals phase-shifted passages at the cost of personal focus.",
    positive: "Highlights hidden mechanisms in the current chamber.",
    negative: "The amplified perception strains your mind, increasing sanity drain.",
    neutral: "You glimpse flickers of alternate timelines overlapping the room.",
    apply: (gameState, context) => {
      context.sceneState.flags.revealedPaths = true;
      gameState.drainRate = Math.min(3.5, gameState.drainRate + 0.25);
      addLog(
        `${context.artifact.name} reveals phased passageways within ${context.scene.name}.`,
        "positive"
      );
      addLog(
        "The clarity is dizzying—the hourglass claws at your attention.",
        "negative"
      );
    },
  },
  {
    id: "brassFamiliar",
    name: "Brass Familiar",
    rarity: "common",
    summary: "A mechanical sparrow that offers help while siphoning borrowed time.",
    positive: "Restores a portion of sanity and provides a hint for intricate puzzles.",
    negative: "Steals moments from the chronometer as its gears unwind.",
    neutral: "Its ticking harmonizes with the hourglass pulse.",
    apply: (gameState, context) => {
      adjustSanity(gameState, +8, "The familiar chirps soothingly.");
      adjustTime(gameState, -20, "The sparrow rewinds your clock to power itself.");
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
      addLog("The anchor steadies your thoughts—sanity ebbs more slowly.", "positive");
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
      addLog("A lingering warmth coils around you—one shock may be absorbed.", "positive");
    },
  },
  {
    id: "paradoxPrism",
    name: "Paradox Prism",
    rarity: "uncommon",
    summary: "Splits timelines, gifting you time while rending your composure.",
    positive: "Extends the chronometer with borrowed moments.",
    negative: "Each reflection scrapes at your sanity.",
    neutral: null,
    apply: (gameState) => {
      adjustTime(gameState, +30, "Time branches outward in shimmering arcs.");
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
      addLog("New pathways unfold in your mind—some mechanisms seem trivial now.", "positive");
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
      addLog("The sigil hums—one barrier this run will yield without question.", "positive");
    },
  },
];

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
              log: "The engineer nods—hidden struts slide into view.",
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
                addLog("The mural locks—stairs slide to reveal a passage.", "positive");
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
          body: "The curator offers to shuffle the exhibit in your favor—at a price.",
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
              title: "Low → Mid → High",
              description: "Balance the flow progressively.",
              outcome: "success",
              effect: (gameState, context) => {
                context.sceneState.puzzles["workshop-conduits"] = true;
                addLog("The conduits blaze, liquefying the hatch seals.", "positive");
              },
            },
            {
              id: "high-low-mid",
              title: "High → Low → Mid",
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
          prompt: "Three memories shimmer—choose the fragment that completes the escape vision.",
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
              description: "Protect your mind, extend your time instead.",
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
          body: "A chorus invites you to trade time for absolute precision.",
          choices: [
            {
              id: "trade-time",
              title: "Surrender time",
              description: "Buy certainty with the chronometer.",
              effect: (gameState, context) => {
                adjustTime(gameState, -20, "The dials drink deeply of your minutes.");
                context.sceneState.puzzles["dials-constellation"] = true;
              },
              log: "The constellation locks into place above you.",
            },
            {
              id: "keep-time",
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
          body: "The navigator promises a shortcut if you surrender composure or minutes.",
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
              title: "Spark → Fuel → Air",
              description: "Classic ignition chain.",
              outcome: "success",
              effect: (gameState, context) => {
                context.sceneState.puzzles["engine-core"] = true;
                addLog("The engine rumbles to life, powering the throat gears.", "positive");
              },
            },
            {
              id: "fuel-air-spark",
              title: "Fuel → Air → Spark",
              description: "Prime before lighting.",
              outcome: "failure",
              effect: (gameState) => adjustSanity(gameState, -8, "A misfire rattles your senses."),
            },
            {
              id: "air-fuel-spark",
              title: "Air → Fuel → Spark",
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
          body: "The mechanic demands either your time or sanity to fine-tune the ignition.",
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
              id: "trade-time",
              title: "Spend time",
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
              description: "Spend time to ensure correctness.",
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
const sceneBoard = document.getElementById("scene-board");
const sceneTitle = document.getElementById("scene-title");
const sceneDescription = document.getElementById("scene-description");
const sceneObjective = document.getElementById("scene-objective");
const inventoryList = document.getElementById("inventory-items");
const logPanel = document.getElementById("log");
const sanityFill = document.getElementById("sanity-fill");
const sanityValue = document.getElementById("sanity-value");
const clockLabel = document.getElementById("clock");
const proceedBtn = document.getElementById("proceed-btn");
const restartBtn = document.getElementById("restart-btn");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalChoices = document.getElementById("modal-choices");
const modalClose = document.getElementById("modal-close");

const gameState = {
  sanity: GAME_CONFIG.startingSanity,
  drainRate: GAME_CONFIG.baseDrain,
  timeRemaining: GAME_CONFIG.startingTimeSeconds,
  scenesQueue: [],
  sceneAssignments: {},
  currentSceneIndex: 0,
  inventory: [],
  inventoryIds: new Set(),
  sceneState: {},
  flags: {},
  loop: null,
  gameOver: false,
};

function resetGameState() {
  gameState.sanity = GAME_CONFIG.startingSanity;
  gameState.drainRate = GAME_CONFIG.baseDrain;
  gameState.timeRemaining = GAME_CONFIG.startingTimeSeconds;
  gameState.scenesQueue = chooseScenes(GAME_CONFIG.runLength);
  gameState.sceneAssignments = assignArtifacts(gameState.scenesQueue);
  gameState.currentSceneIndex = 0;
  gameState.inventory = [];
  gameState.inventoryIds = new Set();
  gameState.sceneState = {};
  gameState.flags = {};
  gameState.gameOver = false;
  clearLog();
  addLog("The hourglass seals around you. Find the artifacts and escape.", "system");
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

function renderScene() {
  const scene = gameState.scenesQueue[gameState.currentSceneIndex];
  if (!scene) {
    completeRun();
    return;
  }
  const sceneState = ensureSceneState(scene.id);
  sceneBoard.innerHTML = "";
  sceneBoard.style.background = scene.boardStyle;
  sceneTitle.textContent = scene.name;
  sceneDescription.textContent = scene.description;
  sceneObjective.textContent = describeObjective(scene, sceneState);
  proceedBtn.disabled = !sceneState.flags.exitReady;

  for (const hotspot of scene.hotspots) {
    const button = template.content.firstElementChild.cloneNode(true);
    button.textContent = hotspot.label;
    button.style.left = `${hotspot.x}%`;
    button.style.top = `${hotspot.y}%`;
    if (sceneState.resolvedHotspots.has(hotspot.id)) {
      button.classList.add("resolved");
    }
    button.addEventListener("click", () => handleHotspot(scene, hotspot));
    sceneBoard.appendChild(button);
  }
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

function ensureSceneState(sceneId) {
  if (!gameState.sceneState[sceneId]) {
    gameState.sceneState[sceneId] = {
      resolvedHotspots: new Set(),
      puzzles: {},
      flags: {},
      dialogues: {},
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
  sceneState.resolvedHotspots.add(hotspot.id);
  gameState.inventory.push({ artifact, sceneId: scene.id });
  gameState.inventoryIds.add(artifact.id);

  const context = { scene, hotspot, sceneState, artifact };
  artifact.apply(gameState, context);

  updateInventoryUI();
  addLog(`${artifact.name} claimed.`, "system");
  renderScene();
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

  const autoSolve = checkAutoSolve(scene, hotspot, sceneState);
  if (autoSolve) {
    sceneState.puzzles[puzzle.id] = true;
    sceneState.resolvedHotspots.add(hotspot.id);
    addLog("Insight floods in— the puzzle resolves itself.", "positive");
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
    addLog("The exit resists—resolve the chamber first.");
    return;
  }
  gameState.currentSceneIndex += 1;
  if (gameState.currentSceneIndex >= gameState.scenesQueue.length) {
    completeRun();
  } else {
    addLog("You descend deeper into the hourglass.", "system");
    proceedBtn.disabled = true;
    renderScene();
  }
}

function updateInventoryUI() {
  inventoryList.innerHTML = "";
  for (const entry of gameState.inventory) {
    const li = document.createElement("li");
    li.className = "inventory-item";
    const artifact = entry.artifact;
    li.innerHTML = `
      <span class="name">${artifact.name}</span>
      <span class="tags">${artifact.rarity.toUpperCase()}</span>
      <span class="effects">${[artifact.positive, artifact.neutral, artifact.negative]
        .filter(Boolean)
        .map((text) => `• ${text}`)
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
  const elapsed = Math.max(0, GAME_CONFIG.startingTimeSeconds - gameState.timeRemaining);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateHud() {
  const sanity = Math.max(0, Math.min(100, gameState.sanity));
  sanityFill.style.width = `${sanity}%`;
  sanityValue.textContent = `${Math.round(sanity)}%`;
  clockLabel.textContent = formatTime(gameState.timeRemaining);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function adjustSanity(gameState, amount, message) {
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
  gameState.timeRemaining = Math.max(0, Math.min(900, gameState.timeRemaining + amount));
  if (message) {
    addLog(message, amount >= 0 ? "positive" : "negative");
  }
  if (gameState.timeRemaining <= 0) {
    endRun("The sands run dry. Time collapses.");
  }
}

function currentScene() {
  return gameState.scenesQueue[gameState.currentSceneIndex];
}

function startLoop() {
  gameState.loop = setInterval(() => {
    if (gameState.gameOver) return;
    const drain = gameState.drainRate;
    adjustSanity(gameState, -drain);
    if (gameState.gameOver) return;
    adjustTime(gameState, -1);
    updateHud();
  }, 1000);
}

function stopLoop() {
  if (gameState.loop) {
    clearInterval(gameState.loop);
    gameState.loop = null;
  }
}

function endRun(message) {
  if (gameState.gameOver) return;
  gameState.gameOver = true;
  stopLoop();
  proceedBtn.disabled = true;
  openModal({
    title: "Run Failed",
    body: message,
    choices: [],
  });
}

function completeRun() {
  if (gameState.gameOver) return;
  gameState.gameOver = true;
  stopLoop();
  openModal({
    title: "You Escaped",
    body: "You emerge from the hourglass, artifacts humming with untapped potential.",
    choices: [],
  });
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

proceedBtn.addEventListener("click", proceedScene);
restartBtn.addEventListener("click", resetGameState);
modalClose.addEventListener("click", closeModal);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
});

resetGameState();

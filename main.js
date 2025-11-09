const BUILD_VERSION = "0.5.0";

const GAME_CONFIG = {
  runLength: 5,
  tickIntervalMs: 1400,
};

const BASE_RARITY_WEIGHTS = {
  common: 5,
  uncommon: 4,
  rare: 3.2,
  legendary: 1.6,
  timeless: 1,
};

const RARITY_ORDER = ["common", "uncommon", "rare", "legendary", "timeless"];

const SEED_MAX = 1_000_000_000;
const LOG_HISTORY_LIMIT = 120;
const DEFAULT_INVITE_STATUS = "Share this link with allies to join your hourglass.";

let activeRng = null;
let coopSync = null;
let coopBroadcastScheduled = false;
let coopApplyingSnapshot = false;
const logHistory = [];
let pendingSessionJoin = null;
let inviteStatusTimer = null;

if (typeof window !== "undefined" && window.location) {
  try {
    const currentUrl = new URL(window.location.href);
    const sessionParam = currentUrl.searchParams.get("session");
    if (sessionParam) {
      pendingSessionJoin = sessionParam;
      currentUrl.searchParams.delete("session");
      const cleanedSearch = currentUrl.searchParams.toString();
      const cleanUrl =
        currentUrl.pathname +
        (cleanedSearch ? `?${cleanedSearch}` : "") +
        (currentUrl.hash || "");
      if (typeof history !== "undefined" && history.replaceState) {
        history.replaceState(null, "", cleanUrl);
      }
    }
  } catch (error) {
    console.warn("Failed to parse invite parameters:", error);
  }
}

function generateSeed() {
  return Math.floor(Math.random() * SEED_MAX);
}

function createRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state ^ (state >>> 15);
    t = Math.imul(t, 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setActiveRng(rng) {
  activeRng = typeof rng === "function" ? rng : null;
}

function useRandom() {
  return activeRng ? activeRng() : Math.random();
}

function randomInt(max) {
  return Math.floor(useRandom() * Math.max(1, max));
}

function randomInRange(min, max) {
  if (max <= min) return min;
  return min + useRandom() * (max - min);
}

function randomChoice(array) {
  if (!array || !array.length) return undefined;
  return array[randomInt(array.length)];
}

function buildInviteLink(sessionId) {
  if (!sessionId || typeof window === "undefined" || !window.location) return "";
  const base = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams(window.location.search);
  params.delete("session");
  params.set("session", sessionId);
  const query = params.toString();
  const hash = window.location.hash || "";
  return `${base}${query ? `?${query}` : ""}${hash}`;
}

const AUDIO_FILES = {
  ambient: "assets/audio/ambient-steam.wav",
  relic: "assets/audio/relic-chime.wav",
  combo: "assets/audio/relic-burst.wav",
};

const GACHA_BONUS_WEIGHTS = {
  rare: 1.3,
  legendary: 1.8,
  timeless: 1.5,
};

const MILESTONE_EVENTS = [
  {
    rooms: 2,
    log: "Echoed sands align - your team steadies its breathing.",
    effect(state) {
      adjustSanity(state, +6, "Focused breaths bolster the group's composure.");
    },
  },
  {
    rooms: 4,
    log: "Hidden clockworks sync with your steps, unlocking a relic pulse.",
    effect(state) {
      state.gachaCharges += 1;
      updateGachaUI();
    },
  },
  {
    rooms: 6,
    log: "Temporal harmonics resonate; momentum cools for a brief respite.",
    effect(state) {
      coolMomentum(10);
    },
  },
];

const MAX_COOP_PLAYERS = 4;
const DEFAULT_PLAYER_NAMES = ["Navigator", "Artificer", "Chrononaut", "Seer"];

const FALLBACK_GAME_MODES = {
  casual: {
    label: "Casual",
    description: "Flux is gentle and discovery is generous.",
    settings: {
      startingSanity: 140,
      baseDrain: 0.5,
      momentumCap: 150,
      surgeMultiplier: 0.75,
      rarityBias: { rare: 1.6, legendary: 2.0, timeless: 1.7 },
      discoveryBoost: 1.45,
      comboIntensity: 1.3,
      gachaBonus: 1.6,
      puzzleSkew: 0.8,
    },
  },
  easy: {
    label: "Easy",
    description: "Measured flux, accessible relic cadence.",
    settings: {
      startingSanity: 120,
      baseDrain: 0.85,
      momentumCap: 125,
      surgeMultiplier: 0.95,
      rarityBias: { rare: 1.35, legendary: 1.7, timeless: 1.45 },
      discoveryBoost: 1.25,
      comboIntensity: 1.1,
      gachaBonus: 1.35,
      puzzleSkew: 0.95,
    },
  },
  normal: {
    label: "Normal",
    description: "The standard hourglass experience.",
    settings: {
      startingSanity: 100,
      baseDrain: 1.05,
      momentumCap: 100,
      surgeMultiplier: 1.05,
      rarityBias: { rare: 1.1, legendary: 1.35, timeless: 1.2 },
      discoveryBoost: 1.0,
      comboIntensity: 1.0,
      gachaBonus: 1.0,
      puzzleSkew: 1.0,
    },
  },
  hard: {
    label: "Hard",
    description: "Flux surges strike harder; stability is fleeting.",
    settings: {
      startingSanity: 80,
      baseDrain: 1.55,
      momentumCap: 85,
      surgeMultiplier: 1.4,
      rarityBias: { rare: 0.95, legendary: 1.15, timeless: 1.05 },
      discoveryBoost: 0.85,
      comboIntensity: 0.9,
      gachaBonus: 0.9,
      puzzleSkew: 1.25,
    },
  },
  timeless: {
    label: "Timeless",
    description: "Relentless chaos, perilous drains, exceptional rewards.",
    settings: {
      startingSanity: 65,
      baseDrain: 1.95,
      momentumCap: 70,
      surgeMultiplier: 1.85,
      rarityBias: { rare: 1.8, legendary: 2.4, timeless: 2.2 },
      discoveryBoost: 1.6,
      comboIntensity: 1.45,
      gachaBonus: 1.9,
      puzzleSkew: 1.5,
    },
  },
};

const FALLBACK_RUN_LENGTHS = {
  "very-short": { label: "Very Short", rooms: 3 },
  short: { label: "Short", rooms: 5 },
  normal: { label: "Normal", rooms: 10 },
  long: { label: "Long", rooms: 20 },
  "very-long": { label: "Very Long", rooms: 50 },
  timeless: { label: "Timeless", rooms: Infinity },
};

const FALLBACK_ARTIFACT_DEFS = [
  {
    id: "chronoLens",
    name: "Chrono Lens",
    rarity: "uncommon",
    summary: "Reveals phase-bloomed passages while taxing your focus.",
    positive: "Highlights hidden mechanisms in the current chamber.",
    negative: "The heightened perception drags at your composure, raising drain.",
    neutral: "You glimpse flickers of alternate flows overlapping the room.",
    applyScript: `(gameState, context) => {
      context.sceneState.flags.revealedPaths = true;
      gameState.drainRate = Math.min(3.5, gameState.drainRate + 0.25);
      addLog(
        \`\${context.artifact.name} reveals phase-bloomed passageways within \${context.scene.name}.\`,
        "positive"
      );
      addLog("The clarity is dizzying; the flux claws at your attention.", "negative");
    }`,
  },
  {
    id: "brassFamiliar",
    name: "Brass Familiar",
    rarity: "common",
    summary: "A mechanical sparrow that offers help while siphoning stored calm.",
    positive: "Restores a portion of sanity and provides a hint for intricate puzzles.",
    negative: "Siphons ambient calm to power its tiny gears.",
    neutral: "Its ticking harmonizes with the hourglass pulse.",
    applyScript: `(gameState, context) => {
      adjustSanity(gameState, +8, "The familiar chirps soothingly.");
      adjustTime(gameState, -20, "The sparrow siphons the flux to power itself.");
      context.sceneState.flags.hintAvailable = true;
    }`,
  },
  {
    id: "temporalAnchor",
    name: "Temporal Anchor",
    rarity: "rare",
    summary: "Stabilizes the slipping present without exacting a toll.",
    positive: "Significantly slows sanity decay for the remainder of the run.",
    negative: null,
    neutral: "You feel the ground stop swaying for a precious moment.",
    applyScript: `(gameState) => {
      gameState.drainRate = Math.max(0.35, gameState.drainRate - 0.6);
      addLog("The anchor steadies your thoughts; sanity ebbs more slowly.", "positive");
    }`,
  },
  {
    id: "cauterizedSand",
    name: "Cauterized Sand",
    rarity: "common",
    summary: "A fistful of glowing grains that can seal fractures or burn your resolve.",
    positive: "Bolsters your sanity and shields against the next sanity loss.",
    negative: "The scorching touch accelerates future sanity decay.",
    neutral: null,
    applyScript: `(gameState, context) => {
      adjustSanity(gameState, +6, "The heated sand sears closed your fear.");
      gameState.drainRate = Math.min(3.5, gameState.drainRate + 0.15);
      context.sceneState.flags.sandWard = true;
      addLog("A lingering warmth coils around you; one shock may be absorbed.", "positive");
    }`,
  },
  {
    id: "paradoxPrism",
    name: "Paradox Prism",
    rarity: "uncommon",
    summary: "Splits flux-lines, gifting you calm while rending your composure.",
    positive: "Extends the calm with borrowed echoes.",
    negative: "Each reflection scrapes at your sanity.",
    neutral: null,
    applyScript: `(gameState) => {
      adjustTime(gameState, +30, "Flux branches outward in shimmering arcs.");
      adjustSanity(gameState, -5, "Your thoughts echo uncomfortably.");
    }`,
  },
  {
    id: "mnemonicCoil",
    name: "Mnemonic Coil",
    rarity: "common",
    summary: "Stores puzzle solutions at the price of buried memories.",
    positive: "Unlocks an insight that solves complex machinery.",
    negative: "Forgets stabilizing thoughts, lowering sanity.",
    neutral: null,
    applyScript: `(gameState, context) => {
      adjustSanity(gameState, -6, "Memories slough away to feed the coil.");
      context.sceneState.flags.autoSolve = true;
      addLog("New pathways unfold in your mind; some mechanisms seem trivial now.", "positive");
    }`,
  },
  {
    id: "hourwardenSigil",
    name: "Hourwarden Sigil",
    rarity: "rare",
    summary: "A keeper's emblem that commands the sands without backlash.",
    positive: "Unlocks a guaranteed escape route from one chamber.",
    negative: null,
    neutral: "The sigil vibrates with an ancient vow.",
    applyScript: `(gameState) => {
      gameState.flags.freeEscape = true;
      addLog("The sigil hums--one barrier this run will yield without question.", "positive");
    }`,
  },
];

let GAME_MODES = JSON.parse(JSON.stringify(FALLBACK_GAME_MODES));
let RUN_LENGTHS = JSON.parse(JSON.stringify(FALLBACK_RUN_LENGTHS));
let artifacts = [];
const artifactMap = new Map();

const DATA_PATHS = {
  modes: "data/config/modes.json",
  runLengths: "data/config/runLengths.json",
  artifactsIndex: "data/artifacts/index.json",
  artifact: (file) => `data/artifacts/${file}`,
};

let dataReadyPromise = null;

function sanitizeText(value) {
  if (value === null || value === undefined) return value;
  return String(value)
    .replace(/\u2014/g, "--")
    .replace(/\u2013/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\uFFFD/g, "");
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cloneFallback(value) {
  return JSON.parse(
    JSON.stringify(
      value,
      (_, v) => {
        if (v === Infinity) return "__FALLBACK_INF__";
        if (v === -Infinity) return "__FALLBACK_NINF__";
        return v;
      }
    ),
    (_, v) => {
      if (v === "__FALLBACK_INF__") return Infinity;
      if (v === "__FALLBACK_NINF__") return -Infinity;
      return v;
    }
  );
}

function normalizeGameModes(raw) {
  const result = cloneFallback(FALLBACK_GAME_MODES);
  if (!raw || typeof raw !== "object") return result;
  for (const [key, def] of Object.entries(raw)) {
    if (!def || typeof def !== "object") continue;
    const base = result[key] || {
      label: key,
      description: "",
      settings: cloneFallback(FALLBACK_GAME_MODES.normal.settings),
    };
    const label = sanitizeText(def.label ?? base.label ?? key);
    const description = sanitizeText(def.description ?? base.description ?? "");
    const settings = {
      ...base.settings,
      ...(def.settings || {}),
    };
    if (base.settings?.rarityBias || def.settings?.rarityBias) {
      settings.rarityBias = {
        ...(base.settings?.rarityBias || {}),
        ...(def.settings?.rarityBias || {}),
      };
    }
    settings.startingSanity = Number.isFinite(Number(settings.startingSanity))
      ? Number(settings.startingSanity)
      : base.settings.startingSanity;
    settings.baseDrain = Number.isFinite(Number(settings.baseDrain))
      ? Number(settings.baseDrain)
      : base.settings.baseDrain;
    settings.momentumCap = Number.isFinite(Number(settings.momentumCap))
      ? Number(settings.momentumCap)
      : base.settings.momentumCap;
    settings.surgeMultiplier = Number.isFinite(Number(settings.surgeMultiplier))
      ? Number(settings.surgeMultiplier)
      : base.settings.surgeMultiplier;
    settings.discoveryBoost = Number.isFinite(Number(settings.discoveryBoost))
      ? Number(settings.discoveryBoost)
      : base.settings.discoveryBoost;
    settings.comboIntensity = Number.isFinite(Number(settings.comboIntensity))
      ? Number(settings.comboIntensity)
      : base.settings.comboIntensity;
    settings.gachaBonus = Number.isFinite(Number(settings.gachaBonus))
      ? Number(settings.gachaBonus)
      : base.settings.gachaBonus ?? 1;
    settings.puzzleSkew = Number.isFinite(Number(settings.puzzleSkew))
      ? Number(settings.puzzleSkew)
      : base.settings.puzzleSkew ?? 1;
    settings.rarityBias = settings.rarityBias || base.settings.rarityBias || {};
    result[key] = { label, description, settings };
  }
  return result;
}

function normalizeRunLengths(raw) {
  const result = cloneFallback(FALLBACK_RUN_LENGTHS);
  if (!raw || typeof raw !== "object") return result;
  for (const [key, def] of Object.entries(raw)) {
    if (!def || typeof def !== "object") continue;
    const roomsValue =
      def.rooms === null || def.rooms === undefined ? Infinity : Number(def.rooms);
    const rooms = Number.isFinite(roomsValue) && roomsValue > 0 ? roomsValue : Infinity;
    const label = sanitizeText(def.label ?? result[key]?.label ?? key);
    result[key] = { label, rooms };
  }
  return result;
}

function sanitizePlayerName(name, index = 0) {
  const trimmed = sanitizeText(name || "").trim();
  if (trimmed) {
    return trimmed.slice(0, 24);
  }
  const fallback = DEFAULT_PLAYER_NAMES[index % DEFAULT_PLAYER_NAMES.length];
  return fallback;
}

function normalizeCoopPlayers(players) {
  if (!Array.isArray(players)) return [];
  return players.slice(0, MAX_COOP_PLAYERS).map((player, index) => ({
    id: player.id ?? `player-${index}`,
    name: sanitizePlayerName(player.name, index),
    maxSanity: Number.isFinite(player.maxSanity) ? player.maxSanity : 0,
    sanity: Number.isFinite(player.sanity) ? player.sanity : 0,
    status: player.status || "steady",
  }));
}

function stripTags(value) {
  if (!value) return "";
  return String(value).replace(/<[^>]*>/g, "");
}

function isReadOnly() {
  return gameState.readonly === true;
}

function setReadOnlyMode(enabled) {
  const next = !!enabled;
  gameState.readonly = next;
  if (bodyEl) {
    bodyEl.classList.toggle("observer-mode", next);
  }
  if (next && proceedBtn) {
    proceedBtn.disabled = true;
  }
  if (observerBanner) {
    observerBanner.textContent = next ? "Observer Mode" : "Active Control";
  }
  if (gachaRollBtn) {
    if (next) {
      gachaRollBtn.disabled = true;
    }
    updateGachaUI();
  }
}

function ensureHostSession(overrides = {}) {
  if (partyMode !== "multi") return null;
  if (!coopSync || !coopSync.startHostSession) return null;
  if (coopSync.isClient && coopSync.isClient()) return null;
  const modeKey = overrides.modeKey || getSelectedMode();
  const lengthKey = overrides.lengthKey || getSelectedLengthKey();
  const playersSource = lobbyPlayers.length ? lobbyPlayers : gameState.players;
  const players = normalizeCoopPlayers(playersSource);
  const baseSeed = gameState.seed && gameState.seed !== 0 ? gameState.seed : generateSeed();
  const config = {
    sessionId:
      overrides.sessionId ||
      gameState.sessionId ||
      (coopSync.sessionId ? coopSync.sessionId() : null),
    modeKey,
    lengthKey,
    seed: overrides.seed || baseSeed,
    players,
    partyMode: "multi",
  };
  const sessionId = coopSync.startHostSession(config);
  if (sessionId) {
    gameState.sessionId = sessionId;
  }
  updateInviteLinkUI();
  return sessionId;
}

function setInviteStatus(message, timeout = 0) {
  if (!inviteStatus) return;
  inviteStatus.textContent = message || DEFAULT_INVITE_STATUS;
  if (inviteStatusTimer) {
    clearTimeout(inviteStatusTimer);
    inviteStatusTimer = null;
  }
  if (timeout > 0) {
    inviteStatusTimer = setTimeout(() => {
      inviteStatus.textContent = DEFAULT_INVITE_STATUS;
      inviteStatusTimer = null;
    }, timeout);
  }
}

function updateInviteLinkUI(statusMessage) {
  if (!inviteSection || !inviteLinkInput || !inviteCopyBtn) return;
  const isMulti = partyMode === "multi";
  const isHost = coopSync && coopSync.isHost && coopSync.isHost();
  const sessionId = gameState.sessionId || (coopSync && coopSync.sessionId && coopSync.sessionId());
  if (isMulti && isHost && sessionId) {
    const link = buildInviteLink(sessionId);
    inviteSection.classList.remove("hidden");
    inviteLinkInput.disabled = false;
    inviteLinkInput.value = link || "Preparing session...";
    inviteCopyBtn.disabled = !link;
    setInviteStatus(statusMessage || DEFAULT_INVITE_STATUS);
  } else if (isMulti && isHost) {
    inviteSection.classList.remove("hidden");
    inviteLinkInput.disabled = true;
    inviteLinkInput.value = "Preparing session...";
    inviteCopyBtn.disabled = true;
    setInviteStatus("Preparing session link...");
  } else {
    inviteSection.classList.add("hidden");
    inviteLinkInput.disabled = true;
    inviteLinkInput.value = "Preparing session...";
    inviteCopyBtn.disabled = true;
    setInviteStatus(DEFAULT_INVITE_STATUS);
  }
}

async function handleInviteCopy() {
  if (!inviteLinkInput || !inviteCopyBtn) return;
  const link = inviteLinkInput.value.trim();
  if (!link || inviteCopyBtn.disabled) {
    setInviteStatus("Session link is still preparing.");
    return;
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
    } else if (typeof document !== "undefined" && document.execCommand) {
      inviteLinkInput.select();
      document.execCommand("copy");
      inviteLinkInput.blur();
    } else {
      throw new Error("Clipboard API unavailable");
    }
    setInviteStatus("Invite link copied to clipboard.", 2200);
  } catch (error) {
    console.warn("Failed to copy invite link:", error);
    setInviteStatus("Copy failed. Select and copy manually.");
  }
}

function loadSoloName() {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem("ttla:soloName");
  } catch (error) {
    console.warn("Failed to load solo name:", error);
    return null;
  }
}

function saveSoloName(name) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem("ttla:soloName", name);
  } catch (error) {
    console.warn("Failed to persist solo name:", error);
  }
}

function initializeLobbyPlayers() {
  if (lobbyPlayers.length) return;
  let loaded = [];
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem("ttla:coopPlayers");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          loaded = parsed
            .slice(0, MAX_COOP_PLAYERS)
            .map((player, index) => ({
              id: Number(player.id) || lobbyIdCounter++,
              name: sanitizePlayerName(player.name, index),
            }));
        }
      }
    } catch (error) {
      console.warn("Failed to load lobby players:", error);
    }
  }
  if (!loaded.length) {
    loaded = [{ id: lobbyIdCounter++, name: DEFAULT_PLAYER_NAMES[0] }];
  }
  lobbyPlayers = loaded;
  const maxId = lobbyPlayers.reduce((max, player) => Math.max(max, player.id), 0);
  lobbyIdCounter = Math.max(maxId + 1, lobbyIdCounter);
}

function saveLobbyPlayers() {
  if (typeof localStorage === "undefined") return;
  try {
    const payload = lobbyPlayers.map((player) => ({
      id: player.id,
      name: player.name,
    }));
    localStorage.setItem("ttla:coopPlayers", JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to save lobby players:", error);
  }
}

function getSelectedPartyMode() {
  const selected = partyModeInputs ? partyModeInputs.find((input) => input.checked) : null;
  return selected ? selected.value : partyMode;
}

function setPartyMode(mode, options = {}) {
  partyMode = mode || "solo";
  gameState.partyMode = partyMode;
  if (!options.skipRadio && partyModeInputs) {
    partyModeInputs.forEach((input) => {
      input.checked = input.value === partyMode;
    });
  }
  if (partyMode === "solo") {
    if (soloNameArea) soloNameArea.classList.remove("hidden");
    if (openLobbyBtn) openLobbyBtn.classList.add("hidden");
    handleSoloNameSave();
    if (coopSync && coopSync.endSession) {
      coopSync.endSession(true);
    }
    gameState.sessionId = null;
  } else {
    if (soloNameArea) soloNameArea.classList.add("hidden");
    if (openLobbyBtn) openLobbyBtn.classList.remove("hidden");
    if (!options.deferSync) {
      syncLobbyToGameState();
    }
    renderPartySummary();
    ensureHostSession();
  }
  updateInviteLinkUI();
  updateTitleNavigation();
}

function handleSoloNameSave() {
  if (!soloNameInput) return;
  const sanitized = sanitizePlayerName(soloNameInput.value || soloPlayerName || DEFAULT_PLAYER_NAMES[0], 0);
  soloPlayerName = sanitized;
  soloNameInput.value = sanitized;
  saveSoloName(sanitized);
  if (partyMode === "solo") {
    syncLobbyToGameState();
    renderPartySummary();
  }
}

function renderPartySummary() {
  if (!partyRoster) return;
  if (partyMode === "solo") {
    const name = sanitizePlayerName(
      soloPlayerName || (soloNameInput ? soloNameInput.value : "") || DEFAULT_PLAYER_NAMES[0],
      0
    );
    soloPlayerName = name;
    if (soloNameInput) soloNameInput.value = name;
    partyRoster.innerHTML = `<span class="party-chip">${escapeHtml(name)}</span>`;
    if (openLobbyBtn) openLobbyBtn.classList.add("hidden");
    if (soloNameArea) soloNameArea.classList.remove("hidden");
  } else {
    if (openLobbyBtn) openLobbyBtn.classList.remove("hidden");
    if (soloNameArea) soloNameArea.classList.add("hidden");
    if (!lobbyPlayers.length) {
      partyRoster.innerHTML = `<span class="party-empty">Add players in the lobby.</span>`;
    } else {
      partyRoster.innerHTML = lobbyPlayers
        .map((player) => `<span class="party-chip">${escapeHtml(player.name)}</span>`)
        .join("");
    }
  }
  updateTitleNavigation();
  updateInviteLinkUI();
  if (partyMode === "multi") {
    queueCoopBroadcast();
  }
}

function updateTitleNavigation() {
  if (!titleSteps || !titleSteps.length) return;
  if (titleStepIndex >= titleSteps.length) {
    titleStepIndex = titleSteps.length - 1;
  }
  if (titleStepIndex < 0) {
    titleStepIndex = 0;
  }
  titleSteps.forEach((step, index) => {
    step.classList.toggle("active", index === titleStepIndex);
  });
  if (titlePrevBtn) {
    titlePrevBtn.disabled = titleStepIndex === 0;
  }
  if (titleNextBtn) {
    const isFinal = titleSteps.length ? titleStepIndex === titleSteps.length - 1 : false;
    if (titleNextBtn.dataset.loading !== "true") {
      titleNextBtn.textContent = isFinal ? "Start Run" : titleNextDefaultLabel;
    }
  }
  if (titleProgress && titleSteps.length) {
    titleProgress.textContent = `Step ${Math.min(titleStepIndex + 1, titleSteps.length)} of ${titleSteps.length}`;
  }
}

function validateTitleStep(stepIndex) {
  if (stepIndex === 0) {
    if (partyMode === "solo") {
      handleSoloNameSave();
      const name = soloPlayerName || (soloNameInput ? soloNameInput.value.trim() : "");
      if (!name) {
        pushToast({
          title: "Codename Needed",
          bodyHtml: "Enter a codename before proceeding.",
          tone: "negative",
        });
        if (soloNameInput) soloNameInput.focus();
        return false;
      }
    } else {
      if (!lobbyPlayers.length) {
        pushToast({
          title: "Lobby Empty",
          bodyHtml: "Add at least one player to the lobby.",
          tone: "negative",
        });
        openLobbyModal();
        return false;
      }
    }
  }
  return true;
}

function handleTitlePrev() {
  if (titleStepIndex <= 0) return;
  titleStepIndex -= 1;
  updateTitleNavigation();
}

function handleTitleNext() {
  if (!validateTitleStep(titleStepIndex)) return;
  if (!titleSteps.length || titleStepIndex >= titleSteps.length - 1) {
    audioManager.unlock();
    if (lobbyOverlay && !lobbyOverlay.classList.contains("hidden")) {
      closeLobbyModal();
    }
    startNewRun();
    return;
  }
  titleStepIndex += 1;
  updateTitleNavigation();
}

function openLobbyModal() {
  if (!lobbyOverlay) return;
  if (partyMode === "multi") {
    ensureHostSession();
  }
  renderLobby();
  updateInviteLinkUI();
  lobbyOverlay.classList.remove("hidden");
  requestAnimationFrame(() => lobbyOverlay.classList.add("active"));
}

function closeLobbyModal() {
  if (!lobbyOverlay || lobbyOverlay.classList.contains("hidden")) return;
  lobbyOverlay.classList.remove("active");
  setTimeout(() => {
    lobbyOverlay.classList.add("hidden");
  }, 220);
  syncLobbyToGameState();
  renderPartySummary();
  updateTitleNavigation();
}

function renderLobby() {
  if (!lobbyList) return;
  lobbyList.innerHTML = "";
  lobbyPlayers.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "lobby-player";
    row.dataset.playerId = String(player.id);

    const input = document.createElement("input");
    input.type = "text";
    input.value = player.name;
    input.maxLength = 24;
    input.addEventListener("input", (event) => {
      updateLobbyPlayerName(player.id, event.target.value);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "ghost";
    removeBtn.textContent = "Remove";
    removeBtn.disabled = lobbyPlayers.length <= 1;
    removeBtn.addEventListener("click", () => removeLobbyPlayer(player.id));

    row.appendChild(input);
    row.appendChild(removeBtn);
    lobbyList.appendChild(row);
  });
  const atCapacity = lobbyPlayers.length >= MAX_COOP_PLAYERS;
  if (lobbyAddBtn) lobbyAddBtn.disabled = atCapacity;
  if (lobbyNameInput) lobbyNameInput.disabled = atCapacity;
  if (partyMode === "multi") {
    ensureHostSession();
  }
  updateTeamHud();
  renderPartySummary();
  updateInviteLinkUI();
}

function addLobbyPlayer(name) {
  if (lobbyPlayers.length >= MAX_COOP_PLAYERS) return;
  const newName = sanitizePlayerName(name, lobbyPlayers.length);
  lobbyPlayers.push({ id: lobbyIdCounter++, name: newName });
  saveLobbyPlayers();
  renderLobby();
}

function removeLobbyPlayer(id) {
  if (lobbyPlayers.length <= 1) return;
  lobbyPlayers = lobbyPlayers.filter((player) => player.id !== id);
  saveLobbyPlayers();
  renderLobby();
}

function updateLobbyPlayerName(id, name) {
  const player = lobbyPlayers.find((p) => p.id === id);
  if (!player) return;
  const sanitized = sanitizePlayerName(name, lobbyPlayers.indexOf(player));
  player.name = sanitized;
  saveLobbyPlayers();
  updateTeamHud();
  renderPartySummary();
}

function syncLobbyToGameState() {
  if (partyMode === "multi") {
    if (!lobbyPlayers.length) {
      lobbyPlayers.push({ id: lobbyIdCounter++, name: sanitizePlayerName(DEFAULT_PLAYER_NAMES[0], 0) });
      saveLobbyPlayers();
    }
    gameState.players = lobbyPlayers.slice(0, MAX_COOP_PLAYERS).map((player) => ({
      id: player.id,
      name: player.name,
    }));
    ensureHostSession();
  } else {
    const name = sanitizePlayerName(
      soloPlayerName || (soloNameInput ? soloNameInput.value : "") || DEFAULT_PLAYER_NAMES[0],
      0
    );
    soloPlayerName = name;
    if (soloNameInput) soloNameInput.value = name;
    gameState.players = [
      {
        id: "solo-1",
        name,
      },
    ];
  }
  updateTeamHud();
  updateInviteLinkUI();
  queueCoopBroadcast();
}

function preparePlayerStats(totalSanity) {
  const party = gameState.players;
  if (!party || !party.length) return;
  const partySize = party.length;
  const baseShare = Math.max(1, Math.floor(totalSanity / partySize));
  let remainder = Math.max(0, totalSanity - baseShare * partySize);
  for (const player of party) {
    const share = baseShare + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    player.maxSanity = share;
    player.sanity = share;
    player.status = "steady";
  }
}

function highlightKeywords(text) {
  if (!text) return "";
  return text.replace(/\b(sanity|calm|flux|momentum|relic|artifact|surge|hint)\b/gi, (match) => {
    return `<span class="keyword">${match}</span>`;
  });
}

function formatParagraph(text) {
  if (!text) return "";
  return highlightKeywords(escapeHtml(text)).replace(/\n/g, "<br>");
}

const impactTracker = {
  session: null,
  begin(label, source) {
    this.session = {
      label: sanitizeText(label || ""),
      source,
      entries: [],
    };
  },
  record(type, amount, extra = {}) {
    if (!this.session) return;
    if (!amount) return;
    const key = `${type}:${extra.direction || "none"}`;
    const existing = this.session.entries.find((entry) => entry.key === key);
    if (existing) {
      existing.amount += amount;
      if (extra.message) {
        existing.messages = existing.messages || [];
        existing.messages.push(extra.message);
      }
    } else {
      this.session.entries.push({
        key,
        type,
        amount,
        direction: extra.direction,
        messages: extra.message ? [extra.message] : [],
      });
    }
  },
  flush(options = {}) {
    if (!this.session) return null;
    const session = this.session;
    this.session = null;
    const meaningful = session.entries.filter((entry) => entry.amount);
    if (!meaningful.length) return null;
    const tone = options.tone || resolveImpactTone(meaningful);
    const title = options.title || session.label || "Outcome";
    const body = meaningful.map(describeImpact).join("<br>");
    if (!options.silent) {
      pushToast({ title, bodyHtml: body, tone });
    }
    return { entries: meaningful, tone, title, bodyHtml: body };
  },
};

function resolveImpactTone(entries) {
  if (!entries || !entries.length) return "neutral";
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  if (total > 0) return "positive";
  if (total < 0) return "negative";
  return "neutral";
}

function describeImpact(entry) {
  const amount = entry.amount;
  switch (entry.type) {
    case "sanity":
      return `${formatImpactLabel("Sanity")}: ${formatImpactDelta(amount)}`;
    case "time":
      return `${formatImpactLabel(entry.direction === "calm" ? "Calm" : "Flux")}: ${formatImpactDelta(amount)}`;
    case "momentum": {
      const direction = entry.direction === "cool" ? "cooled" : "heated";
      return `${formatImpactLabel("Momentum")}: ${formatImpactDelta(amount)} (${direction})`;
    }
    default:
      return `${formatImpactLabel(entry.type)}: ${formatImpactDelta(amount)}`;
  }
}

function formatImpactLabel(label) {
  return escapeHtml(label);
}

function formatImpactDelta(amount) {
  const rounded = Math.round(amount * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}`;
}

function runWithImpact(label, source, fn, options = {}) {
  impactTracker.begin(label, source);
  let result;
  let impactPayload = null;
  try {
    result = fn();
  } finally {
    impactPayload = impactTracker.flush({
      title: sanitizeText(options.title || label),
      tone: options.tone,
      silent: options.silent,
    });
    if (options.onFlush) {
      options.onFlush(impactPayload);
    }
  }
  return { result, impact: impactPayload };
}

let toastCounter = 0;

function pushToast({ title, bodyHtml, tone = "neutral", timeout = 4200 }) {
  if (!toastLayer) return;
  const toast = document.createElement("article");
  toast.className = "toast";
  if (tone && tone !== "neutral") {
    toast.classList.add(tone);
  }
  toast.dataset.toastId = `${++toastCounter}`;
  if (title) {
    const titleEl = document.createElement("header");
    titleEl.className = "toast-title";
    titleEl.innerHTML = escapeHtml(title);
    toast.appendChild(titleEl);
  }
  if (bodyHtml) {
    const bodyEl = document.createElement("div");
    bodyEl.className = "toast-body";
    bodyEl.innerHTML = bodyHtml;
    toast.appendChild(bodyEl);
  }
  toastLayer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  const remove = () => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  };
  toast.addEventListener("click", remove, { once: true });
  setTimeout(remove, timeout);
}

async function loadJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function hydrateArtifact(definition) {
  const artifact = {
    id: definition.id,
    name: sanitizeText(definition.name),
    rarity: definition.rarity,
    summary: sanitizeText(definition.summary),
    positive: sanitizeText(definition.positive),
    negative: sanitizeText(definition.negative),
    neutral: sanitizeText(definition.neutral),
    effects: Array.isArray(definition.effects) ? JSON.parse(JSON.stringify(definition.effects)) : null,
  };

  if (definition.applyScript) {
    try {
      // eslint-disable-next-line no-eval
      artifact.apply = eval(`(${definition.applyScript})`);
    } catch (error) {
      console.warn(`Failed to parse applyScript for ${artifact.id}:`, error);
    }
  }

  if (!artifact.apply) {
    const effects = artifact.effects || [];
    artifact.apply = (gameState, context) => runArtifactEffects(effects, gameState, context);
  }

  return artifact;
}

function applyFallbackArtifacts() {
  artifacts = FALLBACK_ARTIFACT_DEFS.map((def) => hydrateArtifact(def));
  artifactMap.clear();
  for (const artifact of artifacts) {
    artifactMap.set(artifact.id, artifact);
  }
}

async function loadArtifacts() {
  try {
    const index = await loadJSON(DATA_PATHS.artifactsIndex);
    const files = Array.isArray(index) ? index : index.files || [];
    const definitions = await Promise.all(
      files.map((file) =>
        loadJSON(DATA_PATHS.artifact(file)).then((def) => hydrateArtifact(def))
      )
    );
    artifacts = definitions;
    artifactMap.clear();
    for (const artifact of artifacts) {
      artifactMap.set(artifact.id, artifact);
    }
  } catch (error) {
    console.error("Failed to load artifact data:", error);
    applyFallbackArtifacts();
  }
}

async function loadGameData() {
  try {
    const [modes, lengths] = await Promise.all([
      loadJSON(DATA_PATHS.modes),
      loadJSON(DATA_PATHS.runLengths),
    ]);
    GAME_MODES = normalizeGameModes(modes);
    RUN_LENGTHS = normalizeRunLengths(lengths);
  } catch (error) {
    console.error("Failed to load configuration data:", error);
    GAME_MODES = normalizeGameModes(FALLBACK_GAME_MODES);
    RUN_LENGTHS = normalizeRunLengths(FALLBACK_RUN_LENGTHS);
  }
  await loadArtifacts();
}

function ensureDataReady() {
  if (!dataReadyPromise) {
    dataReadyPromise = loadGameData().catch((error) => {
      console.error("Data loading encountered an error:", error);
      applyFallbackArtifacts();
      return false;
    });
  }
  return dataReadyPromise;
}
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

const TUTORIAL_STEPS = [
  {
    title: "Stabilize the Flux",
    body: "Sanity is your tether. When the flux thaws, interact with hotspots to uncover relics, puzzles, and exits. Keep an eye on the flux indicatorâ€”Frozen means safety, Surging means danger.",
    hints: [
      "Hotspots glow in the chamber; tap to inspect them.",
      "Advancing requires the exit hotspot to be primed.",
    ],
    variant: "flux",
  },
  {
    title: "Hunt the Relics",
    body: "Relics are hidden until you sweep for resonance. Use the Interactions list on mobile to access each hotspot. Some relics synergizeâ€”collecting pairs unlocks powerful bonuses.",
    hints: [
      "Look for clues in the log and descriptions.",
      "Scan assists and hints reveal the correct search action.",
    ],
    variant: "relics",
  },
  {
    title: "Read the Echoes",
    body: "Dialogues and puzzles shift the hourglass. Choices may grant relics, calm the flux, or cost sanity. Mode difficulty applies multipliers to drain, surges, and relic frequency.",
    hints: [
      "Use relic effects to auto-solve complex puzzles.",
      "Some choices now reward bonus relicsâ€”watch for codex updates.",
    ],
    variant: "echo",
  },
  {
    title: "Tune Your Run",
    body: "Visit Options to toggle ambient audio, reduce motion, or review the Codex. Modes reconfigure drain, momentum caps, and rarity weightings so each run feels distinct.",
    hints: [
      "Casual grants extra calm and relic cascades.",
      "Timeless introduces volatile surges but massive relic chains.",
    ],
    variant: "options",
  },
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
      case "grantArtifact": {
        grantArtifactReward(effect, context);
        break;
      }
      case "combo": {
        handleComboEffect(effect, context);
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
      {
        type: "combo",
        requires: ["chronoLoomBand"],
        message: "Brass Loom Spool feeds the Chrono Loom Band, reducing drain even further.",
        effects: [{ type: "drain", amount: -0.1, message: "Clockwork stitches reinforce your focus." }],
      },
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
      {
        type: "combo",
        requires: ["steamDraught"],
        message: "Clockdust mixes with steam, sealing the chamber in gentle suspension.",
        effects: [
          { type: "momentum", direction: "cool", amount: 4, message: "Suspended vapors slow the hourglass heartbeat." },
        ],
      },
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
      {
        type: "combo",
        requires: ["resonantChalk"],
        message: "Lantern Beetle and Resonant Chalk weave a lattice of guidance.",
        effects: [
          { type: "momentum", direction: "cool", amount: 4, message: "Stabilizing lines freeze the swirling sand." },
          {
            type: "scanAssist",
            message: "Illuminated chalkwork auto-highlights dormant relic fonts.",
            tone: "positive",
          },
        ],
        elseMessage: "Chalk markings would let the beetle chart a steadier course.",
        elseTone: "neutral",
      },
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
      {
        type: "combo",
        requires: ["lanternBeetle"],
        message: "Resonant Chalk locks onto the beetle's beam, mapping hidden hollows.",
        effects: [
          { type: "hint", message: "The chalk underlines the precise search motion to take next." },
          { type: "momentum", direction: "cool", amount: 3, message: "Guided light smooths the chamber's turbulence." },
        ],
      },
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
      {
        type: "combo",
        requires: ["clockdustSachet"],
        message: "Steam Draught fuses with clockdust, forming soothing vapor curtains.",
        effects: [
          {
            type: "settle",
            state: "calm",
            ticks: 3,
            message: "The chamber hushes beneath a velveteen fog.",
            tone: "neutral",
          },
        ],
        elseMessage: "Dust-laden air would make the draught much steadier.",
      },
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
      {
        type: "combo",
        requires: ["brassLoomSpool"],
        message: "Chrono Loom Band and Brass Loom Spool braid reinforcements across the chamber.",
        effects: [
          { type: "drain", amount: -0.15, message: "Interlaced threads relieve the flux burden." },
          { type: "shield", message: "Woven cords brace you against the next backlash." },
        ],
      },
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
    rarity: "legendary",
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
    rarity: "legendary",
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
    rarity: "legendary",
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
    rarity: "legendary",
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
    rarity: "legendary",
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
    rarity: "legendary",
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
    rarity: "legendary",
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
    rarity: "legendary",
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
      {
        type: "grantArtifact",
        rarity: "legendary",
        message: "{artifact} unfurls from the Eternum Coil's inner loop.",
        tone: "system",
      },
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
                grantArtifactReward(
                  {
                    pool: ["prismDiver", "sandScribe", "latticeCompass"],
                    message: "{artifact} slides from a hidden alcove the curator reveals.",
                    tone: "system",
                  },
                  context
                );
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
                grantArtifactReward(
                  {
                    rarity: "rare",
                    message: "{artifact} condenses within a memory bottle and floats to your grasp.",
                    tone: "system",
                  },
                  context
                );
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
                grantArtifactReward(
                  {
                    rarity: "legendary",
                    message: "{artifact} spins out of the constellation's core.",
                    tone: "system",
                  },
                  context
                );
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
              effect: (gameState, context) => {
                adjustTime(gameState, +15, "Patience yields understanding.");
                grantArtifactReward(
                  {
                    pool: ["gearwrightGauntlet", "pulseEngineCore", "timestepChalice"],
                    message: "{artifact} clicks into place beside the ignition.",
                    tone: "system",
                  },
                  context
                );
              },
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
const tutorialStepTemplate = document.getElementById("tutorial-step-template");
const titleScreen = document.getElementById("title-screen");
const gameContainer = document.getElementById("game");
const sceneBoard = document.getElementById("scene-board");
const sceneHotspots = document.getElementById("scene-hotspots");
const sceneTitle = document.getElementById("scene-title");
const sceneDescription = document.getElementById("scene-description");
const sceneObjective = document.getElementById("scene-objective");
const sceneActions = document.getElementById("scene-actions");
const sceneActionsHeader = document.getElementById("scene-actions-header");
const inventoryList = document.getElementById("inventory-items");
const gachaRollBtn = document.getElementById("gacha-roll-btn");
const gachaChargesLabel = document.getElementById("gacha-charges");
const artifactDetail = document.getElementById("artifact-detail");
const artifactDetailName = document.getElementById("artifact-detail-name");
const artifactDetailRarity = document.getElementById("artifact-detail-rarity");
const artifactDetailSummary = document.getElementById("artifact-detail-summary");
const artifactDetailEffects = document.getElementById("artifact-detail-effects");
const artifactDetailPositive = document.getElementById("artifact-detail-positive");
const artifactDetailNeutral = document.getElementById("artifact-detail-neutral");
const artifactDetailNegative = document.getElementById("artifact-detail-negative");
const artifactDetailCombos = document.getElementById("artifact-detail-combos");
const logPanel = document.getElementById("log");
const sanityFill = document.getElementById("sanity-fill");
const sanityValue = document.getElementById("sanity-value");
const fluxIndicator = document.getElementById("flux-indicator");
const fluxStateLabel = document.getElementById("flux-state");
const proceedBtn = document.getElementById("proceed-btn");
const restartBtn = document.getElementById("restart-btn");
const returnTitleBtn = document.getElementById("return-title-btn");
const audioToggleBtn = document.getElementById("audio-toggle");
const titleFlow = document.getElementById("title-flow");
const titleSteps = titleFlow ? Array.from(titleFlow.querySelectorAll(".title-step")) : [];
const titlePrevBtn = document.getElementById("title-prev");
const titleNextBtn = document.getElementById("title-next");
const titleProgress = document.getElementById("title-progress");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const titleNextDefaultLabel = titleNextBtn ? sanitizeText(titleNextBtn.textContent || "Next") : "Next";
const tutorialBtn = document.getElementById("tutorial-btn");
const openOptionsBtn = document.getElementById("options-btn");
const tutorialOverlay = document.getElementById("tutorial-overlay");
const tutorialBody = document.getElementById("tutorial-body");
const tutorialPrev = document.getElementById("tutorial-prev");
const tutorialNext = document.getElementById("tutorial-next");
const tutorialClose = document.getElementById("tutorial-close");
const optionsOverlay = document.getElementById("options-overlay");
const optionsClose = document.getElementById("options-close");
const optionsSave = document.getElementById("options-save");
const ambientToggle = document.getElementById("ambient-toggle");
const sfxToggle = document.getElementById("sfx-toggle");
const reducedMotionToggle = document.getElementById("reduced-motion-toggle");
const highContrastToggle = document.getElementById("high-contrast-toggle");
const openCodexBtn = document.getElementById("open-codex");
const lobbyList = document.getElementById("lobby-list");
const lobbyForm = document.getElementById("lobby-form");
const lobbyNameInput = document.getElementById("lobby-name-input");
const lobbyAddBtn = document.getElementById("lobby-add-btn");
const inviteSection = document.getElementById("invite-section");
const inviteLinkInput = document.getElementById("invite-link-input");
const inviteCopyBtn = document.getElementById("invite-copy-btn");
const inviteStatus = document.getElementById("invite-status");
const partyOptionsGroup = document.getElementById("party-options");
const partyModeInputs = partyOptionsGroup
  ? Array.from(partyOptionsGroup.querySelectorAll('input[name="party-mode"]'))
  : [];
const soloNameArea = document.getElementById("solo-name-area");
const partyRoster = document.getElementById("party-roster");
const soloNameInput = document.getElementById("solo-name-input");
const soloNameBtn = document.getElementById("solo-name-btn");
const openLobbyBtn = document.getElementById("open-lobby-btn");
const lobbyOverlay = document.getElementById("lobby-overlay");
const lobbyCloseBtn = document.getElementById("lobby-close");
const lobbyDoneBtn = document.getElementById("lobby-done");
const codexOverlay = document.getElementById("codex-overlay");
const codexClose = document.getElementById("codex-close");
const codexList = document.getElementById("codex-list");
const toastLayer = document.getElementById("toast-layer");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalChoices = document.getElementById("modal-choices");
const modalClose = document.getElementById("modal-close");
const sceneArtCanvas = document.getElementById("scene-art");
const sceneArtCtx = sceneArtCanvas ? sceneArtCanvas.getContext("2d") : null;
const modeOptionsContainer = document.getElementById("mode-options");
const lengthOptionsContainer = document.getElementById("length-options");
let modeOptions = [];
let lengthOptions = [];
let partyMode = "solo";
let soloPlayerName = null;
let titleStepIndex = 0;
const versionLabel = document.getElementById("game-version");
const titleBuildLabel = document.getElementById("title-build");
const hudTeam = document.getElementById("hud-team");
const bodyEl = document.body;
const observerBanner = document.getElementById("observer-banner");

if (versionLabel) {
  versionLabel.textContent = `v${BUILD_VERSION}`;
}
if (titleBuildLabel) {
  titleBuildLabel.textContent = `Build v${BUILD_VERSION}`;
}

const gameState = {
  mode: null,
  lengthKey: "very-short",
  partyMode: "solo",
  settings: {},
  sanity: 0,
  baseDrain: 1,
  drainRate: 1,
  momentumCap: 100,
  surgeMultiplier: 1,
  discoveryBoost: 1,
  comboIntensity: 1,
  scenesQueue: [],
  sceneAssignments: {},
  currentSceneIndex: 0,
  startingSanityTotal: 0,
  progress: {
    total: 0,
  },
  inventory: [],
  inventoryIds: new Set(),
  sceneState: {},
  flags: {},
  loop: null,
  rng: null,
  gameOver: false,
  temporalState: "frozen",
  temporalMomentum: 0,
  temporalEventTicks: 0,
  tickCount: 0,
  seed: 0,
  sessionId: null,
  readonly: false,
  remoteSession: false,
  partySize: 1,
  storyContext: null,
  storyCache: {},
  runTotal: 0,
  endless: false,
  clearedRooms: 0,
  lastSceneBaseId: null,
  players: [],
  gachaCharges: 0,
  milestonesTriggered: new Set(),
  audio: {
    ambient: true,
    sfx: true,
    reducedMotion: false,
  },
};

let tutorialIndex = 0;
let tutorialActive = false;
let codexPrepared = false;
let sceneInstanceCounter = 0;
let lobbyPlayers = [];
let lobbyIdCounter = 1;
let selectedArtifactKey = null;
let artifactInstanceCounter = 0;
let inventorySummary = new Map();

function applyCoopScaling(baseSettings) {
  const partySize = Math.max(
    1,
    (gameState.players && gameState.players.length) || (lobbyPlayers && lobbyPlayers.length) || 1
  );
  gameState.partySize = partySize;
  const settings = { ...baseSettings, rarityBias: { ...(baseSettings.rarityBias || {}) } };
  if (partySize <= 1) {
    return settings;
  }

  const sanityMultiplier = 1 + (partySize - 1) * 0.35;
  const drainMultiplier = 1 + (partySize - 1) * 0.18;
  const surgeMultiplier = 1 + (partySize - 1) * 0.12;
  const momentumMultiplier = 1 + (partySize - 1) * 0.12;
  const discoveryMultiplier = 1 + (partySize - 1) * 0.05;
  const comboMultiplier = 1 + (partySize - 1) * 0.1;
  const gachaMultiplier = 1 + (partySize - 1) * 0.2;
  const rarityMultiplier = 1 + (partySize - 1) * 0.08;

  settings.startingSanity = Math.round(settings.startingSanity * sanityMultiplier);
  settings.baseDrain = Number((settings.baseDrain * drainMultiplier).toFixed(2));
  settings.surgeMultiplier = Number((settings.surgeMultiplier * surgeMultiplier).toFixed(2));
  settings.momentumCap = Math.round(settings.momentumCap * momentumMultiplier);
  settings.discoveryBoost = Number((settings.discoveryBoost * discoveryMultiplier).toFixed(2));
  settings.comboIntensity = Number((settings.comboIntensity * comboMultiplier).toFixed(2));
  settings.gachaBonus = Number((settings.gachaBonus * gachaMultiplier).toFixed(2));
  const puzzleMultiplier = 1 + (partySize - 1) * 0.08;
  settings.puzzleSkew = Number(((settings.puzzleSkew || 1) * puzzleMultiplier).toFixed(2));

  for (const key of Object.keys(settings.rarityBias)) {
    settings.rarityBias[key] = Number((settings.rarityBias[key] * rarityMultiplier).toFixed(2));
  }

  return settings;
}

function resetGameState(options = {}) {
  if (!options.skipLobbySync) {
    syncLobbyToGameState();
  } else if (options.players && Array.isArray(options.players)) {
    gameState.players = options.players.slice(0, MAX_COOP_PLAYERS).map((player, index) => ({
      id: player.id ?? `remote-${index}`,
      name: sanitizePlayerName(player.name, index),
      maxSanity: player.maxSanity || 0,
      sanity: player.sanity || 0,
      status: player.status || "steady",
    }));
  }

  sceneInstanceCounter = 0;
  const modeKey =
    (options.modeKey && GAME_MODES[options.modeKey] && options.modeKey) ||
    (gameState.mode && GAME_MODES[gameState.mode] && gameState.mode) ||
    "normal";
  gameState.mode = modeKey;
  const baseSettings = { ...GAME_MODES[modeKey].settings };
  const modeSettings = applyCoopScaling(baseSettings);
  gameState.settings = modeSettings;
  gameState.startingSanityTotal = modeSettings.startingSanity;
  gameState.sanity = modeSettings.startingSanity;
  gameState.baseDrain = modeSettings.baseDrain;
  gameState.drainRate = modeSettings.baseDrain;
  gameState.momentumCap = modeSettings.momentumCap;
  gameState.surgeMultiplier = modeSettings.surgeMultiplier;
  gameState.discoveryBoost = modeSettings.discoveryBoost;
  gameState.comboIntensity = modeSettings.comboIntensity;

  const selectedLength =
    (options.lengthKey && RUN_LENGTHS[options.lengthKey] && options.lengthKey) ||
    (gameState.lengthKey && RUN_LENGTHS[gameState.lengthKey] && gameState.lengthKey) ||
    "very-short";
  gameState.lengthKey = selectedLength;
  const lengthSettings = RUN_LENGTHS[selectedLength];
  const rawRooms = lengthSettings.rooms;
  const runRooms = Number.isFinite(rawRooms) ? Math.max(1, Math.floor(rawRooms)) : Infinity;
  const initialCount = Number.isFinite(runRooms) ? runRooms : Math.min(6, SCENES.length);

  gameState.scenesQueue = chooseScenes(initialCount);
  gameState.sceneAssignments = assignArtifacts(gameState.scenesQueue);
  gameState.currentSceneIndex = 0;
  gameState.runTotal = runRooms;
  gameState.endless = !Number.isFinite(runRooms);
  gameState.clearedRooms = 0;
  gameState.progress.total = Number.isFinite(runRooms) ? runRooms : 0;
  gameState.lastSceneBaseId =
    gameState.scenesQueue.length > 0 ? gameState.scenesQueue[gameState.scenesQueue.length - 1].baseId : null;

  gameState.inventory = [];
  gameState.inventoryIds = new Set();
  gameState.sceneState = {};
  gameState.flags = {};
  gameState.gameOver = false;
  gameState.temporalState = "frozen";
  gameState.temporalMomentum = 0;
  gameState.temporalEventTicks = 0;
  gameState.tickCount = 0;
  const seed =
    typeof options.seed === "number" && Number.isFinite(options.seed) ? options.seed : generateSeed();
  gameState.seed = seed;
  if (Object.prototype.hasOwnProperty.call(options, "sessionId")) {
    gameState.sessionId = options.sessionId;
  }
  const rng = createRng(seed);
  setActiveRng(rng);
  gameState.rng = rng;
  gameState.storyContext = generateStoryContext(gameState.seed);
  gameState.storyCache = {};
  const partySize = Math.max(1, gameState.players?.length || 1);
  preparePlayerStats(gameState.startingSanityTotal);
  const gachaBias = Number(gameState.settings.gachaBonus ?? 1);
  const baseCharges = Math.max(1, Math.round(gachaBias));
  gameState.gachaCharges = baseCharges + Math.max(0, partySize - 1);
  gameState.milestonesTriggered = new Set();
  selectedArtifactKey = null;
  inventorySummary = new Map();
  artifactInstanceCounter = 0;
  clearLog();
  logHistory.length = 0;
  addLog(
    `Mode: ${GAME_MODES[modeKey].label} | Length: ${lengthSettings.label}. The hourglass seals around you.`,
    "system"
  );
  if (partySize > 1) {
    const teamNames = gameState.players.map((player) => player.name).join(", ");
    addLog(`Co-op team: ${teamNames}.`, "system");
  }
  if (gameState.storyContext) {
    const { alias, companion, destination } = gameState.storyContext;
    addLog(
      `Codename ${alias} charts a path toward ${destination}. Your ${companion} stirs at your side.`,
      "system"
    );
  }
  updateInventoryUI();
  updateGachaUI();
  updateTeamHud();
  updateProgressTracker();
  gameState.remoteSession = options.remote === true;
  proceedBtn.disabled = true;
  stopLoop();
  closeModal();
  setReadOnlyMode(options.readonly === true);
  if (!gameState.readonly) {
    startLoop();
  }
  renderScene();
  updateHud();
  updateInviteLinkUI();
  queueCoopBroadcast();
}

function chooseScenes(count) {
  const result = [];
  let previousBaseId = null;
  let target = count;
  if (!Number.isFinite(target)) {
    target = Math.min(6, SCENES.length);
  }
  while (result.length < target) {
    const baseScene = pickSceneBase(previousBaseId);
    const instance = instantiateScene(baseScene);
    result.push(instance);
    previousBaseId = instance.baseId;
  }
  return result;
}

function pickSceneBase(excludeBaseId) {
  const pool = [...SCENES];
  shuffle(pool);
  if (excludeBaseId) {
    const alternative = pool.find((scene) => scene.id !== excludeBaseId);
    if (alternative) {
      return alternative;
    }
  }
  return pool[0];
}

function instantiateScene(baseScene) {
  sceneInstanceCounter += 1;
  return {
    ...baseScene,
    baseId: baseScene.baseId || baseScene.id,
    instanceId: `${baseScene.id}#${sceneInstanceCounter}`,
    hotspots: baseScene.hotspots.map((hotspot) => ({ ...hotspot })),
  };
}

function sceneKey(scene) {
  return scene?.instanceId || scene?.id;
}

function assignArtifacts(scenes) {
  const assignments = {};
  for (const scene of scenes) {
    assignments[sceneKey(scene)] = assignSceneArtifacts(scene);
  }
  return assignments;
}

function assignSceneArtifacts(scene) {
  const map = {};
  for (const hotspot of scene.hotspots) {
    if (hotspot.type !== "artifact") continue;
    const pool = hotspot.artifactPool
      ? artifacts.filter((a) => hotspot.artifactPool.includes(a.id))
      : artifacts;
    map[hotspot.id] = chooseArtifact(pool);
  }
  return map;
}

function appendNextScene() {
  const baseScene = pickSceneBase(gameState.lastSceneBaseId);
  const instance = instantiateScene(baseScene);
  gameState.scenesQueue.push(instance);
  gameState.sceneAssignments[sceneKey(instance)] = assignSceneArtifacts(instance);
  gameState.lastSceneBaseId = instance.baseId;
}

function chooseArtifact(pool) {
  const source = pool && pool.length ? pool : artifacts;
  const weightedPool = source.map((artifact) => ({
    artifact,
    weight: computeRarityWeight(artifact),
  }));
  const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
  let roll = useRandom() * totalWeight;
  for (const item of weightedPool) {
    if ((roll -= item.weight) <= 0) {
      return item.artifact;
    }
  }
  return weightedPool[weightedPool.length - 1].artifact;
}

function getArtifactById(id) {
  return artifactMap.get(id) || null;
}

function computeRarityWeight(artifact) {
  const base = BASE_RARITY_WEIGHTS[artifact.rarity] ?? 1;
  const bias = gameState.settings?.rarityBias?.[artifact.rarity] ?? 1;
  return base * bias;
}

function awardArtifact(artifact, message, tone, context) {
  if (!artifact) return false;
  const scene = context?.scene || currentScene();
  const hotspot = context?.hotspot || null;
  const sceneState = scene
    ? ensureSceneState(sceneKey(scene))
    : context?.sceneState || {
        resolvedHotspots: new Set(),
        puzzles: {},
        flags: {},
        dialogues: {},
        discoveredArtifacts: new Set(),
        searchProfiles: {},
      };

  const entry = {
    instanceId: `artifact-${++artifactInstanceCounter}`,
    artifact,
    sceneId: scene ? sceneKey(scene) : "direct",
    source: hotspot ? hotspot.id : context?.source || "direct",
  };

  const { impact } = runWithImpact(artifact.name, "artifact", () => {
    gameState.inventory.push(entry);
    gameState.inventoryIds.add(artifact.id);
    const applyContext = { scene, hotspot, sceneState, artifact, entry };
    artifact.apply(gameState, applyContext);
  }, { tone: tone || "positive", silent: true });
  selectedArtifactKey = artifact.id;
  updateInventoryUI();
  renderArtifactDetailById(artifact.id);
  highlightSelectedArtifactRow();
  updateHud();
  if (message && !gameState.gameOver) {
    addLog(message.replace("{artifact}", artifact.name), tone ?? "system");
  } else {
    addLog(`${artifact.name} resonates and joins your collection.`, tone ?? "system");
  }
  audioManager.playEffect("artifact");
  const summaryHtml = artifact.summary ? escapeHtml(artifact.summary) : "";
  const impactHtml = impact?.bodyHtml
    ? `<div class="toast-impact">${impact.bodyHtml}</div>`
    : "";
  const bodyHtml = [summaryHtml, impactHtml].filter(Boolean).join(impactHtml && summaryHtml ? "<br>" : "");
  pushToast({
    title: sanitizeText(artifact.name),
    bodyHtml,
    tone: tone ?? "positive",
  });
  renderScene();
  queueCoopBroadcast();
  return true;
}

function performGachaRoll() {
  const pool = artifacts.filter((artifact) => artifact && artifact.rarity);
  if (!pool.length) return null;
  const rarityBias = gameState.settings?.rarityBias || {};
  const gachaBias = Number(gameState.settings?.gachaBonus ?? 1);
  const weights = pool.map((artifact) => {
    const base = BASE_RARITY_WEIGHTS[artifact.rarity] ?? 1;
    const bonus = GACHA_BONUS_WEIGHTS[artifact.rarity] ?? 1;
    const modeBias = rarityBias[artifact.rarity] ?? 1;
    const duplicatePenalty = gameState.inventoryIds.has(artifact.id) ? 0.35 : 1;
    return {
      artifact,
      weight: base * bonus * modeBias * gachaBias * duplicatePenalty,
    };
  });
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;
  let roll = useRandom() * total;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) {
      const duplicate = gameState.inventoryIds.has(entry.artifact.id);
      return { artifact: entry.artifact, duplicate };
    }
  }
  const fallback = weights[weights.length - 1].artifact;
  return { artifact: fallback, duplicate: gameState.inventoryIds.has(fallback.id) };
}

function handleGachaRoll() {
  if (gameState.gameOver || isReadOnly()) return;
  if (gameState.gachaCharges <= 0) {
    addLog("The gacha engine is drained. Clear more chambers to recharge.", "neutral");
    return;
  }
  gameState.gachaCharges -= 1;
  updateGachaUI();
  markTemporalInteraction("artifact");
  const result = performGachaRoll();
  if (!result) {
    addLog("The gacha engine sputters--no relic answers.", "negative");
    return;
  }
  if (result.duplicate) {
    addLog(`${result.artifact.name} echoes familiarly, its power compounding.`, "positive");
  }
  const artifact = result.artifact;
  const context = {
    scene: currentScene(),
    hotspot: null,
    source: "gacha",
  };
  addLog(`The gacha engine coalesces ${artifact.name}.`, "positive");
  awardArtifact(artifact, "{artifact} answers the gacha current.", "system", context);
}

function grantArtifactReward(effect, context) {
  let artifact = null;
  if (effect.artifactId) {
    artifact = getArtifactById(effect.artifactId);
  }
  let pool = artifacts;
  if (effect.pool && effect.pool.length) {
    pool = artifacts.filter((item) => effect.pool.includes(item.id));
  } else if (effect.rarity) {
    pool = artifacts.filter((item) => item.rarity === effect.rarity);
  }
  if (!artifact) {
    let candidates = pool;
    if (effect.unique !== false) {
      const uniquePool = candidates.filter((item) => !gameState.inventoryIds.has(item.id));
      if (uniquePool.length) {
        candidates = uniquePool;
      }
    }
    if (!candidates.length) {
      candidates = artifacts.filter((item) => !gameState.inventoryIds.has(item.id));
    }
    artifact = candidates.length ? chooseArtifact(candidates) : null;
  }
  if (!artifact) return;
  const success = awardArtifact(artifact, effect.message, effect.tone, context);
  if (!success && effect.alreadyMessage) {
    addLog(effect.alreadyMessage.replace("{artifact}", artifact.name), effect.alreadyTone ?? "neutral");
  }
}

function handleComboEffect(effect, context) {
  const requires = effect.requires || [];
  const hasAll = requires.every((id) => gameState.inventoryIds.has(id));
  if (hasAll) {
    if (effect.message && !gameState.gameOver) {
      addLog(effect.message, effect.tone ?? "positive");
    }
    if (effect.effects && effect.effects.length) {
      const scale = gameState.comboIntensity || 1;
      const scaled = effect.effects.map((inner) => {
        if (!inner) return inner;
        if (typeof inner.amount === "number" && ["momentum", "drain", "sanity"].includes(inner.type)) {
          return { ...inner, amount: inner.amount * scale };
        }
        return inner;
      });
      runArtifactEffects(scaled, gameState, context);
    }
  } else if (effect.elseMessage && !gameState.gameOver) {
    addLog(effect.elseMessage, effect.elseTone ?? "neutral");
  }
}

function ensureSceneFlavor(scene) {
  if (!gameState.storyContext) return "";
  const key = sceneKey(scene);
  const cache = gameState.storyCache[key] || {};
  if (!cache.flavor) {
    const rng = seededRandom(`${gameState.seed}:${key}:flavor`);
    const { companion, omen, motif } = gameState.storyContext;
    const verb = seededPick(rng, STORY_VERBS) || "whispers";
    const texture = seededPick(rng, STORY_TEXTURES) || "sandlight";
    const sentence =
      rng() > 0.5
        ? `Your ${companion} ${verb} about ${omen}.`
        : `Suspended ${texture} drift toward ${motif}.`;
    cache.flavor = sentence;
    gameState.storyCache[key] = cache;
  }
  return cache.flavor;
}

function generateSceneIntro(scene) {
  if (!gameState.storyContext) {
    return `You enter ${scene.name}.`;
  }
  const key = sceneKey(scene);
  const cache = gameState.storyCache[key] || {};
  if (!cache.intro) {
    const rng = seededRandom(`${gameState.seed}:${key}:intro`);
    const { companion, omen, destination } = gameState.storyContext;
    const mood = seededPick(rng, ["hums", "glows", "shivers", "thrums"]) || "hums";
    const texture = seededPick(rng, STORY_TEXTURES) || "glimmering sand";
    cache.intro = `${scene.name} ${mood} with ${texture}; your ${companion} murmurs about ${omen} on the road to ${destination}.`;
    gameState.storyCache[key] = cache;
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

  const rng = seededRandom(`${gameState.seed}:${sceneKey(scene)}:art`);
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
  if (useRandom() > 0.35) return null;
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
  const key = sceneKey(scene);
  const sceneState = ensureSceneState(key);
  const readOnly = isReadOnly();
  sceneHotspots.innerHTML = "";
  sceneActions.innerHTML = "";
  sceneBoard.style.background = scene.boardStyle;
  renderSceneArt(scene);
  sceneTitle.textContent = sanitizeText(scene.name);
  const baseDescription = sanitizeText(scene.description);
  const flavorText = sanitizeText(ensureSceneFlavor(scene));
  const combinedDescription = flavorText ? `${baseDescription} ${flavorText}` : baseDescription;
  sceneDescription.innerHTML = formatParagraph(combinedDescription);
  sceneObjective.innerHTML = formatParagraph(describeObjective(scene, sceneState));
  proceedBtn.disabled = readOnly || !sceneState.flags.exitReady;
  if (!sceneState.visited) {
    sceneState.visited = true;
    const intro = generateSceneIntro(scene);
    addLog(intro, "system");
  }

  for (const hotspot of scene.hotspots) {
    const button = template.content.firstElementChild.cloneNode(true);
    button.textContent = sanitizeText(
      hotspot.type === "artifact" && !sceneState.discoveredArtifacts.has(hotspot.id)
        ? `Search ${hotspot.label}`
        : hotspot.label
    );
    button.style.left = `${hotspot.x}%`;
    button.style.top = `${hotspot.y}%`;
    if (sceneState.resolvedHotspots.has(hotspot.id)) {
      button.classList.add("resolved");
    }
    if (readOnly) {
      button.disabled = true;
    }
    if (hotspot.type === "artifact") {
      const discovered = sceneState.discoveredArtifacts.has(hotspot.id);
      const resolved = sceneState.resolvedHotspots.has(hotspot.id);
      button.dataset.state = resolved ? "claimed" : discovered ? "revealed" : "hidden";
      if (!discovered) {
        button.classList.add("undiscovered");
        button.textContent = sanitizeText(`Search ${hotspot.label}`);
      }
    }
    if (!readOnly) {
      button.addEventListener("click", () => handleHotspot(scene, hotspot));
    }
    sceneHotspots.appendChild(button);

    if (actionTemplate) {
      const actionButton = actionTemplate.content.firstElementChild.cloneNode(true);
      const label = actionButton.querySelector(".action-label");
      const context = actionButton.querySelector(".action-context");
      const discovered =
        hotspot.type === "artifact" && sceneState.discoveredArtifacts.has(hotspot.id);
      const resolved = sceneState.resolvedHotspots.has(hotspot.id);
      if (hotspot.type === "artifact" && !resolved && !discovered) {
        label.textContent = sanitizeText(`Search ${hotspot.label}`);
        actionButton.classList.add("undiscovered");
      } else {
        label.textContent = sanitizeText(hotspot.label);
      }
      context.innerHTML = formatParagraph(hotspotContext(hotspot, sceneState));
      if (sceneState.resolvedHotspots.has(hotspot.id)) {
        actionButton.classList.add("resolved");
        actionButton.disabled = true;
      }
      if (readOnly) {
        actionButton.disabled = true;
      } else {
        actionButton.addEventListener("click", () => handleHotspot(scene, hotspot));
      }
      sceneActions.appendChild(actionButton);
    }
  }

  autoPrimeExit(scene, sceneState);
  if (sceneState.flags.exitReady) {
    proceedBtn.disabled = readOnly ? true : false;
    sceneObjective.innerHTML = formatParagraph(describeObjective(scene, sceneState));
  }

  const hasActions = sceneActions.children.length > 0;
  if (sceneActionsHeader) {
    sceneActionsHeader.style.display = hasActions ? "block" : "none";
  }
  sceneActions.style.display = hasActions ? "grid" : "none";
  queueCoopBroadcast();
}

function describeObjective(scene, sceneState) {
  const solved = Object.values(sceneState.puzzles).filter(Boolean).length;
  const total = scene.hotspots.filter((h) => h.type === "puzzle").length;
  const summary = `${solved}/${total} mechanisms stabilized.`;
  const objective = sanitizeText(scene.objective);
  if (sceneState.flags.exitReady) {
    return `${objective} The escape route is primed.`;
  }
  return `${objective} ${summary}`;
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
  if (gameState.gameOver || isReadOnly()) return;
  const sceneState = ensureSceneState(sceneKey(scene));
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
  const assignments = gameState.sceneAssignments[sceneKey(scene)] || {};
  const artifact = assignments[hotspot.id];
  if (!artifact) return;
  if (!sceneState.discoveredArtifacts.has(hotspot.id)) {
    initiateArtifactSearch(scene, hotspot, sceneState, artifact);
    return;
  }
  markTemporalInteraction("artifact");
  sceneState.resolvedHotspots.add(hotspot.id);
  const context = {
    scene,
    hotspot,
    sceneState,
    artifact,
    source: "hotspot",
  };
  const granted = awardArtifact(artifact, "{artifact} claimed.", "system", context);
  if (!granted) {
    addLog(`${artifact.name} hums--already attuned to you.`, "neutral");
  }
}

function initiateArtifactSearch(scene, hotspot, sceneState, artifact) {
  markTemporalInteraction("artifact");
  const profile = ensureSearchProfile(sceneState, hotspot, artifact);
  const globalAssist = Boolean(gameState.flags.scanAssist);
  const localAssist = Boolean(sceneState.flags.searchAssist);
  const hintActive = Boolean(
    sceneState.flags.hintAvailable ||
      globalAssist ||
      localAssist ||
      (gameState.discoveryBoost && gameState.discoveryBoost > 1.2)
  );

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

  const successIndex = randomInt(3);
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
  if (gameState.gameOver || isReadOnly()) return;
  profile.attempts += 1;
  const action = profile.actions[index];
  const tone = action.success ? "positive" : "negative";
  runWithImpact(action.label, "search", () => {
    if (action.success) {
      sceneState.discoveredArtifacts.add(hotspot.id);
      const message = randomFrom(SEARCH_SUCCESS_LINES).replace("{artifact}", artifact.name);
      addLog(message, "positive");
      coolMomentum(3 + useRandom() * 2);
      collectArtifact(scene, hotspot, sceneState);
    } else {
      addLog(randomFrom(SEARCH_FAILURE_LINES), "negative");
      heatMomentum(2);
      adjustSanity(gameState, -3);
      if (profile.attempts >= 2 && !profile.hinted && !sceneState.flags.hintAvailable) {
        const hintAction = profile.actions[profile.successIndex];
        hintAction.description = `${hintAction.description} The sands linger near this motion.`;
      }
    }
  }, { tone });
  updateHud();
}

function attemptPuzzle(scene, hotspot, sceneState) {
  const puzzle = hotspot.puzzle;
  if (!puzzle) return;
  if (isReadOnly()) return;
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
      tone:
        option.outcome === "success" ? "positive" : option.outcome === "failure" ? "negative" : "neutral",
      handler: () => {
        const tone =
          option.outcome === "success" ? "positive" : option.outcome === "failure" ? "negative" : undefined;
        runWithImpact(option.title, "puzzle", () => {
          option.effect(gameState, { scene, sceneState });
          if (option.outcome === "success") {
            sceneState.puzzles[puzzle.id] = true;
            sceneState.resolvedHotspots.add(hotspot.id);
            sceneObjective.textContent = describeObjective(scene, sceneState);
          }
        }, { tone });
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
  if (isReadOnly()) return;
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
      tone: choice.tone,
      handler: () => {
        const tone = choice.tone;
        runWithImpact(choice.title, "dialogue", () => {
          choice.effect(gameState, { scene, sceneState });
          if (choice.log) {
            addLog(choice.log, "system");
          }
          sceneState.dialogues[dialogue.id] = choice.id;
          sceneState.resolvedHotspots.add(hotspot.id);
        }, { tone });
        updateHud();
        renderScene();
        closeModal();
      },
    })),
  });
}

function attemptExit(scene, hotspot, sceneState) {
  if (isReadOnly()) return;
  const key = sceneKey(scene);
  const targetState = sceneState || ensureSceneState(key);
  if (targetState.flags.exitReady) {
    addLog("The path already stands open.");
    return;
  }
  if (!meetsRequirements(scene, hotspot, targetState, true)) {
    return;
  }
  targetState.resolvedHotspots.add(hotspot.id);
  targetState.flags.exitReady = true;
  markTemporalInteraction("exit");
  proceedBtn.disabled = false;
  addLog(hotspot.successText, "positive");
  sceneObjective.textContent = describeObjective(scene, targetState);
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

function autoPrimeExit(scene, sceneState) {
  if (sceneState.flags.exitReady) return;
  const exitHotspot = scene.hotspots.find((hotspot) => hotspot.type === "exit");
  if (!exitHotspot) return;
  const unresolved = scene.hotspots.some((hotspot) => {
    if (hotspot.type === "exit") return false;
    if (hotspot.type === "artifact") return !sceneState.resolvedHotspots.has(hotspot.id);
    if (hotspot.type === "puzzle") {
      const puzzleId = hotspot.puzzle?.id;
      return puzzleId ? !sceneState.puzzles[puzzleId] : true;
    }
    if (hotspot.type === "dialogue") return !sceneState.resolvedHotspots.has(hotspot.id);
    return false;
  });
  if (unresolved) return;
  if (!meetsRequirements(scene, exitHotspot, sceneState, true)) return;
  sceneState.resolvedHotspots.add(exitHotspot.id);
  sceneState.flags.exitReady = true;
  if (!gameState.gameOver) {
    const message = exitHotspot.successText || "The exit thrums open; the route is primed.";
    addLog(message, "positive");
  }
}

function proceedScene() {
  if (gameState.gameOver || isReadOnly()) return;
  const scene = gameState.scenesQueue[gameState.currentSceneIndex];
  const sceneState = ensureSceneState(sceneKey(scene));
  if (!sceneState.flags.exitReady) {
    addLog("The exit resists--resolve the chamber first.");
    return;
  }
  gameState.clearedRooms += 1;
  updateProgressTracker();
  handleMilestones();
  const finishedRun =
    Number.isFinite(gameState.runTotal) && gameState.clearedRooms >= gameState.runTotal;
  gameState.currentSceneIndex += 1;
  if (!finishedRun && gameState.currentSceneIndex >= gameState.scenesQueue.length) {
    appendNextScene();
  }
  if (finishedRun) {
    completeRun();
  } else {
    if (gameState.currentSceneIndex >= gameState.scenesQueue.length) {
      appendNextScene();
    }
    addLog("You descend deeper into the hourglass.", "system");
    proceedBtn.disabled = true;
    settleTemporalFlow("frozen");
    renderScene();
  }
}

function updateInventoryUI() {
  if (!inventoryList) return;
  const summaryMap = new Map();
  const ordered = [];
  for (const entry of gameState.inventory) {
    const id = entry.artifact.id;
    let stack = summaryMap.get(id);
    if (!stack) {
      stack = { artifact: entry.artifact, count: 0 };
      summaryMap.set(id, stack);
      ordered.push(stack);
    }
    stack.count += 1;
  }
  inventorySummary = summaryMap;
  inventoryList.innerHTML = "";
  if (!ordered.length) {
    selectedArtifactKey = null;
    clearArtifactDetail();
    updateGachaUI();
    highlightSelectedArtifactRow();
    return;
  }
  for (const stack of ordered) {
    const artifact = stack.artifact;
    const li = document.createElement("li");
    li.className = `inventory-item rarity-${artifact.rarity}`;
    li.dataset.artifactId = artifact.id;
    const countBadge = stack.count > 1 ? `<span class="count">×${stack.count}</span>` : "";
    li.innerHTML = `
      <div class="summary">
        <span class="name">${sanitizeText(artifact.name)}</span>
        <span class="meta">${sanitizeText((artifact.rarity || "").toUpperCase())}</span>
        ${countBadge}
      </div>
      <div class="effects">${[artifact.positive, artifact.neutral, artifact.negative]
        .filter(Boolean)
        .map((text) => `- ${sanitizeText(text)}`)
        .join("<br>")}</div>
    `;
    li.addEventListener("click", () => {
      renderArtifactDetailById(artifact.id);
      highlightSelectedArtifactRow();
    });
    inventoryList.appendChild(li);
  }
  if (!selectedArtifactKey || !inventorySummary.has(selectedArtifactKey)) {
    selectedArtifactKey = ordered[ordered.length - 1].artifact.id;
  }
  renderArtifactDetailById(selectedArtifactKey);
  updateGachaUI();
  highlightSelectedArtifactRow();
}

function updateGachaUI() {
  if (!gachaRollBtn || !gachaChargesLabel) return;
  const charges = Math.max(0, Math.floor(gameState.gachaCharges || 0));
  gachaRollBtn.disabled = gameState.readonly || charges <= 0 || gameState.gameOver;
  gachaRollBtn.textContent = charges > 0 ? `Relic Gacha (${charges})` : "Relic Gacha";
  gachaChargesLabel.textContent = `Charges: ${charges}`;
}

function highlightSelectedArtifactRow() {
  if (!inventoryList) return;
  const items = inventoryList.querySelectorAll(".inventory-item");
  items.forEach((item) => {
    const isSelected = item.dataset.artifactId === selectedArtifactKey;
    item.classList.toggle("selected", isSelected);
  });
}

function renderArtifactDetailById(artifactId) {
  if (!artifactId || !inventorySummary.has(artifactId)) {
    clearArtifactDetail();
    return;
  }
  const stack = inventorySummary.get(artifactId);
  selectedArtifactKey = artifactId;
  renderArtifactDetail(stack.artifact, stack.count);
}

function renderArtifactDetail(artifact, count = 1) {
  if (!artifactDetail) return;
  artifactDetail.classList.remove("hidden");
  artifactDetail.classList.remove(
    "rarity-common",
    "rarity-uncommon",
    "rarity-rare",
    "rarity-legendary",
    "rarity-timeless"
  );
  artifactDetail.classList.add(`rarity-${artifact.rarity || "common"}`);
  if (artifactDetailName) {
    artifactDetailName.textContent = sanitizeText(artifact.name || "Unknown Artifact");
  }
  if (artifactDetailRarity) {
    const rarityText = (artifact.rarity || "").toUpperCase();
    artifactDetailRarity.textContent = count > 1 ? `${rarityText} · ×${count}` : rarityText;
  }
  if (artifactDetailSummary) {
    artifactDetailSummary.textContent =
      sanitizeText(artifact.summary) || "This relic's story remains unwritten.";
  }
  if (artifactDetailEffects) {
    if (artifact.positive || artifact.neutral || artifact.negative) {
      artifactDetailEffects.classList.remove("hidden");
      artifactDetailPositive.textContent = sanitizeText(artifact.positive) || "-";
      artifactDetailNeutral.textContent = sanitizeText(artifact.neutral) || "-";
      artifactDetailNegative.textContent = sanitizeText(artifact.negative) || "-";
    } else {
      artifactDetailEffects.classList.add("hidden");
    }
  }
  if (artifactDetailCombos) {
    const combos = summarizeArtifactCombos(artifact);
    if (combos.length) {
      artifactDetailCombos.classList.remove("hidden");
      artifactDetailCombos.innerHTML = combos.map((line) => `<div>&bull; ${escapeHtml(line)}</div>`).join("");
    } else {
      artifactDetailCombos.classList.add("hidden");
      artifactDetailCombos.innerHTML = "";
    }
  }
}

function clearArtifactDetail() {
  if (!artifactDetail) return;
  selectedArtifactKey = null;
  artifactDetail.classList.add("hidden");
  artifactDetail.classList.remove(
    "rarity-common",
    "rarity-uncommon",
    "rarity-rare",
    "rarity-legendary",
    "rarity-timeless"
  );
  if (artifactDetailName) {
    artifactDetailName.textContent = "Select an artifact";
  }
  if (artifactDetailRarity) {
    artifactDetailRarity.textContent = "";
  }
  if (artifactDetailSummary) {
    artifactDetailSummary.textContent = "Inspect a relic to review its traits and combos.";
  }
  if (artifactDetailEffects) {
    artifactDetailEffects.classList.add("hidden");
  }
  if (artifactDetailCombos) {
    artifactDetailCombos.classList.add("hidden");
    artifactDetailCombos.innerHTML = "";
  }
}

function summarizeArtifactCombos(artifact) {
  const effects = Array.isArray(artifact.effects) ? artifact.effects : [];
  const combos = [];
  for (const effect of effects) {
    if (effect.requires?.artifactsAny && effect.requires.artifactsAny.length) {
      combos.push(`Pairs with ${effect.requires.artifactsAny.join(", ")} for bonus resonance.`);
    }
    if (effect.requires?.artifactAll && effect.requires.artifactAll.length) {
      combos.push(`Requires ${effect.requires.artifactAll.join(", ")} to fully awaken.`);
    }
    if (effect.message && !combos.includes(effect.message)) {
      combos.push(effect.message);
    }
    if (effect.tone === "combo" && effect.description) {
      combos.push(effect.description);
    }
  }
  return combos.slice(0, 4);
}

function handleMilestones() {
  const cleared = gameState.clearedRooms;
  if (!cleared) return;
  for (const milestone of MILESTONE_EVENTS) {
    if (milestone.rooms !== cleared) continue;
    const key = `fixed-${milestone.rooms}`;
    if (gameState.milestonesTriggered.has(key)) continue;
    gameState.milestonesTriggered.add(key);
    if (milestone.log) {
      addLog(milestone.log, "system");
    }
    if (typeof milestone.effect === "function") {
      milestone.effect(gameState);
    }
  }
  if (cleared % 3 === 0) {
    const key = `gacha-${cleared}`;
    if (!gameState.milestonesTriggered.has(key)) {
      gameState.milestonesTriggered.add(key);
      gameState.gachaCharges += 1;
      updateGachaUI();
      addLog("The gacha engine hums--an extra charge condenses.", "positive");
    }
  }
  if (!Number.isFinite(gameState.runTotal) && cleared % 5 === 0) {
    const key = `endless-${cleared}`;
    if (!gameState.milestonesTriggered.has(key)) {
      gameState.milestonesTriggered.add(key);
      addLog("Endless flux rewards your endurance with a stabilising echo.", "positive");
      adjustSanity(gameState, +8, "The endless sands briefly align.");
      updateGachaUI();
    }
  }
}

function updateTeamHud() {
  if (!hudTeam) return;
  const activePlayers =
    gameState.players && gameState.players.length ? gameState.players : lobbyPlayers || [];
  if (!activePlayers.length) {
    hudTeam.textContent = "Solo";
    return;
  }
  const usingFallback = !gameState.players || !gameState.players.length;
  const totalSanity =
    gameState.startingSanityTotal ||
    gameState.settings?.startingSanity ||
    (usingFallback ? 100 : gameState.sanity || 100);
  const ratio =
    !usingFallback && totalSanity
      ? Math.max(0, Math.min(1, gameState.sanity / totalSanity))
      : 1;
  const entries = activePlayers.map((player, index) => {
    const maxSanity =
      player.maxSanity ||
      Math.max(1, Math.round(totalSanity / Math.max(1, activePlayers.length)));
    const sanity = Math.max(0, Math.round(maxSanity * ratio));
    player.maxSanity = maxSanity;
    player.sanity = sanity;
    const pct = Math.max(0, Math.min(100, Math.round((sanity / maxSanity) * 100)));
    let status = "steady";
    if (pct < 35) status = "critical";
    else if (pct < 70) status = "stressed";
    player.status = status;
    const statusLabel =
      status === "steady" ? "[OK]" : status === "stressed" ? "[WARN]" : "[CRIT]";
    return `${player.name} ${statusLabel} ${pct}%`;
  });
  hudTeam.textContent = entries.join(" | ");
}

function updateProgressTracker() {
  if (!progressFill || !progressText) return;
  const cleared = gameState.clearedRooms || 0;
  const total = gameState.progress?.total || 0;
  if (!Number.isFinite(gameState.runTotal)) {
    progressFill.style.width = "100%";
    progressText.textContent = `${cleared} cleared`;
    return;
  }
  const pct = total > 0 ? Math.min(100, Math.round((cleared / total) * 100)) : 0;
  progressFill.style.width = `${pct}%`;
  progressText.textContent = total > 0 ? `${cleared} / ${total}` : `${cleared} cleared`;
}

function recordLogHistory(entry) {
  logHistory.push(entry);
  if (logHistory.length > LOG_HISTORY_LIMIT) {
    logHistory.splice(0, logHistory.length - LOG_HISTORY_LIMIT);
  }
}

function addLog(message, tone = "") {
  if (!logPanel) return;
  const stamp = timestamp();
  const entry = document.createElement("div");
  entry.className = `log-entry ${tone}`.trim();
  entry.innerHTML = `<strong>${stamp}</strong> ${message}`;
  logPanel.appendChild(entry);
  logPanel.scrollTop = logPanel.scrollHeight;
  recordLogHistory({
    stamp,
    tone,
    message: stripTags(message),
  });
  queueCoopBroadcast();
}

function clearLog() {
  if (logPanel) {
    logPanel.innerHTML = "";
  }
  logHistory.length = 0;
}

function syncInventoryFromSnapshot(ids) {
  gameState.inventory = [];
  gameState.inventoryIds = new Set();
  selectedArtifactKey = null;
  inventorySummary = new Map();
  artifactInstanceCounter = 0;
  if (!Array.isArray(ids)) return;
  ids.forEach((id) => {
    const artifact = getArtifactById(id);
    if (!artifact) return;
    artifactInstanceCounter += 1;
    gameState.inventory.push({
      artifact,
      sceneId: "remote",
      instanceId: `artifact-${artifactInstanceCounter}`,
      source: "remote",
    });
    gameState.inventoryIds.add(artifact.id);
  });
  if (gameState.inventory.length) {
    const lastEntry = gameState.inventory[gameState.inventory.length - 1];
    selectedArtifactKey = lastEntry.artifact.id;
  }
}

function serializeSearchProfiles(profiles) {
  if (!profiles) return {};
  const result = {};
  for (const [key, profile] of Object.entries(profiles)) {
    result[key] = {
      attempts: profile.attempts || 0,
      successIndex: profile.successIndex || 0,
      hinted: !!profile.hinted,
    };
  }
  return result;
}

function serializeSceneStates() {
  const map = {};
  for (const [key, state] of Object.entries(gameState.sceneState || {})) {
    map[key] = {
      resolvedHotspots: Array.from(state.resolvedHotspots || []),
      puzzles: { ...(state.puzzles || {}) },
      flags: { ...(state.flags || {}) },
      dialogues: { ...(state.dialogues || {}) },
      discoveredArtifacts: Array.from(state.discoveredArtifacts || []),
      searchProfiles: serializeSearchProfiles(state.searchProfiles || {}),
      visited: !!state.visited,
    };
  }
  return map;
}

function applySceneStateSnapshot(states) {
  if (!states) return;
  for (const [key, payload] of Object.entries(states)) {
    const state = ensureSceneState(key);
    state.resolvedHotspots = new Set(payload.resolvedHotspots || []);
    state.puzzles = { ...(payload.puzzles || {}) };
    state.flags = { ...(payload.flags || {}) };
    state.dialogues = { ...(payload.dialogues || {}) };
    state.discoveredArtifacts = new Set(payload.discoveredArtifacts || []);
    state.searchProfiles = state.searchProfiles || {};
    const profiles = payload.searchProfiles || {};
    for (const [profileKey, profileData] of Object.entries(profiles)) {
      const existing = state.searchProfiles[profileKey];
      if (existing) {
        existing.attempts = profileData.attempts || 0;
        existing.successIndex = profileData.successIndex || existing.successIndex || 0;
        existing.hinted = !!profileData.hinted;
      } else {
        state.searchProfiles[profileKey] = {
          attempts: profileData.attempts || 0,
          successIndex: profileData.successIndex || 0,
          hinted: !!profileData.hinted,
          actions: [],
        };
      }
    }
    state.visited = !!payload.visited;
  }
}

function buildCoopConfig() {
  return {
    sessionId: gameState.sessionId || null,
    modeKey: gameState.mode,
    lengthKey: gameState.lengthKey,
    seed: gameState.seed,
    players: normalizeCoopPlayers(gameState.players),
    partyMode: gameState.partyMode || partyMode,
  };
}

function buildCoopSnapshot() {
  return {
    sanity: gameState.sanity,
    drainRate: gameState.drainRate,
    temporalState: gameState.temporalState,
    temporalMomentum: gameState.temporalMomentum,
    temporalEventTicks: gameState.temporalEventTicks,
    tickCount: gameState.tickCount,
    clearedRooms: gameState.clearedRooms,
    runTotal: gameState.runTotal,
    currentSceneIndex: gameState.currentSceneIndex,
    progressTotal: gameState.progress?.total ?? 0,
    inventory: gameState.inventory.map((entry) => entry.artifact.id),
    players: normalizeCoopPlayers(gameState.players),
    sceneState: serializeSceneStates(),
    logs: logHistory.slice(-30),
    partySize: gameState.partySize || gameState.players?.length || 1,
  };
}

function renderLogsFromSnapshot(entries) {
  if (!logPanel || !Array.isArray(entries)) return;
  logPanel.innerHTML = "";
  logHistory.length = 0;
  entries.forEach((entry) => {
    const tone = entry.tone || "";
    const stamp = entry.stamp || "";
    const message = entry.message || "";
    const row = document.createElement("div");
    row.className = `log-entry ${tone}`.trim();
    row.innerHTML = `<strong>${escapeHtml(stamp)}</strong> ${escapeHtml(message)}`;
    logPanel.appendChild(row);
    recordLogHistory({ stamp, tone, message });
  });
  logPanel.scrollTop = logPanel.scrollHeight;
}

function ensureRemoteRun(config, sessionId) {
  if (!config || !sessionId) return;
  if (coopSync && coopSync.isHost && coopSync.isHost()) return;
  if (gameState.remoteSession && gameState.sessionId === sessionId) {
    return;
  }
  setPartyMode("multi", { skipRadio: true, deferSync: true });
  lobbyPlayers = normalizeCoopPlayers(config.players);
  saveLobbyPlayers();
  renderPartySummary();
  gameState.mode = config.modeKey || gameState.mode || "normal";
  gameState.lengthKey = config.lengthKey || gameState.lengthKey || "very-short";
  gameState.sessionId = sessionId;
  gameState.partyMode = "multi";
  gameState.players = normalizeCoopPlayers(config.players);
  bodyEl.classList.remove("title-active");
  titleScreen.classList.add("hidden");
  gameContainer.classList.remove("hidden");
  resetGameState({
    seed: config.seed,
    skipLobbySync: true,
    players: config.players,
    modeKey: config.modeKey,
    lengthKey: config.lengthKey,
    readonly: true,
    remote: true,
    sessionId,
  });
  updateInviteLinkUI();
}

function applyCoopSnapshot(snapshot, sessionId) {
  if (!snapshot) return;
  coopApplyingSnapshot = true;
  try {
    if (sessionId) {
      gameState.sessionId = sessionId;
    }
    gameState.remoteSession = true;
    gameState.sanity = snapshot.sanity ?? gameState.sanity;
    gameState.drainRate = snapshot.drainRate ?? gameState.drainRate;
    gameState.temporalState = snapshot.temporalState ?? gameState.temporalState;
    gameState.temporalMomentum = snapshot.temporalMomentum ?? gameState.temporalMomentum;
    gameState.temporalEventTicks = snapshot.temporalEventTicks ?? gameState.temporalEventTicks;
    gameState.tickCount = snapshot.tickCount ?? gameState.tickCount;
    gameState.clearedRooms = snapshot.clearedRooms ?? gameState.clearedRooms;
    if (snapshot.runTotal !== undefined) {
      gameState.runTotal = snapshot.runTotal;
    }
    if (snapshot.currentSceneIndex !== undefined) {
      gameState.currentSceneIndex = snapshot.currentSceneIndex;
    }
    if (snapshot.progressTotal !== undefined) {
      gameState.progress.total = snapshot.progressTotal;
    }
    syncInventoryFromSnapshot(snapshot.inventory || []);
    if (Array.isArray(snapshot.players)) {
      gameState.players = normalizeCoopPlayers(snapshot.players);
      gameState.partySize = gameState.players.length || 1;
    }
    applySceneStateSnapshot(snapshot.sceneState || {});
    if (Array.isArray(snapshot.logs) && snapshot.logs.length) {
      renderLogsFromSnapshot(snapshot.logs);
    }
  } finally {
    coopApplyingSnapshot = false;
  }
  updateInventoryUI();
  updateTeamHud();
  updateProgressTracker();
  updateHud();
  renderScene();
}

function queueCoopBroadcast() {
  if (!coopSync || !coopSync.isHost || !coopSync.isHost()) return;
  if (coopApplyingSnapshot) return;
  if (gameState.partyMode !== "multi") return;
  if (coopBroadcastScheduled) return;
  const scheduler = window.requestAnimationFrame || ((fn) => setTimeout(fn, 32));
  coopBroadcastScheduled = true;
  scheduler(() => {
    coopBroadcastScheduled = false;
    const payload = {
      config: buildCoopConfig(),
      snapshot: buildCoopSnapshot(),
    };
    coopSync.broadcastSnapshot(payload);
  });
}

function endRemoteSession() {
  if (!gameState.remoteSession) return;
  gameState.remoteSession = false;
  gameState.sessionId = null;
  setReadOnlyMode(false);
  if (!bodyEl.classList.contains("title-active")) {
    enterTitleScreen();
  }
}

function createCoopSync() {
  const supported = typeof BroadcastChannel !== "undefined";
  const channel = supported ? new BroadcastChannel("ttla:coop") : null;
  let role = "idle";
  let sessionId = null;
  let currentConfig = null;

  function isHost() {
    return role === "host";
  }

  function isClient() {
    return role === "client";
  }

  function writeSessionStorage(config) {
    if (typeof localStorage === "undefined") return;
    if (!config) {
      localStorage.removeItem("ttla:coopActive");
      return;
    }
    try {
      localStorage.setItem("ttla:coopActive", JSON.stringify(config));
    } catch (error) {
      console.warn("Failed to persist coop session:", error);
    }
  }

  function startHostSession(config = {}) {
    currentConfig = { ...(currentConfig || {}), ...(config || {}) };
    sessionId =
      currentConfig.sessionId ||
      sessionId ||
      `${Date.now().toString(36)}-${generateSeed()}`;
    currentConfig.sessionId = sessionId;
    role = "host";
    writeSessionStorage(currentConfig);
    if (channel) {
      channel.postMessage({ type: "session-start", sessionId, config: currentConfig });
    }
    broadcastSnapshot({ config: currentConfig, snapshot: buildCoopSnapshot() });
    updateInviteLinkUI();
    return sessionId;
  }

  function endSession(announce = true) {
    if (isHost() && channel && sessionId && announce) {
      channel.postMessage({ type: "session-end", sessionId });
    }
    writeSessionStorage(null);
    currentConfig = null;
    role = "idle";
    sessionId = null;
    updateInviteLinkUI();
  }

  function broadcastSnapshot(payload) {
    if (!isHost() || !channel) return;
    if (!sessionId) {
      sessionId = `${Date.now().toString(36)}-${generateSeed()}`;
    }
    currentConfig = {
      ...(payload?.config || currentConfig || {}),
      sessionId,
    };
    writeSessionStorage(currentConfig);
    channel.postMessage({
      type: "state",
      sessionId,
      config: currentConfig,
      snapshot: payload?.snapshot || buildCoopSnapshot(),
      version: BUILD_VERSION,
    });
  }

  function requestState(targetSessionId = sessionId) {
    if (!channel) return;
    channel.postMessage({ type: "state-request", sessionId: targetSessionId });
  }

  function handleSessionStart(message) {
    if (isHost()) return;
    sessionId = message.sessionId;
    role = "client";
    currentConfig = message.config || null;
    if (currentConfig) {
      ensureRemoteRun(currentConfig, sessionId);
    }
    requestState(sessionId);
  }

  function handleState(message) {
    if (isHost()) return;
    const incomingId = message.sessionId || sessionId;
    if (sessionId && incomingId && sessionId !== incomingId) {
      return;
    }
    sessionId = incomingId;
    role = "client";
    currentConfig = message.config || currentConfig;
    if (currentConfig) {
      ensureRemoteRun(currentConfig, sessionId);
    }
    applyCoopSnapshot(message.snapshot, sessionId);
  }

  function handleSessionEnd(message) {
    if (message && sessionId && message.sessionId && message.sessionId !== sessionId) {
      return;
    }
    if (!isClient()) return;
    endRemoteSession();
    role = "idle";
    sessionId = null;
    currentConfig = null;
  }

  function handleStateRequest(message) {
    if (!isHost()) return;
    if (message && sessionId && message.sessionId && message.sessionId !== sessionId) {
      return;
    }
    broadcastSnapshot({ config: currentConfig, snapshot: buildCoopSnapshot() });
  }

  function joinSession(targetSessionId) {
    if (!targetSessionId) return;
    sessionId = targetSessionId;
    role = "client";
    currentConfig = currentConfig || { sessionId: targetSessionId };
    writeSessionStorage({ sessionId: targetSessionId });
    requestState(targetSessionId);
    updateInviteLinkUI();
  }

  function handleMessage(event) {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    switch (data.type) {
      case "session-start":
        handleSessionStart(data);
        break;
      case "state":
        handleState(data);
        break;
      case "session-end":
        handleSessionEnd(data);
        break;
      case "state-request":
        handleStateRequest(data);
        break;
      default:
        break;
    }
  }

  if (channel) {
    channel.addEventListener("message", handleMessage);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== "ttla:coopActive") return;
      if (!event.newValue) {
        handleSessionEnd();
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        if (!isHost()) {
          sessionId = parsed.sessionId;
          role = "client";
          currentConfig = parsed;
          ensureRemoteRun(parsed, sessionId);
          requestState(sessionId);
        }
      } catch (error) {
        console.warn("Failed to parse coop session from storage:", error);
      }
    });
  }

  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem("ttla:coopActive");
      if (stored && !isHost()) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.sessionId) {
          sessionId = parsed.sessionId;
          role = "client";
          currentConfig = parsed;
          ensureRemoteRun(parsed, sessionId);
          requestState(sessionId);
        }
      }
    } catch (error) {
      console.warn("Failed to restore coop session:", error);
    }
  }

  return {
    isHost,
    isClient,
    startHostSession,
    endSession,
    broadcastSnapshot,
    requestState,
    joinSession,
    sessionId: () => sessionId,
  };
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
    const cap = gameState.momentumCap || 1;
    const level = gameState.temporalMomentum / cap;
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
  const previous = gameState.sanity;
  const next = Math.max(0, Math.min(100, gameState.sanity + amount));
  gameState.sanity = next;
  const delta = next - previous;
  if (delta) {
    impactTracker.record("sanity", delta);
  }
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
    impactTracker.record("time", amount, { direction: "calm" });
    coolMomentum(momentumShift);
    settleTemporalFlow("calm", Math.max(2, Math.round(magnitude / 10)));
    if (message) {
      addLog(message, "positive");
    }
  } else {
    impactTracker.record("time", amount, { direction: "flux" });
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
  if (gameState.readonly || (coopSync && coopSync.isClient && coopSync.isClient())) {
    return;
  }
  gameState.loop = setInterval(() => {
    if (gameState.gameOver) return;
    tickTemporalFlow();
    updateHud();
    queueCoopBroadcast();
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
  if (useRandom() > chance || gameState.gameOver) return;
  const negativeBias =
    mode === "surge" ? 0.85 : mode === "active" ? 0.65 : mode === "calm" ? 0.35 : 0.5;
  const direction = useRandom() < negativeBias ? -1 : 1;
  const scale =
    mode === "surge" ? 4.5 : mode === "active" ? 3 : mode === "calm" ? 2.2 : 1.5;
  const delta = direction * (0.8 + useRandom() * scale);
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
  const before = gameState.temporalMomentum;
  const surgeFactor = gameState.surgeMultiplier || 1;
  const adjusted = amount * surgeFactor;
  gameState.temporalMomentum = Math.min(
    gameState.momentumCap,
    gameState.temporalMomentum + adjusted
  );
  const delta = gameState.temporalMomentum - before;
  if (delta) {
    impactTracker.record("momentum", delta, { direction: "heat" });
  }
  if (gameState.temporalMomentum >= gameState.momentumCap) {
    endRun("A temporal surge overwhelms you. The hourglass floods in a single breath.");
    return;
  }
}

function coolMomentum(amount) {
  if (!amount || gameState.gameOver) return;
  const before = gameState.temporalMomentum;
  gameState.temporalMomentum = Math.max(0, gameState.temporalMomentum - amount);
  const delta = gameState.temporalMomentum - before;
  if (delta) {
    impactTracker.record("momentum", delta, { direction: "cool" });
  }
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
  updateGachaUI();
  openModal({
    title: "Run Failed",
    body: message,
    choices: [],
  });
  updateHud();
  updateProgressTracker();
}

function completeRun() {
  if (gameState.gameOver) return;
  gameState.gameOver = true;
  stopLoop();
  gameState.temporalState = "frozen";
  gameState.temporalEventTicks = 0;
  updateGachaUI();
  openModal({
    title: "You Escaped",
    body: "You emerge from the hourglass, artifacts humming with untapped potential.",
    choices: [],
  });
  updateHud();
  updateProgressTracker();
}

function openModal({ title, body, choices }) {
  const readOnly = isReadOnly();
  modalTitle.textContent = sanitizeText(title);
  modalBody.innerHTML = formatParagraph(body);
  modalChoices.innerHTML = "";
  if (choices && choices.length) {
    modalChoices.style.display = "flex";
    for (const choice of choices) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      const choiceTitle = `<span class="choice-title">${escapeHtml(choice.title)}</span>`;
      const choiceBody = choice.description
        ? `<span class="choice-effect">${formatParagraph(choice.description)}</span>`
        : "";
      btn.innerHTML = `${choiceTitle}${choiceBody}`;
      if (choice.tone) {
        btn.classList.add(`tone-${choice.tone}`);
      }
      btn.disabled = readOnly;
      if (!readOnly) {
        btn.addEventListener("click", () => choice.handler());
      }
      modalChoices.appendChild(btn);
    }
  } else {
    modalChoices.style.display = "none";
  }
  modal.classList.remove("hidden");
  audioManager.playEffect("ui");
}

function closeModal() {
  modal.classList.add("hidden");
  audioManager.playEffect("ui");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(useRandom() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function randomFrom(array) {
  if (!array || !array.length) return undefined;
  return array[Math.floor(useRandom() * array.length)];
}

function createAudioManager() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = AudioContext ? new AudioContext() : null;
  let ambientStopper = null;
  let unlocked = false;

  const ambientGain = context ? context.createGain() : null;
  const sfxGain = context ? context.createGain() : null;
  if (ambientGain && sfxGain && context) {
    ambientGain.gain.value = 0.2;
    sfxGain.gain.value = 0.35;
    ambientGain.connect(context.destination);
    sfxGain.connect(context.destination);
  }

  function ensureContext() {
    if (!context) return;
    if (context.state === "suspended") {
      context.resume();
    }
    unlocked = true;
  }

  function playAmbient() {
    if (!context || !ambientGain) return;
    ensureContext();
    if (ambientStopper) return;
    ambientStopper = buildSteamAmbient(context, ambientGain, gameState.audio.reducedMotion);
  }

  function stopAmbient() {
    if (ambientStopper) {
      ambientStopper.stop();
      ambientStopper = null;
    }
  }

  function playEffect(kind) {
    if (!context || !sfxGain || !gameState.audio.sfx) return;
    ensureContext();
    createSteamEffect(context, sfxGain, kind, gameState.audio.reducedMotion);
  }

  function setAmbientEnabled(enabled) {
    if (enabled) {
      playAmbient();
    } else {
      stopAmbient();
    }
  }

  function setReducedMotion(enabled) {
    if (ambientStopper && ambientStopper.setReducedMotion) {
      ambientStopper.setReducedMotion(enabled);
    }
  }

  return {
    context,
    unlocked: () => unlocked,
    unlock: ensureContext,
    playAmbient,
    stopAmbient,
    playEffect,
    setAmbientEnabled,
    setReducedMotion,
  };
}

function buildSteamAmbient(context, destination, reducedMotion) {
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < data.length; i++) {
    const white = useRandom() * 2 - 1;
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 1.8;
  }

  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = reducedMotion ? 500 : 900;
  filter.Q.value = 0.7;

  const tremGain = context.createGain();
  tremGain.gain.value = 0.45;

  source.connect(filter).connect(tremGain).connect(destination);
  source.start(0);

  const hum = context.createOscillator();
  hum.type = "sine";
  hum.frequency.value = 38;
  const humGain = context.createGain();
  humGain.gain.value = 0.09;
  hum.connect(humGain).connect(destination);
  hum.start(0);

  const pulse = context.createOscillator();
  pulse.type = "triangle";
  pulse.frequency.value = reducedMotion ? 0.06 : 0.08;
  const pulseGain = context.createGain();
  pulseGain.gain.value = 0.12;
  pulse.connect(pulseGain).connect(filter.frequency);
  pulse.start(0);

  return {
    stop() {
      source.stop();
      hum.stop();
      pulse.stop();
      source.disconnect();
      hum.disconnect();
      pulse.disconnect();
      filter.disconnect();
      tremGain.disconnect();
      humGain.disconnect();
      pulseGain.disconnect();
    },
    setReducedMotion(enabled) {
      filter.frequency.value = enabled ? 500 : 900;
      pulse.frequency.value = enabled ? 0.04 : 0.08;
    },
  };
}

function createSteamEffect(context, destination, type, reducedMotion) {
  const burst = context.createBuffer(1, context.sampleRate * 0.4, context.sampleRate);
  const data = burst.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const white = useRandom() * 2 - 1;
    data[i] = white * Math.pow(1 - i / data.length, reducedMotion ? 1.5 : 1);
  }
  const src = context.createBufferSource();
  src.buffer = burst;
  const gain = context.createGain();
  gain.gain.setValueAtTime(type === "artifact" ? 0.55 : 0.35, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value =
    type === "artifact" ? (reducedMotion ? 900 : 1200) : reducedMotion ? 400 : 650;
  src.connect(filter).connect(gain).connect(destination);
  src.start();
  src.stop(context.currentTime + 0.5);
}

function setTitleLoading(isLoading, message = "Loading data...") {
  if (!titleNextBtn) return;
  if (isLoading) {
    titleNextBtn.disabled = true;
    titleNextBtn.dataset.loading = "true";
    titleNextBtn.setAttribute("aria-busy", "true");
    titleNextBtn.textContent = message;
  } else {
    titleNextBtn.disabled = false;
    titleNextBtn.dataset.loading = "false";
    titleNextBtn.removeAttribute("aria-busy");
    titleNextBtn.textContent =
      titleStepIndex === titleSteps.length - 1 ? "Start Run" : titleNextDefaultLabel;
  }
  if (titlePrevBtn) {
    titlePrevBtn.disabled = isLoading || titleStepIndex === 0;
  }
}

function hydrateModeOptions() {
  if (!modeOptionsContainer) return;
  const entries = Object.entries(GAME_MODES || {});
  const defaultKey = entries.length ? entries[0][0] : "normal";
  const selectedKey =
    gameState.mode && GAME_MODES[gameState.mode] ? gameState.mode : defaultKey;
  modeOptionsContainer.innerHTML = "";
  for (const [key, config] of entries) {
    const label = document.createElement("label");
    label.className = "mode-option";
    label.dataset.modeKey = key;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "mode";
    input.value = key;

    const nameSpan = document.createElement("span");
    nameSpan.className = "mode-name";
    nameSpan.textContent = sanitizeText(config.label || key);

    const descSpan = document.createElement("span");
    descSpan.className = "mode-desc";
    descSpan.textContent = sanitizeText(config.description || "");

    label.appendChild(input);
    label.appendChild(nameSpan);
    label.appendChild(descSpan);
    modeOptionsContainer.appendChild(label);
  }
  modeOptions = Array.from(modeOptionsContainer.querySelectorAll('input[name="mode"]'));
  applyModeSelection(selectedKey);
  gameState.mode = selectedKey;
  modeOptions.forEach((option) => {
    option.addEventListener("change", () => {
      gameState.mode = option.value;
      applyModeSelection(option.value);
      if (partyMode === "multi") {
        ensureHostSession({ modeKey: option.value });
        queueCoopBroadcast();
      }
    });
  });
}

function hydrateLengthOptions() {
  if (!lengthOptionsContainer) return;
  const entries = Object.entries(RUN_LENGTHS || {});
  const defaultKey = entries.length ? entries[0][0] : "very-short";
  const selectedKey =
    gameState.lengthKey && RUN_LENGTHS[gameState.lengthKey]
      ? gameState.lengthKey
      : defaultKey;
  lengthOptionsContainer.innerHTML = "";
  for (const [key, config] of entries) {
    const label = document.createElement("label");
    label.className = "mode-option length-option";
    label.dataset.lengthKey = key;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "length";
    input.value = key;

    const nameSpan = document.createElement("span");
    nameSpan.className = "mode-name";
    nameSpan.textContent = sanitizeText(config.label || key);

    const descSpan = document.createElement("span");
    descSpan.className = "mode-desc";
    const rooms = config.rooms;
    if (Number.isFinite(rooms)) {
      const chamberText = rooms === 1 ? "chamber" : "chambers";
      descSpan.textContent = `${rooms} ${chamberText}, calibrated trek.`;
    } else {
      descSpan.textContent = "Endless descent, flux without limit.";
    }

    label.appendChild(input);
    label.appendChild(nameSpan);
    label.appendChild(descSpan);
    lengthOptionsContainer.appendChild(label);
  }
  lengthOptions = Array.from(lengthOptionsContainer.querySelectorAll('input[name="length"]'));
  applyLengthSelection(selectedKey);
  gameState.lengthKey = selectedKey;
  lengthOptions.forEach((option) => {
    option.addEventListener("change", () => {
      gameState.lengthKey = option.value;
      applyLengthSelection(option.value);
      if (partyMode === "multi") {
        ensureHostSession({ lengthKey: option.value });
        queueCoopBroadcast();
      }
    });
  });
}

function applyLengthSelection(lengthKey) {
  if (!lengthOptions || !lengthOptions.length) return;
  lengthOptions.forEach((option) => {
    const selected = option.value === lengthKey;
    option.checked = selected;
    if (option.parentElement) {
      option.parentElement.classList.toggle("selected", selected);
    }
  });
}

function getSelectedMode() {
  if (!modeOptions || !modeOptions.length) {
    return gameState.mode && GAME_MODES[gameState.mode] ? gameState.mode : "normal";
  }
  const selected = modeOptions.find((option) => option.checked);
  return selected ? selected.value : gameState.mode || "normal";
}

function getSelectedLengthKey() {
  if (!lengthOptions || !lengthOptions.length) {
    return gameState.lengthKey && RUN_LENGTHS[gameState.lengthKey]
      ? gameState.lengthKey
      : "very-short";
  }
  const selected = lengthOptions.find((option) => option.checked);
  return selected ? selected.value : gameState.lengthKey || "very-short";
}

function applyModeSelection(modeKey) {
  if (!modeOptions || !modeOptions.length) return;
  modeOptions.forEach((option) => {
    const selected = option.value === modeKey;
    option.checked = selected;
    if (option.parentElement) {
      option.parentElement.classList.toggle("selected", selected);
    }
  });
}

function startNewRun() {
  const selectedPartyMode = getSelectedPartyMode();
  setPartyMode(selectedPartyMode, { skipRadio: true });
  handleSoloNameSave();
  const selectedMode = getSelectedMode();
  const selectedLength = getSelectedLengthKey();
  gameState.mode = selectedMode;
  gameState.lengthKey = selectedLength;
  syncLobbyToGameState();
  const isMulti = selectedPartyMode === "multi";
  const seed = generateSeed();
  let sessionId = gameState.sessionId;
  if (isMulti) {
    if (!sessionId) {
      sessionId = `${Date.now().toString(36)}-${seed}`;
    }
  } else {
    sessionId = null;
  }
  gameState.sessionId = sessionId;
  bodyEl.classList.remove("title-active");
  titleScreen.classList.add("hidden");
  gameContainer.classList.remove("hidden");
  tutorialOverlay.classList.add("hidden");
  optionsOverlay.classList.add("hidden");
  codexOverlay.classList.add("hidden");
  resetGameState({
    seed,
    sessionId,
    modeKey: selectedMode,
    lengthKey: selectedLength,
    readonly: false,
    remote: false,
  });
  applyAccessibilitySettings();
  syncAudioState();
  updateAudioUI();
  if (coopSync) {
    if (isMulti) {
      ensureHostSession({
        sessionId,
        modeKey: selectedMode,
        lengthKey: selectedLength,
        seed,
      });
      queueCoopBroadcast();
    } else {
      coopSync.endSession(true);
    }
  }
}

function handleRestart() {
  const isMulti = gameState.partyMode === "multi";
  const seed = generateSeed();
  let sessionId = gameState.sessionId;
  if (isMulti) {
    if (!sessionId) {
      sessionId = `${Date.now().toString(36)}-${seed}`;
    }
  } else {
    sessionId = null;
  }
  resetGameState({
    seed,
    sessionId,
    modeKey: gameState.mode,
    lengthKey: gameState.lengthKey,
    readonly: false,
    remote: false,
  });
  if (coopSync && coopSync.isHost && coopSync.isHost()) {
    if (isMulti) {
      ensureHostSession({
        sessionId,
        modeKey: gameState.mode,
        lengthKey: gameState.lengthKey,
        seed,
      });
      queueCoopBroadcast();
    } else {
      coopSync.endSession(true);
    }
  }
  syncAudioState();
}

function enterTitleScreen() {
  stopLoop();
  setReadOnlyMode(false);
  gameState.remoteSession = false;
  bodyEl.classList.add("title-active");
  applyModeSelection(gameState.mode || "casual");
  applyLengthSelection(gameState.lengthKey || "very-short");
  setPartyMode(getSelectedPartyMode(), { skipRadio: true });
  titleStepIndex = 0;
  titleScreen.classList.remove("hidden");
  gameContainer.classList.add("hidden");
  tutorialOverlay.classList.add("hidden");
  optionsOverlay.classList.add("hidden");
  codexOverlay.classList.add("hidden");
  tutorialActive = false;
  codexPrepared = false;
  audioManager.stopAmbient();
  updateAudioUI();
  renderPartySummary();
  updateTitleNavigation();
  updateTeamHud();
  setTitleLoading(false);
}

function openTutorial(startAt = 0) {
  tutorialIndex = startAt;
  tutorialActive = true;
  renderTutorialStep(tutorialIndex);
  tutorialOverlay.classList.remove("hidden");
}

function closeTutorial() {
  tutorialActive = false;
  tutorialOverlay.classList.add("hidden");
}

function renderTutorialStep(index) {
  const step = TUTORIAL_STEPS[index];
  tutorialBody.innerHTML = "";
  if (!step) return;
  const fragment = tutorialStepTemplate.content.firstElementChild.cloneNode(true);
  fragment.querySelector(".tutorial-step-title").textContent = step.title;
  const illustration = fragment.querySelector(".tutorial-illustration");
  illustration.dataset.variant = step.variant || "";
  fragment.querySelector(".tutorial-step-body").textContent = step.body;
  const hintsList = fragment.querySelector(".tutorial-hints");
  hintsList.innerHTML = step.hints
    .map((hint) => `<li>${hint}</li>`)
    .join("");
  tutorialBody.appendChild(fragment);
  tutorialPrev.disabled = index === 0;
  tutorialNext.textContent = index === TUTORIAL_STEPS.length - 1 ? "Close" : "Next";
}

function openOptions() {
  ambientToggle.checked = gameState.audio.ambient;
  sfxToggle.checked = gameState.audio.sfx;
  reducedMotionToggle.checked = gameState.audio.reducedMotion;
  highContrastToggle.checked = bodyEl.classList.contains("high-contrast");
  optionsOverlay.classList.remove("hidden");
}

function closeOptions() {
  optionsOverlay.classList.add("hidden");
}

function handleOptionsSave() {
  gameState.audio.ambient = ambientToggle.checked;
  gameState.audio.sfx = sfxToggle.checked;
  gameState.audio.reducedMotion = reducedMotionToggle.checked;
  bodyEl.classList.toggle("high-contrast", highContrastToggle.checked);
  applyAccessibilitySettings();
  syncAudioState();
  updateAudioUI();
  syncLobbyToGameState();
  renderPartySummary();
  if (gameState.gameOver) {
    const baseline =
      gameState.startingSanityTotal ||
      gameState.settings?.startingSanity ||
      (gameState.players?.length ? gameState.players.length * 100 : 100);
    preparePlayerStats(baseline);
  }
  updateTeamHud();
  closeOptions();
}

function openCodex() {
  if (!codexPrepared) {
    renderCodex();
    codexPrepared = true;
  }
  optionsOverlay.classList.add("hidden");
  codexOverlay.classList.remove("hidden");
}

function closeCodex() {
  codexOverlay.classList.add("hidden");
}

function renderCodex() {
  codexList.innerHTML = "";
  const source = artifacts && artifacts.length ? artifacts : FALLBACK_ARTIFACT_DEFS.map((def) => hydrateArtifact(def));
  const sorted = [...source].sort((a, b) => {
    const aIndex = RARITY_ORDER.indexOf(a.rarity);
    const bIndex = RARITY_ORDER.indexOf(b.rarity);
    if (aIndex === bIndex) {
      return a.name.localeCompare(b.name);
    }
    return aIndex - bIndex;
  });
  for (const artifact of sorted) {
    const entry = document.createElement("section");
    entry.className = `codex-entry rarity-${artifact.rarity}`;
    entry.innerHTML = `
      <div class="codex-name">${artifact.name}</div>
      <div class="codex-summary">${artifact.summary}</div>
      <div class="codex-effects">
        <strong>Positive:</strong> ${artifact.positive || "&mdash;"}<br>
        <strong>Neutral:</strong> ${artifact.neutral || "&mdash;"}<br>
        <strong>Negative:</strong> ${artifact.negative || "&mdash;"}
      </div>
    `;
    codexList.appendChild(entry);
  }
}

function applyAccessibilitySettings() {
  bodyEl.classList.toggle("reduced-motion", gameState.audio.reducedMotion);
  audioManager.setReducedMotion(gameState.audio.reducedMotion);
}

function toggleAudioMaster() {
  const enabled = gameState.audio.ambient || gameState.audio.sfx;
  const nextState = !enabled;
  gameState.audio.ambient = nextState;
  gameState.audio.sfx = nextState;
  if (ambientToggle) ambientToggle.checked = nextState;
  if (sfxToggle) sfxToggle.checked = nextState;
  syncAudioState();
  updateAudioUI();
}

function syncAudioState() {
  if (gameState.audio.ambient) {
    audioManager.setAmbientEnabled(true);
  } else {
    audioManager.stopAmbient();
  }
  updateAudioUI();
}

function updateAudioUI() {
  const ambientOn = gameState.audio.ambient;
  const sfxOn = gameState.audio.sfx;
  if (audioToggleBtn) {
    const label = ambientOn || sfxOn ? "Audio On" : "Audio Off";
    audioToggleBtn.textContent = label;
    audioToggleBtn.setAttribute("aria-pressed", ambientOn || sfxOn ? "true" : "false");
  }
}

coopSync = createCoopSync();
const audioManager = createAudioManager();
if (coopSync && coopSync.requestState && !coopSync.isHost()) {
  coopSync.requestState();
}
if (pendingSessionJoin && coopSync && coopSync.joinSession) {
  coopSync.joinSession(pendingSessionJoin);
  pendingSessionJoin = null;
}

initializeLobbyPlayers();
soloPlayerName = sanitizePlayerName(loadSoloName() || DEFAULT_PLAYER_NAMES[0], 0);
if (soloNameInput) {
  soloNameInput.value = soloPlayerName;
}
setPartyMode(getSelectedPartyMode(), { skipRadio: true });
renderPartySummary();
updateTitleNavigation();
updateInviteLinkUI();

async function boot() {
  enterTitleScreen();
  updateAudioUI();
  applyAccessibilitySettings();
  setTitleLoading(true);
  let ready = true;
  try {
    const result = await ensureDataReady();
    if (result === false) {
      ready = false;
    }
  } catch (error) {
    console.error("Failed to prepare game data:", error);
    ready = false;
  }
  hydrateModeOptions();
  hydrateLengthOptions();
  renderLobby();
  applyModeSelection(gameState.mode);
  applyLengthSelection(gameState.lengthKey);
  updateGachaUI();
  updateTitleNavigation();
  setTitleLoading(false);
  if (!ready) {
    console.warn("Running with fallback data after loading failure.");
  }
}

boot();

proceedBtn.addEventListener("click", proceedScene);
restartBtn.addEventListener("click", handleRestart);
if (returnTitleBtn) {
  returnTitleBtn.addEventListener("click", enterTitleScreen);
}
if (tutorialBtn) {
  tutorialBtn.addEventListener("click", () => {
    audioManager.unlock();
    openTutorial(0);
  });
}
if (openOptionsBtn) {
  openOptionsBtn.addEventListener("click", openOptions);
}
if (optionsClose) {
  optionsClose.addEventListener("click", closeOptions);
}
if (optionsSave) {
  optionsSave.addEventListener("click", handleOptionsSave);
}
if (titlePrevBtn) {
  titlePrevBtn.addEventListener("click", handleTitlePrev);
}
if (titleNextBtn) {
  titleNextBtn.addEventListener("click", handleTitleNext);
}
if (tutorialPrev) {
  tutorialPrev.addEventListener("click", () => {
    if (tutorialIndex > 0) {
      tutorialIndex -= 1;
      renderTutorialStep(tutorialIndex);
    }
  });
}
if (tutorialNext) {
  tutorialNext.addEventListener("click", () => {
    if (tutorialIndex >= TUTORIAL_STEPS.length - 1) {
      closeTutorial();
    } else {
      tutorialIndex += 1;
      renderTutorialStep(tutorialIndex);
    }
  });
}
if (tutorialClose) {
  tutorialClose.addEventListener("click", closeTutorial);
}
if (audioToggleBtn) {
  audioToggleBtn.addEventListener("click", toggleAudioMaster);
}
if (openCodexBtn) {
  openCodexBtn.addEventListener("click", openCodex);
}
if (codexClose) {
  codexClose.addEventListener("click", closeCodex);
}
if (gachaRollBtn) {
  gachaRollBtn.addEventListener("click", () => {
    audioManager.playEffect("artifact");
    handleGachaRoll();
  });
}
if (inviteCopyBtn) {
  inviteCopyBtn.addEventListener("click", () => {
    handleInviteCopy();
  });
}
if (lobbyForm) {
  lobbyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = lobbyNameInput ? lobbyNameInput.value : "";
    addLobbyPlayer(value);
    if (lobbyNameInput) {
      lobbyNameInput.value = "";
    }
  });
}
modalClose.addEventListener("click", closeModal);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!modal.classList.contains("hidden")) {
      closeModal();
      return;
    }
    if (!tutorialOverlay.classList.contains("hidden")) {
      closeTutorial();
      return;
    }
    if (!optionsOverlay.classList.contains("hidden")) {
      closeOptions();
      return;
    }
    if (!codexOverlay.classList.contains("hidden")) {
      closeCodex();
      return;
    }
    if (lobbyOverlay && !lobbyOverlay.classList.contains("hidden")) {
      closeLobbyModal();
      return;
    }
  }
});

if (partyModeInputs && partyModeInputs.length) {
  partyModeInputs.forEach((input) => {
    input.addEventListener("change", () => setPartyMode(input.value));
  });
}
if (soloNameBtn) {
  soloNameBtn.addEventListener("click", handleSoloNameSave);
}
if (soloNameInput) {
  soloNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSoloNameSave();
    }
  });
}
if (openLobbyBtn) {
  openLobbyBtn.addEventListener("click", () => {
    setPartyMode("multi");
    openLobbyModal();
  });
}
if (lobbyCloseBtn) {
  lobbyCloseBtn.addEventListener("click", closeLobbyModal);
}
if (lobbyDoneBtn) {
  lobbyDoneBtn.addEventListener("click", closeLobbyModal);
}
if (lobbyOverlay) {
  lobbyOverlay.addEventListener("click", (event) => {
    if (event.target === lobbyOverlay) {
      closeLobbyModal();
    }
  });
}







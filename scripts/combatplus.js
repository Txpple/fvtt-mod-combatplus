/**
 * Combat Plus — quality-of-life combat automation.
 *
 * Eight independent features, each behind its own world setting (Game Settings → Configure
 * Settings → Combat Plus):
 *
 *   - Combat Music: when combat starts, whatever is currently playing is snapshotted and
 *     silenced, and the configured combat playlist (or a single track from it) starts. When
 *     the last active combat ends — deleted, or its round reset to 0 — the snapshot resumes.
 *     The snapshot is persisted in a hidden world setting so a mid-combat reload can't strand
 *     the table in battle music. Playback is executed by the active GM's client only.
 *   - No Combat Without Initiative: vetoes the round 0 → 1 update in preUpdateCombat while
 *     any non-defeated combatant still has null initiative, and names the offenders.
 *   - Block Out of Turn Movement: while a combat is running, players can only move a token
 *     during that token's turn — the x/y/elevation update is vetoed in preUpdateToken with a
 *     warning.
 *     An extra toggle also locks player-owned tokens that aren't part of the fight. The GM
 *     is never blocked. (The veto runs on the initiating client, same as the module of the
 *     same name — it is a table-manners rail, not server-side enforcement.)
 *   - Clear Targets After Turn: when the turn of a combatant you own ends, your client clears
 *     its own targets (and broadcasts the empty set).
 *   - Pan to Combatant / Select Combatant: when a combatant you own starts its turn, your
 *     client pans to and/or selects its token. The GM owns everything, so for the GM this is
 *     every combatant — which is the desired follow-the-action behavior.
 *   - Automatically Set Defeated: when an in-combat actor's HP hits 0, its combatant is marked
 *     defeated and the dead overlay stamped — cleared again if it's healed back up. NPCs-only
 *     mode leaves player characters to their death saves. Driven by the active GM's client;
 *     deliberately scoped to actors that actually have a combatant somewhere.
 *   - Turn Notifications: player-facing "your turn" / "next up" messages ({{combatant.name}}
 *     templates) as normal notifications or a large screen banner with configurable font size,
 *     plus per-cue sound effects (blank path = silent) at a shared volume. GM clients stay
 *     quiet — the tracker already tells the GM everything; the new-round cue plays for all.
 *
 * Compatibility: everything here rides document-level hooks (preUpdateCombat, updateCombat,
 * deleteCombat) — no combat-tracker DOM is touched, so replacement trackers like Carousel
 * Combat Tracker work unchanged: their begin/next-turn buttons funnel into the same Combat
 * document updates these hooks observe (and the initiative gate vetoes).
 *
 * Turn-change bookkeeping is deliberately self-tracked (combat.id → last seen round/combatant
 * per client) rather than trusting Combat#previous, whose maintenance across non-initiating
 * clients has shifted between core versions.
 */

const MODULE_ID = "fvtt-mod-combatplus";
const TITLE = "Combat Plus";

/** Setting keys. */
const S = {
  combatMusic: "combatMusic",
  combatPlaylist: "combatPlaylist",
  combatSound: "combatSound",
  requireInitiative: "requireInitiative",
  lockMovement: "lockMovement",
  lockNonCombatants: "lockNonCombatants",
  clearTargets: "clearTargets",
  panToCombatant: "panToCombatant",
  selectCombatant: "selectCombatant",
  autoDefeatedNPCs: "autoDefeatedNPCs",
  autoDefeatedPCs: "autoDefeatedPCs",
  showNextUp: "showNextUp",
  nextUpMessage: "nextUpMessage",
  showYourTurn: "showYourTurn",
  yourTurnMessage: "yourTurnMessage",
  largeSize: "largeSize",
  largeFontSize: "largeFontSize",
  nextTurnSound: "nextTurnSound",
  nextTurnSoundPath: "nextTurnSoundPath",
  currentTurnSound: "currentTurnSound",
  currentTurnSoundPath: "currentTurnSoundPath",
  newRoundSound: "newRoundSound",
  newRoundSoundPath: "newRoundSoundPath",
  soundVolume: "soundVolume",
  resumeState: "resumeState"
};

const setting = key => game.settings.get(MODULE_ID, key);

/** Exactly one client may drive world-visible playback: the active GM's. */
const isActiveGM = () => game.users.activeGM?.isSelf ?? false;

/* ---------------------------------------------------------------------------------------------
 * Combat music
 * ------------------------------------------------------------------------------------------- */

/** Snapshot + silence current playback, then start the configured combat music. */
async function startCombatMusic() {
  const playlist = game.playlists.get(setting(S.combatPlaylist));
  if (!playlist) {
    ui.notifications.warn(`${TITLE}: combat music is enabled but no playlist is configured — use "Choose Combat Music" in the module settings.`);
    return;
  }
  if (playlist.playing) return; // already in battle-music mode (e.g. a second combat started)

  const playing = game.playlists.playing;
  const snapshot = playing.map(p => ({
    id: p.id,
    sounds: p.sounds.filter(s => s.playing).map(s => s.id)
  }));
  await game.settings.set(MODULE_ID, S.resumeState, snapshot);
  for (const p of playing) await p.stopAll();

  const sound = playlist.sounds.get(setting(S.combatSound));
  if (sound) await playlist.playSound(sound);
  else await playlist.playAll();
}

/** Stop the combat music and resume whatever the pre-combat snapshot recorded. */
async function stopCombatMusic() {
  const playlist = game.playlists.get(setting(S.combatPlaylist));
  if (playlist?.playing) await playlist.stopAll();

  const snapshot = setting(S.resumeState) ?? [];
  await game.settings.set(MODULE_ID, S.resumeState, []);
  for (const entry of snapshot) {
    const p = game.playlists.get(entry.id);
    if (!p || p.id === playlist?.id) continue; // never resume the battle playlist into peacetime
    const sounds = (entry.sounds ?? []).map(id => p.sounds.get(id)).filter(Boolean);
    if (sounds.length) for (const s of sounds) await p.playSound(s);
    else await p.playAll();
  }
}

/* ---------------------------------------------------------------------------------------------
 * Settings menu: playlist + track picker (dropdowns must be built from live world data, which
 * a plain registered setting can't do — its choices freeze at registration time).
 * ------------------------------------------------------------------------------------------- */

class CombatMusicConfig extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "combatplus-music-config",
    tag: "form",
    window: { title: "Combat Music", icon: "fa-solid fa-music", contentClasses: ["standard-form"] },
    position: { width: 480, height: "auto" },
    form: { handler: CombatMusicConfig.#onSubmit, closeOnSubmit: true }
  };

  async _renderHTML() {
    const configured = setting(S.combatPlaylist);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="form-group">
        <label>Playlist</label>
        <div class="form-fields"><select name="playlist"></select></div>
        <p class="hint">The playlist that plays during combat.</p>
      </div>
      <div class="form-group">
        <label>Track</label>
        <div class="form-fields"><select name="sound"></select></div>
        <p class="hint">A single track from that playlist, or the entire playlist.</p>
      </div>
      <footer class="form-footer">
        <button type="submit"><i class="fa-solid fa-floppy-disk" inert></i> Save</button>
      </footer>`;

    const playlistSelect = wrapper.querySelector('[name="playlist"]');
    playlistSelect.add(new Option("— none —", ""));
    for (const p of game.playlists.contents.sort((a, b) => a.name.localeCompare(b.name)))
      playlistSelect.add(new Option(p.name, p.id, false, p.id === configured));
    playlistSelect.addEventListener("change", () => this.#populateSounds());
    return wrapper;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(...result.children);
    this.#populateSounds(setting(S.combatSound));
  }

  /** Rebuild the track dropdown from whichever playlist is selected. */
  #populateSounds(selected = "") {
    const playlist = game.playlists.get(this.element.querySelector('[name="playlist"]').value);
    const soundSelect = this.element.querySelector('[name="sound"]');
    soundSelect.innerHTML = "";
    soundSelect.add(new Option("— entire playlist —", ""));
    for (const s of Array.from(playlist?.sounds ?? []).sort((a, b) => a.name.localeCompare(b.name)))
      soundSelect.add(new Option(s.name, s.id, false, s.id === selected));
    soundSelect.disabled = !playlist;
  }

  static async #onSubmit(event, form, formData) {
    const { playlist, sound } = formData.object;
    await game.settings.set(MODULE_ID, S.combatPlaylist, playlist ?? "");
    await game.settings.set(MODULE_ID, S.combatSound, playlist ? (sound ?? "") : "");
  }
}

/* ---------------------------------------------------------------------------------------------
 * Settings registration
 * ------------------------------------------------------------------------------------------- */

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "combatMusicMenu", {
    name: "Combat Music Track",
    label: "Choose Combat Music",
    hint: "Pick the playlist — and optionally a single track — that plays during combat.",
    icon: "fa-solid fa-music",
    type: CombatMusicConfig,
    restricted: true
  });

  game.settings.register(MODULE_ID, S.combatMusic, {
    name: "Combat Music",
    hint: "When combat starts, whatever is playing is silenced and the configured combat music starts; when combat ends, the previous music resumes.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.requireInitiative, {
    name: "No Combat Without Initiative",
    hint: "Prevent combat from beginning until every non-defeated combatant has rolled initiative.",
    scope: "world", config: true, type: Boolean, default: false
  });

  // Split from the old three-choice `autoDefeated` at v1.3.0 (user call 2026-08-16): one
  // switch per side, and the overlay no longer requires a combat — a creature dead on the
  // practice field is just as dead as one dead in initiative. Both default ON (the user's
  // explicit call for PCs; continuity for NPCs).
  game.settings.register(MODULE_ID, S.autoDefeatedNPCs, {
    name: "Auto-Defeated: NPCs",
    hint: "When an NPC's hit points reach 0, stamp the dead overlay (and mark its combatant defeated if it is in a fight) — cleared again if it is healed back up. Works in and out of combat.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.autoDefeatedPCs, {
    name: "Auto-Defeated: PCs",
    hint: "The same for player characters at 0 HP. By the book a PC at 0 is dying, not dead — this table stamps the overlay anyway (turn this off to leave PCs to their death saves).",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.lockMovement, {
    name: "Block Out of Turn Movement",
    hint: "While a combat is running, players can only move a token during that token's turn. The GM is never blocked.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.lockNonCombatants, {
    name: "Block Out of Turn Movement: Non-Combatants",
    hint: "Also lock player-owned tokens that aren't part of the fight while a combat runs on their scene. Off = only combatants are restricted.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.clearTargets, {
    name: "Clear Targets After Turn",
    hint: "When the turn of a combatant you own ends, your targets are cleared automatically.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.panToCombatant, {
    name: "Pan to Combatant",
    hint: "When a combatant you own starts its turn, the camera pans to its token. (The GM owns everything, so the GM follows every turn.)",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.selectCombatant, {
    name: "Select Combatant",
    hint: "When a combatant you own starts its turn, its token is selected automatically. (The GM owns everything, so the GM selects every combatant.)",
    scope: "world", config: true, type: Boolean, default: false
  });

  // --- Combat Turn Notification block (a divider header is injected above the first of these
  // by the renderSettingsConfig hook below). Player-facing: GM clients stay quiet.
  game.settings.register(MODULE_ID, S.showNextUp, {
    name: "Show 'Next Up' Notification",
    hint: "Show a notification to players that their turn is next.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.nextUpMessage, {
    name: "Next Up Message",
    hint: "{{combatant.name}} is replaced with the combatant's name.",
    scope: "world", config: true, type: String, default: "Get ready {{combatant.name}}, you're up next!"
  });

  game.settings.register(MODULE_ID, S.showYourTurn, {
    name: "Show 'Your Turn' Notification",
    hint: "Show a notification to the player whose turn has started.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.yourTurnMessage, {
    name: "Your Turn Message",
    hint: "{{combatant.name}} is replaced with the combatant's name.",
    scope: "world", config: true, type: String, default: "It's your turn {{combatant.name}}, what do you want to do?"
  });

  game.settings.register(MODULE_ID, S.largeSize, {
    name: "Large Size",
    hint: "Display the turn notifications as a large banner across the screen instead of a normal notification.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.largeFontSize, {
    name: "Large Font Size",
    hint: "Font size (px) for the large turn banner.",
    scope: "world", config: true, type: Number, default: 80,
    range: { min: 20, max: 200, step: 5 }
  });

  game.settings.register(MODULE_ID, S.nextTurnSound, {
    name: "Next Turn Sound",
    hint: "Audio effect to play for a player when their turn is up next. Leave the file blank to play no sound.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.nextTurnSoundPath, {
    name: "Next Turn Sound File",
    hint: "Leave blank to play no sound.",
    scope: "world", config: true, type: String, default: "", filePicker: "audio"
  });

  game.settings.register(MODULE_ID, S.currentTurnSound, {
    name: "Current Turn Sound",
    hint: "Audio effect to play for a player at the beginning of their turn. Leave the file blank to play no sound.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.currentTurnSoundPath, {
    name: "Current Turn Sound File",
    hint: "Leave blank to play no sound.",
    scope: "world", config: true, type: String, default: "", filePicker: "audio"
  });

  game.settings.register(MODULE_ID, S.newRoundSound, {
    name: "New Round Sound",
    hint: "Audio effect to play for everyone at the start of a new round. Leave the file blank to play no sound.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.newRoundSoundPath, {
    name: "New Round Sound File",
    hint: "Leave blank to play no sound.",
    scope: "world", config: true, type: String, default: "", filePicker: "audio"
  });

  game.settings.register(MODULE_ID, S.soundVolume, {
    name: "Volume",
    hint: "Volume of the turn and round sound cues.",
    scope: "world", config: true, type: Number, default: 60,
    range: { min: 0, max: 100, step: 5 }
  });

  // Hidden plumbing: the music picker's storage and the pre-combat playback snapshot.
  game.settings.register(MODULE_ID, S.combatPlaylist, { scope: "world", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, S.combatSound, { scope: "world", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, S.resumeState, { scope: "world", config: false, type: Object, default: [] });
});

// Settings-sheet polish: core renders menu buttons ABOVE a module's settings, which would put
// the track picker above the Combat Music toggle that governs it — move it just below the
// toggle instead. Fields whose governing toggle is unchecked grey out live (disabled inputs are
// skipped by form submission, so a greyed field simply keeps its stored value).
Hooks.on("renderSettingsConfig", (app, element) => {
  const el = element instanceof HTMLElement ? element : element?.[0];
  if (!el) return;
  const input = key => el.querySelector(`[name="${MODULE_ID}.${key}"]`);
  const setEnabled = (field, enabled) => {
    if (!field) return;
    field.disabled = !enabled;
    const group = field.closest(".form-group");
    if (group) group.style.opacity = enabled ? "" : "0.4";
  };

  // Combat music: move the track-picker button just below its toggle.
  const musicToggle = input(S.combatMusic);
  const menuButton = el.querySelector(`button[data-key="${MODULE_ID}.combatMusicMenu"]`);
  if (musicToggle && menuButton)
    musicToggle.closest(".form-group")?.after(menuButton.closest(".form-group"));

  // Divider headers so the long settings list reads in chapters. Inserted after the menu-button
  // move above, so "Battle Music" ends up heading both the toggle and the picker beneath it.
  const addDivider = (field, text) => {
    const group = field?.closest(".form-group");
    if (!group || group.previousElementSibling?.classList?.contains("cp-divider")) return;
    const header = document.createElement("h4");
    header.className = "divider cp-divider";
    header.textContent = text;
    group.before(header);
  };
  addDivider(musicToggle, "Battle Music");
  addDivider(input(S.requireInitiative), "Combat Workflows");
  addDivider(input(S.showNextUp), "Combat Turn Notification");

  // Dependency rules: field → is it relevant, given the toggles' CURRENT (unsaved) state?
  const on = key => !!input(key)?.checked;
  const anyNotification = () => on(S.showNextUp) || on(S.showYourTurn);
  const anySound = () => on(S.nextTurnSound) || on(S.currentTurnSound) || on(S.newRoundSound);
  const rules = new Map([
    [menuButton, () => on(S.combatMusic)],
    [input(S.nextUpMessage), () => on(S.showNextUp)],
    [input(S.yourTurnMessage), () => on(S.showYourTurn)],
    [input(S.largeSize), anyNotification],
    [input(S.largeFontSize), () => anyNotification() && on(S.largeSize)],
    [input(S.nextTurnSoundPath), () => on(S.nextTurnSound)],
    [input(S.currentTurnSoundPath), () => on(S.currentTurnSound)],
    [input(S.newRoundSoundPath), () => on(S.newRoundSound)],
    [input(S.soundVolume), anySound]
  ]);
  const syncAll = () => rules.forEach((relevant, field) => setEnabled(field, relevant()));
  syncAll();
  for (const key of [S.combatMusic, S.showNextUp, S.showYourTurn, S.largeSize,
    S.nextTurnSound, S.currentTurnSound, S.newRoundSound])
    input(key)?.addEventListener("change", syncAll);
});

/* ---------------------------------------------------------------------------------------------
 * Turn notifications & sound cues
 * ------------------------------------------------------------------------------------------- */

/** The next non-defeated combatant after the current turn (wrapping into the next round). */
function nextCombatant(combat) {
  const turns = combat.turns;
  if (!turns?.length) return null;
  for (let i = 1; i <= turns.length; i++) {
    const c = turns[(combat.turn + i) % turns.length];
    if (c && !c.isDefeated) return c;
  }
  return null;
}

/** Show a turn message: a big self-fading banner when Large Size is on, else a notification. */
function notifyTurn(template, combatant) {
  const text = (template ?? "").replaceAll("{{combatant.name}}", combatant.name ?? "");
  if (!text) return;
  if (!setting(S.largeSize)) return void ui.notifications.info(text);
  const banner = document.createElement("div");
  banner.textContent = text;
  Object.assign(banner.style, {
    position: "fixed", top: "15%", left: "0", width: "100%", textAlign: "center",
    fontSize: `${setting(S.largeFontSize) || 80}px`, fontFamily: "var(--font-h1, inherit)",
    color: "#fff", textShadow: "0 0 8px #000, 2px 2px 4px #000",
    zIndex: 9999, pointerEvents: "none", transition: "opacity 1s ease-in"
  });
  document.body.appendChild(banner);
  setTimeout(() => (banner.style.opacity = "0"), 3000);
  setTimeout(() => banner.remove(), 4200);
}

/** Play a local sound cue if its toggle is on and a file is configured (blank = silent). */
function playCue(enableKey, pathKey) {
  if (!setting(enableKey)) return;
  const src = setting(pathKey);
  if (!src) return;
  const volume = (setting(S.soundVolume) ?? 60) / 100;
  void foundry.audio.AudioHelper.play({ src, volume, loop: false }, false);
}

/* ---------------------------------------------------------------------------------------------
 * Automatically set defeated — active-GM client stamps the dead overlay at 0 HP (and clears
 * it on heal), per side. Combatants additionally get the tracker's defeated mark; being in
 * a combat is NOT required for the overlay (v1.3.0, user call — the old combat-only scope
 * is why a practice dummy could die without an icon).
 * ------------------------------------------------------------------------------------------- */

Hooks.on("updateActor", (actor, changed) => {
  if (!isActiveGM()) return;
  const hp = foundry.utils.getProperty(changed, "system.attributes.hp.value");
  if (hp === undefined) return;
  const isPC = actor.type === "character";
  if (!setting(isPC ? S.autoDefeatedPCs : S.autoDefeatedNPCs)) return;

  const defeated = hp <= 0;
  for (const combat of game.combats) {
    for (const c of combat.combatants) {
      // Unlinked (synthetic) actors match by token; linked actors catch all their linked tokens.
      const match = actor.isToken ? c.tokenId === actor.token.id
        : c.actorId === actor.id && c.token?.actorLink !== false;
      if (!match || c.isDefeated === defeated) continue;
      void c.update({ defeated });
    }
  }
  if (actor.statuses.has("dead") !== defeated)
    void actor.toggleStatusEffect("dead", { active: defeated, overlay: true });
});

/* ---------------------------------------------------------------------------------------------
 * Combat lifecycle
 * ------------------------------------------------------------------------------------------- */

/** Per-client bookkeeping: combat.id → { round, combatantId } as of the last state we saw. */
const combatState = new Map();
const rememberState = combat =>
  combatState.set(combat.id, { round: combat.round ?? 0, combatantId: combat.combatant?.id ?? null });

Hooks.once("ready", () => game.combats.forEach(rememberState));
Hooks.on("createCombat", rememberState);

// The initiative gate: veto the round 0 → 1+ update while anyone still hasn't rolled.
Hooks.on("preUpdateCombat", (combat, changed) => {
  if (!setting(S.requireInitiative)) return;
  if (combat.round !== 0 || !("round" in changed) || !(changed.round > 0)) return;
  const missing = combat.combatants.filter(c => c.initiative == null && !c.isDefeated);
  if (!missing.length) return;
  ui.notifications.warn(`Combat can't begin — initiative hasn't been rolled for: ${missing.map(c => c.name).join(", ")}.`);
  return false;
});

/* ---------------------------------------------------------------------------------------------
 * Not Your Turn! — movement lock while combat runs. Veto happens in preUpdateToken on the
 * client initiating the move, so it covers drags, arrow keys, ruler moves, and macros alike.
 * ------------------------------------------------------------------------------------------- */

/** The started combat governing a token's scene, if any (scene-less combats govern everywhere). */
const governingCombat = tokenDoc =>
  game.combats.find(c => c.started && (!c.scene || c.scene.id === tokenDoc.parent?.id));

Hooks.on("preUpdateToken", (tokenDoc, changed) => {
  if (game.user.isGM || !setting(S.lockMovement)) return;
  if (!("x" in changed) && !("y" in changed) && !("elevation" in changed)) return;

  const combat = governingCombat(tokenDoc);
  if (!combat) return;
  if (combat.combatant?.tokenId === tokenDoc.id) return; // its turn — move freely

  const isCombatant = combat.combatants.find(c =>
    c.tokenId === tokenDoc.id && (!c.sceneId || c.sceneId === tokenDoc.parent?.id));
  if (!isCombatant && !setting(S.lockNonCombatants)) return;

  ui.notifications.warn(isCombatant
    ? `Not your turn — ${tokenDoc.name} moves when its turn comes.`
    : `A combat is underway — ${tokenDoc.name} is locked until it ends.`);
  return false;
});

Hooks.on("updateCombat", (combat, changed) => {
  if (!("round" in changed) && !("turn" in changed)) return;
  const prior = combatState.get(combat.id) ?? { round: 0, combatantId: null };
  rememberState(combat);

  // Combat music: round 0 → 1+ is the start; a reset back to round 0 ends the fight early.
  if (isActiveGM() && setting(S.combatMusic)) {
    if (prior.round === 0 && combat.round > 0) void startCombatMusic();
    else if (prior.round > 0 && combat.round === 0) void stopCombatMusic();
  }

  if (!combat.started) return;

  // Clear this client's targets once the turn of a combatant it owns has ended. Cleared via
  // Token#setTarget — User#updateTokenTargets existed through v13 but is GONE in v14; setTarget
  // is stable in both. groupSelection defers the per-token broadcast; one activity ping at the end.
  const previous = combat.combatants.get(prior.combatantId);
  if (setting(S.clearTargets) && previous?.isOwner && game.user.targets.size) {
    for (const t of [...game.user.targets]) t.setTarget(false, { releaseOthers: false, groupSelection: true });
    game.user.broadcastActivity({ targets: [] });
  }

  // Turn notifications & sound cues. The new-round cue is for everyone; the your-turn /
  // next-up messages and turn sounds are player-facing only — the GM owns everything and
  // already has the tracker, so GM clients stay quiet.
  if (combat.round > prior.round) playCue(S.newRoundSound, S.newRoundSoundPath);
  if (!game.user.isGM) {
    const current = combat.combatant;
    if (current?.isOwner) {
      if (setting(S.showYourTurn)) notifyTurn(setting(S.yourTurnMessage), current);
      playCue(S.currentTurnSound, S.currentTurnSoundPath);
    }
    const next = nextCombatant(combat);
    if (next?.isOwner && next !== current) {
      if (setting(S.showNextUp)) notifyTurn(setting(S.nextUpMessage), next);
      playCue(S.nextTurnSound, S.nextTurnSoundPath);
    }
  }

  // Pan/select the new combatant on the client that owns it (token.object is only non-null
  // when the token sits on the scene this client is viewing).
  const token = combat.combatant?.token?.object;
  if (!token?.isOwner) return;
  if (setting(S.selectCombatant)) token.control({ releaseOthers: true });
  if (setting(S.panToCombatant)) canvas.animatePan({ ...token.center, duration: 250 });
});

Hooks.on("deleteCombat", combat => {
  combatState.delete(combat.id);
  if (!isActiveGM() || !setting(S.combatMusic) || !combat.started) return;
  if (game.combats.find(c => c.id !== combat.id && c.started)) return; // another fight still running
  void stopCombatMusic();
});

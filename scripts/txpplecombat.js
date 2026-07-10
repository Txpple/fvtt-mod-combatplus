/**
 * Txpple's Combat Enhancements — quality-of-life combat automation.
 *
 * Five independent features, each behind its own world setting (Game Settings → Configure
 * Settings → Txpple's Combat Enhancements):
 *
 *   - Combat Music: when combat starts, whatever is currently playing is snapshotted and
 *     silenced, and the configured combat playlist (or a single track from it) starts. When
 *     the last active combat ends — deleted, or its round reset to 0 — the snapshot resumes.
 *     The snapshot is persisted in a hidden world setting so a mid-combat reload can't strand
 *     the table in battle music. Playback is executed by the active GM's client only.
 *   - No Combat Without Initiative: vetoes the round 0 → 1 update in preUpdateCombat while
 *     any non-defeated combatant still has null initiative, and names the offenders.
 *   - Clear Targets After Turn: when the turn of a combatant you own ends, your client clears
 *     its own targets (and broadcasts the empty set).
 *   - Pan to Combatant / Select Combatant: when a combatant you own starts its turn, your
 *     client pans to and/or selects its token. The GM owns everything, so for the GM this is
 *     every combatant — which is the desired follow-the-action behavior.
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

const MODULE_ID = "fvtt-mod-txpplecombat";
const TITLE = "Txpple's Combat Enhancements";

/** Setting keys. */
const S = {
  combatMusic: "combatMusic",
  combatPlaylist: "combatPlaylist",
  combatSound: "combatSound",
  requireInitiative: "requireInitiative",
  clearTargets: "clearTargets",
  panToCombatant: "panToCombatant",
  selectCombatant: "selectCombatant",
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
    id: "txpplecombat-music-config",
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

  // Hidden plumbing: the music picker's storage and the pre-combat playback snapshot.
  game.settings.register(MODULE_ID, S.combatPlaylist, { scope: "world", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, S.combatSound, { scope: "world", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, S.resumeState, { scope: "world", config: false, type: Object, default: [] });
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

  // Clear this client's targets once the turn of a combatant it owns has ended.
  const previous = combat.combatants.get(prior.combatantId);
  if (setting(S.clearTargets) && previous?.isOwner && game.user.targets.size) {
    game.user.updateTokenTargets([]);
    game.user.broadcastActivity({ targets: [] });
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

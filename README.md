# Combat Plus

Quality-of-life combat automation for Foundry VTT. Nine independent features, each behind
its own setting in **Game Settings → Configure Settings → Combat Plus**:

- **Combat Music** — when combat starts, whatever is playing is snapshotted and silenced, and
  the configured combat playlist (or a single track from it) starts. When the fight ends, the
  snapshot resumes exactly what was playing before. Pick the playlist/track with the
  **Choose Combat Music** button. The snapshot survives a mid-combat reload; playback is
  driven by the active GM's client only.
- **No Combat Without Initiative** — combat refuses to begin while any non-defeated combatant
  still hasn't rolled initiative, and the warning names the stragglers.
- **Block Out of Turn Movement** — while a combat is running, players can only move a token
  during that token's turn; blocked moves get a warning naming the token. The GM is never
  blocked, and tokens only lock once combat has actually started (round 1+), so pre-fight
  setup stays free. An extra checkbox also locks player-owned tokens that aren't part of the
  fight.
- **Clear Targets After Turn** — when the turn of a combatant you own ends, your targets are
  cleared automatically.
- **Pan to Combatant** — when a combatant you own starts its turn, the camera pans to its
  token.
- **Select Combatant** — when a combatant you own starts its turn, its token is selected
  automatically.
- **Auto-Defeated: NPCs / PCs** — when an actor's HP reaches 0, the dead overlay is stamped
  (and its combatant marked defeated if it is in a fight); healed back above 0, both are
  cleared. One switch per side, so turning off the PC half leaves player characters to their
  death saves. No combat is required — a creature dead on the practice field is just as dead.
- **Combat Turn Notification** — "your turn" and "next up" messages for players (with
  `{{combatant.name}}` templates), either as normal notifications or a large screen banner
  with configurable font size, plus sound cues for next turn / current turn / new round at a
  shared volume. Sound files are chosen per cue — leave a file blank to keep that cue silent.
  GM clients are never notified (the tracker already tells the GM everything); the new-round
  sound plays for everyone.
- **Confirm Roll Visibility Changes** — the roll-visibility buttons (public / private GM /
  blind / self / in-character) sit directly under the chat box, one stray pixel from where the
  cursor already is, and a misclick silently reroutes every roll that follows. With this on
  (the default), the click asks first, and the mode only changes if you confirm.

Pan/select/clear act on the client that **owns** the combatant: players get them on their own
turns; the GM (who owns everything) follows every turn — the desired follow-the-action
behavior.

## Compatibility

Every combat feature rides document-level hooks (`preUpdateCombat`, `updateCombat`,
`deleteCombat`) — no combat-tracker UI is touched. (The roll-visibility guard is the one
UI-side feature: it listens for clicks on core's own chat controls, matching both the v13
`#roll-privacy` / `core.rollMode` plumbing and its v14 `#message-modes` / `core.messageMode`
replacement.) Replacement trackers such as **Carousel Combat Tracker**
work unchanged: their begin/next-turn buttons funnel into the same Combat document updates
these hooks observe (and the initiative gate vetoes).

Compatibility: Foundry v13+ (verified on v14).

## Installation

Install via manifest URL:

```
https://github.com/Txpple/fvtt-mod-combatplus/releases/latest/download/module.json
```

## License

MIT

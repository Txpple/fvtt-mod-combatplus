# Combat Plus

Quality-of-life combat automation for Foundry VTT. Five independent features, each behind its
own checkbox in **Game Settings → Configure Settings → Combat Plus**:

- **Combat Music** — when combat starts, whatever is playing is snapshotted and silenced, and
  the configured combat playlist (or a single track from it) starts. When the fight ends, the
  snapshot resumes exactly what was playing before. Pick the playlist/track with the
  **Choose Combat Music** button. The snapshot survives a mid-combat reload; playback is
  driven by the active GM's client only.
- **No Combat Without Initiative** — combat refuses to begin while any non-defeated combatant
  still hasn't rolled initiative, and the warning names the stragglers.
- **Clear Targets After Turn** — when the turn of a combatant you own ends, your targets are
  cleared automatically.
- **Pan to Combatant** — when a combatant you own starts its turn, the camera pans to its
  token.
- **Select Combatant** — when a combatant you own starts its turn, its token is selected
  automatically.

Pan/select/clear act on the client that **owns** the combatant: players get them on their own
turns; the GM (who owns everything) follows every turn — the desired follow-the-action
behavior.

## Compatibility

Everything rides document-level hooks (`preUpdateCombat`, `updateCombat`, `deleteCombat`) —
no combat-tracker UI is touched. Replacement trackers such as **Carousel Combat Tracker**
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

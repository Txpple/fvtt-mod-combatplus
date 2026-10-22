# Open Roll 5e: Combat Plus

A Foundry VTT module that automates the small chores of running a fight. It plays combat music and
restores what was playing before, holds combat until everyone has rolled initiative, keeps players
from moving out of turn, marks NPCs defeated at 0 HP, tells players when they are up, follows
the active combatant on its owner's screen, asks before a stray click changes who can see your
rolls, shows players a creature's portrait when they double-click a token they don't own, and
gives the GM a mode that lifts the fog and shows every token. Each feature has its own
setting and works on its own.

## How it works

- **Combat features ride the Combat document, not the tracker.** They watch combat updates rather
  than the tracker's buttons, so replacement trackers such as Carousel Combat Tracker work
  unchanged.
- **World-wide changes run on one client.** Combat music and defeated marking are carried out by
  the active GM's client, so nothing happens twice.
- **Per-player behaviour runs on the owner's client.** Turn messages, target clearing, panning and
  selection happen for whoever owns the combatant. The GM owns everything, so the GM follows every
  turn.
- **Settings group into sections** (Battle Music, Combat Workflows, Combat Turn Notification, Chat
  & Rolls, Players, GM Vision), and options that depend on a switch grey out while it is off.

## Installation

Paste the manifest URL into Foundry's *Install Module* dialog:

```
https://github.com/Txpple/fvtt-mod-combatplus/releases/latest/download/module.json
```

Requires Foundry VTT v13 or v14. Auto-Defeated reads dnd5e hit points; the other features work with
any system. No other dependencies.

## Combat music

When a combat begins, whatever is playing is noted and stopped, and the chosen combat playlist
starts, either a single track or the whole playlist. When the last running combat is deleted, or a
combat is reset to round 0, the combat music stops and the earlier music resumes. Pick the playlist
and track with the **Choose Combat Music** button in the settings. The record of what was playing is
saved in the world, so a reload mid-fight still brings the right music back.

## Combat workflows

- **No Combat Without Initiative.** Combat will not begin while any combatant who is not defeated
  still has no initiative. The warning names who is missing.
- **Block Out of Turn Movement.** Once a combat has started, players can move a token only on that
  token's turn; other moves are refused with a warning. Setup before round 1 stays free, and the GM
  is never blocked. A second switch also locks player tokens on the scene that are not in the
  fight. The check runs on the player's own client, so it is a courtesy rail, not enforcement.
- **Auto-Defeated: NPCs.** When an NPC's HP reaches 0 it gets the dead overlay, and any combatant
  for it is marked defeated; healing above 0 clears both. No combat is needed. Player characters are
  never touched: at 0 HP a character is dying, not dead, and dnd5e's own *Apply Downed Conditions*
  and By the Books' death saves play that out. Who writes the Dead status, and when, is written once
  for the family in
  [contracts/dead.md](https://github.com/Txpple/fvtt-suite-openroll5e/blob/main/contracts/dead.md).
- **Clear Targets After Turn.** When the turn of a combatant you own ends, your targets are cleared.
- **Pan to Combatant** and **Select Combatant.** When a combatant you own starts its turn, the
  camera pans to its token and the token is selected.

## Turn notifications

Players see a "your turn" message when their combatant's turn starts and a "next up" message when it
is next. Both texts are editable, and `{{combatant.name}}` is replaced with the combatant's name. They
show as normal notifications or, with **Large Size**, as a banner across the screen at a font size you
choose.

Three sound cues are available: next turn, current turn and new round, at a shared volume. Each cue
plays only when its file is set. GM clients get no turn messages or turn sounds, since the tracker
already tells the GM everything; the new-round sound plays for everyone.

## Confirm roll visibility

The roll visibility buttons (public, private GM, blind, self) sit right under the chat box, and a
misclick quietly changes where every later roll goes. With this setting on, clicking one asks first,
and the mode changes only if you confirm. Enter or Escape keeps the current mode.

## Portrait view

A player who double-clicks a hostile creature, or any token they have no permission on, gets its
portrait in Foundry's image window, under the token's name. Without this, the double-click does
nothing, and the only way to show a portrait is to give players Limited on the actor, which opens
its limited sheet, biography included.

- No ownership changes, no sheet, no stats.
- The title is the token's name, not the actor's, so a token renamed "Hooded figure" stays a
  hooded figure.
- Players with Limited or better still get the sheet. Tokens with the secret disposition do
  nothing.
- With Loot Shelf active, its shop and chest tokens still open their shelves.

## GM Vision

A mode for the GM's own screen. While it is on:

- the scene is brightened and its darkness halved, so a night map reads like day;
- the fog of war is lifted;
- every token shows, even one the tokens you control could not see. Those tokens carry a hatched
  overlay, so you can still tell what your tokens would miss.

Toggle it with **Ctrl+G** (rebindable under *Configure Controls*), with the lightbulb tool in the
token controls, or by right-clicking the lighting controls button, whose bulb turns solid while the
mode is on. A macro can flip it too:

```js
game.settings.set("fvtt-mod-combatplus", "gmVisionActive", !game.settings.get("fvtt-mod-combatplus", "gmVisionActive"));
```

Players see no change: it runs on GM clients only. While the setting is on, tokens hidden from
players carry the hatch on the GM's screen whether the mode is on or off. Turning the setting on or
off takes a reload. If the separate GM Vision module is active, Combat Plus leaves the job to it.

GM Vision is ported from [GM Vision](https://github.com/dev7355608/gm-vision) by dev7355608, under
the MIT License; its notice is kept in [LICENSE](LICENSE).

## Settings

*Game Settings → Configure Settings → Open Roll 5e: Combat Plus.*

| Setting | Default | What it does |
| --- | --- | --- |
| Combat Music | Off | Swaps in the combat playlist for the fight and restores the earlier music after. |
| Choose Combat Music | | Picks the playlist and, optionally, one track. |
| No Combat Without Initiative | Off | Holds round 1 until everyone has rolled. |
| Auto-Defeated: NPCs | On | Dead overlay and defeated mark for NPCs at 0 HP. Player characters are never touched. |
| Block Out of Turn Movement | Off | Players move only on their token's turn. |
| Block Out of Turn Movement: Non-Combatants | Off | Also locks player tokens not in the fight. |
| Clear Targets After Turn | Off | Clears your targets when your turn ends. |
| Pan to Combatant | Off | Pans to your combatant at the start of its turn. |
| Select Combatant | Off | Selects your combatant's token at the start of its turn. |
| Next Up / Your Turn notifications and messages | Off | Player turn messages, with editable text. |
| Large Size / Large Font Size | Off / 80 | Shows turn messages as a screen banner. |
| Next Turn / Current Turn / New Round Sound, and their files | On, no file | Sound cues; a blank file is silent. |
| Volume | 60 | Volume of the sound cues. |
| Confirm Roll Visibility Changes | On | Asks before the roll visibility mode changes. |
| Portrait View for Players | On | Double-clicking a token you have no permission on shows its portrait. |
| GM Vision | Off | Adds the GM's brighten, lift-the-fog, show-every-token mode. Takes a reload. |

## Development

There is no build step: the module is plain ES modules loaded straight from the repo,
`scripts/combatplus.js` and the GM Vision port in `scripts/gmvision/`. Releases: bump `version`
and the `download` URL in `module.json` together, tag `vX.Y.Z`, and publish a zip of the module
with the manifest as a GitHub release.

<!-- openroll5e:family -->
## Part of Open Roll 5e

Combat Plus is one of the Open Roll 5e modules for Foundry VTT, a suite built for one D&D 5e table and
shared. Each module installs and works on its own and none needs another; together they cover the
table from the fog of war to the loot. The other modules:

- [Open Roll 5e: Autoexplore](https://github.com/Txpple/fvtt-mod-autoexplore): lets a scene start fully explored, so the whole map shows through the fog of war while tokens still need line of sight.
- [Open Roll 5e: By the Books](https://github.com/Txpple/fvtt-mod-bythebooks): the 2024 rules played from the sheet: a hit rolls and applies its own damage, saves resolve themselves, reactions hold, concentration is tracked, and rests, senses, sizes and lights follow the book. Every rule that rides a use or an effect in the 2024 core books, Heroes of Faerûn, Arcana Unleashed and Ravenloft: The Horrors Within, each step with a receipt and a revert; offered, never enforced.
- [Open Roll 5e: Errata](https://github.com/Txpple/fvtt-mod-errata5e): corrects, in memory, bugs in the premium D&D 2024 books, the dnd5e system and Foundry itself, each fix held until the vendor ships its own.
- [Open Roll 5e: FX Studio](https://github.com/Txpple/fvtt-mod-fxstudio): visual and sound effects for dnd5e, played from what actually happened at the table, with about a thousand stock FX and a window for authoring your own.
- [Open Roll 5e: Loot Shelf](https://github.com/Txpple/fvtt-mod-lootshelf): loot chests and merchant shelves that players can take from, buy from and sell to without owning them, with a receipt for every trade.
- [Open Roll 5e: Open Server](https://github.com/Txpple/fvtt-mod-openserver): for hosted worlds: clears the startup pause so players can play before the GM arrives, and gives any user a landing scene of their own.
- [Open Roll 5e: Party Stash](https://github.com/Txpple/fvtt-mod-partystash): makes a dnd5e Group actor's inventory a working party stash: drags move instead of copying, coin moves through a dialog, and every transfer posts a receipt.
- [Open Roll 5e: Area Sounds](https://github.com/Txpple/fvtt-mod-areasounds): background sound for scenes: random one-shots with silence between them, seamless crossfaded loops, day and night gating, and quiet during combat.
- [Open Roll 5e: Token Art](https://github.com/Txpple/fvtt-mod-tokenart): gives every token the look of its state, ready, in combat or dead, each a file named beside the base art, with nothing to configure.

Three MCP servers for [Claude Code](https://claude.com/claude-code) complete the suite:

- [fvtt-mcp-dnd5e](https://github.com/Txpple/fvtt-mcp-dnd5e): builds D&D 5e content in a live Foundry world from Claude Code: a stat block becomes a complete NPC, a map image a walled and lit scene, an adventure its journals, tables and handouts.
- [fvtt-mcp-imagegen](https://github.com/Txpple/fvtt-mcp-imagegen): makes the art with Google's Gemini image models: icons, tokens, props, portraits and illustrations, token redresses and restyles, battlemap and overland-map repaints, and the illustrated session records, all grounded in what the world already shows.
- [fvtt-mcp-sessionscribe](https://github.com/Txpple/fvtt-mcp-sessionscribe): turns a session's Discord recording and Foundry chat log into its record. Its end-to-end `session-scribe` skill drives the server from the Craig link to a speaker-labelled transcript, a fully illustrated player recap, combat statistics, GM notes and a party snapshot.

Issues are welcome on every repo in the family; pull requests are not accepted, since each is one
author's design for one table, shared because it might suit yours. How they fit together is mapped in [fvtt-suite-openroll5e](https://github.com/Txpple/fvtt-suite-openroll5e).
<!-- /openroll5e:family -->

## License

MIT. See [LICENSE](LICENSE). Includes code from GM Vision, copyright (c) 2023 dev7355608, MIT.

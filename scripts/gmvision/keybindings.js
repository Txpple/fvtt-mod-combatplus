/**
 * GM Vision's keybinding: Ctrl+G by default, GM only.
 *
 * Ported from GM Vision 2.0.5 (scripts/keybindings.mjs), https://github.com/dev7355608/gm-vision
 * Copyright (c) 2023 dev7355608. MIT License; the full notice is in this module's LICENSE.
 */
import { isActive, setActive, state } from "./state.js";

export function registerKeybindings() {
  game.keybindings.register(state.moduleId, "gmVision", {
    name: "Toggle GM Vision",
    hint: "Brightens the scene, lifts the fog of war and shows every token, for the GM only.",
    editable: [
      { key: "KeyG", modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.CONTROL] }
    ],
    restricted: true,
    onDown: () => {
      if (!state.installed) return;
      void setActive(!isActive());
      return true;
    }
  });
}

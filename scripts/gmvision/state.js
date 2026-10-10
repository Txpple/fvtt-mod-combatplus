/**
 * GM Vision's on/off state: a hidden client setting, as upstream has it, so a macro can flip it.
 *
 * Ported from GM Vision 2.0.5 (scripts/settings.mjs), https://github.com/dev7355608/gm-vision
 * Copyright (c) 2023 dev7355608. MIT License; the full notice is in this module's LICENSE.
 */

/** The client setting holding the on/off state. */
export const ACTIVE_KEY = "gmVisionActive";

/** The token-controls toggle tool's name (hooks.js adds it; the setting keeps it in step). */
export const TOOL = "gmVision";

/**
 * @type {{ moduleId: string, installed: boolean, active: boolean }}
 * `installed` is true only on a GM client with a canvas, once the setup hook has patched the
 * token class; nothing below acts before that.
 */
export const state = { moduleId: "", installed: false, active: false };

export const isActive = () => game.settings.get(state.moduleId, ACTIVE_KEY);
export const setActive = value => game.settings.set(state.moduleId, ACTIVE_KEY, value);

export function registerState(moduleId) {
  state.moduleId = moduleId;
  game.settings.register(moduleId, ACTIVE_KEY, {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
    onChange: value => {
      if (!state.installed) return;
      state.active = value;
      canvas.perception.update({ refreshVision: true });
      const tool = ui.controls?.controls?.tokens?.tools?.[TOOL];
      if (tool) tool.active = value;
      ui.controls?.render();
    }
  });
}

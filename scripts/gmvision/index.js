/**
 * GM Vision: a GM-only mode that brightens the scene, reveals the fog of war and shows every
 * token, hatching the ones no controlled token could see.
 *
 * Ported from GM Vision 2.0.5, https://github.com/dev7355608/gm-vision
 * Copyright (c) 2023 dev7355608. MIT License; the full notice is in this module's LICENSE.
 *
 * What changed in the port: one world switch in Combat Plus installs or skips the whole thing
 * (read at init, so it takes a reload); the keys live under Combat Plus's id; a toggle tool on the
 * token controls joins the keybinding and the lighting button's right-click; and nothing is
 * installed while the gm-vision module itself is active, so the token class is never mixed twice.
 */
import {
  drawCanvasDarknessEffects, drawCanvasVisibility, getSceneControlButtons, renderSceneControls, sightRefresh
} from "./hooks.js";
import TokenMixin from "./token.js";
import VisualEffectsMaskingFilterMixin from "./visual-effects-masking-filter.js";
import { registerKeybindings } from "./keybindings.js";
import { isActive, registerState, state } from "./state.js";

/** The upstream module's id: when it is active, it does this job and the port stays out. */
const UPSTREAM_ID = "gm-vision";

/**
 * Register GM Vision under Combat Plus. Called from Combat Plus's init hook.
 * @param {object} options
 * @param {string} options.moduleId  Combat Plus's id, the namespace for the setting and keybinding
 * @param {string} options.title     the name console lines carry
 * @param {boolean} options.enabled  the world switch's value at init
 */
export function registerGMVision({ moduleId, title, enabled }) {
  // The on/off state is registered whatever the switch says, so a macro that flips it never throws.
  registerState(moduleId);
  if (!enabled) return;
  if (game.modules.get(UPSTREAM_ID)?.active) {
    console.info(`${title} | GM Vision: the gm-vision module is active and provides it, so Combat Plus's copy stays off.`);
    return;
  }

  registerKeybindings();

  Hooks.once("setup", () => {
    if (!game.user.isGM || game.settings.get("core", "noCanvas")) return;

    state.installed = true;
    state.active = isActive();

    CONFIG.Token.objectClass = TokenMixin(CONFIG.Token.objectClass);
    CONFIG.Canvas.visualEffectsMaskingFilter = VisualEffectsMaskingFilterMixin(CONFIG.Canvas.visualEffectsMaskingFilter);

    // Each hook by name, not looped over the exports, so a search for a hook name (and the family's
    // upstream watch) finds every one this code depends on.
    Hooks.on("drawCanvasVisibility", drawCanvasVisibility);
    Hooks.on("sightRefresh", sightRefresh);
    Hooks.on("drawCanvasDarknessEffects", drawCanvasDarknessEffects);
    Hooks.on("renderSceneControls", renderSceneControls);
    Hooks.on("getSceneControlButtons", getSceneControlButtons);
  });
}

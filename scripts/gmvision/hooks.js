/**
 * GM Vision's canvas and UI hooks. index.js registers each export as the hook of the same name,
 * on a GM client with a canvas only.
 *
 * Ported from GM Vision 2.0.5 (scripts/hooks.mjs), https://github.com/dev7355608/gm-vision
 * Copyright (c) 2023 dev7355608. MIT License; the full notice is in this module's LICENSE.
 * getSceneControlButtons is Combat Plus's addition.
 */
import { TOOL, setActive, state } from "./state.js";

/** @type {PIXI.LegacyGraphics|undefined} */
let revealFog;

/**
 * Fog reveal: a white rectangle over the whole scene in the visibility group, shown while active.
 * @param {foundry.canvas.groups.CanvasVisibility} group
 */
export function drawCanvasVisibility(group) {
  revealFog = group.addChild(
    new PIXI.LegacyGraphics()
      .beginFill(0xFFFFFF)
      .drawShape(canvas.dimensions.rect)
      .endFill());
  revealFog.visible = false;
}

/**
 * @param {foundry.canvas.groups.CanvasVisibility} group
 */
export function sightRefresh(group) {
  if (revealFog) revealFog.visible = state.active;
  canvas.effects.illumination.filter.uniforms.gmVision = state.active;
  canvas.effects.darkness.filter.alpha = state.active ? 0.5 : 1.0;
}

/**
 * Swap the darkness layer's void filter for an alpha filter, so the darkness can be halved.
 * @param {foundry.canvas.layers.CanvasDarknessEffects} layer
 */
export function drawCanvasDarknessEffects(layer) {
  const index = layer.filters?.indexOf(layer.filter);

  layer.filter = new PIXI.AlphaFilter();

  if (index >= 0) {
    layer.filters[index] = layer.filter;
  }
}

/**
 * The lighting control's bulb is solid while GM Vision is on, and a right-click on it toggles.
 * @param {foundry.applications.ui.SceneControls} application
 * @param {HTMLElement} element
 * @param {foundry.applications.types.ApplicationRenderContext} context
 * @param {foundry.applications.types.SceneControlsRenderOptions} options
 */
export function renderSceneControls(application, element, context, options) {
  if (!options.parts.includes("layers")) {
    return;
  }

  const lighting = element.querySelector(`[data-control="lighting"]`);

  if (!lighting) {
    return;
  }

  if (state.active) {
    lighting.classList.replace("fa-regular", "fa-solid");
  } else {
    lighting.classList.replace("fa-solid", "fa-regular");
  }

  lighting.addEventListener("contextmenu", event => {
    event.preventDefault();

    void setActive(!state.active);
  });
}

/**
 * A toggle tool on the token controls, where the GM spends a fight: the discoverable door to the
 * same switch as the keybinding and the right-click. Foundry 13 and 14 keep controls and tools as
 * records keyed by name.
 * @param {Record<string, foundry.applications.ui.SceneControl>} controls
 */
export function getSceneControlButtons(controls) {
  const tools = controls?.tokens?.tools;
  if (!tools) return;
  tools[TOOL] = {
    name: TOOL,
    title: "GM Vision",
    icon: "fa-solid fa-lightbulb",
    toggle: true,
    active: state.active,
    order: Math.max(0, ...Object.values(tools).map(t => t?.order ?? 0)) + 1,
    onChange: (event, active) => {
      if (active !== state.active) void setActive(active);
    }
  };
}

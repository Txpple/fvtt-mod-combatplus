/**
 * The Token mixin: while GM Vision is on, a token no controlled token can see is shown anyway, and
 * every token that would be invisible, or is hidden from players, carries the hatch overlay.
 *
 * Ported from GM Vision 2.0.5 (scripts/token.mjs), https://github.com/dev7355608/gm-vision
 * Copyright (c) 2023 dev7355608. MIT License; the full notice is in this module's LICENSE.
 */
import DetectionFilter from "./detection-filter.js";
import { state } from "./state.js";

/** @type {DetectionFilter|undefined} */
let detectionFilter;

/**
 * @type {(Token: typeof foundry.canvas.placeables.Token) => typeof foundry.canvas.placeables.Token}
 */
export default Token => class extends Token {
  /** @override */
  get isVisible() {
    const visible = super.isVisible;

    if (!visible || this.document.hidden) {
      this.detectionFilter = detectionFilter ??= DetectionFilter.create();
    }

    if (!visible && state.active && this._preview?.previewType !== "config"
      && canvas.effects.visionSources.some(s => s.active) && !this.isFilteredOut && !this._testCulled?.()) {
      return true;
    }

    return visible;
  }
};

import type { CliRenderer, KeyEvent } from "@opentui/core";

/** OpenTUI release this keyboard adapter is validated against. */
export const OPENTUI_KEYBOARD_API_VERSION = "0.4.3";

export type KeyboardHandler = (key: KeyEvent) => void | Promise<void>;

export interface KeyboardInput {
  onKeyPress(handler: KeyboardHandler): void;
  offKeyPress(handler: KeyboardHandler): void;
}

/** Subscribe to keypress events through OpenTUI's public keyInput API. */
export function createKeyboardInput(renderer: CliRenderer): KeyboardInput {
  const { keyInput } = renderer;

  return {
    onKeyPress(handler) {
      keyInput.on("keypress", handler);
    },
    offKeyPress(handler) {
      keyInput.off("keypress", handler);
    },
  };
}

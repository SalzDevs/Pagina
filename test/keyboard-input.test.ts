import { describe, expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";

import { handleHistoryKey } from "../navigation/history-keys";
import { createKeyboardInput, OPENTUI_KEYBOARD_API_VERSION } from "../viewport/keyboard";
import { createScrollViewport, handleScrollKey } from "../viewport/scroll";

describe("keyboard input adapter", () => {
  test("targets the pinned OpenTUI keyboard API version", () => {
    expect(OPENTUI_KEYBOARD_API_VERSION).toBe("0.4.3");
  });

  test("delivers keypress events through renderer.keyInput", async () => {
    const { renderer, mockInput, flush } = await createTestRenderer({
      width: 80,
      height: 24,
    });

    const keyboard = createKeyboardInput(renderer);
    const seen: string[] = [];
    const handler = (key: { name: string }) => {
      seen.push(key.name);
    };

    keyboard.onKeyPress(handler);
    mockInput.pressArrow("down");
    await flush();

    expect(seen).toContain("down");

    keyboard.offKeyPress(handler);
    mockInput.pressArrow("up");
    await flush();

    expect(seen).toEqual(["down"]);
  });

  test("routes scroll bindings through the public key input API", async () => {
    const { renderer, mockInput, flush } = await createTestRenderer({
      width: 80,
      height: 24,
    });

    let viewport = createScrollViewport(10, 25);
    const keyboard = createKeyboardInput(renderer);
    const handler = (key: Parameters<typeof handleScrollKey>[1]) => {
      const next = handleScrollKey(viewport, key);
      if (next) viewport = next;
    };

    keyboard.onKeyPress(handler);
    mockInput.pressArrow("down");
    await flush();

    expect(viewport.scrollY).toBe(1);
  });

  test("routes history bindings through the public key input API", async () => {
    const { renderer, mockInput, flush } = await createTestRenderer({
      width: 80,
      height: 24,
    });

    const keyboard = createKeyboardInput(renderer);
    const actions: Array<ReturnType<typeof handleHistoryKey>> = [];
    keyboard.onKeyPress((key) => {
      actions.push(handleHistoryKey(key));
    });

    mockInput.pressKey("u");
    await flush();
    mockInput.pressKey("u", { shift: true });
    await flush();

    expect(actions).toEqual(["back", "forward"]);
  });
});

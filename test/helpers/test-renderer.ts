import { CliRenderer } from "@opentui/core";
import { EventEmitter } from "node:events";

/** Headless OpenTUI renderer for integration tests without a live terminal. */
export function createTestRenderer(width = 80, height = 24): CliRenderer {
  const stdin = Object.assign(new EventEmitter(), {
    setRawMode() {},
    resume() {},
    pause() {},
    isTTY: true,
  });
  const stdout = Object.assign(new EventEmitter(), {
    columns: width,
    rows: height,
    isTTY: true,
    write() {
      return true;
    },
  });

  return new CliRenderer(stdin, stdout, width, height, {
    exitOnCtrlC: false,
    useMouse: true,
  });
}

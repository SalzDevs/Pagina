/** Copy text to the system clipboard when a platform helper is available. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (process.platform === "darwin") {
    return spawnCopy(["pbcopy"], text);
  }

  if (process.platform === "linux") {
    if (await spawnCopy(["wl-copy"], text)) return true;
    if (await spawnCopy(["xclip", "-selection", "clipboard"], text)) return true;
  }

  return writeOsc52(text);
}

async function spawnCopy(command: string[], text: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(command, {
      stdin: "pipe",
      stdout: "ignore",
      stderr: "ignore",
    });
    proc.stdin.write(text);
    proc.stdin.end();
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

function writeOsc52(text: string): boolean {
  try {
    const base64 = Buffer.from(text, "utf8").toString("base64");
    process.stdout.write(`\x1b]52;c;${base64}\x07`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Exposes a local port through Tailscale Funnel while running a package script.
 *
 * Usage: funneler --port <number> [--script <name>]
 * The port may instead come from PORT; the script defaults to "dev". Tailscale
 * can be selected with TAILSCALE_BIN. The port is passed to Tailscale, while the
 * package script is started with `pnpm run <name>`. TAILNET_HOSTNAME is built
 * from Tailscale's whoami JSON and inherited by the package script.
 *
 * Tailscale output is forwarded to the terminal and scanned for a .ts.net URL.
 * A URL captured before the package script starts is opened in the platform's
 * default browser after the script process starts. When either child exits, the
 * other is stopped; SIGINT and SIGTERM are forwarded to both children.
 */
import { execFileSync, spawn } from "node:child_process";
import { Command, InvalidArgumentError } from "commander";

const isValidPort = (port: number) => Number.isInteger(port) && port >= 1 && port <= 65535;
const parsePort = (value: string) => {
  const port = Number(value);
  if (!isValidPort(port)) {
    throw new InvalidArgumentError("port must be an integer between 1 and 65535");
  }
  return port;
};

const program = new Command()
  .option("--port <number>", "local port to expose", parsePort)
  .option("--script <name>", "package script to run", "dev");
program.parse();

const { port: optionPort, script } = program.opts<{ port?: number; script: string }>();
const port = optionPort ?? (process.env.APP_PORT === undefined ? undefined : Number(process.env.APP_PORT));
if (port === undefined || !isValidPort(port)) {
  program.error("provide a valid --port <number> or set APP_PORT (1-65535)");
}

const bin = process.env.TAILSCALE_BIN ?? "tailscale";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const whoamiOutput = execFileSync(bin, ["whoami", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"]
});

const whoami: unknown = JSON.parse(whoamiOutput);

if (
  !isRecord(whoami) ||
  !isRecord(whoami.Node) ||
  !isRecord(whoami.Node.Hostinfo) ||
  typeof whoami.Node.Hostinfo.Hostname !== "string" ||
  !isRecord(whoami.CurrentTailnet) ||
  typeof whoami.CurrentTailnet.MagicDNSSuffix !== "string"
) {
  throw new Error("tailscale whoami --json did not include Node.Hostinfo.Hostname and CurrentTailnet.MagicDNSSuffix");
}
process.env.TAILNET_HOSTNAME = `${whoami.Node.Hostinfo.Hostname}.${whoami.CurrentTailnet.MagicDNSSuffix}`;

const child = spawn(bin, ["funnel", String(port)], { stdio: ["inherit", "pipe", "pipe"] });

const opener =
  process.platform === "darwin" ? ["open"] :
  process.platform === "win32" ? ["cmd", "/c", "start", ""] : ["xdg-open"];

let opened = false;
let scriptStarted = false;
let pendingUrl: string | undefined;
const openBrowserUrl = (url: string) => {
  opened = true;
  // Give the package script a moment to initialize before opening the app.
  setTimeout(() => {
    console.log(`Opening ${url} in your browser...`);
    spawn(opener[0], [...opener.slice(1), url], { stdio: "ignore", detached: true }).unref();
  }, 1000);  
};
const onData = (chunk: { toString(encoding?: string): string }) => {
  const text = chunk.toString();
  process.stdout.write(text);
  const url = !opened && !pendingUrl && text.match(/https:\/\/[^\s/]+\.ts\.net\S*/)?.[0];
  if (url) {
    // Keep an early URL until the package script process has started.
    // if (scriptStarted) openBrowserUrl(url);
    pendingUrl = url;
  }
};
child.stdout.on("data", onData);
child.stderr.on("data", onData);

let scriptChild: ReturnType<typeof spawn> | undefined;
let stopped = false;
// Keep the funnel and package script alive as a pair.
const stop = (code: number, signal: NodeJS.Signals = "SIGTERM") => {
  if (stopped) return;
  stopped = true;
  process.exitCode = code;
  if (scriptChild && scriptChild.exitCode === null && scriptChild.signalCode === null) {
    scriptChild.kill(signal);
  }
  if (child.exitCode === null && child.signalCode === null) child.kill(signal);
};

child.once("spawn", () => {
  if (stopped) return;
  scriptChild = spawn("pnpm", ["run", script], { stdio: "inherit" });
  scriptChild.once("spawn", () => {
    scriptStarted = true;
    if (pendingUrl) openBrowserUrl(pendingUrl);
  });
  scriptChild.on("error", (e) => {
    console.error(`Failed to run package script "${script}" with pnpm: ${e.message}`);
    stop(1);
  });
  scriptChild.on("exit", (code) => {
    if (!stopped) stop(code ?? 1);
  });
});

child.on("error", (e) => {
  console.error(`Failed to run ${bin}: ${e.message}`);
  stop(1);
});
child.on("exit", (code) => {
  if (!stopped) stop(code ?? 1);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => stop(sig === "SIGINT" ? 130 : 143, sig));
}
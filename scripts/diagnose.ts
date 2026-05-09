import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { runDiagnostic } from "../lib/diagnostics/runDiagnostic";

interface CliOptions {
  scriptPath: string;
  audience?: string;
  channel?: string;
  traction?: string;
  pretty: boolean;
  progress: boolean;
  out?: string;
}

function parseCli(): CliOptions {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      audience: { type: "string" },
      channel: { type: "string" },
      traction: { type: "string" },
      pretty: { type: "boolean", default: false },
      progress: { type: "boolean", default: false },
      out: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    process.stderr.write(
      `Usage: npm run diagnose -- <script_path> [flags]

Runs the Phase 0 inference and the eleven dimension grading prompts on the
script at <script_path>. Emits the JSON diagnostic report to stdout (or to
--out <file> if provided).

Flags:
  --audience    Override the inferred audience (Phase 0 picks the first
                candidate by default).
  --channel     Override the inferred channel positioning.
  --traction    Recent traction pattern. Defaults to "Unknown" since the CLI
                has no UI yet.
  --pretty      Pretty-print the JSON.
  --progress    Stream phase 0 + per-dimension status to stderr as work
                completes.
  --out <file>  Write the JSON to <file> instead of stdout (lets you skip
                the npm-run banner that pollutes stdout).
`,
    );
    process.exit(values.help ? 0 : 2);
  }

  return {
    scriptPath: positionals[0],
    audience: values.audience as string | undefined,
    channel: values.channel as string | undefined,
    traction: values.traction as string | undefined,
    pretty: values.pretty === true,
    progress: values.progress === true,
    out: values.out as string | undefined,
  };
}

async function main(): Promise<void> {
  const opts = parseCli();
  let script: string;
  try {
    script = readFileSync(opts.scriptPath, "utf-8");
  } catch (err) {
    process.stderr.write(
      `Could not read ${opts.scriptPath}: ${(err as Error).message}\n`,
    );
    process.exit(1);
  }

  const log = (msg: string) => {
    if (opts.progress) process.stderr.write(msg + "\n");
  };

  log(`▸ running phase 0 inference...`);
  const report = await runDiagnostic({
    script,
    audience: opts.audience,
    channel: opts.channel,
    traction: opts.traction,
    onPhase0Complete: (ctx) => {
      log(`✓ phase 0 done`);
      log(`  audience: ${ctx.audience}`);
      log(`  channel:  ${ctx.channel}`);
      log(`  traction: ${ctx.traction}`);
      log(`▸ grading 11 dimensions in parallel...`);
    },
    onDimensionComplete: (grade) => {
      log(`  ✓ ${grade.dimension_name.padEnd(24)} ${grade.grade}`);
    },
  });

  log(``);
  log(`overall: ${report.overall_label}`);
  log(`routing: ${report.routing_recommendation}`);

  const json = opts.pretty
    ? JSON.stringify(report, null, 2) + "\n"
    : JSON.stringify(report) + "\n";

  if (opts.out) {
    writeFileSync(opts.out, json);
    log(`✓ wrote ${opts.out}`);
  } else {
    process.stdout.write(json);
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${(err as Error).message}\n`);
  if (process.env.DEBUG) {
    process.stderr.write(((err as Error).stack ?? "") + "\n");
  }
  process.exit(1);
});

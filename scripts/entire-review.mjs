import { execFileSync } from "node:child_process";

/** Decisions already made on the commits Entire checkpointed. */
const DECISIONS = {
  "01M4KNQHESBV27DJV6DWX2A9Q8": "Each project gets its own floor. Each session is reported as an operation. The prompt stays out.",
  "01M4KNR8EBQXGDD8W7Z8QJ3AJ7": "The checkpoint id is written on the commit, so the session can be opened later from that line.",
  "01M4RV6G5EWDV8875WCXRZEFXQ": "A floor keeps the four newest sessions. The demo stays in the browser and posts nothing.",
  "01M4RVJ3KDT91TGRVXDMNTN8DR": "Watching local sessions accepts the discover source, so the office typechecks when that source is chosen.",
  "01M4RXSFK8MB9T0CJPZM19NY4D": "The $1,960 base case does not pay a founder. The clone ships the Entire hooks, and links use the full commit SHA.",
};

function checkpoints() {
  const log = execFileSync("git", ["log", "-30", "--format=%H%x1f%s%x1f%b%x1e"], { encoding: "utf8" });
  const rows = [];
  for (const record of log.split("\x1e")) {
    const [sha, subject, body] = record.trim().split("\x1f");
    const match = /Entire-Checkpoint:\s*([0-9A-Z]{26})/.exec(body ?? "");
    if (!sha || !match) continue;
    rows.push({ sha, id: match[1], subject: subject ?? "" });
  }
  return rows;
}

function has(command) {
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const rows = checkpoints();
console.log("Progress");
for (const row of rows) {
  console.log(`\n${row.id}`);
  console.log(row.subject);
  console.log(DECISIONS[row.id] ?? "Checkpoint stored with the commit.");
  console.log(row.sha);
}

if (!process.argv.includes("--graph")) process.exit(0);

if (!has("entire")) {
  console.log("\nEntire CLI is not installed. The hooks no-op until it is.");
  process.exit(0);
}

const latest = rows[0];
console.log("\nGraph");
if (latest) {
  console.log(`\nCheckpoint ${latest.id}`);
  execFileSync("entire", ["graph", "checkpoint", latest.id], { stdio: "inherit" });
}
console.log("\nChanging jevTriageAgent");
execFileSync(
  "entire",
  ["graph", "impact", "--repo", ".", "--symbol", "jevTriageAgent", "--format", "text", "--exclude-tests", "--limit", "8"],
  { stdio: "inherit" },
);

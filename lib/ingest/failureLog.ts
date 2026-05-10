import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

export type FailureRecord = {
  module: string;
  payload: unknown;
  error: string;
};

export async function appendFailure(path: string, record: FailureRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n";
  await appendFile(path, line, "utf8");
}

import { initializeShell } from "./app-shell.js";
import { initializeRecords } from "./records.js";

await initializeShell(initializeRecords);

const { execFile } = require("node:child_process");
const { extractSkills } = require("../utils/skillCatalog");
let running = 0;
// No shell, external network, temporary PDF files, or raw resume text in logs/storage.
async function resumeSkills(content) {
  if (running >= 2) { const error = new Error("Resume extraction is busy. Please try again."); error.status = 503; throw error; }
  running++;
  try {
    const text = await new Promise((resolve, reject) => {
      const child = execFile("pdftotext", ["-f", "1", "-l", "20", "-enc", "UTF-8", "-q", "-", "-"],
        { timeout: 10000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
          if (error) {
            const safe = new Error(error.code === "ENOENT" ? "Resume extraction requires Poppler (pdftotext) on the backend server. You can still add skills manually." : "Unable to read this PDF. Try an unencrypted, text-based PDF or add skills manually.");
            safe.status = error.code === "ENOENT" ? 503 : 422; reject(safe);
          } else resolve(stdout);
        });
      child.stdin.on("error", () => {}); // An invalid PDF can close stdin before input is consumed.
      child.stdin.end(content);
    });
    return extractSkills(text);
  } finally { running--; }
}
module.exports = { resumeSkills };

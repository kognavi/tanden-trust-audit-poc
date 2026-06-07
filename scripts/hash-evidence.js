const { hashFile } = require("../lib/audit");

const filePath = process.argv[2] || "samples/evidence-consent.json";

try {
  const hash = hashFile(filePath);

  console.log("Evidence file:", filePath);
  console.log("SHA-256 hash:", hash);
} catch (error) {
  console.error("Failed to hash evidence file.");
  console.error(error.message);
  process.exit(1);
}

const { hashFileWithDetails } = require("../lib/audit");

const filePath = process.argv[2] || "samples/evidence-consent.json";

(async () => {
  try {
    const result = await hashFileWithDetails(filePath);

    console.log("Evidence file:", filePath);
    console.log("Canonicalization:", result.canonicalization);
    console.log("Canonical JSON:", result.canonicalJson);
    console.log("SHA-256 hash:", result.hash);
  } catch (error) {
    console.error("Failed to hash evidence file.");
    console.error(error.message);
    process.exit(1);
  }
})();

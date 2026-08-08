const { hashFileWithDetails } = require("../lib/audit");

const filePath = process.argv[2] || "samples/evidence-consent.json";

(async () => {
  try {
    const result = await hashFileWithDetails(filePath);

    console.log("Evidence file:", filePath);
    console.log("Canonicalization:", result.canonicalization);
    console.log("SHA-256 hash:", result.hash);

    // SHOW_RAW_CANONICAL=1 が設定された場合のみ canonicalJson を出力する。
    // canonicalJson は元データの完全なコピーであり、デフォルト表示すると
    // ターミナル履歴・ログに機密データが残るリスクがある（H5 データ最小化）。
    if (process.env.SHOW_RAW_CANONICAL === "1") {
      console.warn(
        "[WARNING] SHOW_RAW_CANONICAL=1: Displaying raw canonical JSON. " +
        "This output may contain sensitive data. Do not use in production pipelines."
      );
      // hashJson() から canonicalJson は削除済みのため、
      // 必要な場合は canonicalizeJson() を直接呼び出す。
      const { canonicalizeJson } = require("../lib/audit");
      const parsedJson = JSON.parse(require("fs").readFileSync(filePath, "utf8"));
      const canonicalJson = await canonicalizeJson(parsedJson);
      console.log("Canonical JSON:", canonicalJson);
    }
  } catch (error) {
    console.error("Failed to hash evidence file.");
    console.error(error.message);
    process.exit(1);
  }
})();

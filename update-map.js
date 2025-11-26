// update-map.js

const fs = require("fs");
const https = require("https");

console.log("============================================");
console.log("      🔄 MAP FILE UPDATE SCRIPT STARTED");
console.log("============================================\n");

// -----------------------------------------------------------
// 1️⃣ FILE PATHS
// -----------------------------------------------------------
const DEST = "src/app/map";
const GITHUB =
  "https://raw.githubusercontent.com/Ajay-kumar-abacus/angular-location-setup/main/setup-files/map";

const updateFiles = {
  "map.component.html": `${DEST}/map.component.html`,
  "map.component.scss": `${DEST}/map.component.scss`,
  "map.component.ts": `${DEST}/map.component.ts`,
  "map.module.ts": `${DEST}/map.module.ts`,
};

// -----------------------------------------------------------
// Helper: Download and overwrite file
// -----------------------------------------------------------
function download(url, dest) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.log("❌ Failed:", url);
        resolve(false);
        return;
      }

      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        fs.writeFileSync(dest, data, "utf8");
        console.log("✔ Updated:", dest);
        resolve(true);
      });

    }).on("error", (err) => {
      console.log("❌ Error downloading:", err.message);
      resolve(false);
    });
  });
}

// -----------------------------------------------------------
// 2️⃣ START MAP FILE UPDATE
// -----------------------------------------------------------
(async () => {
  console.log("➡ Updating map files from GitHub...\n");

  for (const [src, dest] of Object.entries(updateFiles)) {
    await download(`${GITHUB}/${src}`, dest);
  }

  console.log("\n============================================");
  console.log("      🎉 MAP UPDATE COMPLETE — GENUINE AJAY");
  console.log("============================================\n");

})();

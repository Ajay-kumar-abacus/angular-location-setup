// create-map-tracking-setup.js

const fs = require("fs");
const https = require("https");
const { execSync } = require("child_process");

console.log("============================================");
console.log("       🚀 MAP TRACKING AUTOMATION STARTING");
console.log("============================================\n");

// -----------------------------------------------------------
// 1️⃣ CREATE MAP-TRACKING MODULE
// -----------------------------------------------------------
console.log("\n➡ Creating map-tracking module...");
execSync(
  "ng g module map-tracking --module app.module --route map-tracking",
  { stdio: "inherit" }
);

// -----------------------------------------------------------
// 2️⃣ CREATE MAP-TRACKING COMPONENT
// -----------------------------------------------------------
console.log("\n➡ Creating map-tracking component...");
execSync(
  "ng g c map-tracking/map-tracking --skip-import --skip-tests=true",
  { stdio: "inherit" }
);

// -----------------------------------------------------------
// 3️⃣ COPY (MAP HTML / SCSS / TS / MODULE) FROM GITHUB
// -----------------------------------------------------------
console.log("\n➡ Copying Map Component Files...");

const GITHUB =
  "https://raw.githubusercontent.com/Ajay-kumar-abacus/angular-location-setup/main/setup-files/map";

const fileMapping = [
  { src: "map.component.html", dest: "src/app/map-tracking/map-tracking/map-tracking.component.html" },
  { src: "map.component.scss", dest: "src/app/map-tracking/map-tracking/map-tracking.component.scss" },
  { src: "map.component.ts", dest: "src/app/map-tracking/map-tracking/map-tracking.component.ts" },
  { src: "map.module.ts", dest: "src/app/map-tracking/map-tracking.module.ts" }
];

function download(url, dest) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.log("❌ Failed:", url);
        resolve(false);
        return;
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
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

(async () => {
  for (let f of fileMapping) {
    await download(`${GITHUB}/${f.src}`, f.dest);
  }

  // -----------------------------------------------------------
  // 4️⃣ UPDATE NAVIGATION MENU
  // -----------------------------------------------------------
  console.log("\n➡ Updating navigation menu...");

  const navPath = "src/app/navigation/navigation.component.html";
  let navHtml = fs.readFileSync(navPath, "utf8");

  const menu = `
<li>
  <a mat-button routerLink="/map-tracking" routerLinkActive="active">
    <i class="material-icons">domain</i> Map Tracking
  </a>
</li>
`;

  if (!navHtml.includes('routerLink="/map-tracking"')) {
    navHtml = navHtml.replace(/<\/li>(\s*)/, `</li>\n${menu}\n`);
    fs.writeFileSync(navPath, navHtml);
    console.log("✔ MAP TRACKING added under Attendance");
  } else {
    console.log("✔ Menu already present");
  }

  // -----------------------------------------------------------
  // 5️⃣ ADD ROUTE
  // -----------------------------------------------------------
  console.log("\n➡ Updating app-routing.module.ts...");

  const routePath = "src/app/app-routing.module.ts";
  let routeData = fs.readFileSync(routePath, "utf8");

  if (!routeData.includes("map-tracking")) {
    routeData = routeData.replace(
      "const routes: Routes = [",
      `const routes: Routes = [
    { path: "map-tracking", loadChildren: './map-tracking/map-tracking.module#MapTrackingModule' },`
    );
    fs.writeFileSync(routePath, routeData);
    console.log("✔ Route added");
  } else {
    console.log("✔ Route already exists");
  }

  console.log("\n============================================");
  console.log("    🎉 MAP-TRACKING SETUP COMPLETE!");
  console.log("============================================\n");

})();

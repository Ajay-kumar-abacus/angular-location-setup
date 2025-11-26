// create-map-setup.js

const fs = require("fs");
const https = require("https");
const { execSync } = require("child_process");

console.log("============================================");
console.log("       🚀 MAP SETUP AUTOMATION STARTING");
console.log("============================================\n");

// -----------------------------------------------------------
// 1️⃣ CREATE MAP MODULE
// -----------------------------------------------------------
console.log("\n➡ Creating map module...");
execSync(
  "ng g module map --module app.module --route map",
  { stdio: "inherit" }
);

// -----------------------------------------------------------
// 2️⃣ CREATE MAP COMPONENT (inside src/app/map ONLY)
// -----------------------------------------------------------
console.log("\n➡ Creating map component...");
execSync(
  "ng g c map --skip-import --skip-tests=true",
  { stdio: "inherit" }
);

// -----------------------------------------------------------
// 3️⃣ COPY FILES FROM GITHUB (HTML / SCSS / TS / MODULE)
// -----------------------------------------------------------
console.log("\n➡ Copying MAP FILES...");

const DEST = "src/app/map";
const GITHUB =
  "https://raw.githubusercontent.com/Ajay-kumar-abacus/angular-location-setup/main/setup-files/map";

const filesToCopy = {
  "map.component.html": `${DEST}/map.component.html`,
  "map.component.scss": `${DEST}/map.component.scss`,
  "map.component.ts": `${DEST}/map.component.ts`,
  "map.module.ts": `${DEST}/map.module.ts`,
};

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
    });
  });
}

(async () => {

  for (const [src, dest] of Object.entries(filesToCopy)) {
    await download(`${GITHUB}/${src}`, dest);
  }

  // -----------------------------------------------------------
  // 4️⃣ UPDATE NAVIGATION MENU
  // -----------------------------------------------------------
  console.log("\n➡ Updating navigation menu...");

  const navPath = "src/app/navigation/navigation.component.html";
  let navHtml = fs.readFileSync(navPath, "utf8");

  const menu = `
<li>
  <a mat-button routerLink="/map" routerLinkActive="active">
    <i class="material-icons">domain</i> Map
  </a>
</li>
`;

  if (!navHtml.includes('routerLink="/map"')) {
    navHtml = navHtml.replace(/<\/li>(\s*)/, `</li>\n${menu}\n`);
    fs.writeFileSync(navPath, navHtml);
    console.log("✔ Map menu added");
  }

  // -----------------------------------------------------------
  // 5️⃣ ADD ROUTE IF NOT PRESENT
  // -----------------------------------------------------------
  console.log("\n➡ Updating app-routing.module.ts...");

  const routePath = "src/app/app-routing.module.ts";
  let routeData = fs.readFileSync(routePath, "utf8");

  if (!routeData.includes("map")) {
    routeData = routeData.replace(
      "const routes: Routes = [",
      `const routes: Routes = [
    { path: "map", loadChildren: './map/map.module#MapModule' },`
    );
    fs.writeFileSync(routePath, routeData);
    console.log("✔ Route added");
  }

  // -----------------------------------------------------------
// 🔄  Replace tracking links inside attendance.component.html
// -----------------------------------------------------------
console.log("\n➡ Updating attendance.component.html...");

const attendancePath = "src/app/attendance/attendance.component.html";

if (fs.existsSync(attendancePath)) {
    let attendanceHtml = fs.readFileSync(attendancePath, "utf8");

    // Replace ANY /tracking... with /map
    const updatedHtml = attendanceHtml
        .replace(/routerLink="\/tracking[^"]*"/g, 'routerLink="/map"')
        .replace(/routerLink='\/tracking[^']*'/g, "routerLink='/map'")
        .replace(/['"]\/tracking[^'"]*['"]/g, '"\/map"')
        .replace(/tracking\//g, "map/")
        .replace(/tracker\//g, "map/");

    fs.writeFileSync(attendancePath, updatedHtml, "utf8");

    console.log("✔ Replaced tracking links with /map in attendance.component.html");
} else {
    console.log("⚠ attendance.component.html not found");
}


  console.log("\n============================================");
  console.log("    🎉 MAP SETUP COMPLETE!");
  console.log("============================================\n");

})();

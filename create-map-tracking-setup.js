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
// 8️⃣ REPLACE 'tracker/' WITH 'map-tracking/' IN attendance.component.html
// -----------------------------------------------------------
console.log("\n➡ Updating attendance.component.html...");

const attendanceFile = "src/app/attendence/attendence.component.html";

if (fs.existsSync(attendanceFile)) {
  let attendanceContent = fs.readFileSync(attendanceFile, "utf8");
  const updatedAttendance = attendanceContent.replace(/tracker\//g, "/map");
  fs.writeFileSync(attendanceFile, updatedAttendance);
  console.log("✔ tracker/ replaced with map-tracking/");
} else {
  console.log("⚠ attendance.component.html not found");
}


// -----------------------------------------------------------
// 9️⃣ ADD FULLSCREEN CSS TO styles.scss
// -----------------------------------------------------------
console.log("\n➡ Adding fullscreen-map CSS to styles.scss...");

const stylesPath = "src/styles.scss";
let currentStyles = fs.readFileSync(stylesPath, "utf8");

const fullScreenCSS = `
body.fullscreen-map {
    .main-container {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        padding: 15px !important;
        z-index: 10000 !important;
        height: 100% !important;
        width: 100vw !important;
    }
}
`;

if (!currentStyles.includes("body.fullscreen-map")) {
  fs.writeFileSync(stylesPath, fullScreenCSS + "\n" + currentStyles);
  console.log("✔ Fullscreen CSS added to styles.scss");
} else {
  console.log("✔ Fullscreen CSS already exists");
}

   console.log("\n➡ Downloading locationIcon folder...");

  const ICON_DEST = "src/assets/locationIcon";

// CREATE DIRECTORY
  if (!fs.existsSync(ICON_DEST)) {
    fs.mkdirSync(ICON_DEST, { recursive: true });
  }

  const ICON_BASE =
    "https://raw.githubusercontent.com/Ajay-kumar-abacus/angular-location-setup/main/locationIcon";

  const iconFiles = [
    "finder.gif",
    "home-address.png",
    "location.png",
    "map-pin.png",
    "noData.ico",
    "person.png",
    "person1.png"
  ];

  for (const icon of iconFiles) {
    await new Promise((resolve) => {
      https.get(`${ICON_BASE}/${icon}`, (res) => {
        if (res.statusCode !== 200) {
          console.log("❌ Failed:", icon);
          resolve();
          return;
        }

        const filePath = `${ICON_DEST}/${icon}`;
        const fileStream = fs.createWriteStream(filePath);

        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          console.log("✔ Downloaded:", filePath);
          resolve();
        });
      });
    });
  }

 

console.log("===============================================");
  console.log(" 🎉 ANGULAR MAP-TRACKING SETUP COMPLETE 🎉");
  console.log(" 🚀 Developed by GENUINE AJAY 🚀");
  console.log("===============================================");
 

})();

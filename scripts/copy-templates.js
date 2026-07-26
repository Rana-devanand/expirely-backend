const fs = require("node:fs");
const path = require("node:path");

const source = path.join(__dirname, "..", "app", "templates");
const destination = path.join(__dirname, "..", "dist", "app", "templates");

if (fs.existsSync(source)) {
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

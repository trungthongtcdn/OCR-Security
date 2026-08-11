import { loadConfig } from "../src/config.js";
import { ensureCompanyConfig, openDatabase } from "../src/db/database.js";

const config = loadConfig();
const db = openDatabase(config.db.file);
ensureCompanyConfig(db, 1000);
console.log(`Da khoi tao database tai ${config.db.file}`);
console.log("Cau hinh nghiep vu (Gemini, Google Sheets, han muc, NVKD) duoc thiet lap qua trang Admin.");
db.close();

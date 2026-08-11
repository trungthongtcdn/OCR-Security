import { loadConfig } from "../src/config.js";
import { ensureCompanyConfig, openDatabase } from "../src/db/database.js";

const config = loadConfig();
const db = openDatabase(config.db.file);
ensureCompanyConfig(db, config.quota.companyMonthlyQuota);
console.log(`Da khoi tao database tai ${config.db.file}`);
console.log(`Han muc cong ty mac dinh: ${config.quota.companyMonthlyQuota} luot/thang`);
db.close();

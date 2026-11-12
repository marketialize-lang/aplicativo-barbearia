import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
if (!databaseId || !/^[0-9a-f-]{36}$/i.test(databaseId)) {
  throw new Error("Defina CLOUDFLARE_D1_DATABASE_ID com o ID do D1 barbearia-mvp antes de publicar.");
}

const configPath = resolve(".output/server/wrangler.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
config.d1_databases = [{ binding: "DB", database_name: "barbearia-mvp", database_id: databaseId }];
config.workers_dev = true;
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log("Binding DB aplicado ao Worker de publicação.");

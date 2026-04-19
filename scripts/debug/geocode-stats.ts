import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://bddlrsqatgqoznyegpeq.supabase.co";
const envPath = path.join(__dirname, "..", "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const serviceRoleKey = envContent
  .split("\n")
  .find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="))
  ?.split("=")[1]
  ?.trim();

if (!serviceRoleKey) process.exit(1);
const supabase = createClient(SUPABASE_URL, serviceRoleKey);

async function main() {
  const { count: total } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });
  const { count: geocoded } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .not("latitude", "is", null);
  console.log(`total=${total} geocoded=${geocoded} missing=${(total ?? 0) - (geocoded ?? 0)}`);

  const { data: sample } = await supabase
    .from("companies")
    .select("id, name, address, postal_code, city, country_code")
    .is("latitude", null)
    .limit(10);
  console.log("SAMPLE MISSING (first 10):");
  for (const s of sample ?? []) {
    console.log(JSON.stringify(s));
  }

  const { count: noAddr } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .is("latitude", null)
    .is("address", null);
  const { count: noAll } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .is("latitude", null)
    .is("address", null)
    .is("postal_code", null)
    .is("city", null);
  console.log(`missing-with-no-address=${noAddr} missing-with-no-address-and-no-postal-and-no-city=${noAll}`);
}

main();

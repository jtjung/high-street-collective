import { auth } from "@clerk/nextjs/server";

const BYPASS_USER_ID = "dev-bypass";

export async function getAuth() {
  if (process.env.AUTH_BYPASS === "true") {
    return { userId: BYPASS_USER_ID };
  }
  return auth();
}

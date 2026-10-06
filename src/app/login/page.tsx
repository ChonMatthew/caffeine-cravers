import { getShops } from "@/lib/dal";

import { LoginForm } from "./login-form";

// The PIN screen, with the shop picker above the keypad. A Server Component so
// the shop list comes straight from the `shops` table (no session needed yet).
export default async function LoginPage() {
  const shops = await getShops();
  return <LoginForm shops={shops.map((s) => ({ id: s.id, name: s.name }))} />;
}

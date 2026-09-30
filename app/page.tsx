import { VelaPlatform } from "@/components/vela-platform";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Database is not configured; rendering the signed-out experience.", error);
    }
  }
  return <VelaPlatform initialUser={user} />;
}

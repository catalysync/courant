import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const GET = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return redirect("/sign-in");
  }

  return redirect(`/users/${session.user.id}`);
};
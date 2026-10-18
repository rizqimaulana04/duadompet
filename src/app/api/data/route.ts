import { currentUser } from "@/lib/auth";
import { mutate, snapshot } from "@/lib/service";
import { sameOrigin } from "@/lib/security";
import { json } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return json(await snapshot((await currentUser()).id));
  } catch {
    return json({ error: "Silakan masuk kembali" }, 401);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await currentUser();
    const { action, ...data } = await req.json();
    return json(await mutate(user.id, action, data));
  } catch (e) {
    console.error("Mutation failed:", e instanceof Error ? e.name : "unknown");
    return json(
      {
        error:
          e instanceof Error && !e.message.includes("prisma")
            ? e.message
            : "Permintaan gagal. Periksa data atau coba kembali.",
      },
      400,
    );
  }
}

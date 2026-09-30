import { Sparkles } from "lucide-react";

export default function Loading() {
  return <main className="grid min-h-screen place-items-center bg-background text-foreground"><div className="text-center"><div className="mx-auto grid size-12 animate-pulse place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles /></div><p className="mt-4 text-sm font-semibold">Preparing your learning workspace…</p><p className="mt-1 text-xs text-muted-foreground">Applying your programme, role, and timezone</p></div></main>;
}

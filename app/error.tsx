"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CircleAlert } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Vela application error", error);
  }, [error]);
  return <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground"><section className="w-full max-w-lg rounded-[24px] border bg-card p-8 text-center shadow-sm"><div className="mx-auto grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive"><CircleAlert /></div><div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-primary"><BrandMark size={24} /> Vela AI Academy</div><h1 className="mt-4 text-2xl font-bold tracking-tight">We couldn’t load this workspace</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your data is safe. Try the request again; if the issue continues, contact academy support with reference {error.digest ?? "unavailable"}.</p><Button className="mt-6" onClick={reset}>Try again</Button></section></main>;
}

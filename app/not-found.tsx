import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground"><section className="text-center"><BrandMark size={40} className="mx-auto" /><p className="mt-6 text-sm font-bold uppercase tracking-[.14em] text-primary">404</p><h1 className="mt-2 text-3xl font-bold tracking-tight">This learning page is unavailable</h1><p className="mt-3 text-muted-foreground">Return to your workspace or contact support if you expected access.</p><Button asChild className="mt-6"><Link href="/">Return to Vela Academy</Link></Button></section></main>;
}

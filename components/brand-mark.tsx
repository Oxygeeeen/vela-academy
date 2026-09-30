import Image from "next/image";

export function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/favicon.svg"
      alt="Vela Academy"
      width={size}
      height={size}
      priority
      className={className}
    />
  );
}

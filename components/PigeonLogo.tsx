import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number | string; title?: string };

export function PigeonLogo({ size = 32, title = "Pigeon", ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      {...props}
    >
      <title>{title}</title>
      <polygon points="8,20 29,27 18,8 46,25 36,29" fill="#17324a" />
      <polygon points="18,8 34,27 28,16" fill="#49667b" />
      <polygon points="8,20 28,38 29,27" fill="#23445f" />
      <polygon points="28,38 36,29 45,49 24,55" fill="#102f49" />
      <polygon points="36,29 45,49 50,27" fill="#31546d" />
      <polygon points="50,27 55,20 61,27 55,31" fill="#17324a" />
      <polygon points="45,49 24,55 33,44" fill="#49667b" />
      <polygon points="28,38 18,49 31,46" fill="#23445f" />
      <circle cx="55.5" cy="24.8" r="1.15" fill="#f4f1e8" />
    </svg>
  );
}

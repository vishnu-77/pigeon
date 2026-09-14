import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function Icon({ size = 24, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function ArrowRight(props: IconProps) {
  return <Icon {...props}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Icon>;
}

export function Check(props: IconProps) {
  return <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>;
}

export function Copy(props: IconProps) {
  return <Icon {...props}><rect x="9" y="9" width="11" height="11" rx="1" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></Icon>;
}

export function FlaskConical(props: IconProps) {
  return <Icon {...props}><path d="M10 2v6.5L4.8 17a3 3 0 0 0 2.6 4.5h9.2a3 3 0 0 0 2.6-4.5L14 8.5V2" /><path d="M8 2h8" /><path d="M7 16h10" /></Icon>;
}

export function Github(props: IconProps) {
  return <Icon {...props}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.4 4 5 5 0 0 0 19.2.5S18.1.1 15 2a13.4 13.4 0 0 0-7 0C4.9.1 3.8.5 3.8.5A5 5 0 0 0 3.6 4a5.4 5.4 0 0 0-1.4 3.7c0 5.4 3.5 6.6 6.8 7A4.8 4.8 0 0 0 8 18v4" /><path d="M8 19c-3 .9-3-1.5-4-2" /></Icon>;
}

export function Terminal(props: IconProps) {
  return <Icon {...props}><path d="m4 17 6-6-6-6" /><path d="M12 19h8" /></Icon>;
}

export function X(props: IconProps) {
  return <Icon {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>;
}

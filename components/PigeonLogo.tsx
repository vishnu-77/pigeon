import type { ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height"> & {
  size?: number | string;
  title?: string;
};

const MARK_WIDTH = 535;
const MARK_HEIGHT = 413;

export function PigeonLogo({ size = 32, title = "Pigeon", style, ...props }: Props) {
  const width = typeof size === "number" ? (size * MARK_WIDTH) / MARK_HEIGHT : size;
  const height = typeof size === "number" ? size : "auto";

  return (
    <img
      src="/brand/pigeon-mark.svg"
      alt={title}
      draggable={false}
      style={{
        width,
        height,
        objectFit: "contain",
        flexShrink: 0,
        ...style
      }}
      {...props}
    />
  );
}

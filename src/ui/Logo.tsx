import * as stylex from "@stylexjs/stylex";

export const logo = stylex.create({
  mark: {
    display: "block",
    flexShrink: 0,
  },
});

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      {...stylex.props(logo.mark)}
    >
      <path
        d="M7 8.2c0-1.4 1-2.2 2.3-2.2H20c7.4 0 13.2 5.6 13.2 13 0 1.4-.2 2.7-.6 3.9-.9-6.4-6.4-11.3-13-11.3H9.3c-.4 0-.8.1-1.1.3V8.2Z"
        fill="#111111"
      />
      <path
        d="M7 8.2v23.6c0 1.4 1 2.2 2.3 2.2H20c7.4 0 13.2-5.6 13.2-13S27.4 8 20 8H9.3C8 8 7 8.8 7 10.2Z"
        fill="#111111"
      />
      <circle cx="25.2" cy="20" r="9.1" fill="#C6FF00" />
    </svg>
  );
}

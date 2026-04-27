import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: "#059669",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "7px",
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 20,
          fontWeight: 800,
          fontFamily: "sans-serif",
          letterSpacing: "-1px",
          display: "flex",
        }}
      >
        S
      </div>
    </div>,
    { ...size }
  );
}

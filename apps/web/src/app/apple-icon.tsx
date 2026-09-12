import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #01131a 0%, #0a6258 100%)",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            marginLeft: 10,
            width: 0,
            height: 0,
            borderTop: "34px solid transparent",
            borderBottom: "34px solid transparent",
            borderLeft: "52px solid #26bfb0",
          }}
        />
      </div>
    ),
    { ...size },
  );
}

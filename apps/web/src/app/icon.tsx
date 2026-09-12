import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 112,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 280,
            height: 280,
            borderRadius: 999,
            background: "rgb(38 191 176 / 0.18)",
            border: "6px solid #26bfb0",
          }}
        >
          <div
            style={{
              marginLeft: 24,
              width: 0,
              height: 0,
              borderTop: "72px solid transparent",
              borderBottom: "72px solid transparent",
              borderLeft: "112px solid #26bfb0",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}

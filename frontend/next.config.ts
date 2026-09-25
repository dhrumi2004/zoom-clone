import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-only "N" badge sits in the bottom-left corner, on top of the meeting's Mute button.
  // Compile/runtime errors are still shown.
  devIndicators: false,
};

export default nextConfig;

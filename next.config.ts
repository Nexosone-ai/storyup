import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow user image uploads through server actions (images are resized
      // client-side first, but keep headroom).
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

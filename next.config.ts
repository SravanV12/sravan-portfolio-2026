import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next generates editor instruction files on dev start and rewrites them on
  // every restart. This project's are maintained by hand, so leave them alone.
  agentRules: false,
};

export default nextConfig;

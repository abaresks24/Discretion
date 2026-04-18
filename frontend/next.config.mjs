/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // react-globe.gl / three are ESM-heavy — transpile them for Next's server bundler.
  transpilePackages: ["react-globe.gl", "three"],
  webpack: (config) => {
    // wagmi v2 relies on `pino` which optionally imports `pino-pretty` — stub it.
    config.externals.push("pino-pretty");
    return config;
  },
};

export default nextConfig;

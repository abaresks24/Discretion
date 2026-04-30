/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@iexec-nox/handle"],
  webpack: (config, { isServer }) => {
    // wagmi v2 relies on `pino` which optionally imports `pino-pretty` — stub it.
    config.externals.push("pino-pretty");

    // @metamask/sdk referenes @react-native-async-storage (RN-only, optional).
    // Tell webpack to resolve it to `false` so the bundle ignores it cleanly.
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      "@react-native-async-storage/async-storage": false,
    };

    // Silence the "critical dependency: the request of a dependency is an
    // expression" warning emitted by @iexec-nox/handle's dynamic requires.
    if (!isServer) {
      config.module.exprContextCritical = false;
    }

    return config;
  },
};

export default nextConfig;

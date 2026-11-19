/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.plugins.push({
      apply(compiler) {
        compiler.hooks.normalModuleFactory.tap("CrossDriveFixPlugin", (nmf) => {
          nmf.hooks.beforeResolve.tap("CrossDriveFixPlugin", (resolveData) => {
            if (resolveData && typeof resolveData.request === "string") {
              if (
                resolveData.request.startsWith("./C:") ||
                resolveData.request.startsWith(".\\C:") ||
                resolveData.request.startsWith("./c:") ||
                resolveData.request.startsWith(".\\c:")
              ) {
                resolveData.request = resolveData.request.replace(/^\.[\/\\]/, "");
              }
            }
          });
        });
      },
    });
    return config;
  },
};

module.exports = nextConfig;

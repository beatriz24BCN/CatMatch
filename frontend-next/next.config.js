/** @type {import('next').NextConfig} */
module.exports = {
  // Keep trailing slashes so FastAPI routes such as /api/persons/ do not loop on redirects
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://localhost:8001';
    return [
      // Next drops the trailing slash on :path*, so match it explicitly first
      { source: '/api/:path*/', destination: `${backend}/api/:path*/` },
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
    ];
  },
};

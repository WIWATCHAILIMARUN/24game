{
  "version": 2,
  "buildCommand": "cd Frontend/vite-project && npm install && npm run build",
  "outputDirectory": "Frontend/vite-project/dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
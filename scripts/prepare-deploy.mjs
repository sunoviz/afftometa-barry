import { copyFileSync } from 'node:fs'

// Ship the approved dashboard inside the server function so login is required
// before serving HTML, including requests to /index.html.
copyFileSync('dist/index.html', 'server/dashboard.html')

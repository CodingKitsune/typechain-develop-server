#!/usr/bin/env node

const { writeFileSync, readFileSync } = require('fs');
const paths = process.argv.filter((_, index) => index >= 2);
for (const path of paths) {
  const data = `#!/usr/bin/env node\n\n${readFileSync(path)}\n`;
  writeFileSync(path, data);
}

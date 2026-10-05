import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const banner =
  "import { createRequire } from 'module';const require = createRequire(import.meta.url);";

const alias = {
  "@db/schema": path.join(root, "db/schema.ts"),
  "@db/relations": path.join(root, "db/relations.ts"),
  "@contracts/constants": path.join(root, "contracts/constants.ts"),
  "@contracts/errors": path.join(root, "contracts/errors.ts"),
};

const shared = {
  platform: "node",
  bundle: true,
  format: "esm",
  banner: { js: banner },
  alias,
  logLevel: "info",
};

await esbuild.build({
  ...shared,
  entryPoints: [path.join(root, "server/boot.ts")],
  outfile: path.join(root, "dist/boot.js"),
});

await esbuild.build({
  ...shared,
  entryPoints: [path.join(root, "server/app.ts")],
  outfile: path.join(root, "dist/server.js"),
});

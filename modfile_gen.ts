import fs from "fs";
import loader from "./loader";
async function main() {
  const modfile = await fs.promises.readFile("sixprofiler.sb3");
  const modload = new loader();
  const modjson = await modload.load(modfile);
  fs.promises.writeFile(
    "modfile.ts",
    'import type { Sb3JSON } from "./sb3processor";\n' +
      "const modfile: Sb3JSON = " +
      JSON.stringify(modjson) +
      "\n" +
      "export default modfile;"
  );
}
main();

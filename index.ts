import fs from "fs";
// import util from "util";
import loader from "./loader";
import getstat from "./getstat";
import patch from "./patch";
// import * as sb3processor from "./sb3processor";

async function main() {
  const argv2 = process.argv[2];
  const argv3 = process.argv[3];
  if (argv2 === undefined) {
    throw new Error();
  }
  if (argv3 === undefined) {
    throw new Error();
  }
  const sb3file = await fs.promises.readFile(argv2);
  const sb3load = new loader();
  const sb3json = await sb3load.load(sb3file);
  // await fs.promises.writeFile(
  //   "project_old.ts",
  //   'import * as sb3processor from "./sb3processor";\n\n' +
  //     "const sb3json: sb3processor.Sb3JSON = " +
  //     util.inspect(sb3json, {
  //       depth: null,
  //       maxArrayLength: null,
  //       maxStringLength: null,
  //     }) +
  //     ";\n\nconsole.log(sb3json);"
  // );
  if (argv3 === "-d") {
    getstat(sb3json);
    return;
  }
  const modfile = await fs.promises.readFile("sixprofiler.sb3");
  const modload = new loader();
  const modjson = await modload.load(modfile);
  // await fs.promises.writeFile(
  //   "project_mod.ts",
  //   'import * as sb3processor from "./sb3processor";\n\n' +
  //     "const sb3json: sb3processor.Sb3JSON = " +
  //     util.inspect(modjson, {
  //       depth: null,
  //       maxArrayLength: null,
  //       maxStringLength: null,
  //     }) +
  //     ";\n\nconsole.log(sb3json);"
  // );
  if (process.argv[4] === "-r") {
    // 移除补丁
    await patch(sb3json, modjson, true);
  } else {
    await patch(sb3json, modjson, false);
  }
  const sb3file_new = await sb3load.save(sb3json);
  // await fs.promises.writeFile(
  //   "project_new.ts",
  //   'import * as sb3processor from "./sb3processor;"\n\n' +
  //     "const sb3json: sb3processor.Sb3JSON = " +
  //     util.inspect(sb3json, {
  //       depth: null,
  //       maxArrayLength: null,
  //       maxStringLength: null,
  //     }) +
  //     ";\n\nconsole.log(sb3json);"
  // );
  await fs.promises.writeFile(argv3, new Uint8Array(sb3file_new));
}

main();

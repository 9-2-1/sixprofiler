import fs from "fs";
async function main() {
  let index = (await fs.promises.readFile("dist/index.html")).toString();
  const workerre = /new Worker\("([^"]*)"\)/g;
  let match: string[] | null = null;
  match = workerre.exec(index);
  while (match !== null) {
    if (match[0] !== undefined && match[1] !== undefined) {
      try {
        let worker = (
          await fs.promises.readFile("dist/" + match[1])
        ).toString();
        let replace =
          'new Worker(URL.createObjectURL(new Blob(["("+function(){' +
          worker +
          '}.toString()+")()"],{type:"text/jacascript"})))';
        index =
          index.slice(0, workerre.lastIndex - match[0].length) +
          replace +
          index.slice(workerre.lastIndex);
        workerre.lastIndex -= match[0].length - replace.length;
      } catch (err) {
        console.error("替换 " + match[0] + " 错误：", err);
      }
    }
    match = workerre.exec(index);
  }
  await fs.promises.writeFile("dist/SixProfiler.html", index);
}
main();

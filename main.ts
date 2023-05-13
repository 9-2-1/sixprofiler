import loader from "./loader";
import getstat from "./getstat";
import patch from "./patch";

const file_chooser = document.getElementById("file_chooser");
const stat_graph = document.getElementById("stat_graph");
const stat_table = document.getElementById("stat_table");

if (!(file_chooser instanceof HTMLInputElement)) {
  throw new Error();
}
if (file_chooser.type !== "file") {
  throw new Error();
}

file_chooser.value = "";
file_chooser.addEventListener("change", () => {
  const files = file_chooser.files;
  if (files === null || files[0] === undefined) {
    console.error("no file");
    return;
  }
  const fread = new FileReader();
  fread.addEventListener("load", async () => {
    if (!(fread.result instanceof ArrayBuffer)) {
      console.error("");
      return;
    }
    const sb3file = new loader();
    const sb3json = await sb3file.load(fread.result);
    console.log(sb3json);
  });
  fread.readAsArrayBuffer(files[0]);
});

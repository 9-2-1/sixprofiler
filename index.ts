const fc1 = document.getElementById("fc1");
const fc2 = document.getElementById("fc2");
const textbox = document.getElementById("text");

if (
  !(fc1 instanceof HTMLInputElement) ||
  fc1.type !== "file" ||
  !(fc2 instanceof HTMLInputElement) ||
  fc2.type !== "file" ||
  !(textbox instanceof HTMLTextAreaElement)
) {
  throw new Error("HTML 文件对应的不对");
}

const stopped = (err: boolean) => {
  fc1.disabled = false;
  fc2.disabled = false;
  textbox.classList.remove("blink");
  if (err) {
    textbox.classList.add("error");
  }
};

const running = () => {
  fc1.disabled = true;
  fc2.disabled = true;
  textbox.classList.remove("error");
  textbox.classList.add("blink");
};

textbox.value = "";

const worker = new Worker("./worker", { type: "module" });
worker.addEventListener("error", (err) => {
  textbox.value += "发生了错误: " + err.message + "\n";
});
worker.addEventListener("message", (msg) => {
  switch (msg.data.type) {
    case "print":
      textbox.value += msg.data.data;
      break;
    case "clear":
      textbox.value = "";
      break;
    case "file":
      savefile(msg.data.name, msg.data.data);
      break;
    case "finish":
      stopped(msg.data.error);
      break;
  }
});

function fcbond(
  fc: HTMLInputElement,
  callback: (name: string, data: ArrayBuffer) => void
) {
  fc.value = "";
  fc.addEventListener("change", () => {
    const files = fc.files;
    if (files === null || files[0] === undefined) {
      console.error("no file");
      return;
    }
    const file = files[0];
    const fread = new FileReader();
    fread.addEventListener("load", () => {
      if (!(fread.result instanceof ArrayBuffer)) {
        console.error("");
        return;
      }
      callback(file.name, fread.result);
    });
    fread.readAsArrayBuffer(file);
    fc.value = "";
  });
}

function savefile(name: string, data: ArrayBuffer) {
  const blob = new Blob([data], {
    type: "application/x-octet-stream",
  });
  const objurl = URL.createObjectURL(blob);
  const alink = document.createElement("a");
  alink.href = objurl;
  alink.download = name;
  alink.click();
  URL.revokeObjectURL(objurl);
}

fcbond(fc1, (name, sb3file) => {
  running();
  worker.postMessage({ type: "fc1", name, sb3file });
});

fcbond(fc2, (name, sb3file) => {
  running();
  worker.postMessage({ type: "fc2", name, sb3file });
});

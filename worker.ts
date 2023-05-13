import loader from "./loader";
import getstat from "./getstat";
import patch from "./patch";
import modjson from "./modfile";

addEventListener("message", async (msg) => {
  try {
    switch (msg.data.type) {
      case "fc1":
        await fc1(msg.data.name, msg.data.sb3file);
        break;
      case "fc2":
        await fc2(msg.data.name, msg.data.sb3file);
        break;
    }
    postMessage({ type: "finish", error: false });
  } catch (err) {
    console.error(err);
    print("发生了错误: ");
    if (err instanceof Error) {
      print(err.message);
    }
    postMessage({ type: "finish", error: true });
  }
});

async function fc1(name: string, sb3file: ArrayBuffer) {
  clear();
  const sb3load = new loader();
  const sb3json = await sb3load.load(sb3file);
  await patch(sb3json, modjson, false, (text) => {
    print(text + "\n");
  });
  const sb3file_new = await sb3load.save(sb3json);
  savefile(name.replace(".sb3", ".profiler.sb3"), sb3file_new);
}

async function fc2(_: string, sb3file: ArrayBuffer) {
  clear();
  const sb3load = new loader();
  const sb3json = await sb3load.load(sb3file);
  await getstat(sb3json, (text) => {
    print(text + "\n");
  });
}

function print(text: string) {
  postMessage({ type: "print", data: text });
}

function clear() {
  postMessage({ type: "clear" });
}

function savefile(name: string, data: ArrayBuffer) {
  postMessage({ type: "file", name, data });
}

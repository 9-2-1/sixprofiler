import fs from "fs";
// import util from "util";
import loader from "./loader";
import * as sb3processor from "./sb3processor";

async function main() {
  const sb3file = await fs.promises.readFile(process.argv[2]);
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
  if (process.argv[3] === "-d") {
    dump(sb3json);
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
    await patch(sb3json, modjson, false);
  } else {
    await patch(sb3json, modjson, true);
  }
  const sb3file_new = await sb3load.save(sb3json);
  // await fs.promises.writeFile(
  //   "project_new.ts",
  //   'import * as sb3processor from "./sb3processor"\n\n' +
  //     "const sb3json: sb3processor.Sb3JSON =" +
  //     util.inspect(sb3json, {
  //       depth: null,
  //       maxArrayLength: null,
  //       maxStringLength: null,
  //     }) +
  //     ";\n\nconsole.log(sb3json);"
  // );
  await fs.promises.writeFile(process.argv[3], new Uint8Array(sb3file_new));
}

function dump(sb3json: sb3processor.Sb3JSON): void {
  const sb3 = new sb3processor.Sb3Class(sb3json);
  const id = sb3.stage().list("zzz sixprofiler evid").value;
  const count = sb3.stage().list("zzz sixprofiler evcount").value;
  const time = sb3.stage().list("zzz sixprofiler evtime").value;
  const pack = sb3.stage().list("zzz sixprofiler pack").value;
  const pack2 = sb3.stage().list("zzz sixprofiler pack2").value;

  const info: string[] = [];
  for (const item0 of pack2) {
    for (const item of item0.toString().split(" ")) {
      if (item !== "") {
        info.push(item);
      }
    }
  }
  for (const item0 of pack) {
    for (const item of item0.toString().split(" ")) {
      if (item !== "") {
        info.push(item);
      }
    }
  }
  for (const item of id) {
    info.push(item.toString());
  }
  for (const item of count) {
    info.push(item.toString());
  }
  for (const item of time) {
    info.push(item.toString());
  }

  const infomap: (number | "--")[] = info.map((x) =>
    x === "--" ? "--" : Number(x)
  );
  let infoi = 0;
  const infoarea: { id: number; count: number; time: number }[][] = [];
  while (infoi < infomap.length) {
    const lev: [number[], number[], number[]] = [[], [], []];
    for (let i = 0; i < 3; i++) {
      infoi++;
      while (infoi < infomap.length) {
        const val = infomap[infoi];
        if (val === "--") {
          break;
        }
        lev[i].push(val);
        infoi++;
      }
    }
    const infoframe: { id: number; count: number; time: number }[] = [];
    for (let i = 0; i < lev[0].length; i++) {
      infoframe.push({
        id: lev[0][i],
        count: lev[1][i],
        time: lev[2][i],
      });
    }
    infoarea.push(infoframe);
  }

  const gather: {
    [id: number]: {
      id: number;
      count: number;
      time: number;
      maxcount: number;
      maxtime: number;
    };
  } = {};
  for (const info of infoarea) {
    for (const infoid of info) {
      if (!Object.prototype.hasOwnProperty.call(gather, infoid.id)) {
        gather[infoid.id] = {
          id: infoid.id,
          count: 0,
          time: 0,
          maxcount: 0,
          maxtime: 0,
        };
      }
      gather[infoid.id].count += infoid.count;
      gather[infoid.id].time += infoid.time;
      if (infoid.count > gather[infoid.id].maxcount) {
        gather[infoid.id].maxcount = infoid.count;
      }
      if (infoid.time > gather[infoid.id].maxtime) {
        gather[infoid.id].maxtime = infoid.time;
      }
    }
  }

  const idmap: { [id: number]: string } = {};
  for (let i = 0; i < sb3.targetcount(); i++) {
    const target = sb3.target(i);
    for (const topblock of target.topBlocks()) {
      const next = topblock.next();
      if (
        next !== null &&
        !Array.isArray(next._source) &&
        next._source.opcode === "procedures_call" &&
        typeof next._source.mutation?.proccode === "string" &&
        next._source.mutation.proccode.startsWith("zzz sixprofiler position:")
      ) {
        const id = Number(next.inputvalue(next.procinput(0)));
        let descp = "unknown";
        if (Array.isArray(topblock._source)) {
          descp = "Impossible";
        } else if (topblock._source.opcode === "procedures_definition") {
          const input2 = topblock.input_2("custom_block");
          if (input2.type !== "block" || Array.isArray(input2.block._source)) {
            descp = "Impossible";
          } else {
            descp =
              "定义 " + JSON.stringify(input2.block._source.mutation?.proccode);
          }
        } else {
          const opcodemap: { [opcode: string]: string } = {
            control_start_as_clone: "当作为克隆体启动时",
            event_whenflagclicked: "当 %1 被点击",
            event_whenthisspriteclicked: "当角色被点击",
            event_whenstageclicked: "当舞台被点击",
            event_whentouchingobject: "当该角色碰到 %1",
            event_whenbroadcastreceived: "当接收到 %1",
            event_whenbackdropswitchesto: "当背景换成 %1",
            event_whengreaterthan: "当 %1 > ...",
            event_whengreaterthan_timer: "计时器",
            event_whengreaterthan_loudness: "响度",
            event_broadcast: "广播 %1",
            event_broadcastandwait: "广播 %1 并等待",
            event_whenkeypressed: "当按下 %1 键",
          };
          const opcode = topblock._source.opcode;
          const fields = Object.values(topblock._source.fields);
          descp = opcodemap[opcode];
          if (descp !== undefined) {
            fields.forEach((v, i) => {
              descp = descp.replace(
                new RegExp(`%${i + 1}`),
                JSON.stringify(v[0])
              );
            });
          } else {
            descp =
              opcode + " " + fields.map((x) => JSON.stringify(x[0])).join(" ");
          }
        }

        idmap[id] = JSON.stringify(target.name()) + ": " + descp;
      }
    }
  }

  const sortresult = Object.values(gather).sort((a, b) => b.time - a.time);

  // console.log(
  //   infoarea
  //     .map((info) =>
  //       info.map((x) => x.id + "\t" + x.count + "\t" + x.time).join("\n")
  //     )
  //     .join("\n--------\n")
  // );

  const frame = infoarea.length;
  console.log("frame: " + frame);
  console.log(
    [
      "编号",
      "次数",
      "时长",
      "时长/次",
      "次/帧",
      "时长/帧",
      "大次帧",
      "大时帧",
      "描述",
    ].join("\t")
  );
  console.log(
    sortresult
      .map(({ id, count, time, maxcount, maxtime }) =>
        [
          id,
          count,
          time,
          (time / count).toFixed(3),
          (count / frame).toFixed(1),
          (time / frame).toFixed(3),
          maxcount,
          maxtime,
          idmap[id] ?? "未知积木",
        ].join("\t")
      )
      .join("\n")
  );
}

function unpatch(
  sb3: sb3processor.Sb3Class,
  t_flag: { [id: string]: sb3processor.BlockJSON }
) {
  for (let i = 0; i < sb3.targetcount(); i++) {
    const target = sb3.target(i);
    for (const name of target.variables()) {
      if (name.startsWith("zzz sixprofiler")) {
        target.delVariable(name);
      }
    }
    for (const name of target.lists()) {
      if (name.startsWith("zzz sixprofiler")) {
        target.delList(name);
      }
    }
    for (let topblock of target.topBlocks()) {
      if (
        !Array.isArray(topblock._source) &&
        topblock._source.opcode === "event_whenbroadcastreceived" &&
        topblock
          .fieldvalue("BROADCAST_OPTION")
          .toString()
          .startsWith("zzz sixprofiler")
      ) {
        const next = topblock.next();
        topblock.next(null);
        const entry = target.newBlock(t_flag)[0];
        if (Array.isArray(entry._source)) {
          throw new Error();
        }
        entry.next(next);
        entry._source.x = topblock._source.x;
        entry._source.y = topblock._source.y;
        topblock.delete(true);
        topblock = entry;
      }
      topblock.bfs((block) => {
        if (Array.isArray(block._source)) {
          return "parent";
        }
        if (block._source.opcode === "procedures_definition") {
          const prototype = block.input_2("custom_block");
          if (
            prototype.type === "block" &&
            !Array.isArray(prototype.block._source) &&
            prototype.block._source.opcode === "procedures_prototype"
          ) {
            const proccode = prototype.block._source.mutation?.proccode;
            if (
              typeof proccode === "string" &&
              proccode.startsWith("zzz sixprofiler")
            ) {
              return "deletebelow";
            }
          }
        }
        if (block._source.opcode.startsWith("event_when")) {
          const next = block.next();
          if (
            next !== null &&
            !Array.isArray(next._source) &&
            next._source.opcode === "procedures_call" &&
            typeof next._source.mutation?.proccode === "string" &&
            next._source.mutation.proccode.startsWith("zzz sixprofiler") &&
            next.next() === null
          ) {
            return "deletebelow";
          }
        }
        if (
          block._source.opcode === "procedures_call" &&
          typeof block._source.mutation?.proccode === "string" &&
          block._source.mutation.proccode.startsWith("zzz sixprofiler")
        ) {
          return "delete";
        }
        return "input";
      });
    }
  }
}

export async function patch(
  sb3json: sb3processor.Sb3JSON,
  modjson: sb3processor.Sb3JSON,
  patch: boolean
) {
  const sb3 = new sb3processor.Sb3Class(sb3json);
  const mod = new sb3processor.Sb3Class(modjson);
  const t_start = mod.targetname("启动函数").blockjson();
  const t_entry = mod.targetname("替换绿旗").blockjson();
  const t_flag = mod.targetname("绿旗").blockjson();
  const t_sixlib = mod.targetname("库函数").blockjson();
  const t_sixlibcall = mod.targetname("库函数调用").blockjson();
  // 清理之前插入的 patch
  unpatch(sb3, t_flag);
  if (!patch) {
    return;
  }
  // 现在，开始插入 block
  for (const name of mod.stage().variables()) {
    sb3.stage().variable(name, mod.stage().variable(name).value);
  }
  for (const name of mod.stage().lists()) {
    sb3.stage().list(name, mod.stage().list(name).value);
  }
  let tag = 0;
  for (let i = 0; i < sb3.targetcount(); i++) {
    const target = sb3.target(i);
    for (let topblock of target.topBlocks()) {
      if (Array.isArray(topblock._source)) {
        continue;
      }
      if (topblock._source.opcode === "event_whenflagclicked") {
        const next = topblock.next();
        topblock.next(null);
        const entry = target.newBlock(t_entry)[0];
        if (Array.isArray(entry._source)) {
          throw new Error();
        }
        entry.next(next);
        entry._source.x = topblock._source.x;
        entry._source.y = topblock._source.y;
        topblock.delete(true);
        topblock = entry;
      }
      const insertList: sb3processor.BlockClass[] = [];
      topblock.bfs((block) => {
        const parent = block.parent();
        if (parent !== null) {
          insertList.push(block);
        }
        return "substack";
      });
      for (const block of insertList) {
        const checker = target.newBlock(t_sixlibcall)[0];
        checker.inputvalue(checker.procinput(0), tag);
        if (block.parent()?.parent()) {
          checker.inputvalue(checker.procinput(1), 0);
        } else {
          checker.inputvalue(checker.procinput(1), 1);
        }
        //ポッピン
        checker.insertBefore(block);
      }
      tag++;
    }

    target.newBlock(t_sixlib);
  }
  sb3.stage().newBlock(t_start);
}

main();
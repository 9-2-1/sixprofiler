import fs from "fs";
// import util from "util";
import loader from "./loader";
import * as sb3processor from "./sb3processor";

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
    await patch(sb3json, modjson, false);
  } else {
    await patch(sb3json, modjson, true);
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

function getoradd<V>(obj: { [key: number]: V }, key: number, defaul: V): V {
  let ret = obj[key];
  if (ret === undefined) {
    ret = obj[key] = defaul;
  }
  return ret;
}

function tableline(tabwidth: number, items: (string | number)[]): string {
  return items
    .map((item, i) => {
      let text = "";
      if (typeof item === "number") {
        text = String(item);
      } else {
        text = item;
      }
      if (i == items.length - 1) {
        return text;
      } else {
        let width = 0;
        const chars = text.split("");
        let text2 = "";
        for (const char of chars) {
          // TODO 需要一个更加精确的宽度判断方法
          const clen = (char.codePointAt(0) ?? 0) < 0xff ? 1 : 2;
          if (clen + width >= tabwidth) {
            break;
          }
          width += clen;
          text2 += char;
        }
        text2 += " ".repeat(tabwidth - width);
        return text2;
      }
    })
    .join("");
}

function getstat(sb3json: sb3processor.Sb3JSON): void {
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
        if (val === "--" || val === undefined) {
          break;
        }
        lev[i]?.push(val);
        infoi++;
      }
    }
    const infoframe: { id: number; count: number; time: number }[] = [];
    for (let i = 0; i < lev[0].length; i++) {
      const id = lev[0][i];
      const count = lev[1][i];
      const time = lev[2][i];
      if (id === undefined || count === undefined || time === undefined) {
        throw new Error();
      }
      infoframe.push({
        id,
        count,
        time,
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
      callfrom: {
        [id: number]: {
          id: number;
          count: number;
          maxcount: number;
        };
      };
      callto: {
        [id: number]: {
          id: number;
          count: number;
          maxcount: number;
        };
      };
    };
  } = {};
  for (const info of infoarea) {
    for (const infoid of info) {
      if (infoid.id > 10000000) {
        // 调用关系记录
        const from = Math.floor(infoid.id / 10000000);
        const to = infoid.id % 10000000;
        const frominfo = getoradd(gather, from, {
          id: from,
          count: 0,
          time: 0,
          maxcount: 0,
          maxtime: 0,
          callfrom: {},
          callto: {},
        });
        const toinfo = getoradd(gather, to, {
          id: to,
          count: 0,
          time: 0,
          maxcount: 0,
          maxtime: 0,
          callfrom: {},
          callto: {},
        });
        const fromcallto = getoradd(frominfo.callto, to, {
          id: to,
          count: 0,
          maxcount: 0,
        });
        const tocallfrom = getoradd(toinfo.callfrom, from, {
          id: from,
          count: 0,
          maxcount: 0,
        });
        fromcallto.count += infoid.count;
        if (infoid.count > fromcallto.maxcount) {
          fromcallto.maxcount = infoid.count;
        }
        tocallfrom.count += infoid.count;
        if (infoid.count > tocallfrom.maxcount) {
          tocallfrom.maxcount = infoid.count;
        }
      } else {
        // 位置记录
        const ginfo = getoradd(gather, infoid.id, {
          id: infoid.id,
          count: 0,
          time: 0,
          maxcount: 0,
          maxtime: 0,
          callfrom: {},
          callto: {},
        });
        ginfo.count += infoid.count;
        ginfo.time += infoid.time;
        if (infoid.count > ginfo.maxcount) {
          ginfo.maxcount = infoid.count;
        }
        if (infoid.time > ginfo.maxtime) {
          ginfo.maxtime = infoid.time;
        }
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
        let descp = "不知道";
        if (Array.isArray(topblock._source)) {
          descp = "变量/列表";
        } else {
          const opcode = topblock._source.opcode;
          if (opcode === "procedures_definition") {
            const input2 = topblock.input_2("custom_block");
            if (
              input2.type !== "block" ||
              Array.isArray(input2.block._source)
            ) {
              descp = "定义？";
            } else {
              descp =
                "定义 " +
                JSON.stringify(input2.block._source.mutation?.proccode);
            }
          } else if (
            opcode === "event_whenbroadcastreceived" &&
            topblock.fieldvalue("BROADCAST_OPTION") === "zzz sixprofiler entry"
          ) {
            descp = "当(绿旗)被点击";
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
            const fields = Object.values(topblock._source.fields);
            const desmap = opcodemap[opcode];
            if (desmap !== undefined) {
              descp = desmap;
              fields.forEach((v, i) => {
                descp = descp.replace(
                  new RegExp(`%${i + 1}`),
                  JSON.stringify(v[0])
                );
              });
            } else {
              descp =
                opcode +
                " " +
                fields.map((x) => JSON.stringify(x[0])).join(" ");
            }
          }
        }

        idmap[id] = JSON.stringify(target.name()) + ": " + descp;
      }
    }
  }

  const tloss1 =
    ((gather[-1]?.time ?? 0) +
      (gather[-2]?.time ?? 0) +
      (gather[-3]?.time ?? 0) +
      (gather[-4]?.time ?? 0)) /
    (1000 * 4);
  const tloss0 = (gather[-5]?.time ?? 0) / (1000 * 4);

  for (const value of Object.values(gather)) {
    value.time -= Math.round(value.count * tloss1);
    value.maxtime -= Math.round(value.maxcount * tloss1);
    if (value.time < 0) value.time = 0;
    if (value.maxtime < 0) value.maxtime = 0;
  }

  const sortresult = Object.values(gather).sort((a, b) =>
    b.time === a.time ? b.count - a.count : b.time - a.time
  );

  // console.log(
  //   infoarea
  //     .map((info) =>
  //       info.map((x) => x.id + "\t" + x.count + "\t" + x.time).join("\n")
  //     )
  //     .join("\n--------\n")
  // );

  const frame = infoarea.length;
  console.log(
    "记录帧数: " +
      frame +
      " 平均记录1次损耗: " +
      tloss1 +
      "ms 平均标记一次损耗: " +
      tloss0 +
      "ms"
  );
  for (const {
    id,
    count,
    time,
    maxcount,
    maxtime,
    callfrom,
    callto,
  } of sortresult) {
    if (id < 1 || id > 10000000) {
      continue;
    }
    console.log(
      tableline(8, [
        "编号",
        "次数",
        "时长",
        "时长/次",
        "次/帧",
        "时长/帧",
        "大次帧",
        "大时帧",
        "描述",
      ])
    );
    console.log(
      tableline(8, [
        id,
        count,
        time,
        (time / count).toPrecision(6),
        (count / frame).toPrecision(6),
        (time / frame).toPrecision(6),
        maxcount,
        maxtime,
        idmap[id] ?? "未知积木",
      ])
    );
    for (const {
      id: from,
      count: count1,
      maxcount: maxcount1,
    } of Object.values(callfrom)) {
      console.log(
        " " +
          tableline(8, [
            "来源",
            count1,
            "" + ((count1 / count) * 100).toFixed(2).padStart(6, " ") + "%",
            "",
            (count1 / frame).toPrecision(6),
            "",
            maxcount1,
            "",
            idmap[from] ?? "未知积木",
          ])
      );
    }
    for (const { id: to, count: count1, maxcount: maxcount1 } of Object.values(
      callto
    )) {
      const multiply = count1 / count;
      let multiplytext = "";
      if (multiply > 999999) {
        multiplytext = "x999999";
      } else if (multiply > 9999.9) {
        multiplytext = "x" + multiply.toFixed(0);
      } else {
        multiplytext = "x" + multiply.toPrecision(5);
      }
      console.log(
        "  " +
          tableline(8, [
            "调用",
            count1,
            multiplytext,
            "",
            (count1 / frame).toFixed(1),
            "",
            maxcount1,
            "",
            idmap[to] ?? "未知积木",
          ])
      );
    }
    console.log("");
  }
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
        if (entry === undefined || Array.isArray(entry._source)) {
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
            !next._source.mutation.proccode.startsWith(
              "zzz sixprofiler position:"
            ) &&
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
  // 触发器积木
  const hatOpcodes: string[] = [];
  // 循环积木
  const loopOpcodes: string[] = [];
  // 等待积木
  const waitOpcodes: string[] = [];
  // 知道的积木类型
  const knowTypes: string[] = [];

  const sb3 = new sb3processor.Sb3Class(sb3json);
  const mod = new sb3processor.Sb3Class(modjson);
  const t_start = mod.targetname("启动函数").blockjson();
  const t_entry = mod.targetname("替换绿旗").blockjson();
  const t_flag = mod.targetname("绿旗").blockjson();
  const t_sixlib = mod.targetname("库函数").blockjson();
  const t_sixlibpos = mod.targetname("记录位置").blockjson();
  const t_sixlibcall = mod.targetname("记录调用").blockjson();

  const t_hats = mod.targetname("触发器积木");
  const t_loops = mod.targetname("循环积木");
  const t_waits = mod.targetname("等待积木");
  const t_knows = mod.targetname("已知的积木类型");

  for (const topblock of t_hats.topBlocks()) {
    if (Array.isArray(topblock._source)) {
      continue;
    }
    hatOpcodes.push(topblock._source.opcode);
  }

  for (const topblock of t_loops.topBlocks()) {
    if (Array.isArray(topblock._source)) {
      continue;
    }
    loopOpcodes.push(topblock._source.opcode);
  }

  for (const topblock of t_waits.topBlocks()) {
    if (Array.isArray(topblock._source)) {
      continue;
    }
    waitOpcodes.push(topblock._source.opcode);
  }

  for (const topblock of t_knows.topBlocks()) {
    if (Array.isArray(topblock._source)) {
      continue;
    }
    const opcode = topblock._source.opcode;
    const optype = opcode.split("_")[0];
    if (optype !== undefined) {
      knowTypes.push(optype);
    }
  }

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
  const spacing = 500;
  for (let i = 0; i < sb3.targetcount(); i++) {
    const target = sb3.target(i);
    let tag_ = tag;
    let topshift = spacing;
    const proccodemap: { [id: string]: number } = Object.create(null);
    for (const topblock of target.topBlocks()) {
      if (Array.isArray(topblock._source)) {
        continue;
      }
      tag_++;
      if (topblock._source.opcode === "procedures_definition") {
        const prototype = topblock.input_2("custom_block");
        if (
          prototype.type === "block" &&
          !Array.isArray(prototype.block._source) &&
          prototype.block._source.opcode === "procedures_prototype"
        ) {
          const proccode = prototype.block._source.mutation?.proccode;
          if (typeof proccode === "string") {
            if (proccodemap[proccode] !== undefined) {
              console.warn(
                "角色" +
                  JSON.stringify(target.name()) +
                  "的自定义积木" +
                  JSON.stringify(proccode) +
                  "有重复的定义。"
              );
            } else {
              proccodemap[proccode] = tag_;
            }
          }
        }
      }
    }
    for (let topblock of target.topBlocks()) {
      if (Array.isArray(topblock._source)) {
        topblock._source[3] = topshift;
        topblock._source[4] = 0;
        topshift += spacing;
        continue;
      }
      topblock._source.x = topshift;
      topblock._source.y = 0;
      topshift += spacing;
      tag++;
      if (topblock._source.opcode === "event_whenflagclicked") {
        const next = topblock.next();
        topblock.next(null);
        const entry = target.newBlock(t_entry)[0];
        if (entry === undefined || Array.isArray(entry._source)) {
          throw new Error();
        }
        entry.next(next);
        entry._source.x = topblock._source.x;
        entry._source.y = topblock._source.y;
        topblock.delete(true);
        topblock = entry;
      }
      // 需要在前面插入计数积木的积木列表
      const insertList: sb3processor.BlockClass[] = [];
      // 需要在前面插入调用关系计数积木的调用自制积木列表
      const callList: sb3processor.BlockClass[] = [];
      // 需要在后面插入计数积木的积木列表
      const appendList: sb3processor.BlockClass[] = [];
      topblock.bfs((block) => {
        const parent = block.parent();
        if (parent !== null) {
          // 在循环积木内
          if (
            !Array.isArray(parent._source) &&
            parent.next()?.id !== block.id
          ) {
            const opcode = parent._source.opcode;
            const optype = opcode.split("_")[0];
            if (
              optype === undefined ||
              !knowTypes.includes(optype) ||
              loopOpcodes.includes(opcode)
            ) {
              insertList.push(block);
            }
          }
        }
        if (!Array.isArray(block._source)) {
          const opcode = block._source.opcode;
          // 调用关系计数
          if (opcode === "procedures_call") {
            callList.push(block);
          }
          // 在触发器积木后，定义积木后，循环积木后，等待积木后，调用积木后，未知且有后续积木的积木后
          const optype = opcode.split("_")[0];
          if (
            hatOpcodes.includes(opcode) ||
            opcode === "procedures_definition" ||
            (loopOpcodes.includes(opcode) && opcode !== "control_forever") ||
            waitOpcodes.includes(opcode) ||
            opcode === "procedures_call" ||
            ((optype === undefined || !knowTypes.includes(optype)) &&
              block.next() !== null)
          ) {
            appendList.push(block);
          }
        }
        return "substack";
      });
      for (const block of callList) {
        if (Array.isArray(block._source)) {
          continue;
        }
        const proccode = block._source.mutation?.proccode;
        if (proccode !== undefined) {
          const tag_ = proccodemap[proccode];
          if (tag_ !== undefined) {
            const checker = target.newBlock(t_sixlibcall)[0];
            if (checker === undefined) {
              throw new Error();
            }
            checker.insertBefore(block);
            checker.inputvalue(checker.procinput(0), tag);
            checker.inputvalue(checker.procinput(1), tag_);
          } else {
            console.warn(
              "角色" +
                JSON.stringify(target.name()) +
                "的自定义积木" +
                JSON.stringify(proccode) +
                "没有定义。"
            );
          }
        }
      }
      for (const block of insertList) {
        const checker = target.newBlock(t_sixlibpos)[0];
        if (checker === undefined) {
          throw new Error();
        }
        checker.inputvalue(checker.procinput(0), tag);
        checker.inputvalue(checker.procinput(1), 0);
        checker.insertBefore(block);
      }
      for (const block of appendList) {
        const checker = target.newBlock(t_sixlibpos)[0];
        if (checker === undefined) {
          throw new Error();
        }
        checker.inputvalue(checker.procinput(0), tag);
        if (block.parent() === null) {
          checker.inputvalue(checker.procinput(1), 1);
        } else {
          checker.inputvalue(checker.procinput(1), 0);
        }
        const next = block.next();
        block.next(checker);
        checker.next(next);
      }
    }

    target.newBlock(t_sixlib);
  }
  sb3.stage().newBlock(t_start);
}

main();

import * as sb3processor from "./sb3processor";

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

export default function getstat(
  sb3json: sb3processor.Sb3JSON,
  printline?: (text: string) => void
): void {
  if (printline === undefined) {
    printline = (text: string) => {
      console.log(text);
    };
  }
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
  printline(
    "记录帧数: " +
      frame +
      " 平均记录1次损耗: " +
      tloss1 +
      "ms 平均标记一次损耗: " +
      tloss0 +
      "ms"
  );
  printline("");
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
    printline(
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
    printline(
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
      printline(
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
      printline(
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
    printline("");
  }
}

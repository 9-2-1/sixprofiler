import * as sb3processor from "./sb3processor";

export default async function patch(
  sb3json: sb3processor.Sb3JSON,
  modjson: sb3processor.Sb3JSON,
  remove: boolean,
  printline?: (text: string) => void
) {
  if (printline === undefined) {
    printline = (text: string) => {
      console.warn(text);
    };
  }
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
  if (remove) {
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
    let tag_ = tag;
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
              printline(
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
        continue;
      }
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
            printline(
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

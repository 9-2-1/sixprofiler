// comment注释，monitor删除变量问题，opcode，position
// fix shadow, topLevel

/** project.json */
export interface Sb3JSON {
  targets: TargetJSON[];
  monitors: MonitorJSON[];
  // ignored
  [key: string]: unknown;
}

/** targets[_] */
export interface TargetJSON {
  name: string;
  isStage: boolean;
  blocks: { [id: string]: BlockJSON };
  variables: { [id: string]: VariableJSON };
  lists: { [id: string]: ListJSON };
  broadcasts: { [id: string]: string };
  comments: { [id: string]: CommentJSON };
  // ignored
  [key: string]: unknown;
}

/** monitors[_] */
export interface MonitorJSON {
  // ignored
  [key: string]: unknown;
}

/** targets[_].blocks[_] */
export type BlockJSON = BlockJSON_short | BlockJSON_normal;
export interface BlockJSON_normal {
  opcode: string;
  parent: null | undefined | string;
  next: null | undefined | string;
  inputs: { [id: string]: InputJSON };
  fields: { [id: string]: FieldJSON };
  comment?: string;
  shadow: boolean;
  topLevel: boolean;
  x?: number;
  y?: number;
  mutation?: {
    tagName: "mutation";
    children: unknown[];
    proccode?: string;
    argumentids?: string;
    argumentnames?: string;
    argumentdefaults?: string;
    warp?: "false" | "true" | boolean;
    hasnext?: "false" | "true" | boolean;
    // incomplete
    [name: string]: unknown;
  };
}

// strange
type BlockJSON_short =
  | [...(VariableRef | ListRef), number, number]
  | VariableRef
  | ListRef;

/** targets[_].variables[_] */
export type VariableJSON = [string, string | number | boolean];

/** targets[_].lists[_] */
export type ListJSON = [string, (string | number | boolean)[]];

/** targets[_].comments[_] */
export type CommentJSON = {
  blockId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  text: string;
};

// | // Constants used during serialization and deserialization
// | const INPUT_SAME_BLOCK_SHADOW = 1; // unobscured shadow
// | const INPUT_BLOCK_NO_SHADOW = 2; // no shadow
// | const INPUT_DIFF_BLOCK_SHADOW = 3; // obscured shadow
// | // There shouldn't be a case where block is null, but shadow is present...
// |
// | // Constants referring to 'primitive' blocks that are usually shadows,
// | // or in the case of variables and lists, appear quite often in projects
// | // math_number
// | const MATH_NUM_PRIMITIVE = 4; // there's no reason these constants can't collide
// | // math_positive_number
// | const POSITIVE_NUM_PRIMITIVE = 5; // with the above, but removing duplication for clarity
// | // math_whole_number
// | const WHOLE_NUM_PRIMITIVE = 6;
// | // math_integer
// | const INTEGER_NUM_PRIMITIVE = 7;
// | // math_angle
// | const ANGLE_NUM_PRIMITIVE = 8;
// | // colour_picker
// | const COLOR_PICKER_PRIMITIVE = 9;
// | // text
// | const TEXT_PRIMITIVE = 10;
// | // event_broadcast_menu
// | const BROADCAST_PRIMITIVE = 11;
// | // data_variable
// | const VAR_PRIMITIVE = 12;
// | // data_listcontents
// | const LIST_PRIMITIVE = 13;

export type InputRef = [4 | 5 | 6 | 7 | 8 | 9 | 10, string | number];
export type BroadcastRef = [11, string, string | null];
export type VariableRef = [12 | 13, string, string | null];
export type ListRef = [12 | 13, string, string | null];

export type ShadowRef = string | InputRef | BroadcastRef;
export type BlockRef = string | VariableRef | ListRef;

export type InputJSON =
  | [1, ShadowRef | null]
  | [2, BlockRef | null]
  | [3, BlockRef | null, ShadowRef | null];
export type FieldJSON = [string] | [string, string | null];

export type InputType = InputBlockType | InputArrayType | InputNullType;
export type Input2Type = InputBlockType | Input2ArrayType | InputNullType;
export type InputBlockType = { type: "block"; block: BlockClass };
export type InputArrayType = {
  type: "array";
  array: BlockRef;
};
export type Input2ArrayType = {
  type: "array";
  array: ShadowRef;
};
export type InputNullType = { type: "null" };

export type BfsBlockReturn =
  | "input"
  | "substack"
  | "next"
  | "parent"
  | "delete"
  | "deletebelow";

function copyjson<T>(x: T): T {
  let y: any = undefined;
  if (typeof x === "object" && x !== null) {
    if (Array.isArray(x)) {
      y = x.map((v) => copyjson(v));
    } else {
      y = {};
      for (const key in x) {
        y[key] = copyjson(x[key]);
      }
    }
  } else {
    y = x;
  }
  return y;
}

function newid(usedId: string[]): string {
  const pool = (
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "-/:;()_$~?![]{}#%^*+=|"
  ).split("");
  let id = "";
  do {
    id = Array(20)
      .fill("0")
      .map(() => pool[Math.floor(Math.random() * pool.length)])
      .join("");
  } while (usedId.includes(id));
  return id;
}

export class Sb3Class {
  constructor(public _source: Sb3JSON) {}

  targetname(name: string): TargetClass {
    let id = -1;
    this._source.targets.forEach((target, i) => {
      if (target.name === name) {
        id = i;
      }
    });
    if (id === -1) {
      throw new Error();
    }
    return new TargetClass(this, id);
  }

  target(id: number): TargetClass {
    if (this._source.targets[id] === undefined) {
      throw new Error();
    }
    return new TargetClass(this, id);
  }

  targetcount(): number {
    return this._source.targets.length;
  }

  stage(): TargetClass {
    let id = -1;
    this._source.targets.forEach((target, i) => {
      if (target.isStage) {
        id = i;
      }
    });
    if (id === -1) {
      throw new Error();
    }
    const target = this.target(id);
    if (target === null) {
      throw new Error();
    }
    return target;
  }

  allBlockId(): string[] {
    let ret: string[] = [];
    for (let i = 0; i < this.targetcount(); i++) {
      const target = this.target(i);
      if (target === null) {
        throw new Error();
      }
      ret = ret.concat(target.allBlockId());
    }
    return ret;
  }
}

export class TargetClass {
  _source: TargetJSON;

  constructor(public sb3class: Sb3Class, public id: number) {
    const source = this.sb3class._source.targets[this.id];
    if (source === undefined) {
      throw new Error();
    }
    this._source = source;
  }

  isStage(): boolean {
    return this._source.isStage;
  }

  name(): string {
    return this._source.name;
  }

  varOrList(
    type: "variables",
    name: string,
    value?: string | number | boolean
  ): { id: string; value: string | number | boolean };
  varOrList(
    type: "lists",
    name: string,
    value?: (string | number | boolean)[]
  ): { id: string; value: (string | number | boolean)[] };

  varOrList(
    type: "variables" | "lists",
    name: string,
    value?: any
  ): {
    id: string;
    value: any;
  } {
    let vari = this._source[type];
    let getvalue: any;
    let id: string | null = null;
    for (const [vid, vinfo] of Object.entries(vari)) {
      if (vinfo[0] === name) {
        if (value !== undefined) {
          vinfo[1] = value;
        }
        id = vid;
        getvalue = vinfo[1];
        break;
      }
    }
    if (id === null && !this.isStage()) {
      vari = this.sb3class.stage()._source[type];
      for (const [vid, vinfo] of Object.entries(vari)) {
        if (vinfo[0] === name) {
          if (value !== undefined) {
            vinfo[1] = value;
          }
          id = vid;
          getvalue = vinfo[1];
          break;
        }
      }
    }
    if (id === null && value !== undefined) {
      if (this.isStage()) {
        for (let i = 0; i < this.sb3class.targetcount(); i++) {
          const target = this.sb3class.target(i);
          const vari = target._source[type];
          for (const vinfo of Object.values(vari)) {
            if (vinfo[0] === name) {
              throw new Error();
            }
          }
        }
      }
      id = newid(Object.keys(vari));
      vari[id] = [name, value];
      getvalue = value;
    }
    if (id === null) {
      throw new Error();
    } else {
      return { id, value: getvalue };
    }
  }

  variables(): string[] {
    const ret: string[] = [];
    for (const variable of Object.values(this._source.variables)) {
      ret.push(variable[0]);
    }
    return ret;
  }

  lists(): string[] {
    const ret: string[] = [];
    for (const list of Object.values(this._source.lists)) {
      ret.push(list[0]);
    }
    return ret;
  }

  variable(
    name: string,
    value?: string | number | boolean
  ): { id: string; value: string | number | boolean } {
    return this.varOrList("variables", name, value);
  }

  delVariable(name: string) {
    const vari = this.variable(name);
    for (let i = 0; i < this.sb3class.targetcount(); i++) {
      if (this.isStage() || i === this.id) {
        const target = this.sb3class.target(i);
        for (const topblock of target.topBlocks()) {
          topblock.bfs((block) => {
            if (Array.isArray(block._source)) {
              if (block._source[0] === 12 && block._source[1] === name) {
                return "delete";
              }
            } else {
              const fields = block.fields();
              if (
                fields.includes("VARIABLE") &&
                block.fieldvalue("VARIABLE") === name
              ) {
                return "delete";
              }
              const inputs = block.inputs();
              for (const iname of inputs) {
                const input = block.input(iname);
                if (
                  input.type === "array" &&
                  input.array[0] === 12 &&
                  input.array[1] === name
                ) {
                  block.input(iname, { type: "null" });
                }
              }
            }
            return "input";
          });
        }
      }
    }
    delete this._source.variables[vari.id];
  }

  delList(name: string) {
    const vari = this.list(name);
    for (let i = 0; i < this.sb3class.targetcount(); i++) {
      if (this.isStage() || i === this.id) {
        const target = this.sb3class.target(i);
        for (const topblock of target.topBlocks()) {
          topblock.bfs((block) => {
            if (Array.isArray(block._source)) {
              if (block._source[0] === 13 && block._source[1] === name) {
                return "delete";
              }
            } else {
              const fields = block.fields();
              if (
                fields.includes("LIST") &&
                block.fieldvalue("LIST") === name
              ) {
                return "delete";
              }
              const inputs = block.inputs();
              for (const iname of inputs) {
                const input = block.input(iname);
                if (
                  input.type === "array" &&
                  input.array[0] === 13 &&
                  input.array[1] === name
                ) {
                  block.input(iname, { type: "null" });
                }
              }
            }
            return "input";
          });
        }
      }
    }
    delete this._source.lists[vari.id];
  }

  list(
    name: string,
    value?: (string | number | boolean)[]
  ): { id: string; value: (string | number | boolean)[] } {
    return this.varOrList("lists", name, value);
  }

  broadcast(name: string, create = true): { id: string } {
    const vari = this.sb3class.stage()._source.broadcasts;
    let id: string | null = null;
    for (const vid in vari) {
      if (vari[vid] === name) {
        id = vid;
        break;
      }
    }
    if (id === null && create) {
      id = newid(Object.keys(vari));
      vari[id] = name;
    }
    if (id === null) {
      throw new Error("找不到广播 " + name);
    } else {
      return { id };
    }
  }

  /**
   * 只返回 topBlock
   */
  newBlock(blocks: { [id: string]: BlockJSON }): BlockClass[] {
    const idmap: { [id: string]: string } = {};
    const usedId = this.sb3class.allBlockId();
    const that = this;

    function transShortBlock(block: BlockJSON_short): BlockJSON_short {
      switch (block[0]) {
        case 12:
          block[2] = that.variable(block[1], 0).id;
          break;
        case 13:
          block[2] = that.list(block[1], []).id;
          break;
      }
      return block;
    }

    function transRef(block: BlockRef | null): BlockRef | null;
    function transRef(block: ShadowRef | null): ShadowRef | null;
    function transRef(
      block: BlockRef | ShadowRef | null
    ): BlockRef | ShadowRef | null;
    function transRef(
      block: ShadowRef | BlockRef | null
    ): ShadowRef | BlockRef | null {
      if (Array.isArray(block)) {
        switch (block[0]) {
          case 11:
            block[2] = that.broadcast(block[1]).id;
            break;
          case 12:
            block[2] = that.variable(block[1], 0).id;
            break;
          case 13:
            block[2] = that.list(block[1], []).id;
            break;
        }
        return block;
      } else {
        return transId(block);
      }
    }
    function transId(id: string | null): string | null {
      if (typeof id === "string") {
        return idmap[id] ?? null;
      } else {
        return id;
      }
    }

    blocks = copyjson(blocks);
    for (const id in blocks) {
      let nid = id;
      if (usedId.includes(id)) {
        nid = newid(usedId);
      }
      usedId.push(nid);
      idmap[id] = nid;
    }
    const newblocks: { [id: string]: BlockJSON } = {};
    for (const [id, block] of Object.entries(blocks)) {
      if (Array.isArray(block)) {
        transShortBlock(block);
      } else {
        block.parent = transId(block.parent ?? null);
        block.topLevel = block.parent === null;
        block.next = transId(block.next ?? null);
        for (const [name, input] of Object.entries(block.inputs)) {
          switch (input[0]) {
            case 1:
            case 2:
              {
                const input1 = transRef(input[1]);
                if (input1 === null) {
                  block.inputs[name] = [1, null];
                } else {
                  input[1] = input1;
                }
              }
              break;
            case 3:
              {
                const input1 = transRef(input[1]);
                const input2 = transRef(input[2]);
                if (input1 === null) {
                  block.inputs[name] = [1, input2];
                } else {
                  input[1] = input1;
                  input[2] = input2;
                }
              }
              break;
          }
        }
      }
      const newid = transId(id);
      if (newid === null) {
        throw new Error();
      }
      newblocks[newid] = block;
    }
    Object.assign(this._source.blocks, newblocks);
    const ret: BlockClass[] = [];
    for (const [i, block] of Object.entries(newblocks)) {
      if (Array.isArray(block) || block.topLevel) {
        ret.push(new BlockClass(i, this));
      }
    }
    return ret;
  }

  topBlocks(): BlockClass[] {
    const ret: BlockClass[] = [];
    for (const [i, block] of Object.entries(this._source.blocks)) {
      if (Array.isArray(block) || block.topLevel) {
        ret.push(new BlockClass(i, this));
      }
    }
    return ret;
  }

  block(id: string): BlockClass {
    return new BlockClass(id, this);
  }

  blockjson(): { [id: string]: BlockJSON } {
    return this._source.blocks;
  }

  allBlockId(): string[] {
    return Object.keys(this._source.blocks);
  }
}

export class BlockClass {
  _source: BlockJSON;

  constructor(public id: string, public target: TargetClass) {
    const source = target._source.blocks[id];
    if (source === undefined) {
      throw new Error();
    }
    this._source = source;
  }

  parentReplace(other: BlockClass | null) {
    this.parent()?._replace(this, other);
  }

  _replace(old: BlockClass, other: BlockClass | null) {
    if (Array.isArray(this._source)) {
      throw new Error();
    }
    const id = old.id;
    if (this.next()?.id === id) {
      this.next(other);
      return;
    }
    for (const name of Object.keys(this._source.inputs)) {
      const input = this.input(name);
      if (input.type === "block" && input.block.id === id) {
        if (other === null) {
          this.input(name, { type: "null" });
        } else {
          this.input(name, { type: "block", block: other });
        }
        return;
      }
      const input_2 = this.input_2(name);
      if (input_2.type === "block" && input_2.block.id === id) {
        if (other === null) {
          this.input_2(name, { type: "null" });
        } else {
          this.input_2(name, { type: "block", block: other });
        }
        return;
      }
    }
    throw new Error();
  }

  delete(below: boolean) {
    if (below) {
      this.parent(null);
    } else {
      this.pickout();
    }
    for (const name of this.inputs()) {
      const input = this.input(name);
      const input_2 = this.input_2(name);
      if (input.type === "block") {
        input.block.delete(true);
      }
      if (input_2.type === "block") {
        input_2.block.delete(true);
      }
    }
    this.next()?.delete(true);
    //console.log(this.id, this.target._source.blocks[this.id])
    delete this.target._source.blocks[this.id];
  }

  parent(other?: BlockClass | null, oneway = false): BlockClass | null {
    if (other !== undefined) {
      if (Array.isArray(this._source)) {
        throw new Error("变量和列表不能设置上一积木");
      }
      if (other !== null) {
        if (this.target !== other.target) {
          throw new Error("Target 不一致");
        }
      }
      if (!oneway) {
        this.parentReplace(null);
      }
      this._source.parent = other?.id ?? null;
      this._source.topLevel = this._source.parent === null;
    }
    if (Array.isArray(this._source)) {
      return null;
    }
    const parent = this._source.parent;
    return parent === null || parent === undefined
      ? null
      : new BlockClass(parent, this.target);
  }

  next(other?: BlockClass | null): BlockClass | null {
    if (other !== undefined) {
      if (Array.isArray(this._source)) {
        throw new Error("变量或者列表不能设置后一积木");
      }
      if (other !== null) {
        if (this.target !== other.target) {
          throw new Error("Target 不一致");
        }
      }
      this.next()?.parent(null, true);
      this._source.next = null;
      if (other !== null) {
        other.parent(this, true);
        this._source.next = other.id;
        //console.log(this.id, other.id);
      }
    }
    if (Array.isArray(this._source)) {
      return null;
    }
    const next = this._source.next;
    return next === undefined || next === null
      ? null
      : new BlockClass(next, this.target);
  }

  inputs(): string[] {
    if (Array.isArray(this._source)) {
      return [];
    }
    return Object.keys(this._source.inputs);
  }

  input(input: string, other?: InputType): InputType {
    if (Array.isArray(this._source)) {
      throw new Error("变量或者列表积木没有输入区域");
    }
    let inputo = this._source.inputs[input];
    if (inputo === undefined) {
      throw new Error("输入框名字错误");
    }
    if (other !== undefined) {
      let otherval;
      switch (other.type) {
        case "block":
          if (this.target !== other.block.target) {
            throw new Error("Target 不一致");
          }
          other.block.parent(this, true);
          otherval = other.block.id;
          break;
        case "array":
          otherval = other.array;
          break;
        case "null":
          otherval = null;
          break;
      }

      switch (inputo[0]) {
        case 1:
          if (otherval !== null) {
            if (inputo[1] === null) {
              inputo = [2, otherval];
            } else {
              inputo = [3, otherval, inputo[1]];
            }
            this._source.inputs[input] = inputo;
          }
          break;
        case 2:
          if (typeof inputo[1] === "string") {
            const blo = this.target.block(inputo[1]);
            blo?.parent(null, true);
          }
          inputo[1] = otherval;
          break;
        case 3:
          if (typeof inputo[1] === "string") {
            const blo = this.target.block(inputo[1]);
            blo?.parent(null, true);
          }
          if (otherval === null) {
            inputo = [1, inputo[2]];
            this._source.inputs[input] = inputo;
          } else {
            inputo[1] = otherval;
          }
      }
    }
    switch (inputo[0]) {
      case 1:
        return { type: "null" };
      case 2:
      case 3:
        if (inputo[1] === null) {
          return { type: "null" };
        } else if (Array.isArray(inputo[1])) {
          return { type: "array", array: inputo[1] };
        } else {
          return { type: "block", block: this.target.block(inputo[1]) };
        }
      default:
        throw new Error("文件格式有问题");
    }
  }

  input_2(input: string, other?: Input2Type): Input2Type {
    if (Array.isArray(this._source)) {
      throw new Error("变量或者列表积木没有输入区域");
    }
    let inputo = this._source.inputs[input];
    if (inputo === undefined) {
      throw new Error("输入框名字错误");
    }
    if (other !== undefined) {
      let otherval;
      switch (other.type) {
        case "block":
          if (this.target !== other.block.target) {
            throw new Error("Target 不一致");
          }
          other.block.parent(this, true);
          otherval = other.block.id;
          break;
        case "array":
          otherval = other.array;
          break;
        case "null":
          otherval = null;
          break;
      }

      switch (inputo[0]) {
        case 1:
          if (typeof inputo[1] === "string") {
            const blo = this.target.block(inputo[1]);
            blo?.parent(null, true);
          }
          inputo[1] = otherval;
          break;
        case 2:
          if (otherval !== null) {
            if (inputo[1] === null) {
              inputo = [1, otherval];
            } else {
              inputo = [3, inputo[1], otherval];
            }
            this._source.inputs[input] = inputo;
          }
          break;
        case 3:
          if (typeof inputo[2] === "string") {
            const blo = this.target.block(inputo[2]);
            blo?.parent(null, true);
          }
          if (otherval === null) {
            inputo = [2, inputo[1]];
            this._source.inputs[input] = inputo;
          } else {
            inputo[2] = otherval;
          }
      }
    }
    let outi: ShadowRef | null;
    switch (inputo[0]) {
      case 2:
        return { type: "null" };
      case 1:
        outi = inputo[1];
        break;
      case 3:
        outi = inputo[2];
        break;
      default:
        throw new Error("文件格式有问题");
    }
    if (outi === null) {
      return { type: "null" };
    } else if (Array.isArray(outi)) {
      return { type: "array", array: outi };
    } else {
      return { type: "block", block: this.target.block(outi) };
    }
  }

  inputvalue(input: string, value?: string | number): string | number | null {
    if (Array.isArray(this._source)) {
      throw new Error("变量或者列表积木没有输入区域");
    }
    const inputo = this._source.inputs[input];
    if (inputo === undefined) {
      throw new Error("输入框名字错误");
    }
    let valueRef: BlockRef | ShadowRef | null = null;
    switch (inputo[0]) {
      case 1:
        valueRef = inputo[1];
        break;
      case 2:
        valueRef = null;
        break;
      case 3:
        valueRef = inputo[2];
        break;
      default:
        throw new Error("文件格式有问题");
    }
    if (valueRef !== null) {
      if (typeof valueRef === "string") {
        const shadow = this.target.block(valueRef);
        if (shadow === null) {
          throw new Error("菜单积木丢失");
        }
        const field = shadow.fields()[0];
        if (field === undefined) {
          throw new Error("菜单积木无选项");
        }
        if (value !== undefined) {
          shadow.fieldvalue(field, value);
        }
        return shadow.fieldvalue(field);
      } else {
        switch (valueRef[0]) {
          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 9:
          case 10:
            if (value !== undefined) {
              valueRef[1] = value;
            }
            return valueRef[1];
          case 11:
            if (value !== undefined) {
              if (typeof value !== "string") {
                throw new Error("广播积木异常");
              }
              valueRef[1] = value;
              valueRef[2] = this.target.broadcast(value).id;
            }
            return valueRef[1];
          default:
            throw new Error("文件格式有问题");
        }
      }
    } else {
      if (value !== undefined) {
        throw new Error("输入框不能设置底值");
      }
      return null;
    }
  }

  fields(): string[] {
    if (Array.isArray(this._source)) {
      return [];
    }
    return Object.keys(this._source.fields);
  }

  fieldvalue(field: string, value?: string | number): string | number {
    if (Array.isArray(this._source)) {
      throw new Error();
    }
    const fieldo = this._source.fields[field];
    if (fieldo === undefined) {
      throw new Error();
    }
    if (value !== undefined) {
      if (typeof value !== "string") {
        throw new Error();
      }
      fieldo[0] = value;
      switch (field) {
        case "VARIABLE":
          fieldo[1] = this.target.variable(value, "").id;
          break;
        case "LIST":
          fieldo[1] = this.target.list(value, []).id;
          break;
        case "BROADCAST_OPTION":
          fieldo[1] = this.target.broadcast(value).id;
          break;
        default:
          fieldo[1] = null;
      }
    }
    return fieldo[0];
  }

  procinput(index: number): string {
    if (Array.isArray(this._source)) {
      throw new Error();
    }
    const idstr = this._source.mutation?.argumentids;
    if (typeof idstr !== "string") {
      throw new Error();
    }
    const ids = JSON.parse(idstr);
    const id = ids[index];
    if (id === undefined) {
      throw new Error();
    }
    return id;
  }

  bfs(func: (block: BlockClass) => BfsBlockReturn) {
    //console.log("bfs", this.id, this._source);
    const ret: BfsBlockReturn = func(this);
    //console.log(ret);
    if (ret === "delete") {
      const next = this.next();
      if (next !== null) {
        next.bfs(func);
      }
      this.delete(false);
      return;
    }
    if (ret === "deletebelow") {
      this.delete(true);
      return;
    }
    if (ret === "input" || ret === "substack") {
      for (const name of this.inputs()) {
        if (ret === "input" || name.startsWith("SUBSTACK")) {
          const substack = this.input(name);
          if (substack.type === "block") {
            substack.block.bfs(func);
          }
        }
      }
    }
    if (ret !== "parent") {
      const next = this.next();
      if (next !== null) {
        next.bfs(func);
      }
    }
  }

  insertBefore(other: BlockClass) {
    if (
      other.parent() === null &&
      !Array.isArray(this._source) &&
      !Array.isArray(other._source)
    ) {
      this._source.x = other._source.x;
      this._source.y = other._source.y;
    }
    other.parentReplace(this);
    this.next(other);
  }

  pickout() {
    const next = this.next();
    this.next(null);
    this.parentReplace(next);
    //console.log(this)
  }
}

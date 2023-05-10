import JSZip from "jszip";

export default class loader {
  sb3zip: JSZip | null = null;
  sb3json: any = null;
  async load(sb3file: ArrayBuffer): Promise<any> {
    this.sb3zip = await JSZip.loadAsync(sb3file);
    const project = this.sb3zip.files["project.json"];
    if (project === undefined) {
      throw new Error("文件无 project.json");
    }
    this.sb3json = JSON.parse(await project.async("string"));
    return this.sb3json;
  }
  async save(sb3json: any): Promise<ArrayBuffer> {
    if (this.sb3zip === null) {
      throw new Error("Zip not loaded");
    }
    this.sb3json = sb3json;
    this.sb3zip.file("project.json", JSON.stringify(this.sb3json));
    return await this.sb3zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9,
      },
    });
  }
}

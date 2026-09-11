import * as THREE from "three";

export type BrMaterialKey =
  | "structuralWhite"
  | "structuralDark"
  | "paintedMetal"
  | "brushedMetal"
  | "glass"
  | "windowDark"
  | "windowLit"
  | "road"
  | "concrete"
  | "sidewalk"
  | "grass"
  | "soil"
  | "hologram"
  | "energyCyan"
  | "energyPurple"
  | "industrialOrange"
  | "warningRed"
  | "solarPanel"
  | "cargoMetal"
  | "interiorFloor"
  | "interiorWall";

type SignOptions = {
  foreground?: string;
  background?: string;
  border?: string;
  subtitle?: string;
};

export class BrMaterialLibrary {
  private readonly materials = new Map<string, THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();
  private disposed = false;

  readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  readonly unitChamferedBox = createChamferedBoxGeometry();
  readonly unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  readonly unitOctahedron = new THREE.OctahedronGeometry(1, 1);
  readonly unitPlane = new THREE.PlaneGeometry(1, 1);

  constructor() {
    this.materials.set("structuralWhite", this.standard(0xe4edf0, .34, .28));
    this.materials.set("structuralDark", this.standard(0x101a2c, .32, .76));
    this.materials.set("paintedMetal", this.standard(0x344b67, .44, .56));
    this.materials.set("brushedMetal", this.standard(0x899aa8, .26, .82));
    this.materials.set("glass", new THREE.MeshPhysicalMaterial({
      color: 0x66b8d7, roughness: .1, metalness: .06, transparent: true,
      opacity: .34, transmission: .16, depthWrite: false, side: THREE.DoubleSide
    }));
    this.materials.set("windowDark", this.standard(0x071322, .14, .52, 0x06152a, .36));
    this.materials.set("windowLit", this.standard(0xffd898, .21, .18, 0xffad55, .66));
    this.materials.set("road", this.standard(0x1c2939, .84, .14));
    this.materials.set("concrete", this.standard(0x64727b, .78, .06));
    this.materials.set("sidewalk", this.standard(0xa9b7bc, .74, .1));
    this.materials.set("grass", this.standard(0x3d8c68, .92, .02));
    this.materials.set("soil", this.standard(0x654b3e, .96, 0));
    this.materials.set("hologram", this.basic(0x63efff, .56));
    this.materials.set("energyCyan", this.basic(0x60efff, .9));
    this.materials.set("energyPurple", this.basic(0xac65ff, .82));
    this.materials.set("industrialOrange", this.standard(0xe88135, .5, .48));
    this.materials.set("warningRed", this.standard(0xd8484f, .45, .38, 0x7d131e, .38));
    this.materials.set("solarPanel", this.standard(0x173d66, .18, .66, 0x071d3a, .38));
    this.materials.set("cargoMetal", this.standard(0x7d4d35, .66, .58));
    this.materials.set("interiorFloor", this.standard(0x263548, .78, .18));
    this.materials.set("interiorWall", this.standard(0xb7c6cb, .8, .08));
    this.applySurfaceDetail(["structuralWhite", "paintedMetal", "brushedMetal", "cargoMetal"], this.createSurfaceTexture("panel"), .025);
    this.applySurfaceDetail(["concrete", "sidewalk", "interiorFloor", "interiorWall"], this.createSurfaceTexture("grid"), .018);
    this.applySurfaceDetail(["road"], this.createSurfaceTexture("road"), .012);
  }

  get(key: BrMaterialKey): THREE.Material {
    const material = this.materials.get(key);
    if (!material) throw new Error(`Unknown BR material: ${key}`);
    return material;
  }

  own<T extends THREE.Material>(material: T): T {
    this.materials.set(`owned:${this.materials.size}`, material);
    return material;
  }

  accent(color: THREE.ColorRepresentation, emissive = .15): THREE.MeshStandardMaterial {
    const key = `accent:${String(color)}:${emissive}`;
    const cached = this.materials.get(key);
    if (cached) return cached as THREE.MeshStandardMaterial;
    const next = this.standard(color, .4, .42, color, emissive);
    this.materials.set(key, next);
    return next;
  }

  translucent(color: THREE.ColorRepresentation, opacity: number, additive = false): THREE.MeshBasicMaterial {
    const key = `translucent:${String(color)}:${opacity}:${additive}`;
    const cached = this.materials.get(key);
    if (cached) return cached as THREE.MeshBasicMaterial;
    const next = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.materials.set(key, next);
    return next;
  }

  createSign(text: string, options: SignOptions = {}): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = options.subtitle ? 160 : 128;
    const context = canvas.getContext("2d")!;
    const foreground = options.foreground ?? "#f5fbff";
    const background = options.background ?? "rgba(7, 15, 31, .92)";
    const border = options.border ?? "#62efff";
    context.fillStyle = background;
    this.roundRect(context, 8, 8, 496, canvas.height - 16, 24);
    context.fill();
    context.strokeStyle = border;
    context.lineWidth = 7;
    this.roundRect(context, 11, 11, 490, canvas.height - 22, 21);
    context.stroke();
    context.fillStyle = foreground;
    context.font = "800 48px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, options.subtitle ? 61 : 65, 462);
    if (options.subtitle) {
      context.fillStyle = border;
      context.font = "700 24px system-ui, sans-serif";
      context.fillText(options.subtitle, 256, 116, 460);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    this.textures.add(texture);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
    this.materials.set(`sign:${this.materials.size}`, material);
    const sprite = new THREE.Sprite(material);
    sprite.userData.brSign = true;
    return sprite;
  }

  createPanelTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#e3ecef";
    context.fillRect(0, 0, 256, 256);
    context.strokeStyle = "rgba(35, 55, 75, .23)";
    context.lineWidth = 3;
    for (let position = 0; position <= 256; position += 64) {
      context.beginPath(); context.moveTo(position, 0); context.lineTo(position, 256); context.stroke();
      context.beginPath(); context.moveTo(0, position); context.lineTo(256, position); context.stroke();
    }
    context.fillStyle = "rgba(13, 33, 54, .2)";
    for (let y = 12; y < 256; y += 64) for (let x = 12; x < 256; x += 64) context.fillRect(x, y, 5, 5);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    this.textures.add(texture);
    return texture;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const material of new Set(this.materials.values())) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.unitBox.dispose();
    this.unitChamferedBox.dispose();
    this.unitCylinder.dispose();
    this.unitOctahedron.dispose();
    this.unitPlane.dispose();
    this.materials.clear();
    this.textures.clear();
  }

  private standard(
    color: THREE.ColorRepresentation,
    roughness: number,
    metalness: number,
    emissive?: THREE.ColorRepresentation,
    emissiveIntensity = 0
  ): THREE.MeshStandardMaterial {
    const parameters: THREE.MeshStandardMaterialParameters = { color, roughness, metalness };
    if (emissive !== undefined) { parameters.emissive = emissive; parameters.emissiveIntensity = emissiveIntensity; }
    return new THREE.MeshStandardMaterial(parameters);
  }

  private basic(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
      blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending
    });
  }

  private applySurfaceDetail(keys: BrMaterialKey[], texture: THREE.CanvasTexture, scale: number): void {
    for (const key of keys) {
      const material = this.get(key) as THREE.MeshStandardMaterial;
      material.bumpMap = texture;
      material.bumpScale = scale;
      material.roughnessMap = texture;
      material.needsUpdate = true;
    }
  }

  private createSurfaceTexture(kind: "panel" | "grid" | "road"): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#d8d8d8";
    context.fillRect(0, 0, 256, 256);
    const random = seededNoise(kind === "panel" ? 341 : kind === "grid" ? 947 : 1771);
    for (let index = 0; index < 520; index++) {
      const shade = 170 + Math.floor(random() * 70);
      context.fillStyle = `rgba(${shade},${shade},${shade},.16)`;
      const size = random() > .88 ? 2 : 1;
      context.fillRect(Math.floor(random() * 256), Math.floor(random() * 256), size, size);
    }
    context.strokeStyle = kind === "road" ? "rgba(52,52,52,.24)" : "rgba(65,73,82,.22)";
    context.lineWidth = kind === "road" ? 3 : 2;
    const spacing = kind === "panel" ? 64 : kind === "grid" ? 48 : 128;
    for (let value = spacing; value < 256; value += spacing) {
      context.beginPath(); context.moveTo(value, 0); context.lineTo(value, 256); context.stroke();
      context.beginPath(); context.moveTo(0, value); context.lineTo(256, value); context.stroke();
    }
    if (kind === "panel") {
      context.fillStyle = "rgba(48,58,70,.32)";
      for (let y = 8; y < 256; y += 64) for (let x = 8; x < 256; x += 64) context.fillRect(x, y, 4, 4);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    this.textures.add(texture);
    return texture;
  }

  private roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }
}

function createChamferedBoxGeometry(): THREE.ExtrudeGeometry {
  const inset = .12;
  const shape = new THREE.Shape();
  shape.moveTo(-.5 + inset, -.5);
  shape.lineTo(.5 - inset, -.5);
  shape.lineTo(.5, -.5 + inset);
  shape.lineTo(.5, .5 - inset);
  shape.lineTo(.5 - inset, .5);
  shape.lineTo(-.5 + inset, .5);
  shape.lineTo(-.5, .5 - inset);
  shape.lineTo(-.5, -.5 + inset);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -.5);
  // ExtrudeGeometry is authored in XY. Rotate it so the chamfered polygon is
  // the horizontal footprint and Y remains the vertical building axis.
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function seededNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ state >>> 15, 1 | state);
    state ^= state + Math.imul(state ^ state >>> 7, 61 | state);
    return ((state ^ state >>> 14) >>> 0) / 4294967296;
  };
}

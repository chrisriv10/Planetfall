import * as THREE from "three";

/** Canonical Planetfall astronaut construction shared by every game mode. */
export type AstronautVisual = {
  group: THREE.Group;
  torso: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  helmet: THREE.Group;
  visor: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  backpack: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  suitMaterial: THREE.MeshStandardMaterial;
  lodDetails: THREE.Object3D[];
};

export type AstronautOptions = {
  identityColor: string;
  suitAccent: string;
  isBot: boolean;
  castShadow?: boolean;
};

export function createAstronautVisual(options: AstronautOptions): AstronautVisual {
  const group = new THREE.Group();
  const lodDetails: THREE.Object3D[] = [];
  const castShadow = options.castShadow ?? false;
  const suit = new THREE.MeshStandardMaterial({ color: options.suitAccent, roughness: .58, flatShading: true });
  const white = new THREE.MeshStandardMaterial({ color: 0xf0f6ff, roughness: .48, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x202747, roughness: .72, flatShading: true });
  const glow = new THREE.MeshStandardMaterial({ color: options.identityColor, emissive: options.identityColor, emissiveIntensity: .75, metalness: .25, roughness: .3 });
  const visorMaterial = new THREE.MeshStandardMaterial({ color: 0x102344, metalness: .82, roughness: .12, emissive: 0x0b4167, emissiveIntensity: .6 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.48, .52, 5, 9), white);
  torso.position.y = .72;
  torso.scale.set(1.06, 1, .92);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(.62, .36, .12), suit);
  chest.position.set(0, .82, .43);
  const chestLight = new THREE.Mesh(new THREE.BoxGeometry(.3, .07, .025), glow);
  chestLight.position.set(0, .86, .505);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(.43, .075, 5, 10), dark);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = .45;
  belt.scale.z = .78;

  const helmet = new THREE.Group();
  helmet.position.y = 1.46;
  const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(.56, 12, 9), white);
  helmetShell.scale.set(1.02, .98, .98);
  const helmetBand = new THREE.Mesh(new THREE.TorusGeometry(.48, .055, 5, 12), suit);
  helmetBand.rotation.x = Math.PI / 2;
  helmetBand.position.y = -.18;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(.43, 12, 8, 0, Math.PI * 2, 0, Math.PI * .58), visorMaterial);
  visor.position.set(0, .02, .31);
  visor.scale.set(.98, .74, .42);
  const visorGlint = new THREE.Mesh(new THREE.SphereGeometry(.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0xbef8ff, transparent: true, opacity: .75 }));
  visorGlint.position.set(-.2, .17, .58);
  visorGlint.scale.set(1.8, .6, .35);
  helmet.add(helmetShell, helmetBand, visor, visorGlint);
  lodDetails.push(chestLight, belt, helmetBand, visorGlint);

  const backpack = new THREE.Group();
  backpack.position.set(0, .86, -.45);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(.66, .74, .32), dark);
  pack.scale.z = 1.12;
  const tankMaterial = new THREE.MeshStandardMaterial({ color: 0xa9bad9, metalness: .45, roughness: .35 });
  for (const x of [-.22, .22]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .56, 7), tankMaterial);
    tank.position.set(x, .02, -.22);
    backpack.add(tank);
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(.1, .2, 7, 1, true), glow);
    nozzle.rotation.x = Math.PI;
    nozzle.position.set(x, -.39, -.22);
    backpack.add(nozzle);
    lodDetails.push(tank, nozzle);
  }
  backpack.add(pack);

  const limbGeometry = new THREE.CapsuleGeometry(.13, .4, 3, 7);
  const bootGeometry = new THREE.SphereGeometry(.24, 8, 6);
  const makeLeg = (x: number): THREE.Group => {
    const rig = new THREE.Group();
    rig.position.set(x, .48, 0);
    const leg = new THREE.Mesh(limbGeometry, dark);
    leg.position.y = -.25;
    const knee = new THREE.Mesh(new THREE.SphereGeometry(.15, 7, 5), suit);
    knee.position.set(0, -.28, .1);
    const boot = new THREE.Mesh(bootGeometry, white);
    boot.position.set(0, -.58, .13);
    boot.scale.set(1.05, .72, 1.5);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(.36, .08, .48), dark);
    sole.position.set(0, -.73, .18);
    lodDetails.push(knee, sole);
    rig.add(leg, knee, boot, sole);
    return rig;
  };
  const makeArm = (x: number): THREE.Group => {
    const rig = new THREE.Group();
    rig.position.set(x, 1.02, 0);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(.19, 7, 5), suit);
    shoulder.scale.set(1.2, .8, 1);
    const arm = new THREE.Mesh(limbGeometry, dark);
    arm.position.y = -.27;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .14, 7), suit);
    cuff.position.y = -.48;
    const glove = new THREE.Mesh(new THREE.SphereGeometry(.18, 7, 5), white);
    glove.position.y = -.61;
    lodDetails.push(shoulder, cuff);
    rig.add(shoulder, arm, cuff, glove);
    rig.rotation.z = x > 0 ? -.17 : .17;
    return rig;
  };
  const leftLeg = makeLeg(-.26);
  const rightLeg = makeLeg(.26);
  const leftArm = makeArm(-.57);
  const rightArm = makeArm(.57);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .38, 5), white);
  antenna.position.set(.3, .39, -.05);
  antenna.rotation.z = -.2;
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(.075, 6, 4), new THREE.MeshBasicMaterial({ color: options.isBot ? 0xff7f9b : options.identityColor }));
  antennaTip.position.set(.34, .6, -.05);
  helmet.add(antenna, antennaTip);
  lodDetails.push(antenna, antennaTip);

  group.add(torso, chest, chestLight, belt, helmet, backpack, leftLeg, rightLeg, leftArm, rightArm);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = castShadow;
  });
  return { group, torso, helmet, visor, backpack, leftArm, rightArm, leftLeg, rightLeg, suitMaterial: suit, lodDetails };
}

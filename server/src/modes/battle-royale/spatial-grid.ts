import type { Vec3 } from "@planetfall/shared";

export class SpatialGrid<T extends { id: string; position: Vec3 }> {
  private cells = new Map<string, T[]>();
  constructor(readonly cellSize: number) {}

  rebuild(values: Iterable<T>): void {
    this.cells.clear();
    for (const value of values) {
      const key = this.key(value.position);
      const cell = this.cells.get(key);
      if (cell) cell.push(value); else this.cells.set(key, [value]);
    }
  }

  nearby(position: Vec3, radius: number): T[] {
    const minX = Math.floor((position.x - radius) / this.cellSize);
    const maxX = Math.floor((position.x + radius) / this.cellSize);
    const minY = Math.floor((position.y - radius) / this.cellSize);
    const maxY = Math.floor((position.y + radius) / this.cellSize);
    const minZ = Math.floor((position.z - radius) / this.cellSize);
    const maxZ = Math.floor((position.z + radius) / this.cellSize);
    const result: T[] = [];
    const radiusSq = radius * radius;
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      for (const value of this.cells.get(`${x}:${y}:${z}`) ?? []) {
        const dx = value.position.x - position.x; const dy = value.position.y - position.y; const dz = value.position.z - position.z;
        if (dx * dx + dy * dy + dz * dz <= radiusSq) result.push(value);
      }
    }
    return result;
  }

  private key(position: Vec3): string {
    return `${Math.floor(position.x / this.cellSize)}:${Math.floor(position.y / this.cellSize)}:${Math.floor(position.z / this.cellSize)}`;
  }
}

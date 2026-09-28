import { Animal } from './Animal'
import type { Vec3 } from '../core/math'

export const createPig = (pos: Vec3): Animal => new Animal('pig', pos)

import { describe, expect, it } from 'vitest';
import { quedaExcessiva } from '../pipeline/qualidade/trava-volume';

describe('trava de volume', () => {
  it('bloqueia queda acima de 30%', () => expect(quedaExcessiva(100, 69)).toBe(true));
  it('permite queda de até 30%', () => expect(quedaExcessiva(100, 70)).toBe(false));
  it('ignora primeira execução', () => expect(quedaExcessiva(0, 50)).toBe(false));
});

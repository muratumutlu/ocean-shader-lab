import {describe,it,expect} from 'vitest';
const modulePath = '../../src/scene/terrain.ts';
const api = await import(modulePath).catch(() => ({}));
describe('shared coastal terrain',()=>{
  it('sameSeedProducesSameTerrain: procedural shoreline is reproducible',()=>{
    expect(api.createTerrain).toBeTypeOf('function');
    const a=api.createTerrain(7), b=api.createTerrain(7);
    expect(Array.from(a.heightTexture.image.data)).toEqual(Array.from(b.heightTexture.image.data));
    a.dispose();b.dispose();
  });
  it('sampleHeightMatchesTextureAtGridNodes: water cannot detach from CPU terrain',()=>{
    expect(api.createTerrain).toBeTypeOf('function');
    const t=api.createTerrain(7), size=t.heightTexture.image.width, data=t.heightTexture.image.data;
    for (const [i,j] of [[0,0],[24,32],[64,64],[96,72],[128,128]]) {
      const x=-16+i/(size-1)*32, z=-12+j/(size-1)*24;
      expect(t.sampleHeight(x,z)).toBeCloseTo(data[j*size+i],5);
    }
    t.dispose();
  });
  it('shoreAndRocksShareFiniteWorldCoordinates: boundaries stay within their common tile',()=>{
    expect(api.createTerrain).toBeTypeOf('function');
    const t=api.createTerrain(7);
    const data=Array.from(t.heightTexture.image.data) as number[];
    expect(data.every(Number.isFinite)).toBe(true);
    expect(Math.min(...data)).toBeGreaterThanOrEqual(-3.1);
    expect(Math.max(...data)).toBeLessThan(5);
    expect(Array.from(t.rockMaskTexture.image.data).every((v:any)=>v>=0&&v<=1)).toBe(true);
    // Back dunes emerge; foreground seabed stays under the default tide.
    expect(t.sampleHeight(0,-10)).toBeGreaterThan(1);
    expect(t.sampleHeight(0,10)).toBeLessThan(-1);
    t.dispose();
  });
});

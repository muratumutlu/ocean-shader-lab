import {it,expect} from 'vitest';
import {inputVector} from '../../src/input/mode-controller';
it('routes arrows, WASD, vertical and fast movement without diagonal inflation',()=>{
 expect(inputVector(new Set(['ArrowUp','KeyD','KeyE','ShiftLeft']))).toMatchObject({forward:1,right:1,vertical:1,fast:true,active:true});
 expect(inputVector(new Set(['ArrowUp','ArrowDown']))).toMatchObject({forward:0,active:false});
 expect(inputVector(new Set(['Tab','KeyP']))).toMatchObject({forward:0,right:0,vertical:0,active:false});
});

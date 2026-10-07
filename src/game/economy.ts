// Browser mirror of OceanFocusCore's Economy/GameEngine rules. The catalog JSON is shared
// with the Swift package so prices and effects have a single source.
import catalogJson from '../../OceanFocusCore/Sources/OceanFocusCore/Resources/Catalog.json';

export type UpgradeCategory='equipment'|'boat'|'crew';
export type Upgrade={id:string;name:string;category:UpgradeCategory;price:number;effect:{fishMultiplier?:number;moneyBonus?:number};requires:string[]};
export type Region={id:string;name:string;fishPrice:number;unlockPrice:number;available:boolean;requiresLicense:boolean;upgrades:Upgrade[]};
export type Catalog={version:number;regions:Region[]};
export type Modifiers={fishMultiplier:number;moneyBonus:number};

export const CATALOG=catalogJson as Catalog;
export const PRESETS=[15,25,45,60] as const;
export type Preset=typeof PRESETS[number];
const EPSILON=1e-9;
const BASE_FISH_PER_25=10;

export function durationMultiplier(minutes:number):number{
 return ({15:.55,25:1,45:2.2,60:3} as Record<number,number>)[minutes]??minutes/25;
}
export function fishFor(minutes:number,modifiers:Modifiers):number{
 return Math.floor(BASE_FISH_PER_25*durationMultiplier(minutes)*modifiers.fishMultiplier+EPSILON);
}
export function moneyFor(fish:number,fishPrice:number,modifiers:Modifiers):number{
 return Math.floor(fish*fishPrice*(1+modifiers.moneyBonus)+EPSILON);
}
export function region(id:string):Region{
 const found=CATALOG.regions.find(r=>r.id===id);if(!found)throw Error('Unknown region '+id);return found;
}
export function modifiersFor(regionId:string,owned:ReadonlySet<string>):Modifiers{
 const result={fishMultiplier:1,moneyBonus:0};
 for(const upgrade of region(regionId).upgrades)if(owned.has(upgrade.id)){result.fishMultiplier*=upgrade.effect.fishMultiplier??1;result.moneyBonus+=upgrade.effect.moneyBonus??0;}
 return result;
}
/** Unowned upgrades whose requirements are met, affordable or not. */
export function purchasable(regionId:string,owned:ReadonlySet<string>):Upgrade[]{
 return region(regionId).upgrades.filter(u=>!owned.has(u.id)&&u.requires.every(r=>owned.has(r)));
}

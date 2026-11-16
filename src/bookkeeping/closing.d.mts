import type {BookState} from './engine.mjs';
export interface CloseCheck {id:string;label:string;detail:string;currency:string;status:'pass'|'block'|'review'}
export interface CloseReadiness {asOf:string;baseCurrency:string;currencies:string[];checks:CloseCheck[];blocking:CloseCheck[];ready:boolean;closedThrough:string|null}
export function monthEnd(month:string):string;
export function monthAfter(date:string):string;
export function closingReadiness(state:BookState,asOf:string,baseCurrency?:string,today?:string|null):CloseReadiness;

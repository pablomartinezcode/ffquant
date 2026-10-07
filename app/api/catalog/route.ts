import { dataset, json, failure } from '@/lib/server';
export async function GET(){try{return json(await dataset());}catch(e){return failure(e,503);}}

'use client';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
export function Choice({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:[string,string][]}){return <label className="choice"><span>{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{options.map(([v,t])=><SelectItem value={v} key={v}>{t}</SelectItem>)}</SelectContent></Select></label>;}
export function Pos({p}:{p:string}){return <span className={`pos pos-${p}`}>{p}</span>;}
export const fmt=(n:number|null|undefined,d=1)=>n==null?'—':n.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
export async function api<T>(url:string,body?:unknown,signal?:AbortSignal):Promise<T>{const r=await fetch(url,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});const d=await r.json();if(!r.ok)throw new Error((d as {error?:string}).error??`Request failed (${r.status})`);return d as T;}


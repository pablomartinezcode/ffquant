import { seedDataset } from '@/lib/dataset';
import { Workbench } from './workbench';
export default function Home(){ return <Workbench dataset={seedDataset}/>; }

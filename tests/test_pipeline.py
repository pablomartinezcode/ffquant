import unittest,json,csv,hashlib
from pathlib import Path
from pipeline.build import forecast,fantasy,ROOT

class DataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((ROOT/'data'/'catalog.json').read_text())
    def test_all_seasons_and_unique_ids(self):
        m=self.data['manifest'];self.assertEqual([c['season'] for c in m['coverage']],list(range(1999,m['season']+1)))
        players=self.data['players'];self.assertEqual(len({p['id'] for p in players}),len(players));self.assertEqual(len({p['sleeperId'] for p in players}),len(players))
    def test_authoritative_mapping_of_newer_players(self):
        for name in ['Bucky Irving','Omarion Hampton','Josh Allen']:
            p=next(p for p in self.data['players'] if p['name']==name);self.assertNotEqual(p['mapping'],'unmatched');self.assertGreater(p['gamesThisSeason'],0)
    def test_source_totals_reconcile(self):
        year=self.data['manifest']['season']
        with (ROOT/'.data-cache'/f'stats_player_week_{year}.csv').open() as source:rows=list(csv.DictReader(source))
        for name in ['Josh Allen','Jahmyr Gibbs','Jaxon Smith-Njigba']:
            p=next(p for p in self.data['players'] if p['name']==name);detail=json.loads((ROOT/'public'/'data'/'players'/f"{p['id']}.json").read_text());s=next(s for s in detail['seasons'] if s['season']==year)
            for key in ['passing_yards','rushing_yards','receiving_yards','receptions','targets']:
                total=sum(float(r[key] or 0) for r in rows if r['player_id']==p['id'] and r['season_type']=='REG');self.assertAlmostEqual(s['stats'][key],total)
    def test_retired_players_remain_in_history(self):
        h=json.loads((ROOT/'public'/'data'/'history'/'2006.json').read_text());self.assertTrue(any('Tomlinson' in p['name'] for p in h))
    def test_empty_history_priors_are_explicit(self):
        fc,form,n,confidence=forecast([],'WR',2026,1);self.assertIsNone(form);self.assertEqual(n,0);self.assertEqual(confidence,'low');self.assertGreater(fc['targets'],0)
    def test_artifact_checksums(self):
        artifacts=self.data['manifest'].get('artifacts',{});self.assertGreater(len(artifacts),3000)
        for key,sha in artifacts.items():self.assertEqual(hashlib.sha256((ROOT/'public'/'data'/key).read_bytes()).hexdigest(),sha)
    def test_no_duplicate_player_weeks(self):
        for p in self.data['players'][:100]:
            detail=json.loads((ROOT/'public'/'data'/'players'/f"{p['id']}.json").read_text());keys=[(g['season'],g['week']) for g in detail['weekly']];self.assertEqual(len(keys),len(set(keys)))
if __name__=='__main__':unittest.main()

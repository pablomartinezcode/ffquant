import copy, unittest
from pipeline.build import forecast,fantasy,FIELDS

def game(year,week,**stats):
    return {'season':year,'week':week,'stats':{k:stats.get(k,0) for k in FIELDS}}

class ForecastTests(unittest.TestCase):
    def setUp(self):
        self.base={'carries':15,'rushing_yards':60,'rushing_tds':.4,'targets':4,'receptions':3,'receiving_yards':24,'receiving_tds':.1}
        self.games=[game(2025,i,**self.base) for i in range(1,18)]+[game(2026,i,**self.base) for i in range(1,4)]
    def test_touchdown_spike_is_damped_and_long_term_moves_less(self):
        old=forecast(self.games,'RB',2026)[0]
        spike=self.games+[game(2026,4,**{**self.base,'rushing_tds':3})]
        new=forecast(spike,'RB',2026)[0];future=forecast(spike,'RB',2026,long_term=True)[0]
        # A 15.6-point extra TD event must not create a multi-point every-game forecast jump.
        self.assertGreater(fantasy(new),fantasy(old))
        self.assertLess(fantasy(new)-fantasy(old),1.2)
        self.assertLess(fantasy(future)-fantasy(old),fantasy(new)-fantasy(old))
        self.assertEqual(new['carries'],old['carries'])
    def test_sustained_opportunity_still_moves_quickly_both_directions(self):
        baseline=forecast(self.games,'RB',2026)[0]
        up={k:v*1.7 for k,v in self.base.items()};down={k:v*.3 for k,v in self.base.items()}
        one=forecast(self.games+[game(2026,4,**up)],'RB',2026)[0]
        repeated=self.games+[game(2026,i,**up) for i in range(4,10)]
        new=forecast(repeated,'RB',2026)[0];future=forecast(repeated,'RB',2026,long_term=True)[0]
        low=forecast(self.games+[game(2026,i,**down) for i in range(4,10)],'RB',2026)[0]
        self.assertGreater(fantasy(new),fantasy(one))
        self.assertGreater(new['carries'],baseline['carries']*1.3)
        self.assertGreater(future['carries'],baseline['carries']*1.2)
        self.assertLess(low['carries'],baseline['carries']*.7)
    def test_one_old_backup_game_is_not_an_established_prior(self):
        one=forecast([game(2025,1,attempts=40,passing_yards=450,passing_tds=5)],'QB',2026)[0]
        self.assertLess(one['passing_yards'],250)
        self.assertGreater(forecast([],'QB',2026,1)[0]['passing_yards'],0)
    def test_observed_scores_and_nulls_are_untouched(self):
        games=copy.deepcopy(self.games);games[-1]['stats']['receiving_yards']=None
        before=copy.deepcopy(games);fc=forecast(games,'RB',2026)[0]
        self.assertEqual(games,before);self.assertTrue(all(v is not None for v in fc.values()))
        self.assertLessEqual(fc['receptions'],fc['targets'])

if __name__=='__main__':unittest.main()

import unittest
from pipeline.build import forecast, FIELDS, fantasy
from pipeline.season_transition import opening_signals

def game(year,week,carries=10,targets=3,tds=.2):
    stats={k:0 for k in FIELDS}
    stats.update(carries=carries,targets=targets,receptions=targets*.7,rushing_yards=carries*4,receiving_yards=targets*6,rushing_tds=tds)
    return {'season':year,'week':week,'team':'KC','stats':stats}

class SeasonTransitionTests(unittest.TestCase):
    def setUp(self):
        self.prior=[game(2025,i) for i in range(1,18)]
        self.bases={'carries':10,'targets':3,'attempts':0}
    def signal(self,games):return opening_signals(games,'RB',2026,self.bases)
    def test_opening_single_spike_and_touchdown_only_changes_do_not_trigger(self):
        self.assertFalse(self.signal(self.prior+[game(2026,1,carries=40,tds=4)]))
        games=self.prior+[game(2026,i,tds=3) for i in range(1,5)]
        self.assertFalse(self.signal(games))
        self.assertEqual(forecast(games,'RB',2026)[0],forecast(games,'RB',2026,season_adaptation=False)[0])
    def test_sustained_new_season_shift_reduces_prior_weight_both_directions(self):
        for volume,direction in [(22,'up'),(2,'down')]:
            games=self.prior+[game(2026,i,carries=volume) for i in range(1,5)]
            signal=next(s for s in self.signal(games) if s['metric']=='carries')
            self.assertEqual(signal['direction'],direction)
            self.assertGreater(signal['priorReduction'],0)
            old=forecast(games,'RB',2026,season_adaptation=False)[0]
            new=forecast(games,'RB',2026)[0]
            self.assertLess(abs(new['carries']-volume),abs(old['carries']-volume))
            future=forecast(games,'RB',2026,long_term=True)[0]
            old_future=forecast(games,'RB',2026,long_term=True,season_adaptation=False)[0]
            self.assertLess(abs(future['carries']-volume),abs(old_future['carries']-volume))
    def test_rate_shrinkage_survives_opportunity_reset(self):
        games=self.prior+[game(2026,i,carries=22) for i in range(1,5)]
        old=forecast(games,'RB',2026,season_adaptation=False)[0];new=forecast(games,'RB',2026)[0]
        for metric in ('rushing_yards','rushing_tds'):
            self.assertAlmostEqual(new[metric]/new['carries'],old[metric]/old['carries'],places=5)
        spike=games+[game(2026,5,carries=22,tds=3)]
        self.assertLess(fantasy(forecast(spike,'RB',2026)[0])-fantasy(new),1.5)
    def test_midseason_changes_do_not_invent_a_season_reset(self):
        games=self.prior+[game(2026,i) for i in range(1,7)]+[game(2026,i,carries=25) for i in range(7,11)]
        self.assertFalse(self.signal(games))
        opening=self.prior+[game(2026,i,carries=22) for i in range(1,5)]
        self.assertEqual(self.signal(opening),self.signal(opening+[game(2026,i,carries=10) for i in range(7,12)]))
    def test_missing_samples_and_sparse_priors_do_not_count_as_evidence(self):
        games=self.prior+[game(2026,i,carries=22) for i in range(1,5)]
        games[-1]['stats']['carries']=None;games[-2]['stats']['carries']=None
        self.assertFalse(self.signal(games))
        self.assertFalse(self.signal(self.prior[:7]+[game(2026,i,carries=22) for i in range(1,5)]))
    def test_counterfactual_recomputes_without_latest_appearance(self):
        games=self.prior+[game(2026,i,carries=22) for i in range(1,4)]
        self.assertTrue(self.signal(games));self.assertFalse(self.signal(games[:-1]))
        self.assertEqual(forecast(games[:-1],'RB',2026)[0],forecast(games[:-1],'RB',2026,season_adaptation=False)[0])

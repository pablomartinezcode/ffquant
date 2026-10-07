import unittest
from pipeline.priors import build_priors,bucket
from pipeline.build import forecast,FIELDS,fantasy

class PriorTests(unittest.TestCase):
    def test_failures_and_censoring(self):
        drafts=[{'season':str(year),'position':'RB','gsis_id':pid,'pick':'3','pfr_player_name':pid} for year,pid in [(2020,'hit'),(2020,'miss'),(2025,'future'),(2020,'')]]
        game={'season':2020,'stats':{k:0 for k in FIELDS}};game['stats']['rushing_yards']=100
        priors,report=build_priors(drafts,{}, {'hit':[game]},2026,FIELDS,fantasy)
        cohort=priors['RB:1–10'];self.assertEqual(cohort['count'],2);self.assertEqual(cohort['profiles'][0]['rushing_yards'],50);self.assertEqual(len(report['unmatchedDrafts']),1)
    def test_draft_prior_survives_first_appearance(self):
        prior={k:0 for k in FIELDS};prior['rushing_yards']=80
        game={'season':2026,'stats':prior.copy()}
        before=forecast([],'RB',2026,1,prior)[0]
        after=forecast([game],'RB',2026,1,prior)[0]
        self.assertEqual(before['rushing_yards'],80);self.assertEqual(after['rushing_yards'],80)
    def test_pick_bands(self):
        self.assertEqual(bucket(3),'1–10');self.assertEqual(bucket(32),'11–32');self.assertEqual(bucket(33),'33–64')

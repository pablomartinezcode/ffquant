import unittest
from pipeline.rosters import current_roster, assign_qb_roles

class RosterTests(unittest.TestCase):
    def test_bye_week_and_injured_reserves_are_not_retirement(self):
        latest={'KC':4,'CHI':5}
        self.assertTrue(current_roster({'team':'KC','week':'4','status':'ACT'},{'active':False},latest))
        self.assertTrue(current_roster({'team':'CHI','week':'5','status':'RES'},{'status':'Injured Reserve'},latest))
        self.assertTrue(current_roster({'team':'CHI','week':'1','status':'RES'},{'team':'CHI','injury_status':'IR'},latest))
        self.assertFalse(current_roster({'team':'CHI','week':'1','status':'ACT'},{'active':True},latest))
    def test_catalog_active_flag_does_not_override_retirement_or_release(self):
        for status in ['RET','CUT','UFA','TRT']:
            self.assertFalse(current_roster({'team':'CHI','week':'5','status':status},{'active':True,'team':'CHI'},{'CHI':5}))
        self.assertFalse(current_roster(None,{'active':True,'status':'Active'},{'CHI':5}))
    def test_injury_cover_preserves_incumbent_without_promoting_one_game_backup(self):
        players=[{'id':'inc','team':'CHI','position':'QB','status':'Out','depthOrder':3},{'id':'cover','team':'CHI','position':'QB','status':'Active','depthOrder':1}]
        weekly={'inc':[{'team':'CHI','season':2025,'stats':{'attempts':25}} for _ in range(17)],'cover':[{'team':'CHI','season':2026,'stats':{'attempts':30}}]}
        assign_qb_roles(players,weekly,2026)
        self.assertEqual(players[0]['qbRole']['dynasty'],1)
        self.assertEqual(players[0]['qbRole']['current'],0)
        self.assertEqual(players[1]['qbRole']['current'],1)
        self.assertEqual(players[1]['qbRole']['dynasty'],.2)
        players[0]['status']='Questionable'
        assign_qb_roles(players,weekly,2026)
        self.assertEqual(players[0]['qbRole']['dynasty'],1)
        self.assertEqual(players[1]['qbRole']['dynasty'],.2)
        players[0]['status']='Active'
        assign_qb_roles(players,weekly,2026)
        self.assertEqual(players[0]['qbRole']['label'],'Backup')
        self.assertEqual(players[1]['qbRole']['dynasty'],1)

if __name__=='__main__':unittest.main()

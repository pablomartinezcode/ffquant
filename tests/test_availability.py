import unittest
from pipeline.availability import completed_games,availability_context

def scheduled(week,team='LA',score='0',away='17'):
    return {'season':'2026','week':str(week),'game_type':'REG','home_team':team,'away_team':'SEA','home_score':score,'away_score':away}
def roster(week,status,team='LA'):
    return {'season':'2026','week':str(week),'game_type':'REG','team':team,'status':status}
def played(week,team='LA'):
    return {'season':2026,'week':week,'team':team,'stats':{'targets':0}}
class AvailabilityTests(unittest.TestCase):
    def calculate(self,rows,games=[],status='Active',code='ACT',schedule=None):
        completed=completed_games(schedule or [scheduled(i) for i in range(1,6)],2026,4)
        return availability_context(rows,games,completed,2026,4,'2026-10-08T00:00:00Z',status,code)
    def test_two_confirmed_inactive_games_and_healthy_return(self):
        result=self.calculate([roster(1,'ACT'),roster(2,'INA'),roster(3,'INA'),roster(4,'ACT')],[played(1),played(4)])
        self.assertEqual(result['missedGames'],2);self.assertEqual(result['missedWeeks'],[2,3])
        self.assertEqual(result['rosWeight'],1);self.assertEqual(result['nextGameWeight'],1)
    def test_reserve_absence_reduces_current_season_without_inventing_a_return_date(self):
        result=self.calculate([roster(i,'RES') for i in range(1,6)],status='IR',code='RES')
        self.assertEqual(result['missedGames'],4);self.assertEqual(result['rosWeight'],.35);self.assertEqual(result['nextGameWeight'],0)
    def test_active_no_stat_game_is_unknown_and_zero_stat_row_is_an_appearance(self):
        result=self.calculate([roster(1,'ACT'),roster(2,'ACT')],[played(2)])
        self.assertEqual(result['missedGames'],0);self.assertEqual(result['unknownParticipationGames'],1)
        self.assertEqual(result['games'][1]['result'],'recorded')
    def test_missing_coverage_is_unavailable_not_zero(self):
        self.assertIsNone(self.calculate([])['missedGames'])
        self.assertIsNone(self.calculate([],[played(1)])['missedGames'])
    def test_byes_pending_games_and_future_weeks_excluded_zero_score_is_completed(self):
        schedule=[scheduled(1),scheduled(3,score=''),scheduled(4,away=''),scheduled(5)]
        result=self.calculate([roster(i,'RES') for i in range(1,6)],schedule=schedule)
        self.assertEqual(result['missedWeeks'],[1])
    def test_team_history_duplicates_and_conflicting_statuses(self):
        schedule=[scheduled(1,'DEN'),scheduled(2,'DAL')]
        result=self.calculate([roster(1,'INA','DEN'),roster(1,'INA','DEN'),roster(2,'RES','DAL')],[played(2,'DAL')],schedule=schedule)
        self.assertEqual(result['missedWeeks'],[1]);self.assertEqual(result['trackedGames'],2);self.assertEqual(result['conflicts'],1)
    def test_ambiguous_roster_assignment_and_practice_squad_do_not_become_injuries(self):
        result=self.calculate([roster(1,'ACT'),roster(1,'INA'),roster(2,'DEV')])
        self.assertEqual(result['missedGames'],0);self.assertEqual(result['unknownParticipationGames'],1);self.assertEqual(result['practiceSquadGames'],1)
    def test_questionable_alone_and_current_out_status_are_distinct(self):
        self.assertEqual(self.calculate([roster(1,'ACT')],status='Questionable')['nextGameWeight'],1)
        self.assertEqual(self.calculate([roster(1,'ACT')],status='Out')['nextGameWeight'],0)
    def test_completed_week_inactive_row_does_not_override_a_healthy_return(self):
        games=completed_games([scheduled(4)],2026,4)
        args=([roster(4,'INA')],[],games,2026,4,'2026-10-08','Active','INA')
        recovered=availability_context(*args,roster_week=4)
        self.assertEqual(recovered['missedGames'],1);self.assertEqual(recovered['nextGameWeight'],1)
        current=availability_context(*args,roster_week=5)
        self.assertEqual(current['nextGameWeight'],0)

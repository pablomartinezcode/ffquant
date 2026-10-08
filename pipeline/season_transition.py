"""A bounded opening-season opportunity reset, never a fantasy-score bonus."""
from statistics import median

OPPORTUNITIES = {'QB': ('attempts', 'carries'), 'RB': ('carries', 'targets'), 'WR': ('targets',), 'TE': ('targets',)}
FLOORS = {'attempts': 20, 'carries': 4, 'targets': 2}
ABSOLUTE_SHIFT = {'attempts': 5, 'carries': 2, 'targets': 1}

def opening_signals(games, pos, year, bases):
    prior = [g for g in games if year-2 <= g['season'] < year][-17:]
    opening = [g for g in games if g['season'] == year and 1 <= (g.get('week') or 99) <= 6]
    signals = []
    for metric in OPPORTUNITIES[pos]:
        old = [g['stats'].get(metric) for g in prior if g['stats'].get(metric) is not None]
        values = [g['stats'].get(metric) for g in opening if g['stats'].get(metric) is not None]
        if len(old) < 8 or len(values) < 3:
            continue
        base = bases[metric]
        middle = median(values)
        direction = 1 if middle > base else -1
        threshold = max(abs(base)*.25, ABSOLUTE_SHIFT[metric])
        consistent = sum(direction*(v-base) >= threshold for v in values)/len(values)
        if abs(middle-base) < threshold or consistent < .75:
            continue
        signal = min(1, (len(values)-2)/2)*max(0, min(1, (abs(middle-base)/max(base, FLOORS[metric])-.25)/.5))
        if signal <= 0:
            continue
        signals.append({'metric':metric, 'prior':round(base,3), 'openingMedian':round(middle,3),
                        'observations':len(values), 'direction':'up' if direction > 0 else 'down',
                        'priorReduction':round(.75*signal,5)})
    return signals

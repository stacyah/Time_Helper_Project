import os
import csv
from datetime import datetime, timedelta

DATA_PATH = os.path.join('data', 'task_data.csv')
CSV_HEADERS = ['date', 'task', 'duration_minutes']

def _ensure_data_folder():
    # create data folder if missing
    folder = os.path.dirname(DATA_PATH)
    if not os.path.isdir(folder):
        os.makedirs(folder)

def load_data(path=DATA_PATH):
    # load rows with date as datetime
    if not os.path.isfile(path):
        return []

    rows = []
    with open(path, newline='') as f:
        reader = csv.reader(f)
        next(reader, None)
        for cols in reader:
            if len(cols) < 3:
                continue
            date_str = cols[0].strip()
            task = cols[1].strip()
            try:
                duration = float(cols[2])
            except ValueError:
                continue

            try:
                dt = datetime.strptime(date_str, '%m/%d/%Y')
            except Exception:
                continue

            rows.append((dt, task, duration))
    return rows

def append_task_logs(logs, path=DATA_PATH):
    # append new logs
    _ensure_data_folder()
    need_header = not os.path.isfile(path)
    with open(path, 'a', newline='') as f:
        writer = csv.writer(f)
        if need_header:
            writer.writerow(CSV_HEADERS)

        today_str = datetime.today().strftime('%m/%d/%Y')
        for log in logs:
            row_date = log.get('date', today_str)
            try:
                _ = datetime.strptime(row_date, '%m/%d/%Y')
                row_date_str = row_date
            except Exception:
                row_date_str = today_str
            writer.writerow([row_date_str, log['task'], log['duration']])

def predict_duration(tasks):
    # compute avg duration per task
    rows = load_data()
    sums = {}
    counts = {}
    for (_dt, t, dur) in rows:
        sums[t] = sums.get(t, 0.0) + dur
        counts[t] = counts.get(t, 0) + 1

    results = []
    for t in tasks:
        if t in sums and counts.get(t, 0) > 0:
            avg = sums[t] / counts[t]
        else:
            avg = 0.0
        results.append({'task': t, 'avg': round(avg, 2)})
    return results

def compute_accuracy_series():
    # build accuracy by date
    rows = load_data()
    if not rows:
        return []

    rows.sort(key=lambda r: r[0])


    by_date = {}
    for dt, task, dur in rows:
        d = dt.date()
        by_date.setdefault(d, []).append((task, dur))

    series = []
    running_sums = {}
    running_counts = {}

    # go through each date in order
    for d in sorted(by_date):
        prior_means = {}
        for t in running_sums:
            count = running_counts.get(t, 0)
            if count > 0:
                prior_means[t] = running_sums[t] / count
            else:
                prior_means[t] = 0.0

        predicted_total = 0.0
        for task, _ in by_date[d]:
            predicted_total += prior_means.get(task, 0.0)

        # get actual total time on date d
        actual_total = sum(dur for (_, dur) in by_date[d])

        # compute accuracy
        if not running_sums:
            acc = 0.0
        else:
            if actual_total > 0:
                diff = abs(predicted_total - actual_total)
                acc = round(1 - (diff / actual_total), 3)
            else:
                acc = 0.0

        series.append({
            'ts': d.strftime('%Y-%m-%d'),
            'accuracy': acc
        })

        # update sums and counts to include date d’s data
        for task, dur in by_date[d]:
            running_sums[task] = running_sums.get(task, 0.0) + dur
            running_counts[task] = running_counts.get(task, 0) + 1

    return series

def get_start_time(event_str, total_minutes):
    # subtract total_minutes from event time
    try:
        t = datetime.strptime(event_str, '%H:%M')
    except Exception:
        return event_str
    start = t - timedelta(minutes=total_minutes)
    return start.strftime('%H:%M')

def get_prediction(event_time, selected_tasks):
    # get full prediction payload
    avgs = predict_duration(selected_tasks)
    total_est = sum(item['avg'] for item in avgs)
    return {
        'predicted_duration': round(total_est, 2),
        'recommended_start': get_start_time(event_time, total_est),
        'task_avgs': avgs,
        'accuracy': compute_accuracy_series()
    }
import os
import tempfile
import pytest
import ml_model

def create_sample_csv(tmp_path):
    path = tmp_path / "task_data.csv"
    path.write_text(
        "05/01/2025,daily backup,17\n"
        "05/01/2025,server health check,11\n"
        "05/02/2025,daily backup,16\n"
        "05/02/2025,server health check,10\n"
        "05/03/2025,daily backup,17\n"
        "05/03/2025,server health check,11\n"
    )
    return str(path)

def test_predict_duration(tmp_path, monkeypatch):
    sample_csv = create_sample_csv(tmp_path)
    monkeypatch.setenv("TASK_DATA_CSV", sample_csv)

    result = ml_model.predict_duration(["daily backup"])
    assert {"task": "daily backup", "avg": 17.0} in result

    result_all = {item["task"]: item["avg"] for item in ml_model.predict_duration(
        ["daily backup", "server health check"]
    )}
    assert result_all["daily backup"] == 17.0
    assert result_all["server health check"] == 11.0

def test_compute_accuracy_series(tmp_path, monkeypatch):
    sample_csv = create_sample_csv(tmp_path)
    monkeypatch.setenv("TASK_DATA_CSV", sample_csv)

    series = ml_model.compute_accuracy_series()
    found = [item for item in series if item["ts"] == "2025-05-01"][0]
    assert pytest.approx(found["accuracy"], rel=1e-3) == 1.0

    found2 = [item for item in series if item["ts"] == "2025-05-02"][0]
    expected = 1 - (2/26)
    assert pytest.approx(found2["accuracy"], rel=1e-3) == pytest.approx(expected, rel=1e-3)

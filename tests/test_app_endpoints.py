import os
import tempfile
import pytest
import app as myapp

@pytest.fixture
def client(tmp_path, monkeypatch):
    temp_csv = tmp_path / "task_data.csv"
    temp_csv.write_text("05/01/2025,daily backup,17\n05/01/2025,server health check,11\n")
    monkeypatch.setenv("TASK_DATA_CSV", str(temp_csv))
    myapp.app.config["TESTING"] = True
    with myapp.app.test_client() as client:
        yield client

def test_predict_endpoint(client):
    payload = {"event_time": "15:00", "selected_tasks": ["daily backup"]}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 200
    data = resp.get_json()
    assert "task_avgs" in data
    avgs = {item["task"]: item["avg"] for item in data["task_avgs"]}
    assert avgs["daily backup"] == 17.0
    assert "recommended_start" in data

def test_log_tasks_endpoint(client):
    new_log = {"logs":[{"task": "daily backup", "duration": 18.0}]}
    before_size = os.path.getsize(os.getenv("TASK_DATA_CSV"))
    resp = client.post("/log_tasks", json=new_log)
    assert resp.status_code == 200
    data = resp.get_json()
    after_size = os.path.getsize(os.getenv("TASK_DATA_CSV"))
    assert after_size > before_size
    assert "accuracy" in data

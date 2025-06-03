from flask import Flask, request, jsonify, render_template
import ml_model

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    # return prediction
    try:
        data = request.get_json()
        event_time = data.get('event_time')
        tasks = data.get('selected_tasks', [])

        if not event_time or not tasks:
            return jsonify({'error': 'Invalid input'}), 400

        prediction = ml_model.get_prediction(event_time, tasks)
        return jsonify(prediction)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/log_tasks', methods=['POST'])
def log_tasks():
    # record actual task durations
    try:
        data = request.get_json()
        logs = data.get('logs', [])

        if not logs:
            return jsonify({'error': 'No logs received'}), 400

        ml_model.append_task_logs(logs)
        tasks = [log['task'] for log in logs]
        task_avgs = ml_model.predict_duration(tasks)
        accuracy = ml_model.compute_accuracy_series()

        return jsonify({
            'task_avgs': task_avgs,
            'accuracy': accuracy
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
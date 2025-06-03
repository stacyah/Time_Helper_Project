// parse "HH:MM" to ms
window.onload = function() {
  function parseHm(timeStr) {
    var parts = timeStr.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var now = new Date();
    now.setHours(h, m, 0, 0);
    return now.getTime();
  }

  // format ms to "Xm Ys"
  function formatMs(ms) {
    var total = ms > 0 ? ms : 0;
    var minutes = Math.floor(total / 60000);
    var seconds = Math.floor((total % 60000) / 1000);
    return minutes + 'm ' + seconds + 's';
  }

    // format decimal minutes to "Xm Ys"
  function formatDecimalToTimeStr(mins) {
    var totalSecs = Math.round(mins * 60);
    var m = Math.floor(totalSecs / 60);
    var s = totalSecs % 60;
    return m + 'm ' + s + 's';
  }

    // show a small toast
  function showToast(message) {
    var toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = '#333';
    toast.style.color = '#f0f0f0';
    toast.style.padding = '8px 14px';
    toast.style.borderRadius = '4px';
    toast.style.fontSize = '0.9rem';
    toast.style.boxShadow = '0 0 6px rgba(0,0,0,0.5)';
    toast.style.opacity = '1';
    toast.style.transition = 'opacity 0.4s ease';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() {
        document.body.removeChild(toast);
      }, 400);
    }, 1800);
  }

    // get elements
  var goBtn = document.getElementById('go');
  var startNowBtn = document.getElementById('start-now');
  var timerPanel = document.getElementById('timer-panel');
  var outputDiv = document.getElementById('output');
  var progressBar = document.getElementById('progress');
  var taskLabel = document.getElementById('current-task');
  var timeLeftTask = document.getElementById('time-left-task');
  var actualContainer = document.getElementById('actual-times');
  var eventTimeInput = document.getElementById('event-time');
  var startTimeEl = document.getElementById('start-time');
  var durEl = document.getElementById('duration');
  var beginsEl = document.getElementById('time-left');
  var barChartEl = document.getElementById('bar-chart');
  var accChartEl = document.getElementById('accuracy-chart');
  var pieChartEl = document.getElementById('pie-chart');

    // check that all required elements are present
  var originalTasks = [];
  var tasksQueue = [];
  var taskDurations = [];
  var timerId, countId;

  goBtn.onclick = function() {
    clearInterval(timerId);
    clearInterval(countId);
    timerPanel.classList.add('hidden');
    outputDiv.classList.add('hidden');
    actualContainer.innerHTML = '';
    progressBar.style.width = '0%';

    // validate event time input
    var eventVal = eventTimeInput.value;
    var allInputs = document.getElementsByTagName('input');
    var selected = [];
    for (var i = 0; i < allInputs.length; i++) {
      var box = allInputs[i];
      if (box.type === 'checkbox' && box.checked) {
        selected.push(box.value);
      }
    }

    if (!eventVal || selected.length === 0) {
      alert('Pick time & tasks');
      return;
    }

    originalTasks = selected.slice();

    fetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_time: eventVal,
        selected_tasks: selected
      })
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.error) {
        alert(data.error);
        return;
      }
      startTimeEl.textContent = data.recommended_start;
      durEl.textContent = formatDecimalToTimeStr(data.predicted_duration);
      outputDiv.classList.remove('hidden');

      // update the time left until the event starts
      var msUntil = parseHm(data.recommended_start) - Date.now();
      beginsEl.textContent = formatMs(msUntil);
      countId = setInterval(function() {
        msUntil -= 1000;
        if (msUntil <= 0) {
          beginsEl.textContent = 'Start now!';
          clearInterval(countId);
        } else {
          beginsEl.textContent = formatMs(msUntil);
        }
      }, 1000);

      tasksQueue = originalTasks.slice();
      taskDurations = [];
      for (var j = 0; j < data.task_avgs.length; j++) {
        taskDurations.push(data.task_avgs[j].avg * 60000);
      }

      drawCharts(data);
    })
    .catch(function(err) {
      console.log('Error fetching /predict:', err);
      alert('Server error');
    });
  };

    // start the timer when the user clicks "Start Now"
  startNowBtn.onclick = function() {
    clearInterval(countId);
    outputDiv.classList.add('hidden');
    timerPanel.classList.remove('hidden');

    if (tasksQueue.length > 0) {
      var task = tasksQueue.shift();
      var duration = taskDurations.shift();
      var startTime = Date.now();
      taskLabel.textContent = task;
      var elapsed0 = Date.now() - startTime;
      var p0 = Math.min(100, (elapsed0 / duration) * 100);
      progressBar.style.width = p0 + '%';
      timeLeftTask.textContent = formatMs(duration - elapsed0);

      timerId = setInterval(function() {
        var now = Date.now();
        var elapsed = now - startTime;
        var pct = Math.min(100, (elapsed / duration) * 100);
        progressBar.style.width = pct + '%';
        timeLeftTask.textContent = formatMs(duration - elapsed);
        if (pct >= 100) {
          clearInterval(timerId);
          timeLeftTask.textContent = 'Done!';
        }
      }, 500);
    }
  };

  document.body.onclick = function(e) {
    if (e.target.id !== 'done') return;
    clearInterval(timerId);
    if (tasksQueue.length === 0) {
      timerPanel.classList.add('hidden');
      showActualInputs();
    } else {
      var nextTask = tasksQueue.shift();
      var nextDuration = taskDurations.shift();
      var st = Date.now();
      taskLabel.textContent = nextTask;
      var elapsedInit = Date.now() - st;
      var pInit = Math.min(100, (elapsedInit / nextDuration) * 100);
      progressBar.style.width = pInit + '%';
      timeLeftTask.textContent = formatMs(nextDuration - elapsedInit);

      timerId = setInterval(function() {
        var now2 = Date.now();
        var elapsed2 = now2 - st;
        var pct2 = Math.min(100, (elapsed2 / nextDuration) * 100);
        progressBar.style.width = pct2 + '%';
        timeLeftTask.textContent = formatMs(nextDuration - elapsed2);
        if (pct2 >= 100) {
          clearInterval(timerId);
          timeLeftTask.textContent = 'Done!';
        }
      }, 500);
    }
  };

  function showActualInputs() {
    actualContainer.innerHTML = '<h3>Enter actual times</h3>';
    for (var i = 0; i < originalTasks.length; i++) {
      var taskName = originalTasks[i];
      var div = document.createElement('div');
      div.innerHTML = '<label>' + taskName +
        ': <input id="actual-' + i + '" type="number" min="0" step="0.1"></label>';
      actualContainer.appendChild(div);
    }
    var submitBtn = document.createElement('button');
    submitBtn.textContent = 'Submit';
    submitBtn.className = 'btn btn-primary';

    submitBtn.onclick = function() {
      var logs = [];
      var valid = true;
      for (var k = 0; k < originalTasks.length; k++) {
        var val = parseFloat(document.getElementById('actual-' + k).value);
        if (isNaN(val) || val < 0) {
          alert('Invalid ' + originalTasks[k]);
          valid = false;
          break;
        }
        logs.push({ task: originalTasks[k], duration: val });
      }
      if (!valid) return;

      submitBtn.disabled = true;
      fetch('/log_tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logs })
      })
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        if (data.error) {
          alert(data.error);
        } else {
          showToast('Model updated!');
          outputDiv.classList.add('hidden');
          drawCharts(data);
        }
      })
      .catch(function(err) {
        console.log('Error in /log_tasks:', err);
        alert('Log failed: ' + err.message);
      })
      .finally(function() {
        submitBtn.disabled = false;
      });
    };
    actualContainer.appendChild(submitBtn);
  }

    // draw the charts
  function drawCharts(data) {
    Plotly.newPlot(
      'bar-chart',
      [{
        x: data.task_avgs.map(t => t.task),
        y: data.task_avgs.map(t => t.avg),
        text: data.task_avgs.map(t => formatDecimalToTimeStr(t.avg)),
        textposition: 'auto',
        hovertemplate: '%{x}<br>%{text}<extra></extra>',
        type: 'bar'
      }],
      { title: 'Duration per Task' }
    );

    if (data.accuracy && data.accuracy.length) {
      data.accuracy.sort((a, b) => new Date(a.ts) - new Date(b.ts));
      var xArr = [], yArr = [];
      for (var m = 0; m < data.accuracy.length; m++) {
        xArr.push(new Date(data.accuracy[m].ts));
        yArr.push(data.accuracy[m].accuracy * 100);
      }
      Plotly.newPlot(
        'accuracy-chart',
        [{
          x: xArr,
          y: yArr,
          type: 'scatter',
          mode: 'lines+markers'
        }],
        {
          title: 'Accuracy Over Time',
          xaxis: { type: 'date' },
          yaxis: { range: [0, 100] }
        }
      );
    } else {
      accChartEl.innerHTML = '<p style="text-align:center; color:#777;">No data</p>';
    }

    var labelsArr = [], valuesArr = [];
    for (var n = 0; n < data.task_avgs.length; n++) {
      labelsArr.push(data.task_avgs[n].task);
      valuesArr.push(data.task_avgs[n].avg);
    }
    Plotly.newPlot(
      'pie-chart',
      [{
        labels: labelsArr,
        values: valuesArr,
        text: valuesArr.map(formatDecimalToTimeStr),
        hovertemplate: '%{label}<br>%{text}<extra></extra>',
        type: 'pie'
      }],
      { title: 'Task Distribution' }
    );
  }
};
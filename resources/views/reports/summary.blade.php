<!DOCTYPE html>
<html>
<head>
    <title>System Report</title>
    <style>
        body { font-family: sans-serif; }
        .header { text-align: center; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .section-title { color: #2c3e50; border-bottom: 2px solid #2c3e50; padding-bottom: 5px; margin-top: 20px;}
    </style>
</head>
<body>
    <div class="header">
        <h1>AquaGuard System Report</h1>
        <p>Generated on: {{ $date }}</p>
    </div>

    <h2 class="section-title">1. Executive Summary</h2>
    <p>Total Alerts This Month: <strong>{{ $total_alerts }}</strong></p>
    <p>Critical Leaks Detected: <strong>{{ $critical_alerts }}</strong></p>

    <h2 class="section-title">2. Machine Learning Status</h2>
    <p>Current Active Model: <strong>{{ $current_model_version }}</strong> (Accuracy: {{ $current_accuracy }}%)</p>
    
    <h3>Training History</h3>
    <table>
        <tr>
            <th>Version</th>
            <th>Created At</th>
            <th>Accuracy</th>
            <th>Status</th>
        </tr>
        @foreach($trainingHistory as $model)
        <tr>
            <td>{{ $model->version }}</td>
            <td>{{ $model->created_at->format('M d, H:i') }}</td>
            <td>{{ $model->accuracy }}%</td>
            <td>{{ $model->is_active ? 'Active' : 'Archived' }}</td>
        </tr>
        @endforeach
    </table>

    <h2 class="section-title">3. Recent Leak Incidents</h2>
    <table>
        <tr>
            <th>Date</th>
            <th>Severity</th>
            <th>Pipeline Location</th>
            <th>Status</th>
        </tr>
        @foreach($alerts as $alert)
        <tr>
            <td>{{ $alert->created_at->format('M d, H:i') }}</td>
            <td style="color: {{ $alert->severity == 'Critical' ? 'red' : 'orange' }}">{{ $alert->severity }}</td>
            <td>Pipeline #{{ $alert->pipeline_id }}</td>
            <td>{{ $alert->status }}</td>
        </tr>
        @endforeach
    </table>
</body>
</html>
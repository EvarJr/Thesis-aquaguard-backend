<!DOCTYPE html>
<html>
<head>
    <title>AquaGuard System Intelligence Report</title>
    <style>
        /* PDF Page Settings */
        @page { margin: 30px 40px; }
        body { font-family: 'Helvetica', sans-serif; color: #333; font-size: 12px; line-height: 1.4; }
        
        /* Header */
        .header { margin-bottom: 30px; border-bottom: 2px solid #0052CC; padding-bottom: 10px; }
        .header table { width: 100%; border: none; }
        .header td { border: none; padding: 0; vertical-align: bottom; }
        .logo { font-size: 24px; font-weight: bold; color: #0052CC; }
        .meta { text-align: right; font-size: 10px; color: #666; }
        
        /* KPI Cards - Using Table for perfect alignment in PDF */
        .kpi-table { width: 100%; margin-bottom: 30px; border-spacing: 10px 0; margin-left: -10px; }
        .kpi-cell { 
            width: 25%; 
            background: #f4f5f7; 
            border: 1px solid #dfe1e6; 
            padding: 15px 10px; 
            text-align: center; 
            border-radius: 5px; 
        }
        .metric-val { font-size: 20px; font-weight: bold; color: #172B4D; display: block; margin-bottom: 5px; }
        .metric-label { font-size: 9px; text-transform: uppercase; color: #5E6C84; letter-spacing: 0.5px; }
        
        /* Typography */
        h2 { color: #172B4D; border-bottom: 1px solid #dfe1e6; padding-bottom: 8px; margin-top: 30px; font-size: 16px; }
        .sub-text { font-size: 10px; color: #666; margin-bottom: 15px; font-style: italic; }

        /* Data Tables */
        .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
        .data-table th { background-color: #0052CC; color: white; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; }
        .data-table td { border-bottom: 1px solid #eee; padding: 8px; vertical-align: middle; }
        .data-table tr:nth-child(even) { background-color: #f9f9f9; }
        
        /* Badges */
        .badge { padding: 3px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; color: white; display: inline-block; }
        .bg-crit { background-color: #DE350B; }
        .bg-ok { background-color: #00875A; }
        .bg-warn { background-color: #FF991F; color: #333; }
        
        /* Charts (Table Based Layout for PDF Stability) */
        .chart-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
        .chart-table td { border: none; padding: 0; vertical-align: middle; }
        .bar-track { width: 100%; background: #eee; height: 12px; border-radius: 4px; overflow: hidden; }
        .bar-fill { height: 100%; background: #0052CC; }
        
        /* Utilities */
        .text-right { text-align: right; }
        .font-mono { font-family: 'Courier New', Courier, monospace; }
    </style>
</head>
<body>

    <!-- HEADER -->
    <div class="header">
        <table>
            <tr>
                <td><div class="logo">AquaGuard <span style="color:#333; font-weight:normal;">Intelligence</span></div></td>
                <td>
                    <div class="meta">
                        Generated: {{ $date }}<br>
                        Security Level: INTERNAL
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <!-- EXECUTIVE SUMMARY (KPIs) -->
    <table class="kpi-table">
        <tr>
            <td class="kpi-cell">
                <span class="metric-val" style="color: {{ $health_score > 80 ? '#00875A' : '#DE350B' }}">
                    {{ $health_score }}/100
                </span>
                <span class="metric-label">System Health</span>
            </td>
            <td class="kpi-cell">
                <span class="metric-val">{{ $total_alerts }}</span>
                <span class="metric-label">Total Incidents</span>
            </td>
            <td class="kpi-cell">
                <span class="metric-val">{{ $false_positives }}</span>
                <span class="metric-label">False Positives</span>
            </td>
            <td class="kpi-cell">
                <span class="metric-val">{{ $current_accuracy > 0 ? $current_accuracy.'%' : 'N/A' }}</span>
                <span class="metric-label">AI Accuracy</span>
            </td>
        </tr>
    </table>

    <!-- 1. LEAK DISTRIBUTION ANALYSIS (FIXED LAYOUT) -->
    <h2>Leak Distribution Analysis</h2>
    <p class="sub-text">Breakdown of incidents by pipeline to identify infrastructure weaknesses.</p>
    
    <div style="border: 1px solid #eee; padding: 15px; border-radius: 5px;">
        @if(count($distribution) > 0)
            <table class="chart-table">
                @foreach($distribution as $dist)
                <tr>
                    <!-- Label -->
                    <td width="20%" style="font-size: 11px; font-weight: bold;">Pipeline #{{ $dist['name'] }}</td>
                    
                    <!-- Progress Bar -->
                    <td width="65%" style="padding: 0 10px;">
                        <div class="bar-track">
                            <div class="bar-fill" style="width: {{ $dist['pct'] }}%; background-color: {{ $dist['pct'] > 50 ? '#DE350B' : '#0052CC' }}"></div>
                        </div>
                    </td>
                    
                    <!-- Value -->
                    <td width="15%" class="text-right" style="font-size: 11px;">
                        <strong>{{ $dist['count'] }}</strong> ({{ $dist['pct'] }}%)
                    </td>
                </tr>
                @endforeach
            </table>
        @else
            <p style="text-align: center; color: #999;">No active leaks recorded in this period.</p>
        @endif
    </div>

    <!-- 2. DETAILED INCIDENT LOG -->
    <h2>Incident Log & Telemetry</h2>
    <p class="sub-text">Snapshot of the last 50 incidents including sensor readings at detection time.</p>
    
    <table class="data-table">
        <thead>
            <tr>
                <th width="18%">Time</th>
                <th width="12%">Pipeline</th>
                <th width="10%">Severity</th>
                <th width="25%">Readings (PSI / Flow)</th>
                <th width="10%">AI Conf.</th>
                <th width="15%">Outcome</th>
                <th width="10%">Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($alerts as $alert)
            <tr>
                <td>{{ $alert->created_at->format('M d, H:i:s') }}</td>
                <td><strong>{{ $alert->pipeline_id ?? 'N/A' }}</strong></td>
                <td>
                    @if($alert->severity == 'Critical')
                        <span class="badge bg-crit">CRITICAL</span>
                    @else
                        <span class="badge bg-warn">{{ $alert->severity }}</span>
                    @endif
                </td>
                <td class="font-mono">
                    P: {{ $alert->snapshot_pressure }} <br>
                    F: {{ $alert->snapshot_flow }}
                </td>
                <td>
                    @if($alert->accuracy)
                        <strong>{{ $alert->accuracy }}%</strong>
                    @else
                        <span style="color:#ccc">-</span>
                    @endif
                </td>
                <td>
                    @if($alert->false_positive)
                        <span style="color: #DE350B; font-weight:bold;">False Alarm</span>
                    @elseif($alert->resolved_at)
                        <span style="color: #00875A; font-weight:bold;">Verified Leak</span>
                    @else
                        <span style="color: #666;">Pending</span>
                    @endif
                </td>
                <td>{{ $alert->status_label }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <!-- 3. AI MODEL AUDIT -->
    <h2>AI Model Audit Trail</h2>
    <table class="data-table">
        <thead>
            <tr>
                <th>Version</th>
                <th>Training Date</th>
                <th>Algorithm</th>
                <th>Accuracy Score</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($trainingHistory as $model)
            <tr style="{{ $model->status === 'ACTIVE' ? 'background-color: #e3f2fd;' : '' }}">
                <td><strong>v{{ $model->version }}</strong></td>
                <td>{{ $model->created_at->format('M d, Y H:i') }}</td>
                <td>Random Forest (GA Opt.)</td>
                <td>{{ $model->accuracy }}%</td>
                <td>
                    @if($model->status === 'ACTIVE')
                        <span class="badge bg-ok">ACTIVE</span>
                    @elseif($model->status === 'TRAINING')
                        <span class="badge bg-warn">TRAINING</span>
                    @else
                        <span style="color: gray;">Archived</span>
                    @endif
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div style="margin-top: 40px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
        Auto-generated by AquaGuard System. This document is confidential and for internal use only.
    </div>
</body>
</html>
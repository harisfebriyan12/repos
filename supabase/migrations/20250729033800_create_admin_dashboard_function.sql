CREATE OR REPLACE FUNCTION get_admin_dashboard_data(admin_id UUID, current_date TEXT)
RETURNS JSONB AS $$
DECLARE
    -- Variables to hold calculated data
    total_users_count INT;
    active_users_count INT;
    total_attendance_count INT;
    today_attendance_count INT;
    late_today_count INT;
    absent_today_count INT;
    total_positions_count INT;
    active_departments_count INT;
    active_warnings_count INT;
    total_salary_paid_val NUMERIC;
    avg_daily_salary_val NUMERIC;

    -- Variables for JSON arrays
    recent_activities_json JSONB;
    late_employees_today_json JSONB;
    absent_employees_today_json JSONB;
    system_settings_json JSONB;

    -- Date variables
    start_of_day TIMESTAMPTZ;
    end_of_day TIMESTAMPTZ;

BEGIN
    -- Set date range for today
    start_of_day := (current_date || ' 00:00:00')::TIMESTAMPTZ;
    end_of_day := (current_date || ' 23:59:59')::TIMESTAMPTZ;

    -- 1. Aggregate Stats
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'active')
    INTO total_users_count, active_users_count
    FROM profiles;

    SELECT COUNT(*) INTO total_attendance_count FROM attendance;

    SELECT
        COUNT(*) FILTER (WHERE type = 'masuk' AND timestamp BETWEEN start_of_day AND end_of_day),
        COUNT(*) FILTER (WHERE is_late = TRUE AND timestamp BETWEEN start_of_day AND end_of_day)
    INTO today_attendance_count, late_today_count
    FROM attendance;

    SELECT COUNT(*) INTO total_positions_count FROM positions;
    SELECT COUNT(DISTINCT department) INTO active_departments_count FROM positions WHERE department IS NOT NULL;
    SELECT COUNT(*) INTO active_warnings_count FROM attendance_warnings WHERE is_resolved = FALSE;

    -- Calculate salary stats
    SELECT
        COALESCE(SUM(daily_salary * 22), 0),
        COALESCE(AVG(daily_salary), 0)
    INTO total_salary_paid_val, avg_daily_salary_val
    FROM employee_salaries WHERE is_active = TRUE;

    -- 2. Absent employees today
    WITH checked_in_today AS (
        SELECT DISTINCT user_id
        FROM attendance
        WHERE timestamp BETWEEN start_of_day AND end_of_day AND type = 'masuk'
    )
    SELECT COUNT(*)
    INTO absent_today_count
    FROM profiles
    WHERE role = 'karyawan' AND status = 'active'
      AND id NOT IN (SELECT user_id FROM checked_in_today);

    -- 3. JSON Arrays
    -- Recent 15 activities
    SELECT jsonb_agg(t)
    INTO recent_activities_json
    FROM (
        SELECT
            a.id, a.user_id, a.type, a.status, a.timestamp, a.is_late, a.late_minutes,
            p.name AS "profiles.name",
            p.role AS "profiles.role",
            p.department AS "profiles.department",
            p.avatar_url AS "profiles.avatar_url",
            p.employee_id AS "profiles.employee_id"
        FROM attendance a
        JOIN profiles p ON a.user_id = p.id
        ORDER BY a.timestamp DESC
        LIMIT 15
    ) t;

    -- Late employees today
    SELECT jsonb_agg(t)
    INTO late_employees_today_json
    FROM (
        SELECT
            a.id, a.user_id, a.late_minutes,
            p.name,
            p.id as profile_id,
            p.department,
            p.avatar_url
        FROM attendance a
        JOIN profiles p ON a.user_id = p.id
        WHERE a.is_late = TRUE AND a.timestamp BETWEEN start_of_day AND end_of_day
        ORDER BY a.late_minutes DESC
    ) t;

    -- Absent employees today
    WITH checked_in_today AS (
        SELECT DISTINCT user_id
        FROM attendance
        WHERE timestamp BETWEEN start_of_day AND end_of_day AND type = 'masuk'
    )
    SELECT jsonb_agg(t)
    INTO absent_employees_today_json
    FROM (
        SELECT
            p.id,
            p.name,
            p.department,
            p.avatar_url,
            p.employee_id
        FROM profiles p
        WHERE p.role = 'karyawan' AND p.status = 'active'
          AND p.id NOT IN (SELECT user_id FROM checked_in_today)
        ORDER BY p.name
    ) t;

    -- System settings
    SELECT jsonb_agg(s)
    INTO system_settings_json
    FROM (
        SELECT setting_key, setting_value
        FROM system_settings
        WHERE is_enabled = TRUE
    ) s;

    -- 4. Construct final JSON response
    RETURN jsonb_build_object(
        'total_users', total_users_count,
        'active_users', active_users_count,
        'total_attendance', total_attendance_count,
        'today_attendance_count', today_attendance_count,
        'late_today_count', late_today_count,
        'absent_today_count', absent_today_count,
        'total_positions', total_positions_count,
        'active_departments', active_departments_count,
        'active_warnings', active_warnings_count,
        'total_salary_paid', total_salary_paid_val,
        'avg_daily_salary', avg_daily_salary_val,
        'recent_activities', COALESCE(recent_activities_json, '[]'::jsonb),
        'late_employees_today', COALESCE(late_employees_today_json, '[]'::jsonb),
        'absent_employees_today', COALESCE(absent_employees_today_json, '[]'::jsonb),
        'system_settings', COALESCE(system_settings_json, '[]'::jsonb)
    );

END;
$$ LANGUAGE plpgsql;

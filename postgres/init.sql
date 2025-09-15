-- PostgreSQL initialization script for BionicPRO Keycloak
-- This script creates the necessary database and user for Keycloak

-- Create additional schemas for different data regions (if needed in future)
CREATE SCHEMA IF NOT EXISTS keycloak_data;
CREATE SCHEMA IF NOT EXISTS audit_logs;

-- Grant permissions to keycloak user
GRANT ALL PRIVILEGES ON SCHEMA keycloak_data TO keycloak;
GRANT ALL PRIVILEGES ON SCHEMA audit_logs TO keycloak;

-- Create extension for UUID generation (useful for Keycloak)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create audit table for tracking authentication events
CREATE TABLE IF NOT EXISTS audit_logs.auth_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    user_id VARCHAR(255),
    client_id VARCHAR(255),
    realm_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details JSONB,
    session_id VARCHAR(255)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_auth_events_time ON audit_logs.auth_events(event_time);
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON audit_logs.auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_client ON audit_logs.auth_events(client_id);

-- Grant permissions for audit table
GRANT ALL PRIVILEGES ON TABLE audit_logs.auth_events TO keycloak;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA audit_logs TO keycloak;

-- Create table for PKCE code challenges tracking (for monitoring)
CREATE TABLE IF NOT EXISTS keycloak_data.pkce_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_challenge VARCHAR(128) NOT NULL,
    code_challenge_method VARCHAR(10) NOT NULL DEFAULT 'S256',
    client_id VARCHAR(255) NOT NULL,
    user_session VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,
    is_used BOOLEAN DEFAULT FALSE
);

-- Index for PKCE challenges
CREATE INDEX IF NOT EXISTS idx_pkce_challenges_created ON keycloak_data.pkce_challenges(created_at);
CREATE INDEX IF NOT EXISTS idx_pkce_challenges_client ON keycloak_data.pkce_challenges(client_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE keycloak_data.pkce_challenges TO keycloak;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA keycloak_data TO keycloak;

-- Create function to clean up old PKCE challenges (they should be short-lived)
CREATE OR REPLACE FUNCTION keycloak_data.cleanup_old_pkce_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM keycloak_data.pkce_challenges 
    WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql;

-- Create function to log authentication events (can be called from Keycloak event listener)
CREATE OR REPLACE FUNCTION audit_logs.log_auth_event(
    p_event_type VARCHAR(100),
    p_user_id VARCHAR(255) DEFAULT NULL,
    p_client_id VARCHAR(255) DEFAULT NULL,
    p_realm_name VARCHAR(255) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_session_id VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO audit_logs.auth_events (
        event_type, user_id, client_id, realm_name, 
        ip_address, user_agent, details, session_id
    ) VALUES (
        p_event_type, p_user_id, p_client_id, p_realm_name,
        p_ip_address, p_user_agent, p_details, p_session_id
    ) RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION keycloak_data.cleanup_old_pkce_challenges() TO keycloak;
GRANT EXECUTE ON FUNCTION audit_logs.log_auth_event(VARCHAR, VARCHAR, VARCHAR, VARCHAR, INET, TEXT, JSONB, VARCHAR) TO keycloak;

-- Create view for authentication statistics
CREATE OR REPLACE VIEW audit_logs.auth_stats AS
SELECT 
    DATE(event_time) as auth_date,
    event_type,
    client_id,
    realm_name,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips
FROM audit_logs.auth_events
WHERE event_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(event_time), event_type, client_id, realm_name
ORDER BY auth_date DESC, event_count DESC;

-- Grant view permissions
GRANT SELECT ON audit_logs.auth_stats TO keycloak;

-- Insert sample data for testing (optional)
DO $$
BEGIN
    -- Only insert if table is empty
    IF NOT EXISTS (SELECT 1 FROM audit_logs.auth_events LIMIT 1) THEN
        INSERT INTO audit_logs.auth_events (event_type, client_id, realm_name, details) VALUES
        ('KEYCLOAK_STARTUP', 'admin-cli', 'master', '{"message": "Keycloak initialized with PostgreSQL"}'),
        ('REALM_CREATED', 'admin-cli', 'bionicpro', '{"message": "BionicPRO realm created"}');
    END IF;
END $$;

"""
Configuration settings for BionicPRO Auth Service
"""
import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # Keycloak Configuration
    keycloak_url: str = "http://keycloak:8080"  # Internal Docker URL for server-to-server
    keycloak_public_url: str = "http://localhost:8080"  # Public URL for browser redirects
    keycloak_realm: str = "bionicpro"
    keycloak_client_id: str = "bionicpro-web-shop"
    keycloak_client_secret: str = ""
    
    # Redis Configuration
    redis_url: str = "redis://redis:6379/0"
    
    # Security Configuration
    session_secret_key: str = "bionicpro-super-secret-key-change-in-production"
    session_cookie_name: str = "bionicpro_session"
    session_max_age: int = 3600  # 1 hour
    
    # CORS Configuration  
    cors_origins: List[str] = ["http://localhost:3000", "http://frontend:3000"]
    
    # Application Configuration
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = True
    
    class Config:
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()

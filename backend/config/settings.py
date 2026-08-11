from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # API Keys
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    
    # AI Provider: 'gemini' or 'openai'
    ai_provider: str = "gemini"
    
    # Kubeconfig file path
    kubeconfig: Optional[str] = None

    # Namespaces treated as "system" and hidden from the UI by default.
    system_namespaces: list = [
        "kube-system",
        "kube-public",
        "kube-node-lease",
        "local-path-storage",
    ]
    
    # Server configuration
    environment: str = "development"
    port: int = 3457
    host: str = "0.0.0.0"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

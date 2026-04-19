from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    MONGO_URI: str
    DB_NAME: str = "scdews"

    NEWS_API_KEY: str | None = None
    WEATHER_API_KEY: str | None = None
    AUTO_REFRESH_ENABLED: bool = True
    AUTO_REFRESH_ON_STARTUP: bool = True
    AUTO_REFRESH_INTERVAL_SECONDS: int = 900
    NEWS_REFRESH_INTERVAL_SECONDS: int = 1800
    WEATHER_REFRESH_INTERVAL_SECONDS: int = 1800

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()

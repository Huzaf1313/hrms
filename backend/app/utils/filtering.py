def build_filter(filters: dict) -> dict:
    return {
        key: value
        for key, value in filters.items()
        if value is not None
    }
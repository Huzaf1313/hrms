from datetime import date

# Saturday and Sunday are predefined weekly offs, so they are never counted
# as leave days.
WEEKEND_WEEKDAYS = frozenset({5, 6})


def is_working_day(value: date) -> bool:
    return value.weekday() not in WEEKEND_WEEKDAYS


def count_working_days(
    start_date: date,
    end_date: date,
) -> int:
    if end_date < start_date:
        return 0

    total = 0

    current = start_date

    while current <= end_date:
        if is_working_day(current):
            total += 1

        current = date.fromordinal(
            current.toordinal() + 1
        )

    return total